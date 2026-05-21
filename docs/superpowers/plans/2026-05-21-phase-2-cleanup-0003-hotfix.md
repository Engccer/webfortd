# Phase 2 Cleanup — 0003 hotfix + production safety 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M3+M4+M5 머지 후 4단계 reviewer가 누적한 carry-over 4건(I-1~I-4)을 한 PR로 묶어 처리 — Phase 3 RAG 진입 전 cleanup. SQL 마이그레이션 1건(트리거 search_path) + TypeScript 코드 3건(batch UPDATE observability, error.message PII 가드, DocumentRow runtime parser).

**Architecture:** 마이그레이션은 idempotent CREATE OR REPLACE 패턴 (0001 set_updated_at + 0002 guard_documents_status_transition 두 함수에 `set search_path = ''` 추가). 코드 변경은 publish-content.ts의 main() 함수 영역 + 신규 parser 헬퍼.

**Tech Stack:** PostgreSQL 17 + plpgsql, Node test runner, @supabase/supabase-js (기존).

---

## 비개발자용 쉬운 설명 (위원장 보고용)

이 PR 머지 후:
1. **DB 트리거가 더 안전해짐** — 0001/0002에 있는 트리거 함수 2개에 `search_path = ''` 가드를 박아 *function hijacking* 공격 표면을 차단. 현재는 안전하지만 supabase advisors가 표준 경고로 잡는 항목.
2. **publish 스크립트가 더 투명해짐** — `npm run kb:publish -- --apply` 실행 후 단순히 "N pages 전환 완료"가 아니라 *어떤 ID가 실제로 transition됐는지* DB read-back으로 확인. partial failure(트리거 raise 등) 발생 시 명확한 진단.
3. **에러 메시지가 더 안전해짐** — `error.message`에 row 데이터가 노출될 수 있는 가능성을 차단. `error.code`(SQLSTATE)와 sanitized description만 우선 노출. DEBUG 모드에서만 full message.
4. **타입 안정성 강화** — Supabase JS의 select 결과를 evaluate하기 전에 `parseDocumentRow` 가드 함수가 shape 검증. 미래 sync 회귀로 데이터 형태가 어긋나면 즉시 catch.

위원장 워크플로 영향: 0건 — 모든 변경은 *내부 보호 레이어*. `npm run kb:publish:dry-run`/`-- --apply` 인터페이스 그대로.

---

## File Structure

| 경로 | 책임 | 신규/수정 |
|------|------|-----------|
| `supabase/migrations/0003_function_search_path_hotfix.sql` | I-1 — 트리거 함수 2건에 `set search_path = ''` 추가 (CREATE OR REPLACE) | 신규 |
| `scripts/publish-content.ts` | I-2 batch UPDATE read-back + I-3 PII 가드 + I-4 runtime parser 통합 | 수정 |
| `scripts/lib/error-format.ts` | I-3 formatSupabaseError helper (error.code 우선, message는 DEBUG만) | 신규 |
| `scripts/lib/parse-document-row.ts` | I-4 `parseDocumentRow(raw: unknown): DocumentRow` shape guard | 신규 |
| `tests/publish-content.test.ts` | I-2/I-3/I-4 단위 테스트 추가 (3~5건) | 수정 |
| `tests/migrations/0002_publish_workflow.test.ts` | I-2 read-back 검증 추가 (1건) | 수정 |

**파일 크기**: 마이그레이션 ~30 lines (두 함수). publish-content.ts 변경은 +50 lines. helper 각 ~30~50 lines.

---

## 설계 결정

### D1. 0003 마이그레이션 = idempotent CREATE OR REPLACE

기존 0001/0002의 함수 DEFINITION을 그대로 두고 *새 정의*를 CREATE OR REPLACE로 덮어쓴다. 트리거 자체(`create trigger ...`)는 함수 reference라 변경 불요.

```sql
-- 0003에 두 함수 모두 SET search_path = '' 추가하여 재정의
create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$ ... $$;

create or replace function guard_documents_status_transition()
returns trigger language plpgsql
set search_path = ''
as $$ ... $$;
```

