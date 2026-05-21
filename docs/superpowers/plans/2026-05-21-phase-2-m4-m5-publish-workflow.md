# Phase 2 M4+M5 — Editor Roles + Write RLS + 검수 자동화 (draft→published) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) `editor_roles` 테이블 + write RLS + status 전이 트리거를 도입해 *권한 계층*을 박는다. (2) `npm run kb:publish` 스크립트로 draft → published 검수 자동화 워크플로를 자동화한다. 끝나면 위원장이 reviewed_by/접근성/출처 게이트를 통과한 페이지를 일괄 published로 전환할 수 있다.

**Architecture:** M4는 *권한 인프라* — Supabase RLS + Postgres 트리거로 status 컬럼 보호. M5는 *검수 자동화* — service role을 사용한 Node TypeScript 스크립트로 가드 로직(reviewed_by, accessibility, source) 평가 + dry-run/report/apply 3-mode 제공. M5는 M4의 status 전이 트리거를 신뢰해 service role 외 우회 경로 차단.

**Tech Stack:** PostgreSQL 17(Supabase) + RLS + plpgsql 트리거, Node test runner(`node:test`), `@supabase/supabase-js@^2.106`, `tsx`로 스크립트 실행.

---

## 비개발자용 쉬운 설명 (위원장 보고용)

이 작업이 끝나면 무엇이 달라지나:

1. **535개 페이지의 검수→공개 전환을 자동화한다.** 지금은 전부 *draft* 상태라 일반 방문자에게 안 보이는데, 마크다운 frontmatter의 `reviewed_by`(검수자 이름)·`accessibility.alt_text_complete`(이미지 alt text 완료 여부)·`source`(출처) 세 조건을 통과한 페이지만 자동으로 *published*로 올린다.
2. **위원장은 `npm run kb:publish:dry-run`을 먼저 실행** — 결과 보고서 출력. "오늘 N개 페이지 통과, M개 페이지가 어떤 게이트에서 막혔는지" 확인 가능. 실제 전환은 명시적으로 `--apply` 플래그 줘야 진행 (예방적).
3. **권한 계층이 박힌다** — 미래에 검수자(편집자)를 늘려도 RLS가 자동으로 *누가 무엇을 수정할 수 있나*를 보호. M4 시점엔 검수자 0명 (위원장 단독 service role 사용), 멤버 추가는 향후 마일스톤에서 결정.
4. **status 컬럼은 절대 임의 변경 불가** — Postgres 트리거가 service role 외에는 status 변경 차단. 누군가 인증 후 본문 수정해도 `draft`를 `published`로 바꿀 수 없음.
5. **위원장 워크플로 변경**: 마크다운 frontmatter에 `reviewed_by: ['김헌용']` 같은 식으로 검수 도장 찍은 후 `npm run kb:sync && npm run kb:publish:dry-run` → 통과 페이지 확인 → `npm run kb:publish --apply`. 옵시디언/Claude Code에서 frontmatter 편집이 곧 검수 액션이 된다.

왜 한 plan으로 묶나? → M5의 publish 스크립트가 M4의 status 트리거를 신뢰해 가드 우회를 차단한다. M4 머지만 하면 사용자 가시 가치 0(권한 인프라뿐), M5 단독은 트리거 없이 status 무방어. 두 마일스톤은 짝.

---

## File Structure

| 경로 | 책임 | 신규/수정 |
|------|------|-----------|
| `supabase/migrations/0002_editor_roles_and_publish.sql` | editor_roles 테이블 + write RLS + status 전이 트리거 | 신규 |
| `scripts/publish-content.ts` | publish 워크플로 (가드 평가 + dry-run/report/apply 3-mode) | 신규 |
| `tests/migrations/0002_editor_roles_rls.test.ts` | RLS round-trip 통합 테스트 (anon X / authenticated 부분 write / service role status 전이) | 신규 |
| `tests/publish-content.test.ts` | 가드 로직 단위 테스트 (mocked Supabase) | 신규 |
| `tests/migrations/0002_publish_workflow.test.ts` | 통합 테스트 — fixture document 생성 → 가드 평가 → status 전이 검증 | 신규 |
| `package.json` | `kb:publish`, `kb:publish:dry-run` 스크립트 추가 | 수정 |
| `scripts/sync-content-to-db.ts` | (선택) status 강제 정책 주석 보강 — M5 publish 워크플로와 정합 명시 | 수정 |
| `.env.local.example` | (변동 없음 — 기존 SUPABASE_SECRET_KEY 재사용) | — |

**파일 크기**: 마이그레이션 ~120 lines. publish-content.ts ~300 lines. 테스트 각 100~200 lines.

