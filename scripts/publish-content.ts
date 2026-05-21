/**
 * webfortd Phase 2 M5 — draft → published 검수 자동화 스크립트
 *
 * documents.status가 'draft' 또는 'in_review'인 페이지 중에서 검수 게이트 3개를
 * 통과한 페이지를 service_role로 일괄 'published' 전환한다.
 *
 * 가드 3개 (모두 AND 평가):
 *   1. reviewed_by — frontmatter에 검수자 이름이 1명 이상 박혀 있어야 함
 *   2. source — frontmatter에 출처 정보가 비어있지 않아야 함
 *   3. accessibility — embedded_media가 있는 경우 alt_text_complete=true 필수
 *
 * 동작 모드:
 *   - dry-run (기본): 가드 평가 + 보고서 출력만, DB UPDATE 없음
 *   - apply (`--apply` 플래그): 통과 페이지 일괄 status='published' 전환
 *
 * M4 status 전이 트리거(`guard_documents_status_transition`)가 service_role 외
 * 모든 호출을 차단하므로 이 스크립트는 service_role 키 (`SUPABASE_SECRET_KEY`)로
 * 작동해야 한다. anon/authenticated로는 status UPDATE가 항상 raise exception.
 *
 * 호출 컨텍스트:
 *   - `npm run kb:publish:dry-run` — 보고서만 출력
 *   - `npm run kb:publish -- --apply` — 실제 전환
 *
 * `sync-content-to-db.ts`의 D1 invariant(status는 sync 시점에 무조건 'draft'
 * 강제)와 정합 — 마크다운 정본 수정 → sync → draft 회귀 → publish 재실행이
 * 표준 흐름.
 */

import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// `.env.local` shadowing 차단 helper — 단일 source of truth는 scripts/lib/env-loader.ts.
// Node `--env-file`은 기존 env를 덮어쓰지 않음. ~/.zshrc의 stale SUPABASE_SECRET_KEY가
// shadowing되면 "Invalid API key" 401. 이 helper가 .env.local 값을 우선시.
import { loadDotEnvLocalOverrides } from './lib/env-loader.ts'

// ---------- types ----------

// DocumentRow 정의 + runtime parser는 scripts/lib/parse-document-row.ts에 단일 source.
// publish-content.ts는 backward-compat re-export로 기존 tests의 import path 유지.
import { parseDocumentRow, type DocumentRow } from './lib/parse-document-row.ts'
import { formatSupabaseError } from './lib/error-format.ts'
export type { DocumentRow }

export interface GuardResult {
  passed: boolean
  failures: string[]
}

// ---------- guards ----------

/**
 * 한 페이지(documents row)에 가드 3개를 AND 평가한다.
 *
 * 실패 메시지는 보고서의 breakdown 키로 사용되므로 *짧고 일관된 한국어 라벨*
 * 사용 (예: 'reviewed_by 누락', 'source 누락', 'alt_text_complete (이미지 alt
 * 미완료)'). 변경 시 단위 테스트(Task 3) 영향 확인.
 */
export function evaluateGuards(doc: DocumentRow): GuardResult {
  const failures: string[] = []

  // 1. reviewed_by — 1명 이상 박혀 있어야 함
  if (!doc.reviewed_by || doc.reviewed_by.length === 0) {
    failures.push('reviewed_by 누락')
  }

  // 2. source — 빈 객체/null 차단
  if (!doc.source || Object.keys(doc.source).length === 0) {
    failures.push('source 누락')
  }

  // 3. accessibility — embedded_media가 있으면 alt_text_complete=true 필수
  const hasMedia =
    Array.isArray(doc.embedded_media) && doc.embedded_media.length > 0
  if (hasMedia) {
    // accessibility는 Record<string, unknown> | null. narrowing 후 boolean 비교.
    const altComplete = doc.accessibility?.alt_text_complete === true
    if (!altComplete) {
      failures.push('alt_text_complete (이미지 alt 미완료)')
    }
  }

  return { passed: failures.length === 0, failures }
}

// ---------- report ----------

export interface Report {
  total: number
  passing: { id: string; slug: string }[]
  blocked: { id: string; slug: string; failures: string[] }[]
}