`auth.role()`은 schema prefix 박혀있어 빈 search_path에서도 작동. now() 같은 built-in은 pg_catalog에 있어 search_path 무관.

### D2. batch UPDATE 후 read-back

`.update({status:'published'}).in('id', ids)` 후, *동일 ids에 대해 select 재조회*해서 status='published'인 row만 실제 전환된 것으로 보고. partial transition(트리거 raise 등으로 일부 row만 success) 검출 가능.

보고서에 두 수치 분리:
- `Pass all gates (intended)`: report.passing.length
- `Transitioned (verified)`: read-back 결과 status='published' 수치

Mismatch 발생 시 stderr에 어떤 ID가 실패했는지 + 가능한 원인.

### D3. error.message PII 가드 — formatSupabaseError helper

```typescript
export function formatSupabaseError(err: {
  code?: string
  message?: string
  details?: string
  hint?: string
}): string {
  const debug = process.env.DEBUG === '1' || process.env.DEBUG === 'true'
  const code = err.code ?? 'unknown'
  if (debug) {
    return `[${code}] ${err.message ?? ''} (details: ${err.details ?? '-'}, hint: ${err.hint ?? '-'})`
  }
  // production 기본: code + sanitized description
  return `[${code}] ${describeKnownCode(code)}`
}

function describeKnownCode(code: string): string {
  const known: Record<string, string> = {
    '42501': 'RLS 정책 거부 (insufficient_privilege)',
    'P0001': '트리거 raise exception (status 전이 등)',
    '23502': 'NOT NULL constraint violation',
    '23503': 'FK constraint violation',
    '23505': 'unique constraint violation',
    '23514': 'CHECK constraint violation',
  }
  return known[code] ?? `(code ${code})`
}
```

publish-content.ts의 console.error 출력은 `formatSupabaseError(err)`를 거침. row 데이터·user_id 등은 *기본적으로 노출 안 함*.

### D4. DocumentRow runtime parser — parseDocumentRow

```typescript
import type { DocumentRow } from '../publish-content'  // or 별도 types 파일

export function parseDocumentRow(raw: unknown): DocumentRow {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('DocumentRow expected object, got ' + typeof raw)
  }
  const r = raw as Record<string, unknown>
  // 필수 필드 존재 + 타입 확인 (id, slug, status는 string; reviewed_by는 array 또는 null)
  if (typeof r.id !== 'string') throw new TypeError('DocumentRow.id missing/non-string')
  if (typeof r.slug !== 'string') throw new TypeError('DocumentRow.slug missing/non-string')
  if (typeof r.status !== 'string') throw new TypeError('DocumentRow.status missing/non-string')
  if (r.reviewed_by !== null && !Array.isArray(r.reviewed_by)) {
    throw new TypeError('DocumentRow.reviewed_by must be string[] | null')
  }
  if (r.embedded_media !== null && !Array.isArray(r.embedded_media)) {
    throw new TypeError('DocumentRow.embedded_media must be unknown[] | null')
  }
  // source, accessibility은 object 또는 null (jsonb)
  if (r.source !== null && (typeof r.source !== 'object' || Array.isArray(r.source))) {
    throw new TypeError('DocumentRow.source must be Record | null')
  }
  if (r.accessibility !== null && (typeof r.accessibility !== 'object' || Array.isArray(r.accessibility))) {
    throw new TypeError('DocumentRow.accessibility must be Record | null')
  }
  return r as DocumentRow
}
```

main()의 select 결과를 `docs.map(parseDocumentRow)` 거친 후 evaluateGuards에 전달. 비정상 shape 즉시 TypeError → script exit.

### D5. 단일 PR + 단일 plan

4건 carry-over를 분리하지 않고 한 PR로 묶어 cleanup 작업의 일관성 유지. PR 본문에 4건 모두 명시.

### D6. Phase 3 진입 전 cleanup 마감 — codex-rescue 재실행은 별도 task