---

## 설계 결정 (M4+M5 시점에 박는 것)

### D1. editor_roles 테이블 = `user_id` PK + role 단일 값

| 컬럼 | 타입 | 의미 |
|------|------|------|
| user_id | uuid PK (FK → auth.users.id ON DELETE CASCADE) | Supabase Auth 사용자 |
| role | text NOT NULL CHECK (role in ('editor')) | M4 시점엔 editor만. 향후 reviewer/admin 추가 검토 |
| granted_at | timestamptz NOT NULL DEFAULT now() | 부여 시각 |
| granted_by | uuid (FK → auth.users.id) NULL | 부여자 (NULL = 수동 시드) |

한 사용자 = 한 role. composite PK 회피 (한 사용자가 여러 role 갖는 케이스는 M4 시점에 없음, future-proof도 단순한 모델 우선).

### D2. M4 시점 editor 멤버 = 0명

위원장은 *service role*로 모든 작업 수행 (publish 스크립트). editor 부여는 Phase 4 또는 별도 마일스톤에서 위원장 결정 후 dashboard SQL editor로 INSERT.

이유: M4에 멤버 추가하면 그 user_id를 마이그레이션에 박아야 하는데 (1) 위원장 user_id는 M3 로그인 후에야 생성됨 — chicken-and-egg, (2) 마이그레이션 파일에 user_id 박는 건 stylistic noise. 위원장 admin 부여는 *데이터*지 *스키마*가 아니므로 시드로 분리.

### D3. write RLS — documents UPDATE는 editor에게 body/title/etc만 허용, status는 차단

```sql
-- editor가 documents 본문 UPDATE 가능 (status는 트리거가 차단)
create policy "editor write documents"
  on documents for update
  to authenticated
  using (exists (select 1 from editor_roles where user_id = auth.uid()))
  with check (exists (select 1 from editor_roles where user_id = auth.uid()));
```

`USING`은 *어떤 row를 update 가능한가*, `WITH CHECK`는 *update 후 row 상태가 정책을 통과하나*. editor면 모든 documents UPDATE 가능. 단 status 변경은 별도 트리거가 차단.

### D4. status 전이 트리거 — service role 외 차단

```sql
create or replace function guard_documents_status_transition()
returns trigger language plpgsql as $$
begin
  if OLD.status is distinct from NEW.status then
    -- auth.role()이 'service_role'이면 통과, 아니면 차단
    if coalesce(auth.role(), '') != 'service_role' then
      raise exception 'documents.status 전이는 service_role에서만 허용 (M5 publish 워크플로). 현재 role: %', auth.role();
    end if;
  end if;
  return NEW;
end;
$$;

create trigger documents_guard_status_transition
  before update on documents
  for each row execute function guard_documents_status_transition();
```

`auth.role()`은 Supabase가 jwt에서 추출해 session에 주입. service_role 키로 호출 시 `'service_role'` 반환, anon은 `'anon'`, authenticated는 `'authenticated'`.

### D5. M5 publish 가드 — 3개 조건 AND

| 가드 | 조건 | 면제 |
|------|------|------|
| reviewed_by | `array_length(reviewed_by, 1) >= 1` | 없음 (필수) |
| accessibility | `(embedded_media = '[]'::jsonb) OR (accessibility->>'alt_text_complete')::bool = true` | 본문에 이미지/영상 없으면 면제 |
| source | `source IS NOT NULL AND source != '{}'::jsonb` | 없음 (kb-index 통과 시 항상 존재, defensive) |

가드 평가는 *publish 스크립트 코드*에서 수행 (RLS/트리거가 아니라). 이유: 게이트별 fail 리포팅이 필요한데 SQL exception은 단일 row 단위라 batch report 작성 부적합.

스크립트는 service role 키로 SELECT → 가드 평가 → 통과 페이지만 UPDATE status='published'. 트리거는 *우회 방지 안전망* 역할.

### D6. publish 스크립트 = dry-run + report + apply 3-mode

```bash
npm run kb:publish:dry-run    # 가드 평가만, 결과 보고서, status 변경 없음
npm run kb:publish -- --apply # 실제 전환
```

기본 = dry-run (예방적). `--apply` 플래그 명시해야 실제 UPDATE. report는 항상 출력 (dry-run/apply 모두).

### D7. 보고서 포맷