/**
 * 후보 docs 전체에 evaluateGuards를 돌려서 passing/blocked 분리한다.
 * 입력 docs는 status='draft' 또는 'in_review'만 들어와야 함 (caller가 보장).
 */
export function buildReport(docs: DocumentRow[]): Report {
  const passing: Report['passing'] = []
  const blocked: Report['blocked'] = []
  for (const d of docs) {
    const r = evaluateGuards(d)
    if (r.passed) {
      passing.push({ id: d.id, slug: d.slug })
    } else {
      blocked.push({ id: d.id, slug: d.slug, failures: r.failures })
    }
  }
  return { total: docs.length, passing, blocked }
}

/**
 * Report를 사용자(위원장) 친화적 텍스트 보고서로 포맷한다.
 *
 * - 총계 (candidate / passing / blocked)
 * - blocked breakdown — 단일 게이트 실패는 게이트명, 복수 실패는 '복수 게이트 실패'로 묶음
 * - blocked 샘플 최대 10건 (slug + failures)
 * - applied=true: 전환 완료 메시지, applied=false: dry-run 안내
 */
export function formatReport(report: Report, applied: boolean): string {
  const lines: string[] = []
  const mode = applied ? 'APPLY (status 전이 실제 수행)' : 'DRY-RUN (변경 없음)'
  lines.push('========================================')
  lines.push(`Publish workflow report (${new Date().toISOString()})`)
  lines.push(`Mode: ${mode}`)
  lines.push('========================================')
  lines.push(`Total candidate pages (draft/in_review): ${report.total}`)
  lines.push(`Pass all gates:                          ${report.passing.length}`)
  lines.push(`Blocked:                                 ${report.blocked.length}`)
  lines.push('')

  const breakdown: Record<string, number> = {}
  for (const b of report.blocked) {
    const key = b.failures.length > 1 ? '복수 게이트 실패' : b.failures[0]
    breakdown[key] = (breakdown[key] ?? 0) + 1
  }
  if (Object.keys(breakdown).length > 0) {
    lines.push('Blocked breakdown:')
    for (const [k, v] of Object.entries(breakdown)) {
      lines.push(`  - ${k}: ${v}`)
    }
    lines.push('')
  }

  if (report.blocked.length > 0) {
    lines.push('Sample blocked pages (max 10):')
    for (const b of report.blocked.slice(0, 10)) {
      lines.push(`  - slug: ${b.slug}  | reason: ${b.failures.join(', ')}`)
    }
    lines.push('')
  }

  if (applied) {
    lines.push(
      `Action: ${report.passing.length} pages 전환 완료 (status='published')`,
    )
  } else {
    lines.push(
      `Action: dry-run 종료. 실제 전환은 npm run kb:publish -- --apply`,
    )
  }
  return lines.join('\n')
}

// formatReport의 apply variant: read-back 검증 결과(transitioned/stale)를 보고서에 노출.
// batch UPDATE 후 .in('id', ids) 재조회로 실제 status='published' 수치 확인 → mismatch
// 발생 시 stale 카운트로 visibility 보장. publish-content.ts의 main()에서만 사용.
export function formatReportWithVerify(
  report: Report,
  verifiedCount: number,
  staleCount: number,
): string {
  const base = formatReport(report, true)
  const lines = base.split('\n')
  const actionIdx = lines.findIndex((l) => l.startsWith('Action:'))
  if (actionIdx < 0) return base
  lines.splice(
    actionIdx,
    0,
    `Verified transitioned (read-back):       ${verifiedCount}`,
  )
  if (staleCount > 0) {
    lines.splice(
      actionIdx + 1,
      0,
      `Stale (UPDATE 후 published 아님):        ${staleCount}`,
    )
  }
  return lines.join('\n')
}

// ---------- CLI main ----------

/**
 * CLI 진입점. argv 파싱 + Supabase service_role client 생성 + draft/in_review
 * 후보 조회 + 보고서 생성 + (apply 모드 시) status UPDATE.
 *
 * 에러 처리:
 *   - SUPABASE 환경변수 누락 → exit(1)
 *   - documents 조회 실패 → exit(1)
 *   - status UPDATE 실패 → exit(1) (이 경우 부분 적용 가능성 있으나
 *     UPDATE는 단일 .in(ids) 호출이라 transactional)
 */