이 plan 완료 후 별도 codex-rescue 재실행 (M3+M4+M5+0003 누적 검토). 결과 반영 후 Phase 3 RAG plan 작성.

---

## Task 1: 0003 마이그레이션 (트리거 search_path 가드)

**Files:**
- Create: `supabase/migrations/0003_function_search_path_hotfix.sql`
- (수정 X): `tests/migrations/0001_init_kb_rls.test.ts`, `tests/migrations/0002_editor_roles_rls.test.ts` — 기존 통합 테스트가 search_path 변경 영향 없이 그대로 PASS

### Step 1.1: 마이그레이션 파일 작성

```sql
-- ============================================================
-- 0003_function_search_path_hotfix.sql
-- Phase 2 Cleanup: 트리거 함수 2건에 search_path = '' 추가
-- function hijacking 방지 (supabase advisor 표준 경고 해소).
-- auth.role(), now() 등 built-in은 schema prefix 또는 pg_catalog 의존이라
-- search_path 변경의 runtime 영향 0.
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function guard_documents_status_transition()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if OLD.status is distinct from NEW.status then
    if coalesce(auth.role(), '') != 'service_role' then
      raise exception 'documents.status 전이는 service_role에서만 허용 (M5 publish 워크플로). 현재 role: %', coalesce(auth.role(), 'null');
    end if;
  end if;
  return NEW;
end;
$$;
```

### Step 1.2: 마이그레이션 적용

```bash
supabase db push
```

### Step 1.3: 회귀 검증

```bash
npm run test:integration 2>&1 | tail -10
```

Expected: 19/19 PASS — 기존 M4/M5 통합 테스트가 search_path 변경 무관하게 통과.

### Step 1.4: commit

```bash
git add supabase/migrations/0003_function_search_path_hotfix.sql
git commit -m "fix(security): 트리거 함수 2건에 search_path = '' 가드 추가

0001 set_updated_at + 0002 guard_documents_status_transition 두 함수가
search_path를 명시하지 않아 function hijacking 잠재 위협 (supabase advisor 표준).
0003 hotfix로 두 함수 모두 CREATE OR REPLACE + SET search_path = '' 적용.

runtime 영향 0: auth.role()/now() 모두 schema prefix or pg_catalog 의존."
```

---

## Task 2: I-3 error.message PII 가드 — formatSupabaseError helper

**Files:**
- Create: `scripts/lib/error-format.ts`
- Modify: `scripts/publish-content.ts` (error 로깅 영역 2~3건)
- Create/Modify: `tests/error-format.test.ts` (신규, 3~4건)

### Step 2.1: helper 작성

`scripts/lib/error-format.ts`:

```typescript
interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

const KNOWN_CODES: Record<string, string> = {
  '42501': 'RLS 정책 거부 (insufficient_privilege)',
  'P0001': '트리거 raise exception (status 전이 등)',
  '23502': 'NOT NULL constraint violation',
  '23503': 'FK constraint violation',
  '23505': 'unique constraint violation',
  '23514': 'CHECK constraint violation',
}

export function formatSupabaseError(err: SupabaseLikeError): string {
  const debug = process.env.DEBUG === '1' || process.env.DEBUG === 'true'
  const code = err.code ?? 'unknown'
  if (debug) {
    return `[${code}] ${err.message ?? ''} (details: ${err.details ?? '-'}, hint: ${err.hint ?? '-'})`
  }
  const desc = KNOWN_CODES[code] ?? `(code ${code})`
  return `[${code}] ${desc}`
}
```

### Step 2.2: publish-content.ts 적용

`main()`의 두 console.error 영역에서 `formatSupabaseError(error)` 사용.

```typescript
import { formatSupabaseError } from './lib/error-format.ts'

// ... main 함수 안에서
if (error) {
  console.error('documents 조회 실패:', formatSupabaseError(error))
  process.exit(1)
}
// ...
if (updErr) {
  console.error('status 전이 실패:', formatSupabaseError(updErr))
  process.exit(1)
}
```