```
========================================
Publish workflow report (2026-05-21 21:42 KST)
========================================
Total draft pages: 535
Pass all gates:    XXX  →  published 전환 후보
Blocked:           YYY

Blocked breakdown:
  - reviewed_by 누락 (검수자 없음):           AAA
  - alt_text_complete (이미지 alt 미완료):    BBB
  - source 누락:                              CCC
  - 복수 게이트 실패:                          DDD

Sample blocked pages (max 10):
  - slug: foo-bar  | reason: reviewed_by 누락
  - slug: baz-qux  | reason: alt_text_complete + reviewed_by 누락
  ...

Action: --apply 미지정 → dry-run 종료. 실제 전환은 npm run kb:publish -- --apply
```

### D8. idempotent

이미 published 상태 페이지는 재전환 시도 X. 스크립트가 status='draft' OR 'in_review'인 페이지만 후보. 반복 실행 안전.

### D9. published 페이지의 마크다운 수정 흐름 (carry-over 정책)

published 페이지의 frontmatter나 본문을 마크다운에서 수정하면 → `npm run kb:sync`가 status='draft' 강제 (M2 D1 invariant) → 다시 검수 후 `npm run kb:publish` 필요. *마크다운이 정본*이라는 webfortd 원칙 정합 — 콘텐츠 변경은 항상 검수 게이트를 재통과해야 함.

이 흐름은 위원장에게 직관적이지만 M5 시점에 *경고*로 명시 (현재 published → 다음 sync 후 draft로 회귀). 향후 *조용한 marginal update*(오타 수정 등)를 published 유지로 처리하고 싶으면 별도 플래그 도입 검토.

### D10. RLS 정책 vs 트리거 — 분리 책임

| 레이어 | 책임 |
|--------|------|
| RLS (`with check`) | row 단위 *권한* 검증 — editor만 documents UPDATE |
| 트리거 (`guard_documents_status_transition`) | *status 컬럼 전이* 검증 — service role만 |

RLS는 컬럼 단위 권한 부족 (Postgres column-level GRANT는 있지만 PostgREST/Supabase가 노출 안 함). 트리거가 컬럼 보호 담당.

---

## Task 1: M4 — 0002 마이그레이션 (editor_roles + write RLS + status 트리거)

**Files:**
- Create: `supabase/migrations/0002_editor_roles_and_publish.sql`

### Step 1.1: 마이그레이션 파일 작성

`supabase/migrations/0002_editor_roles_and_publish.sql`:

```sql
-- ============================================================
-- 0002_editor_roles_and_publish.sql
-- Phase 2 M4+M5: 편집자 권한 + status 전이 보호
-- ============================================================

-- 1. editor_roles 테이블
create table editor_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create index idx_editor_roles_role on editor_roles(role);

alter table editor_roles enable row level security;

-- editor_roles SELECT — 로그인 사용자가 자신의 role 확인 가능
create policy "editor read own role"
  on editor_roles for select
  to authenticated
  using (user_id = auth.uid());

-- editor_roles INSERT/UPDATE/DELETE — service role만 (정책 미정의 = anon/authenticated 차단)

-- 2. documents write RLS — editor만 update
create policy "editor write documents"
  on documents for update
  to authenticated
  using (exists (select 1 from editor_roles where user_id = auth.uid()))
  with check (exists (select 1 from editor_roles where user_id = auth.uid()));

-- 3. status 전이 트리거 — service_role 외 차단
create or replace function guard_documents_status_transition()
returns trigger language plpgsql as $$
begin
  if OLD.status is distinct from NEW.status then
    if coalesce(auth.role(), '') != 'service_role' then
      raise exception 'documents.status 전이는 service_role에서만 허용 (M5 publish 워크플로). 현재 role: %', coalesce(auth.role(), 'null');
    end if;
  end if;
  return NEW;
end;
$$;

create trigger documents_guard_status_transition
  before update on documents
  for each row execute function guard_documents_status_transition();
```

### Step 1.2: 통합 테스트 작성 — RLS round-trip (실패 → 통과)

`tests/migrations/0002_editor_roles_rls.test.ts`:

```typescript
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../helpers/env-loader'

loadDotEnvLocalOverrides()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SECRET_KEY  = process.env.SUPABASE_SECRET_KEY!

describe('0002 editor_roles + write RLS + status 트리거', () => {
  let anon: SupabaseClient
  let admin: SupabaseClient
  let testDocId: string

  before(async () => {
    anon  = createClient(SUPABASE_URL, ANON_KEY)
    admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } })

    // fixture document 생성 (status='draft')
    const { data, error } = await admin.from('documents').insert({
      slug: `m4-test-${Date.now()}`,
      title: 'M4 RLS test',
      type: '기타',
      year: 2026,
      source: { type: 'test' },
      axis: 'agreements',
      status: 'draft',
    }).select('id').single()
    if (error) throw error
    testDocId = data.id
  })

  test('anon은 editor_roles INSERT 차단 (42501)', async () => {
    const { error } = await anon.from('editor_roles').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      role: 'editor',
    })
    assert.ok(error)
    assert.equal(error?.code, '42501')
  })

  test('anon은 documents UPDATE body 차단', async () => {
    const { error } = await anon.from('documents')
      .update({ title: 'hacked' })
      .eq('id', testDocId)
    // RLS가 0 row matched로 표시 (UPDATE 정책 없음 → anon은 0 row 영향)
    // error는 null이지만 row가 변경되지 않음을 admin 재조회로 확인
    const { data } = await admin.from('documents').select('title').eq('id', testDocId).single()
    assert.notEqual(data?.title, 'hacked')
  })

  test('service_role은 status draft → published 전이 성공', async () => {
    const { error } = await admin.from('documents')
      .update({ status: 'published' })
      .eq('id', testDocId)
    assert.equal(error, null)
    const { data } = await admin.from('documents').select('status').eq('id', testDocId).single()
    assert.equal(data?.status, 'published')
  })

  test('cleanup: testDoc 삭제', async () => {
    await admin.from('documents').delete().eq('id', testDocId)
  })
})
```

(env-loader helper는 기존 sync-content-to-db.ts의 `loadDotEnvLocalOverrides` 추출 또는 인라인 재사용)

### Step 1.3: 마이그레이션 적용 (Supabase CLI)

```bash
supabase migration up
# 또는 dashboard SQL editor에 직접 붙여넣기
```

확인:
```bash
supabase db lint  # syntax 검증
```

### Step 1.4: 통합 테스트 실행 → PASS

```bash
npm run test:integration -- tests/migrations/0002_editor_roles_rls.test.ts
```

Expected: 4 tests PASS.

### Step 1.5: 기존 통합 테스트 회귀 (M1/M2 12건)

```bash
npm run test:integration
```

Expected: 12 + 4 = 16 PASS.

### Step 1.6: commit

```bash
git add supabase/migrations/0002_editor_roles_and_publish.sql tests/migrations/0002_editor_roles_rls.test.ts
git commit -m "feat(m4): editor_roles 테이블 + write RLS + status 전이 트리거

editor만 documents body update 가능. status 컬럼 변경은 service_role만 (트리거).
M4 시점 editor 멤버 0명 — 위원장은 service_role로 작업. RLS round-trip 4 tests PASS."
```

---

## Task 2: M5 — publish-content.ts 스크립트

**Files:**
- Create: `scripts/publish-content.ts`
- Modify: `package.json` (`kb:publish`, `kb:publish:dry-run` 스크립트)

### Step 2.1: publish-content.ts 골격

`scripts/publish-content.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ====== env loader (sync-content-to-db.ts와 동일 패턴) ======
function loadDotEnvLocalOverrides() {
  const envPath = join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

loadDotEnvLocalOverrides()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY 필요')
  process.exit(1)
}

// ====== types ======
interface DocumentRow {
  id: string
  slug: string
  status: string
  reviewed_by: string[]
  source: Record<string, unknown> | null
  embedded_media: unknown[]
  accessibility: Record<string, unknown>
}

interface GuardResult {
  passed: boolean
  failures: string[]
}

// ====== guards ======
export function evaluateGuards(doc: DocumentRow): GuardResult {
  const failures: string[] = []

  // 1. reviewed_by
  if (!doc.reviewed_by || doc.reviewed_by.length === 0) {
    failures.push('reviewed_by 누락')
  }

  // 2. source
  if (!doc.source || Object.keys(doc.source).length === 0) {
    failures.push('source 누락')
  }

  // 3. accessibility (embedded_media 있으면 alt_text_complete 필수)
  const hasMedia = Array.isArray(doc.embedded_media) && doc.embedded_media.length > 0
  if (hasMedia) {
    const altComplete = doc.accessibility?.alt_text_complete === true
    if (!altComplete) failures.push('alt_text_complete (이미지 alt 미완료)')
  }

  return { passed: failures.length === 0, failures }
}

// ====== report ======
interface Report {
  total: number
  passing: { id: string; slug: string }[]
  blocked: { id: string; slug: string; failures: string[] }[]
}

export function buildReport(docs: DocumentRow[]): Report {
  const passing: Report['passing'] = []
  const blocked: Report['blocked'] = []
  for (const d of docs) {
    const r = evaluateGuards(d)
    if (r.passed) passing.push({ id: d.id, slug: d.slug })
    else blocked.push({ id: d.id, slug: d.slug, failures: r.failures })
  }
  return { total: docs.length, passing, blocked }
}

export function formatReport(report: Report, applied: boolean): string {
  const lines: string[] = []
  lines.push('========================================')
  lines.push(`Publish workflow report (${new Date().toISOString()})`)
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
  lines.push('Blocked breakdown:')
  for (const [k, v] of Object.entries(breakdown)) {
    lines.push(`  - ${k}: ${v}`)
  }
  lines.push('')

  if (report.blocked.length > 0) {
    lines.push('Sample blocked pages (max 10):')
    for (const b of report.blocked.slice(0, 10)) {
      lines.push(`  - slug: ${b.slug}  | reason: ${b.failures.join(', ')}`)
    }
    lines.push('')
  }

  if (applied) {
    lines.push(`Action: ${report.passing.length} pages 전환 완료 (status='published')`)
  } else {
    lines.push(`Action: dry-run 종료. 실제 전환은 npm run kb:publish -- --apply`)
  }
  return lines.join('\n')
}

// ====== main ======
async function main() {
  const apply = process.argv.includes('--apply')

  const client = createClient(SUPABASE_URL!, SECRET_KEY!, {
    auth: { persistSession: false },
  })

  // draft 또는 in_review 후보 페이지 조회
  const { data: docs, error } = await client
    .from('documents')
    .select('id, slug, status, reviewed_by, source, embedded_media, accessibility')
    .in('status', ['draft', 'in_review'])
    .range(0, 9999)

  if (error) {
    console.error('documents 조회 실패:', error.message)
    process.exit(1)
  }
  if (!docs) {
    console.error('documents null')
    process.exit(1)
  }

  const report = buildReport(docs as DocumentRow[])

  if (apply && report.passing.length > 0) {
    const ids = report.passing.map(p => p.id)
    const { error: updErr } = await client
      .from('documents')
      .update({ status: 'published' })
      .in('id', ids)
    if (updErr) {
      console.error('status 전이 실패:', updErr.message)
      process.exit(1)
    }
  }

  console.log(formatReport(report, apply))
}

if (require.main === module) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
```