async function main(): Promise<void> {
  // 1. shadowing 차단: ~/.zshrc 등의 stale export보다 .env.local 우선
  loadDotEnvLocalOverrides()

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY
  if (!SUPABASE_URL || !SECRET_KEY) {
    console.error(
      'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY 환경변수 필요 ' +
        '(.env.local 또는 direnv hook 확인)',
    )
    process.exit(1)
  }

  // 2. argv 파싱 — exact match ('--apply'만 통과, '--apply-foo' 등은 X)
  //    --dry-run이 명시되면 --apply가 함께 있어도 무조건 dry-run (safety override).
  //    C1 fix: npm run kb:publish:dry-run -- --apply 같은 실수 패턴이 production 변경을 일으키지 않도록.
  const dryRunFlag = process.argv.includes('--dry-run')
  const applyFlag = process.argv.includes('--apply')
  const apply = applyFlag && !dryRunFlag

  // 3. service_role client (M4 트리거 통과를 위해 필수)
  const client: SupabaseClient = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 4. draft 또는 in_review 후보 페이지 조회
  // PostgREST 기본 1000 row cap을 회피하기 위해 .range(0, 9999) 명시.
  // M2 carry-over 패턴과 정합.
  const { data: docs, error: fetchError } = await client
    .from('documents')
    .select('id, slug, status, reviewed_by, source, embedded_media, accessibility')
    .in('status', ['draft', 'in_review'])
    .range(0, 9999)

  if (fetchError) {
    console.error('documents 조회 실패:', formatSupabaseError(fetchError))
    process.exit(1)
  }
  if (!docs) {
    console.error('documents 조회 결과 null (예상치 못한 응답)')
    process.exit(1)
  }

  // 5. runtime parser로 shape 검증 → fail-fast (Supabase JS 결과의 silent type drift 차단)
  const parsed: DocumentRow[] = (docs as unknown[]).map(parseDocumentRow)
  const report = buildReport(parsed)

  // 6. apply 모드 + 통과 페이지 있으면 UPDATE + read-back 검증
  if (apply && report.passing.length > 0) {
    const ids = report.passing.map((p) => p.id)
    const { error: updateError } = await client
      .from('documents')
      .update({ status: 'published' })
      .in('id', ids)
    if (updateError) {
      console.error('status 전이 실패:', formatSupabaseError(updateError))
      process.exit(1)
    }

    // read-back: 실제 transition된 row 검증 (partial failure observability)
    const { data: verified, error: verifyError } = await client
      .from('documents')
      .select('id, slug, status')
      .in('id', ids)
    if (verifyError) {
      console.error('read-back 실패:', formatSupabaseError(verifyError))
      process.exit(1)
    }
    const verifiedRows = verified ?? []
    const transitioned = verifiedRows.filter((v) => v.status === 'published')
    const stale = verifiedRows.filter((v) => v.status !== 'published')

    if (stale.length > 0) {
      console.error(
        `경고: ${stale.length}개 row가 read-back에서 published 아님 (intended ${ids.length}):`,
      )
      for (const s of stale) {
        console.error(`  - id=${s.id} slug=${s.slug} status=${s.status}`)
      }
    }

    console.log(formatReportWithVerify(report, transitioned.length, stale.length))
    return
  }

  // 7. dry-run 또는 apply지만 통과 0건 — 단순 보고서 출력
  console.log(formatReport(report, apply))
}

// ESM 환경(`node --import tsx`)에서 직접 호출 시에만 main 실행.
// fileURLToPath로 양쪽 정규화해서 file:// scheme/encoding 차이를 흡수.
// 단위 테스트가 이 파일을 import할 때는 main이 자동 실행되지 않아야 함.
const invokedPath = process.argv[1]
  ? fileURLToPath(new URL(`file://${process.argv[1]}`))
  : ''
const modulePath = fileURLToPath(import.meta.url)
if (invokedPath === modulePath) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