### Step 2.3: 단위 테스트

`tests/error-format.test.ts`:

```typescript
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatSupabaseError } from '../scripts/lib/error-format'

describe('formatSupabaseError', () => {
  test('알려진 code → 한국어 description', () => {
    const out = formatSupabaseError({ code: '42501', message: 'rls failed' })
    assert.match(out, /\[42501\]/)
    assert.match(out, /RLS 정책 거부/)
    assert.doesNotMatch(out, /rls failed/) // message는 default 비노출
  })

  test('알려지지 않은 code → (code XYZ)', () => {
    const out = formatSupabaseError({ code: 'XYZ', message: 'oops' })
    assert.match(out, /\[XYZ\]/)
    assert.match(out, /\(code XYZ\)/)
  })

  test('DEBUG=1 → full message 노출', () => {
    process.env.DEBUG = '1'
    const out = formatSupabaseError({ code: '23505', message: 'duplicate key', details: 'slug=foo', hint: 'use upsert' })
    assert.match(out, /duplicate key/)
    assert.match(out, /slug=foo/)
    assert.match(out, /use upsert/)
    delete process.env.DEBUG
  })

  test('code 누락 → unknown', () => {
    const out = formatSupabaseError({ message: 'no code' })
    assert.match(out, /\[unknown\]/)
  })
})
```

### Step 2.4: 실행 + 회귀

```bash
npm run test -- tests/error-format.test.ts
npm run test
```

Expected: 4 + 116 = 120 unit tests PASS.

### Step 2.5: commit

```bash
git add scripts/lib/error-format.ts scripts/publish-content.ts tests/error-format.test.ts
git commit -m "feat(security): formatSupabaseError helper — error.message PII 가드

publish-content.ts의 console.error 출력에 적용. 기본은 [code] + 한국어 description.
DEBUG=1 환경변수로 full message/details/hint 노출.
4 unit tests + console.error 출력 형식 변경."
```

---

## Task 3: I-4 DocumentRow runtime parser — parseDocumentRow

**Files:**
- Create: `scripts/lib/parse-document-row.ts`
- Modify: `scripts/publish-content.ts` (main()의 select 결과를 parse 거침)
- Modify: `tests/publish-content.test.ts` (parser 단위 테스트 4건 추가)

### Step 3.1: parser 작성

`scripts/lib/parse-document-row.ts`:

```typescript
// 시그니처는 main()이 select하는 컬럼만 cover
export interface DocumentRow {
  id: string
  slug: string
  status: string
  reviewed_by: string[] | null
  source: Record<string, unknown> | null
  embedded_media: unknown[] | null
  accessibility: Record<string, unknown> | null
}

export function parseDocumentRow(raw: unknown): DocumentRow {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('DocumentRow expected object, got ' + typeof raw)
  }
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string') throw new TypeError('DocumentRow.id missing/non-string')
  if (typeof r.slug !== 'string') throw new TypeError('DocumentRow.slug missing/non-string')
  if (typeof r.status !== 'string') throw new TypeError('DocumentRow.status missing/non-string')
  if (r.reviewed_by !== null && !Array.isArray(r.reviewed_by)) {
    throw new TypeError('DocumentRow.reviewed_by must be string[] | null')
  }
  if (r.embedded_media !== null && !Array.isArray(r.embedded_media)) {
    throw new TypeError('DocumentRow.embedded_media must be unknown[] | null')
  }
  if (r.source !== null && (typeof r.source !== 'object' || Array.isArray(r.source))) {
    throw new TypeError('DocumentRow.source must be Record | null')
  }
  if (r.accessibility !== null && (typeof r.accessibility !== 'object' || Array.isArray(r.accessibility))) {
    throw new TypeError('DocumentRow.accessibility must be Record | null')
  }
  return r as DocumentRow
}
```

### Step 3.2: publish-content.ts 적용 + DocumentRow 타입 import 통일

publish-content.ts 상단 import를 helper로 통일:

```typescript
import { parseDocumentRow, type DocumentRow } from './lib/parse-document-row.ts'
```