### Step 2.2: package.json 스크립트 추가

```json
{
  "scripts": {
    "kb:publish:dry-run": "node --import tsx scripts/publish-content.ts",
    "kb:publish": "node --import tsx scripts/publish-content.ts"
  }
}
```

(apply 플래그는 사용자가 `npm run kb:publish -- --apply`로 전달)

### Step 2.3: dry-run 실행 (실 운영 DB)

```bash
npm run kb:publish:dry-run
```

Expected: 535 candidate pages, **0 passing** (현재 모든 페이지 reviewed_by 비어있을 가능성 높음 — frontmatter에 안 박힘), 535 blocked. 보고서 출력.

이는 정상 — 위원장이 향후 frontmatter에 reviewed_by 채우고 sync 재실행한 뒤 publish하는 흐름의 *baseline*.

### Step 2.4: commit

```bash
git add scripts/publish-content.ts package.json
git commit -m "feat(m5): publish-content.ts — draft → published 검수 자동화 스크립트

가드 3개 (reviewed_by, accessibility, source) + dry-run/apply 2-mode + report 출력.
service_role 사용으로 status 트리거 통과. baseline dry-run: 535 candidate, 0 passing
(reviewed_by 미설정 — 정상 baseline, 향후 frontmatter 검수 도장 후 publish)."
```

---

## Task 3: M5 — 가드 로직 단위 테스트

**Files:**
- Create: `tests/publish-content.test.ts`

### Step 3.1: 단위 테스트 작성

`tests/publish-content.test.ts`:

```typescript
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGuards, buildReport, formatReport } from '../scripts/publish-content'

describe('evaluateGuards', () => {
  const baseDoc = {
    id: 'id-1', slug: 'slug-1', status: 'draft',
    reviewed_by: ['김헌용'],
    source: { type: 'policy', url: 'https://...' },
    embedded_media: [],
    accessibility: { alt_text_complete: false },
  }

  test('모든 게이트 통과 → passed=true', () => {
    const r = evaluateGuards(baseDoc)
    assert.equal(r.passed, true)
    assert.deepEqual(r.failures, [])
  })

  test('reviewed_by 누락 → failures에 포함', () => {
    const r = evaluateGuards({ ...baseDoc, reviewed_by: [] })
    assert.equal(r.passed, false)
    assert.ok(r.failures.some(f => f.includes('reviewed_by')))
  })

  test('source 누락 → failures에 포함', () => {
    const r = evaluateGuards({ ...baseDoc, source: null })
    assert.equal(r.passed, false)
    assert.ok(r.failures.some(f => f.includes('source')))
  })

  test('embedded_media 있고 alt_text_complete=false → failures', () => {
    const r = evaluateGuards({
      ...baseDoc,
      embedded_media: [{ src: '/img.png', alt: 'foo' }],
      accessibility: { alt_text_complete: false },
    })
    assert.equal(r.passed, false)
    assert.ok(r.failures.some(f => f.includes('alt_text_complete')))
  })

  test('embedded_media 있고 alt_text_complete=true → 통과', () => {
    const r = evaluateGuards({
      ...baseDoc,
      embedded_media: [{ src: '/img.png', alt: 'foo' }],
      accessibility: { alt_text_complete: true },
    })
    assert.equal(r.passed, true)
  })

  test('embedded_media 비어 있으면 alt_text_complete 면제', () => {
    const r = evaluateGuards({
      ...baseDoc,
      embedded_media: [],
      accessibility: { alt_text_complete: false },
    })
    assert.equal(r.passed, true)
  })

  test('복수 게이트 fail → failures 배열 길이 >= 2', () => {
    const r = evaluateGuards({
      ...baseDoc,
      reviewed_by: [],
      source: null,
    })
    assert.equal(r.passed, false)
    assert.ok(r.failures.length >= 2)
  })
})

describe('buildReport', () => {
  test('total = docs.length, passing + blocked = total', () => {
    const docs = [
      { id: '1', slug: 's1', status: 'draft', reviewed_by: ['a'], source: { x: 1 }, embedded_media: [], accessibility: {} },
      { id: '2', slug: 's2', status: 'draft', reviewed_by: [],    source: { x: 1 }, embedded_media: [], accessibility: {} },
    ]
    const r = buildReport(docs)
    assert.equal(r.total, 2)
    assert.equal(r.passing.length, 1)
    assert.equal(r.blocked.length, 1)
    assert.equal(r.passing[0].slug, 's1')
    assert.equal(r.blocked[0].slug, 's2')
  })
})

describe('formatReport', () => {
  test('dry-run 메시지 포함', () => {
    const r = { total: 1, passing: [], blocked: [{ id: '1', slug: 's1', failures: ['reviewed_by 누락'] }] }
    const out = formatReport(r, false)
    assert.match(out, /dry-run 종료/)
    assert.match(out, /--apply/)
  })

  test('apply 시 전환 메시지 포함', () => {
    const r = { total: 1, passing: [{ id: '1', slug: 's1' }], blocked: [] }
    const out = formatReport(r, true)
    assert.match(out, /1 pages 전환 완료/)
  })
})
```

### Step 3.2: 실행 → PASS

```bash
npm run test -- tests/publish-content.test.ts
```

Expected: 10 tests PASS.

### Step 3.3: 회귀 (전체 단위 테스트)

```bash
npm run test
```

Expected: 105 + 10 = 115 unit tests PASS.

### Step 3.4: commit

```bash
git add tests/publish-content.test.ts
git commit -m "test(m5): publish-content.ts 가드/report 단위 테스트 10건

evaluateGuards (7) + buildReport (1) + formatReport (2) — 게이트 통과/차단/면제 케이스 + 출력 검증."
```

---

## Task 4: M5 — publish 워크플로 통합 테스트

**Files:**
- Create: `tests/migrations/0002_publish_workflow.test.ts`

목적: 가드 로직과 status 트리거를 *실 DB*에서 end-to-end 검증. fixture document 4개(통과 1 + 차단 3) 생성 → 가드 평가 → 전환 → 트리거 통과 확인.

### Step 4.1: 통합 테스트 작성

`tests/migrations/0002_publish_workflow.test.ts`:

```typescript
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../helpers/env-loader'
import { evaluateGuards } from '../../scripts/publish-content'

loadDotEnvLocalOverrides()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY!

describe('0002 publish workflow — 통합', () => {
  let admin: SupabaseClient
  const fixtures = [
    {
      slug: `m5-pass-${Date.now()}`,
      reviewed_by: ['김헌용'],
      source: { type: 'test' },
      embedded_media: [],
      accessibility: { alt_text_complete: false },
      // expected pass
    },
    {
      slug: `m5-fail-rb-${Date.now()}`,
      reviewed_by: [],
      source: { type: 'test' },
      embedded_media: [],
      accessibility: { alt_text_complete: false },
      // expected fail: reviewed_by
    },
    {
      slug: `m5-fail-alt-${Date.now()}`,
      reviewed_by: ['김헌용'],
      source: { type: 'test' },
      embedded_media: [{ src: '/x.png' }],
      accessibility: { alt_text_complete: false },
      // expected fail: alt_text_complete
    },
    {
      slug: `m5-fail-multi-${Date.now()}`,
      reviewed_by: [],
      source: {},
      embedded_media: [{ src: '/x.png' }],
      accessibility: { alt_text_complete: false },
      // expected fail: 복수
    },
  ]
  const ids: string[] = []

  before(async () => {
    admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } })
    for (const fx of fixtures) {
      const { data, error } = await admin.from('documents').insert({
        slug: fx.slug,
        title: `M5 fixture ${fx.slug}`,
        type: '기타',
        year: 2026,
        source: fx.source,
        embedded_media: fx.embedded_media,
        accessibility: fx.accessibility,
        reviewed_by: fx.reviewed_by,
        axis: 'agreements',
        status: 'draft',
      }).select('id').single()
      if (error) throw error
      ids.push(data.id)
    }
  })

  after(async () => {
    if (ids.length > 0) await admin.from('documents').delete().in('id', ids)
  })

  test('fixture 1 통과, fixture 2~4 차단 (가드 평가)', async () => {
    const { data } = await admin.from('documents')
      .select('id, slug, status, reviewed_by, source, embedded_media, accessibility')
      .in('id', ids)
    assert.ok(data)
    const results = (data ?? []).map(d => ({ slug: d.slug, ...evaluateGuards(d as any) }))
    const passSlugs = results.filter(r => r.passed).map(r => r.slug)
    const failSlugs = results.filter(r => !r.passed).map(r => r.slug)
    assert.equal(passSlugs.length, 1)
    assert.equal(failSlugs.length, 3)
    assert.ok(passSlugs[0].startsWith('m5-pass-'))
  })

  test('service_role로 status draft → published 전환 성공', async () => {
    const passId = ids[0] // m5-pass
    const { error } = await admin.from('documents').update({ status: 'published' }).eq('id', passId)
    assert.equal(error, null)
    const { data } = await admin.from('documents').select('status').eq('id', passId).single()
    assert.equal(data?.status, 'published')
  })

  test('차단된 fixture는 status 그대로 draft', async () => {
    const { data } = await admin.from('documents').select('slug, status').in('id', ids.slice(1))
    assert.ok(data)
    for (const d of data ?? []) {
      assert.equal(d.status, 'draft', `${d.slug}는 draft여야 함`)
    }
  })
})
```

### Step 4.2: 실행

```bash
npm run test:integration -- tests/migrations/0002_publish_workflow.test.ts
```

Expected: 3 tests PASS.

### Step 4.3: 통합 테스트 전체 회귀

```bash
npm run test:integration
```

Expected: 16 (Task 1까지) + 3 = 19 PASS.

### Step 4.4: commit

```bash
git add tests/migrations/0002_publish_workflow.test.ts
git commit -m "test(m5): publish 워크플로 통합 테스트 3건

fixture 4개(통과 1 + 차단 3) → evaluateGuards + service_role status 전이 + 차단 페이지 status 보존."
```

---

## Task 5: tests/helpers/env-loader 추출 (선택, refactor 가독성)

**Files:**
- Create: `tests/helpers/env-loader.ts`
- Modify: 기존 통합 테스트 (`tests/migrations/0001_init_kb*.test.ts`) — import 갱신

기존 sync-content-to-db.ts의 `loadDotEnvLocalOverrides` 함수를 `tests/helpers/env-loader.ts`로 추출. Task 1 + Task 4 통합 테스트에서 import 재사용.

### Step 5.1: helper 작성

`tests/helpers/env-loader.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadDotEnvLocalOverrides() {
  const envPath = join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
```

### Step 5.2: 기존 테스트의 인라인 loader 제거 + import 교체

(grep으로 인라인 loader 찾아서 일괄 교체)

```bash
grep -rn "loadDotEnvLocalOverrides" tests/ scripts/
```

### Step 5.3: 회귀 — 통합 + 단위 전체

```bash
npm run test
npm run test:integration
```

Expected: 변동 없음.

### Step 5.4: commit

```bash
git add tests/helpers/env-loader.ts tests/migrations/
git commit -m "refactor(test): loadDotEnvLocalOverrides를 tests/helpers/env-loader.ts로 추출

M1/M2/M4/M5 통합 테스트에서 중복 코드 제거."
```

---

## Task 6: codex-rescue 마일스톤 리뷰

> 글로벌 CLAUDE.md "마일스톤 단위 codex-rescue dispatch" 규칙.

### Step 6.1: dispatch

리뷰 포커스:

1. **D4 트리거 정합성** — `auth.role()`이 service_role 외 모두 차단하나? `null` 케이스(인증 없는 internal call) 처리 안전?
2. **D5 가드 평가 — embedded_media 면제 정합성** — `Array.isArray(embedded_media)`가 jsonb로 저장된 `[]`와 매치되나? Supabase JS는 jsonb → JS array 자동 변환 보장?
3. **D6 dry-run/apply 분리** — `--apply` 누락 시 절대 status UPDATE 안 일어나는지? `process.argv.includes('--apply')`가 잘못된 플래그 매칭 안 하는지(예: `--apply-something`)?
4. **D8 idempotent** — 이미 published 페이지를 publish 스크립트가 재처리 안 하는지? (.in('status', ['draft', 'in_review']) 게이트)
5. **D9 워크플로 — published → 마크다운 수정 후 sync** — sync-content-to-db.ts D1 invariant(status='draft' 강제)와 publish 스크립트가 *충돌*하지 않는지? 콘텐츠 수정 후 재검수 흐름 명확한지?
6. **D10 RLS vs 트리거 분리** — editor가 documents UPDATE 시 status 컬럼을 *함께* 보내도 트리거가 잡는지? `OLD.status is distinct from NEW.status`가 NULL 케이스에서 정확한지?
7. **테스트 fixture 격리** — Task 4의 fixture 4개가 다른 통합 테스트 fixture와 slug 충돌 안 하는지? `Date.now()` 충돌 가능성?
8. **마이그레이션 idempotent** — `0002_editor_roles_and_publish.sql`을 두 번 실행하면? (create table if exists 미사용 — 정책)
9. **편집자 부재 invariant** — M4 시점 editor_roles 멤버 0명. `npm run kb:publish:dry-run`이 의도한 baseline 출력하는지?
10. **service role 키 노출** — publish-content.ts가 SECRET_KEY 사용. `.env.local`이 gitignored인지, 스크립트 로그에 키 노출 안 하는지?

### Step 6.2: 결과 처리

OK / CONCERN / BLOCK 판정에 따라:
- OK → Task 7 진입
- CONCERN → 즉시 fix commit + Task 6.1 재실행
- BLOCK → plan 재설계

---

## Task 7: PR + 메모리/CLAUDE.md 갱신

### Step 7.1: 위원장 dry-run 실행 안내 (선택, 머지 전)

위원장에게 PR 머지 *전* 또는 *후* dry-run 실행 권장:

```bash
git checkout phase-2-m4-m5-publish-workflow
npm run kb:publish:dry-run
```

Expected baseline: 535 candidate, 0 passing, 535 blocked (reviewed_by 누락이 535건). 보고서 출력 정상 확인.

### Step 7.2: codex-rescue concern 반영 (있으면)

### Step 7.3: TTS 요약

### Step 7.4: 메모리 갱신

- `~/.claude/projects/.../memory/project_phase_status.md` — Phase 2 M4+M5 완료 섹션 추가
- `~/.claude/projects/.../memory/MEMORY.md` — Quick Reference 갱신
- `webfortd/CLAUDE.md` — 변경 이력 + Phase 2 행 status 갱신 + Phase 로드맵 표 갱신

### Step 7.5: push + PR

```bash
git push -u origin phase-2-m4-m5-publish-workflow
gh pr create --title "Phase 2 M4+M5: editor_roles + write RLS + 검수 자동화" --body "..."
```

PR body에 비개발자 설명 (위원장 보고용) 포함.

### Step 7.6: 위원장 머지 의사 확인

---

## Branch Strategy

```bash
git checkout master && git pull
git checkout -b phase-2-m4-m5-publish-workflow
```

---

## 후속 plan 예고

| 마일스톤 | 범위 |
|---------|------|
| **Phase 3** | 임베딩 파이프라인 + RAG 챗봇 + ivfflat REINDEX + AI Elements 채팅 UI |
| **Phase 4** | 소셜 피드 (`(wiki)` 그룹) — editor_roles에 첫 멤버 추가 + 피드 write RLS |
| Phase 5 | TTS·이미지 alt 자동생성 |
| Phase 6 | 다국어·정책 통계 시각화 |

---

## Self-Review

- [x] 모든 task에 파일 경로 + 코드 sample
- [x] M4 (권한 인프라) + M5 (검수 자동화) 짝 관계 명시 (D9·D10)
- [x] TDD 흐름 (Task 1·3·4 실패 테스트 → 구현 → PASS)
- [x] codex-rescue 마지막 단계 (Task 6, 10개 리뷰 포커스)
- [x] 비개발자 설명 (위원장 보고용)
- [x] 접근성·invariant·idempotent 명시
- [x] 마이그레이션 syntax 검증 (Supabase CLI)
- [x] 보고서 포맷 박힘 (D7)
- [x] dry-run baseline 예측 (Step 2.3 — 535 blocked 정상)

---

## Plan 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-21 | 초기 작성 — M4 (editor_roles + write RLS + status 트리거) + M5 (publish 워크플로 + dry-run/apply) 한 plan |
