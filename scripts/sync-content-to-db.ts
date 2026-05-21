/**
 * webfortd Phase 2 M2 — 빌드 인덱스 → Supabase 동기화 스크립트
 *
 * scripts/sync-content.ts가 생성한 kb-index.generated.json + 마크다운 정본을 입력으로
 * 받아 documents/wiki_backlinks 테이블을 idempotent 동기화한다.
 *
 * 본 파일은 *Task 2 범위*만 포함한다:
 *   - transformDocumentRow (frontmatter → row 객체)
 *   - loadBody (frontmatter 분리 후 본문 로딩)
 *   - extractWikiLinks / extractEmbeddedMedia (module-private 헬퍼)
 *
 * 후속 Task에서 upsert / backlinks sync / CLI main이 추가된다.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { KBDocumentSummary } from '@/lib/kb'
import kbIndex from '@/lib/kb-index.generated.json'

/**
 * .env.local을 직접 파싱해서 *기존 env 변수를 덮어쓴다*.
 *
 * **왜 `node --env-file=.env.local`로 충분하지 않은가**:
 * Node의 `--env-file`은 이미 process.env에 존재하는 키를 *덮어쓰지 않는다*.
 * 다중 프로젝트를 다루는 사용자 환경에서 `~/.zshrc`에 다른 프로젝트의
 * `SUPABASE_SECRET_KEY`가 export되어 있으면 webfortd/.env.local의 정확한
 * 키 대신 shell의 stale 키가 사용되어 "Invalid API key" 401을 받는다.
 *
 * 이 헬퍼는 `.env.local`에 명시된 키를 *우선시*해서 shadowing 사고를 차단.
 * direnv hook이 정상 작동하면 결과는 동일하지만, direnv가 미발동인 컨텍스트
 * (non-interactive shell, 일부 IDE)에서도 안전하게 동작.
 */