main()의 select 결과 처리:

```typescript
const docs = (data ?? []).map(parseDocumentRow)
const report = buildReport(docs)
```

### Step 3.3: 단위 테스트 4건

`tests/publish-content.test.ts`에 추가:

```typescript
import { parseDocumentRow } from '../scripts/lib/parse-document-row'

describe('parseDocumentRow', () => {
  test('정상 shape → 그대로 반환', () => {
    const raw = {
      id: 'i', slug: 's', status: 'draft',
      reviewed_by: ['a'], source: { x: 1 },
      embedded_media: [], accessibility: { alt: true },
    }
    const out = parseDocumentRow(raw)
    assert.equal(out.id, 'i')
    assert.deepEqual(out.reviewed_by, ['a'])
  })

  test('null 입력 → TypeError', () => {
    assert.throws(() => parseDocumentRow(null), TypeError)
  })

  test('id missing → TypeError', () => {
    const raw = { slug: 's', status: 'draft', reviewed_by: [], source: null, embedded_media: null, accessibility: null }
    assert.throws(() => parseDocumentRow(raw), /id missing/)
  })

  test('reviewed_by가 string이면 TypeError', () => {
    const raw = { id: 'i', slug: 's', status: 'draft', reviewed_by: 'wrong', source: null, embedded_media: null, accessibility: null }
    assert.throws(() => parseDocumentRow(raw), /reviewed_by/)
  })
})
```

### Step 3.4: 실행 + 회귀

```bash
npm run test
```

Expected: 120 + 4 = 124 unit tests PASS.

### Step 3.5: commit

```bash
git add scripts/lib/parse-document-row.ts scripts/publish-content.ts tests/publish-content.test.ts
git commit -m "feat(safety): parseDocumentRow runtime parser — Supabase JS select 결과 shape 검증

main()의 select → parseDocumentRow → evaluateGuards 경로. 비정상 shape 즉시 TypeError.
DocumentRow 타입 정의를 publish-content.ts에서 lib/parse-document-row.ts로 이동.
4 unit tests."
```

---

## Task 4: I-2 batch UPDATE read-back observability

**Files:**
- Modify: `scripts/publish-content.ts` (main()의 apply 분기 + formatReport)
- Modify: `tests/migrations/0002_publish_workflow.test.ts` (read-back 검증 1건 추가)

### Step 4.1: publish-content.ts main() apply 분기에서 read-back

```typescript
if (apply && report.passing.length > 0) {
  const ids = report.passing.map(p => p.id)
  const { error: updErr } = await client
    .from('documents')
    .update({ status: 'published' })
    .in('id', ids)
  if (updErr) {
    console.error('status 전이 실패:', formatSupabaseError(updErr))
    process.exit(1)
  }

  // read-back: 실제 전환된 row 확인
  const { data: verified, error: vErr } = await client
    .from('documents')
    .select('id, slug, status')
    .in('id', ids)
  if (vErr) {
    console.error('read-back 실패:', formatSupabaseError(vErr))
    process.exit(1)
  }
  const transitioned = (verified ?? []).filter(v => v.status === 'published')
  const stale = (verified ?? []).filter(v => v.status !== 'published')

  if (stale.length > 0) {
    console.error(`경고: ${stale.length}개 row가 read-back에서 published 아님:`)
    for (const s of stale) console.error(`  - id=${s.id} slug=${s.slug} status=${s.status}`)
  }

  // formatReport에 verified count 전달
  console.log(formatReportWithVerify(report, transitioned.length, stale.length))
  return
}

console.log(formatReport(report, false))
```

새 formatReport variant:

```typescript
export function formatReportWithVerify(
  report: Report,
  verifiedCount: number,
  staleCount: number,
): string {
  const base = formatReport(report, true) // applied=true header
  const lines = base.split('\n')
  // Action 라인 직전에 verify 정보 삽입
  const actionIdx = lines.findIndex(l => l.startsWith('Action:'))
  lines.splice(actionIdx, 0, `Verified transitioned:                    ${verifiedCount}`)
  if (staleCount > 0) {
    lines.splice(actionIdx + 1, 0, `Stale (transition failed):               ${staleCount}`)
  }
  return lines.join('\n')
}
```

### Step 4.2: 통합 테스트 read-back 검증 1건 추가

`tests/migrations/0002_publish_workflow.test.ts`에 추가:

```typescript
test('apply 후 read-back으로 status=published 검증', async () => {
  // 위 'service_role로 status draft → published 전환 성공' 테스트 이후
  // ids[0]가 published. 같은 fixture를 .in('id', [ids[0]])로 재조회.
  const { data } = await admin.from('documents')
    .select('id, slug, status')
    .in('id', [ids[0]])
  assert.ok(data)
  assert.equal(data?.length, 1)
  assert.equal(data?.[0].status, 'published')
})
```

(기존 3 tests 그대로 + 새 1건 → 통합 테스트 20 total)

### Step 4.3: 실행 + 회귀

```bash
npm run test:integration
npm run test
```

Expected:
- integration: 19 + 1 = 20 PASS
- unit: 124 PASS

### Step 4.4: commit

```bash
git add scripts/publish-content.ts tests/migrations/0002_publish_workflow.test.ts
git commit -m "feat(observability): publish apply 후 read-back 검증 + 보고서에 verified/stale 표시

batch UPDATE 후 .in('id', ids) 재조회로 실제 transition된 row count 확인.
Stale 발견 시 stderr에 id/slug/status 상세 + 보고서 Stale 카운트 노출.
formatReportWithVerify variant 추가. 통합 테스트 1건 추가 (read-back 검증)."
```

---

## Task 5: PR + 메모리/CLAUDE.md 갱신

### Step 5.1: 위원장 dry-run 안내 (선택)

PR 머지 직전 dry-run으로 production 영향 0 확인:

```bash
npm run kb:publish:dry-run  # baseline 535/8/527 유지 확인
npm run test                # 124 PASS
npm run test:integration    # 20 PASS
```

### Step 5.2: TTS 요약

### Step 5.3: 메모리 갱신

- `~/.claude/projects/.../memory/project_phase_status.md` — Phase 2 Cleanup 섹션 추가
- `~/.claude/projects/.../memory/MEMORY.md` — Quick Reference
- `webfortd/CLAUDE.md` — 변경 이력 + Phase 2 표 status "완료" 명시

### Step 5.4: push + PR

```bash
git push -u origin phase-2-cleanup-0003-hotfix
gh pr create --title "Phase 2 Cleanup: 0003 hotfix + production safety 강화" --body "..."
```

PR body에 4개 항목별 변경 명시.

### Step 5.5: 위원장 머지 의사 확인

---

## Branch Strategy

```bash
git checkout master && git pull
git checkout -b phase-2-cleanup-0003-hotfix
```

---

## 후속 plan 예고

| 단계 | 범위 |
|------|------|
| codex-rescue 재실행 | M3+M4+M5+0003 누적 cross-cutting invariant 검토 |
| Phase 3 plan | 임베딩 파이프라인 + RAG 챗봇 + AI Elements 채팅 UI |

---

## Self-Review

- [x] carry-over 4건 모두 task에 박힘 (I-1 Task 1, I-3 Task 2, I-4 Task 3, I-2 Task 4)
- [x] 각 task에 단위/통합 테스트 추가 (TDD 흐름)
- [x] 비개발자 설명 (위원장 보고용)
- [x] 마이그레이션 idempotent (CREATE OR REPLACE)
- [x] DocumentRow 타입 단일 source — 이동 후 publish-content.ts/publish-content.test.ts/0002_publish_workflow.test.ts 모두 통일
- [x] PII 가드 helper가 환경변수(DEBUG)로 toggle — production 기본 안전, dev DEBUG에서 full

---

## Plan 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-21 | 초기 작성 — Phase 2 cleanup (carry-over 4건 묶음), Phase 3 진입 전 |