function loadDotEnvLocalOverrides(): void {
  const dotenvPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(dotenvPath)) return
  const raw = fs.readFileSync(dotenvPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // 큰따옴표/작은따옴표 stripping (matched pairs만)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

/**
 * Node CLI 환경 전용 admin client.
 *
 * `@/lib/supabase/admin`은 `import 'server-only'`로 Next.js client bundle을
 * 차단하는데, 이 가드는 raw Node 환경(`node --import tsx`)에서도 throw하므로
 * 이 스크립트에서는 import 불가. CLI는 항상 Node 컨텍스트이고 SUPABASE_SECRET_KEY가
 * `.env.local`로만 주입되므로 client bundle 누출 위험이 원천 차단됨.
 *
 * 빌드/Server Component용 admin은 그대로 `@/lib/supabase/admin`이 책임지고,
 * 이 스크립트는 동일 createClient 옵션을 그대로 사용한다.
 */
function createCliAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 미설정')
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const REPO_ROOT = process.cwd()

/**
 * Supabase `documents` 테이블 row 객체 형태.
 *
 * D2: frontmatter의 `references`는 SQL reserved word라 컬럼명 `references_data`로 rename.
 * D1: `status`는 sync 시점에 모두 'draft' 강제 (M5 검수 자동화에서 published 전환).
 */
export interface DocumentRow {
  slug: string
  title: string
  subtitle: string | null
  type: string
  disability_types: string[]
  domains: string[]
  regions: string[]
  year: number
  effective_date: string | null
  source: Record<string, unknown>
  references_data: unknown[]
  status: 'draft' | 'in_review' | 'published' | 'archived' | 'deprecated'
  authors: string[]
  reviewed_by: string[]
  reviewer_notes: string | null
  accessibility: Record<string, unknown>
  content_md: string
  source_path: string
  wiki_links: string[]
  embedded_media: unknown[]
  parent_headings: string[]
  source_origin: string | null
  axis: string
}

/**
 * frontmatter + 본문을 documents 테이블 row 객체로 변환한다.
 *
 * - D1: status는 입력 frontmatter 값을 무시하고 'draft'로 강제.
 * - D2: `references` → `references_data` 컬럼명 rename. row 객체에 `references` 키 *없음*.
 */
export function transformDocumentRow(
  doc: KBDocumentSummary,
  contentMd: string,
): DocumentRow {
  const fm = doc.frontmatter
  return {
    slug: doc.slug,
    title: fm.title,
    subtitle: fm.subtitle ?? null,
    type: fm.type,
    disability_types: fm.disability_types ?? [],
    domains: fm.domains ?? [],
    regions: fm.regions ?? [],
    year: fm.year,
    effective_date: fm.effective_date ?? null,
    source: fm.source as Record<string, unknown>,
    references_data: (fm.references ?? []) as unknown[],
    status: 'draft', // D1
    authors: fm.authors ?? [],
    reviewed_by: fm.reviewed_by ?? [],
    reviewer_notes: fm.reviewer_notes ?? null,
    accessibility: fm.accessibility as Record<string, unknown>,
    content_md: contentMd,
    source_path: doc.filePath,
    wiki_links: extractWikiLinks(contentMd),
    embedded_media: extractEmbeddedMedia(contentMd),
    parent_headings: fm.parent_headings ?? [],
    source_origin: fm.source_origin ?? null,
    axis: doc.axis,
  }
}

// ---------- module-private 헬퍼 ----------

const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

function extractWikiLinks(markdown: string): string[] {
  const slugs = new Set<string>()
  for (const m of markdown.matchAll(WIKI_LINK_RE)) {
    slugs.add(m[1].trim())
  }
  return [...slugs]
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g

function extractEmbeddedMedia(markdown: string): unknown[] {
  const media: unknown[] = []
  for (const m of markdown.matchAll(IMAGE_RE)) {
    media.push({ alt: m[1], url: m[2], caption: m[3] ?? null })
  }
  return media
}

// ---------- 본문 로딩 ----------

/**
 * 마크다운 정본 파일에서 frontmatter를 제외한 본문 영역을 로딩한다.
 * filePath는 저장소 루트 기준 상대 경로(예: `content/agreements/test.md`).
 */
export function loadBody(filePath: string): string {
  const full = path.join(REPO_ROOT, filePath)
  const raw = fs.readFileSync(full, 'utf8')
  const { content } = matter(raw)
  return content
}

// ---------- documents batch upsert ----------

export interface UpsertOptions {
  batchSize?: number
  onProgress?: (done: number, total: number) => void
}

export async function upsertDocuments(
  client: SupabaseClient,
  rows: DocumentRow[],
  opts: UpsertOptions = {},
): Promise<{ totalUpserted: number }> {
  const batchSize = opts.batchSize ?? 50
  let done = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    const { error } = await client
      .from('documents')
      .upsert(chunk, { onConflict: 'slug' })
    if (error) {
      throw new Error(
        `documents upsert 실패 (batch ${i / batchSize + 1}, slugs ${chunk.map((r) => r.slug).slice(0, 3).join(', ')}...): ${error.message}`,
      )
    }
    done += chunk.length
    opts.onProgress?.(done, rows.length)
  }
  return { totalUpserted: done }
}

// ---------- wiki_backlinks sync (delete + insert per source) ----------

/**
 * `wiki_backlinks` 테이블 row 객체 형태.
 *
 * D3: `line`은 sync 시점에 채우지 않는다 (`scripts/sync-content.ts`가 valid
 * backlink push 시 line을 omit). 항상 `null` insert. DB 컬럼은 future-reserved.
 */
export interface WikiBacklinkInsert {
  source_doc_id: string
  target_slug: string
  anchor: string | null
  link_text: string | null
  line: number | null
}

export interface SyncBacklinksResult {
  totalInserted: number
  skippedSources: string[]
}

/**
 * 페이지별 wiki_backlinks를 idempotent 동기화한다.
 *
 * D5: source_doc_id별 *기존 row 일괄 삭제 → 신규 insert*. upsert composite key가
 * 없어 unique constraint 활용 불가. "이 페이지의 backlinks를 현재 인덱스 기준
 * 으로 재구성"이라는 의미를 명시.
 *
 * D3: 모든 row의 `line`은 null (sync-content.ts가 line을 미저장).
 *
 * 입력 `bySource`는 *source perspective* (Record<sourceSlug, links[]>).
 * 각 link의 `to` 필드는 target slug (DB 컬럼 `target_slug`와 1:1 매핑).
 * kb-index.generated.json의 `wiki_backlinks`는 target perspective이므로 caller
 * 는 `invertBacklinksToSourcePerspective`로 변환해서 넘겨야 한다.
 *
 * `anchor`/`link_text`는 link에 있으면 *그대로 보존*해서 row에 들어간다 (현재
 * sync-content.ts가 emit하지 않아 항상 null이지만, 미래 변경 시 자동 반영됨 —
 * D1 surrogate PK 결정의 forward-compat 의도).
 */
export async function syncWikiBacklinks(
  client: SupabaseClient,
  bySource: Record<
    string,
    { to: string; anchor?: string; link_text?: string }[]
  >,
  slugToId: Record<string, string>,
): Promise<SyncBacklinksResult> {
  // 1. source_doc_ids 매핑 + 미존재 source 수집
  const sourceIds: string[] = []
  const inserts: WikiBacklinkInsert[] = []
  const skipped: string[] = []

  for (const [sourceSlug, links] of Object.entries(bySource)) {
    const sourceId = slugToId[sourceSlug]
    if (!sourceId) {
      skipped.push(sourceSlug)
      continue
    }
    sourceIds.push(sourceId)
    for (const link of links) {
      inserts.push({
        source_doc_id: sourceId,
        target_slug: link.to,
        anchor: link.anchor ?? null,
        link_text: link.link_text ?? null,
        line: null, // D3
      })
    }
  }

  // 2. 기존 row 일괄 삭제 (D5)
  if (sourceIds.length > 0) {
    const { error: delError } = await client
      .from('wiki_backlinks')
      .delete()
      .in('source_doc_id', sourceIds)
    if (delError) {
      throw new Error(`wiki_backlinks delete 실패: ${delError.message}`)
    }
  }

  // 3. 신규 insert (batch 500)
  if (inserts.length > 0) {
    const batchSize = 500
    for (let i = 0; i < inserts.length; i += batchSize) {
      const chunk = inserts.slice(i, i + batchSize)
      const { error } = await client.from('wiki_backlinks').insert(chunk)
      if (error) {
        throw new Error(`wiki_backlinks insert 실패: ${error.message}`)
      }
    }
  }

  return { totalInserted: inserts.length, skippedSources: skipped }
}

/**
 * kb-index의 wiki_backlinks (target perspective) → source perspective 변환.
 *
 * 입력: `{ 'target-slug': [{ from: 'source-slug', anchor?, link_text? }] }`
 *   - 인덱스의 wiki_backlinks는 "이 target을 가리키는 source 목록"
 *   - inner field `from`은 source slug
 *
 * 출력: `{ 'source-slug': [{ to: 'target-slug', anchor?, link_text? }] }`
 *   - source 페이지가 어떤 target을 가리키는가
 *   - inner field `to`는 target slug (DB column wiki_backlinks.target_slug와 시맨틱 정합)
 *
 * **anchor/link_text/line은 보존**: 현재 sync-content.ts가 valid backlink에 anchor/link_text를
 * emit하지 않지만 (corpus 0건), forward-compat 위해 pass-through. 미래에 sync-content.ts가
 * 변경되면 자동 반영됨 (D1 surrogate PK 결정과 정합).
 */
export function invertBacklinksToSourcePerspective(
  byTarget: Record<
    string,
    { from: string; anchor?: string; link_text?: string }[]
  >,
): Record<
  string,
  { to: string; anchor?: string; link_text?: string }[]
> {
  const bySource: Record<
    string,
    { to: string; anchor?: string; link_text?: string }[]
  > = {}
  for (const [targetSlug, links] of Object.entries(byTarget)) {
    for (const link of links) {
      const sourceSlug = link.from
      if (!bySource[sourceSlug]) bySource[sourceSlug] = []
      bySource[sourceSlug].push({
        to: targetSlug,
        anchor: link.anchor,
        link_text: link.link_text,
      })
    }
  }
  return bySource
}

// ---------- CLI main ----------

interface MainOptions {
  dryRun: boolean
}

/**
 * sync-content-to-db CLI entry.
 *
 * 동작 모드:
 *   - dry-run: kb-index 로드 → 전체 535건 transform → slug 중복 검증 → backlinks invert
 *     까지만 수행하고 종료. DB write 없음.
 *   - normal: dry-run 단계 + admin client로 documents upsert + slug→id fetch +
 *     wiki_backlinks sync(delete+insert per source).
 *
 * 모든 단계는 idempotent. 중간 실패 시 재실행으로 회복 가능.
 *
 * 호출 컨텍스트:
 *   - `npm run kb:sync:dry-run` — dry-run
 *   - `npm run kb:sync` — 실 운영 적용
 *   - 두 script 모두 `node --env-file=.env.local --import tsx` 통해 SUPABASE_SECRET_KEY 주입
 */
async function main(opts: MainOptions): Promise<void> {
  // shadowing 차단: ~/.zshrc 등의 stale export보다 .env.local 우선
  loadDotEnvLocalOverrides()

  const startedAt = Date.now()
  const index = kbIndex as unknown as {
    documents: KBDocumentSummary[]
    wiki_backlinks: Record<
      string,
      { from: string; anchor?: string; link_text?: string }[]
    >
  }
  const { documents, wiki_backlinks } = index

  console.log(
    `[sync] 입력: ${documents.length} documents, ${Object.keys(wiki_backlinks).length} target slugs`,
  )

  // 1. transform (전체)
  const rows: DocumentRow[] = []
  for (const doc of documents) {
    const body = loadBody(doc.filePath)
    rows.push(transformDocumentRow(doc, body))
  }

  // 2. dry-run validation — slug 중복 검증
  const slugCounts: Record<string, number> = {}
  for (const r of rows) slugCounts[r.slug] = (slugCounts[r.slug] ?? 0) + 1
  const duplicates = Object.entries(slugCounts).filter(([, n]) => n > 1)
  if (duplicates.length > 0) {
    throw new Error(
      `slug 중복 ${duplicates.length}건: ${duplicates
        .slice(0, 5)
        .map((d) => d[0])
        .join(', ')}...`,
    )
  }

  if (opts.dryRun) {
    console.log(
      `[sync] DRY-RUN — transform ${rows.length} rows OK. DB write 생략.`,
    )
    const bySourceDry = invertBacklinksToSourcePerspective(wiki_backlinks)
    console.log(
      `[sync] backlinks (source perspective): ${Object.keys(bySourceDry).length} source pages`,
    )
    return
  }

  // 3. admin client + documents upsert (batch 50, 100/50 단위로 progress 로그)
  const client = createCliAdminClient()
  await upsertDocuments(client, rows, {
    batchSize: 50,
    onProgress: (done, total) => {
      if (done % 100 === 0 || done === total) {
        console.log(`[sync] documents ${done}/${total}`)
      }
    },
  })

  // 4. slug → id 매핑 fetch (535건 < Supabase 기본 limit 1000)
  const { data: idRows, error: fetchError } = await client
    .from('documents')
    .select('id, slug')
  if (fetchError) {
    throw new Error(`documents id fetch 실패: ${fetchError.message}`)
  }
  // reviewer I-1: DB에 중복 slug가 있으면 silent drop 방지 (UNIQUE constraint로 거의 불가능하지만 belt-and-suspenders)
  const slugToId: Record<string, string> = {}
  for (const r of idRows ?? []) {
    const slug = r.slug as string
    if (slugToId[slug]) {
      throw new Error(
        `DB에 중복 slug 발견: ${slug} (id ${slugToId[slug]}, ${r.id}). documents 테이블 UNIQUE 제약 확인 필요.`,
      )
    }
    slugToId[slug] = r.id as string
  }

  // 5. backlinks invert + sync
  const bySource = invertBacklinksToSourcePerspective(wiki_backlinks)
  const backlinksResult = await syncWikiBacklinks(client, bySource, slugToId)

  console.log(
    `[sync] backlinks inserted: ${backlinksResult.totalInserted}, skipped sources: ${backlinksResult.skippedSources.length}`,
  )
  if (backlinksResult.skippedSources.length > 0) {
    console.warn(
      `[sync] skipped sources sample: ${backlinksResult.skippedSources.slice(0, 5).join(', ')}`,
    )
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(
    `[sync] 완료 (${elapsed}s) — documents ${rows.length}, backlinks ${backlinksResult.totalInserted}`,
  )
}

// Run if invoked directly (tsx ESM 환경: import.meta.url과 process.argv[1] 비교).
// fileURLToPath로 양쪽 정규화해서 file:// scheme/encoding 차이를 흡수.
const invokedPath = process.argv[1]
  ? fileURLToPath(new URL(`file://${process.argv[1]}`))
  : ''
const modulePath = fileURLToPath(import.meta.url)
if (invokedPath === modulePath) {
  const dryRun = process.argv.includes('--dry-run')
  main({ dryRun }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
