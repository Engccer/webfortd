# Phase 2 M2 — 빌드 인덱스 → Supabase 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `kb-index.generated.json`(535 atomic 페이지 + 1040 backlinks)과 마크다운 정본을 webfortd-prod의 `documents`·`wiki_backlinks` 테이블로 idempotent 동기화한다. M2 끝나면 RLS 정책이 *실제 효과를 발휘*하는 상태(데이터 535건 in DB)가 된다.

**Architecture:** 마크다운 정본 → `scripts/sync-content-to-db.ts` (admin client 사용) → Supabase. 단방향, sync. 양방향 동기화 X. status는 모두 `draft`로 시작 (Phase 2 M5 검수 자동화에서 `published` 전환).

**Tech Stack:** `@supabase/supabase-js` (이미 devDep), Node `node --import tsx`, `gray-matter` (이미 dep), `--env-file=.env.local` (Node 20.6+).

---

## 비개발자용 쉬운 설명 (위원장 보고용)

이 작업이 끝나면 무엇이 달라지나:

1. **위키 페이지 535개가 Supabase 데이터베이스에 들어간다** — 마크다운 파일 그대로 옮기는 게 아니라, 검색·필터링 가능한 *데이터*로 변환해서 표에 채워 넣음.
2. **모든 페이지 상태는 일단 "draft"(초안)** — Phase 2 M5의 검수 자동화에서 정책 기준 통과한 페이지부터 "published"로 바뀐다. 즉 *외부 사용자는 여전히 위키 페이지가 안 보임* (RLS가 published만 노출).
3. **검수 자동화 전까지의 임시 상태**: 위키 UI가 보는 데이터는 여전히 *마크다운 파일 직접 읽기* (Phase 1 방식). DB는 "준비 완료" 상태로 대기. Phase 2 M5에서 published 전환되면 UI도 DB 경로로 자연스럽게 전환 가능.
4. **위원장 입장에서 직접 변하는 건 없음** — 위키 페이지 화면 그대로, 챗봇 mock UI 그대로. 단 *다음 단계(검수 자동화 → 챗봇 RAG)로 가는 데이터 토대*가 깔린다.

왜 한 번에 published로 안 만드나? → SQL 데이터 535건 중 일부에 frontmatter 오류·미완성 alt text 등이 있을 수 있다. 검수 자동화 단계에서 *가드 통과한 페이지만* published. 그 전엔 draft (안전 모드).

---

## File Structure

| 경로 | 책임 | 신규/수정 |
|------|------|-----------|
| `src/lib/supabase/admin.ts` | service role admin client (lazy 초기화) | 신규 |
| `src/lib/supabase/client.ts` | anon client (browser/server-side read용, M3 auth에서도 사용) | 신규 |
| `scripts/sync-content-to-db.ts` | sync CLI entry: kb-index 읽기 + transform + upsert + backlinks | 신규 |
| `tests/sync-content-to-db.test.ts` | transform 단위 테스트 (frontmatter → row 매핑, references → references_data 등) | 신규 |
| `tests/migrations/0001_init_kb_rls.test.ts` | RLS fixture 확장 (carry-over 3: 실 데이터 draft/published 4경로) | 신규 |
| `tests/migrations/0001_init_kb.test.ts` | 기존 smoke 테스트 (M2 동기화 후에도 그린 유지 — Step 5에서 cleanup 필요할 수 있음) | 수정 가능 |
| `package.json` | `kb:sync`, `kb:sync:dry-run` 스크립트 추가 | 수정 |
| `.env.local.example` | `SUPABASE_SECRET_KEY` placeholder | 수정 |
| `.env.local` | `SUPABASE_SECRET_KEY` (이미 controller가 추가, .gitignore 차단) | (이미 수정됨) |

**파일 크기 예상**:
- `sync-content-to-db.ts`: 400~600 lines (load + transform + upsert + backlinks 한 파일). 더 커지면 split.
- 다른 파일: 모두 200 lines 이내.

---

## 설계 결정 (M2 시점에 박는 것)

### D1. status는 모두 `draft`로 동기화

upsert 시점에 일관성을 위해 모든 row의 status는 `'draft'`. `'published'` 전환은 M5 검수 자동화 단계의 책임. 이 결정으로 *M2 끝난 직후 어떤 row도 anon에게 노출되지 않음* — RLS 안전 모드.

### D2. `references` → `references_data` 컬럼 매핑 (M1 Task 2 reviewer I1 후속)

`kb-index.generated.json`의 frontmatter에 `references` 필드가 있음. DB 컬럼은 `references_data` (SQL reserved word 회피). transform 단계에서 명시적 rename.

### D3. `wiki_backlinks.line`은 sync에서 채우지 않음 (M1 carry-over 1)

`scripts/sync-content.ts:317-321`는 valid backlink push 시 `line` 필드를 omit. broken link만 `line`을 보존. M2 sync도 동일 — valid backlink는 `line = null`로 insert. DB 컬럼은 future-reserved 상태 유지.

### D4. ivfflat REINDEX는 M2에서 미실행 (M1 carry-over 2)

M2는 `documents`·`wiki_backlinks`만 다룸. `document_chunks`는 0건 그대로 — embedding 인덱스 영향 없음. REINDEX는 Phase 3 RAG의 청크 + 임베딩 채우기 직후에 처리.

### D5. wiki_backlinks 동기화는 *delete + insert* (idempotent)

upsert 패턴 대신 *source_doc_id별 기존 row 전체 삭제 후 재삽입*. 이유:
- composite key가 없어 unique constraint upsert 불가
- "이 페이지의 backlinks를 *현재 인덱스 기준으로* 재구성한다"는 의미 명확
- 작업 단위가 페이지 단위라 트랜잭션 크기 작음 (페이지당 평균 2 backlinks)

### D6. target-side RLS 게이트는 추가하지 않음 (M1 carry-over 4)

`wiki_backlinks.target_slug`가 draft 문서를 가리켜도 anon에게 노출되는 상태 유지. 근거: **마크다운 정본이 git public** (`content/**/*.md`는 GitHub repo 공개). 따라서 slug 자체는 비밀이 아님. RLS 추가는 over-engineering.

### D7. dry-run 모드 의무

`npm run kb:sync:dry-run`이 *모든 변환 + 정합성 검증을 수행하되 DB write를 안 함*. 실 운영 적용 직전 검증용. 535 documents + 1040 backlinks가 정확히 transform되는지 colliding slug 등 없는지 확인.

### D8. service role key는 *sync 스크립트 한정* 사용

`SUPABASE_SECRET_KEY`는 `src/lib/supabase/admin.ts`의 `getAdminClient()`에서만 import. browser/Server Component에서 절대 사용 안 함. Next.js 빌드 시 client bundle 제외 보장 (NEXT_PUBLIC_ 접두사 X).

---

## Task 1: admin client + .env.local.example 갱신

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/supabase/client.ts`
- Modify: `.env.local.example`

### Step 1.1: `src/lib/supabase/client.ts` — anon client (lazy)

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _anonClient: SupabaseClient | null = null

/**
 * Browser-safe anon client (publishable key 사용).
 * RLS 정책에 따라 status='published' documents/chunks/backlinks만 read 가능.
 */
export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      )
    }
    _anonClient = createClient(url, anonKey)
  }
  return _anonClient
}
```

### Step 1.2: `src/lib/supabase/admin.ts` — admin client (lazy, server-only)

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminClient: SupabaseClient | null = null

/**
 * Service role admin client (RLS 우회).
 * 절대 browser/Server Component에서 import 금지. sync 스크립트·관리 도구 한정.
 * SUPABASE_SECRET_KEY는 NEXT_PUBLIC_ 접두사 없음 → Next.js 빌드 시 client bundle에서 제외.
 */
export function getAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getAdminClient는 server-side 전용 (browser import 금지)')
  }
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 미설정',
      )
    }
    _adminClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _adminClient
}
```

### Step 1.3: `.env.local.example` 갱신

기존 2줄 다음에 placeholder 1줄 추가:
```
SUPABASE_SECRET_KEY=sb_secret_<from dashboard Reveal>
```

### Step 1.4: 검증 — `npm run test` (89 그린 유지)

```bash
npm run test 2>&1 | tail -10
```

Expected: 89 tests pass (admin/client 모듈 import만으로 회귀 없음).

### Step 1.5: commit

```bash
git add src/lib/supabase/admin.ts src/lib/supabase/client.ts .env.local.example
git commit -m "feat(supabase): add admin + anon client helpers (lazy init)"
```

---

## Task 2: sync 스크립트 — 구조 + content 로딩 + transform (TDD)

**Files:**
- Create: `scripts/sync-content-to-db.ts` (구조 + load + transform 부분만; upsert는 Task 3, backlinks는 Task 4)
- Create: `tests/sync-content-to-db.test.ts` (transform 단위 테스트)

### Step 2.1: 실패 테스트 작성 — `tests/sync-content-to-db.test.ts`

```typescript
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { transformDocumentRow } from '@/scripts/sync-content-to-db'

describe('transformDocumentRow', () => {
  test('frontmatter.references → references_data 컬럼 매핑', () => {
    const doc = {
      slug: 'test-doc',
      axis: 'agreements',
      filePath: 'content/agreements/test-doc.md',
      frontmatter: {
        title: '테스트',
        type: '지침',
        disability_types: ['전체'],
        domains: ['정책법령'],
        regions: ['전국'],
        year: 2026,
        status: 'draft',
        source: { organization: 'test', citation: 'test' },
        references: [{ citation: 'ref1', type: 'web' as const }],
        accessibility: {
          alt_text_complete: true,
          captions_available: false,
          reading_level: 'standard' as const,
          audio_tts_ready: false,
        },
        authors: [],
        reviewed_by: [],
        parent_headings: [],
      },
      body_excerpt: '본문 발췌',
    }
    const row = transformDocumentRow(doc, '본문 전체 마크다운')
    assert.equal(row.slug, 'test-doc')
    assert.equal(row.axis, 'agreements')
    assert.equal(row.source_path, 'content/agreements/test-doc.md')
    assert.equal(row.content_md, '본문 전체 마크다운')
    assert.deepEqual(row.references_data, [{ citation: 'ref1', type: 'web' }])
    // references 컬럼은 *없어야* 함 (SQL reserved word 회피)
    assert.equal('references' in row, false)
    // status는 draft (D1)
    assert.equal(row.status, 'draft')
  })

  test('frontmatter에 references 없을 때 references_data 빈 배열', () => {
    const doc = {
      slug: 'test-2',
      axis: 'policies',
      filePath: 'content/policies/test-2.md',
      frontmatter: {
        title: '제목',
        type: '지침',
        disability_types: ['시각'],
        domains: ['편의지원'],
        regions: ['전국'],
        year: 2025,
        status: 'draft',
        source: { organization: 'org', citation: 'cite' },
        references: [],
        accessibility: {
          alt_text_complete: true,
          captions_available: false,
          reading_level: 'standard' as const,
          audio_tts_ready: false,
        },
        authors: [],
        reviewed_by: [],
        parent_headings: [],
      },
      body_excerpt: '',
    }
    const row = transformDocumentRow(doc, '')
    assert.deepEqual(row.references_data, [])
  })

  test('disability_types가 단일 문자열이 아닌 배열', () => {
    const doc = {
      slug: 'multi-type',
      axis: 'disability-types',
      filePath: 'content/disability-types/multi.md',
      frontmatter: {
        title: '복합',
        type: '안내서',
        disability_types: ['시각', '청각'],
        domains: ['인사관리'],
        regions: ['서울'],
        year: 2024,
        status: 'draft',
        source: { organization: 'o', citation: 'c' },
        references: [],
        accessibility: {
          alt_text_complete: true,
          captions_available: false,
          reading_level: 'standard' as const,
          audio_tts_ready: false,
        },
        authors: [],
        reviewed_by: [],
        parent_headings: [],
      },
      body_excerpt: '',
    }
    const row = transformDocumentRow(doc, '본문')
    assert.deepEqual(row.disability_types, ['시각', '청각'])
  })
})
```

### Step 2.2: 테스트 실행 → FAIL (모듈 부재)

```bash
node --import tsx --test tests/sync-content-to-db.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module ...sync-content-to-db` — 모듈 부재 에러.

### Step 2.3: `scripts/sync-content-to-db.ts` 최소 구현 (transform 함수만)

```typescript
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import kbIndex from '@/lib/kb-index.generated.json'
import type { KBDocumentSummary } from '@/lib/kb'

const REPO_ROOT = process.cwd()

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
 * frontmatter + 본문을 documents 테이블 row 객체로 변환.
 * D1: status는 draft 강제.
 * D2: frontmatter.references → references_data 컬럼명 rename.
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

/**
 * 마크다운 정본에서 본문 로딩 (frontmatter 제외).
 */
export function loadBody(filePath: string): string {
  const full = path.join(REPO_ROOT, filePath)
  const raw = fs.readFileSync(full, 'utf8')
  const { content } = matter(raw)
  return content
}

// (upsert/backlinks는 Task 3·4에서 추가)
```

### Step 2.4: 테스트 재실행 → PASS

```bash
node --import tsx --test tests/sync-content-to-db.test.ts 2>&1 | tail -10
```

Expected: 3 tests pass.

### Step 2.5: 회귀 — `npm run test`

Expected: 89 + 3 = 92 tests pass.

### Step 2.6: commit

```bash
git add scripts/sync-content-to-db.ts tests/sync-content-to-db.test.ts
git commit -m "feat(sync): add transform layer (frontmatter → DocumentRow with references_data rename)"
```

---

## Task 3: documents batch upsert + 진행률

**Files:**
- Modify: `scripts/sync-content-to-db.ts` (upsert 함수 추가)
- Modify: `tests/sync-content-to-db.test.ts` (upsert idempotency 테스트 추가 — mocked client)

### Step 3.1: 실패 테스트 추가 — idempotent upsert (mocked)

```typescript
describe('upsertDocuments (mocked client)', () => {
  test('빈 배열 → 0 batches', async () => {
    const upserted: any[] = []
    const mockClient = {
      from: () => ({
        upsert: async (rows: any[]) => {
          upserted.push(...rows)
          return { error: null }
        },
      }),
    } as any
    const result = await upsertDocuments(mockClient, [], { batchSize: 50 })
    assert.equal(result.totalUpserted, 0)
    assert.equal(upserted.length, 0)
  })

  test('150건 → 50 batch 3회', async () => {
    const upserted: any[] = []
    let batchCount = 0
    const mockClient = {
      from: () => ({
        upsert: async (rows: any[]) => {
          batchCount++
          upserted.push(...rows)
          return { error: null }
        },
      }),
    } as any
    const rows = Array.from({ length: 150 }, (_, i) => ({
      slug: `s-${i}`,
      title: `t-${i}`,
    })) as any
    const result = await upsertDocuments(mockClient, rows, { batchSize: 50 })
    assert.equal(result.totalUpserted, 150)
    assert.equal(batchCount, 3)
  })

  test('upsert 실패 → throw with row context', async () => {
    const mockClient = {
      from: () => ({
        upsert: async () => ({
          error: { code: 'PGRST', message: 'unique violation' },
        }),
      }),
    } as any
    await assert.rejects(
      () => upsertDocuments(mockClient, [{ slug: 'x' } as any], { batchSize: 50 }),
      /unique violation/,
    )
  })
})
```

`import { upsertDocuments } from '@/scripts/sync-content-to-db'`.

### Step 3.2: 테스트 실행 → FAIL (함수 부재)

### Step 3.3: 구현 추가

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

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
```

### Step 3.4: 테스트 재실행 → PASS, 회귀 확인

### Step 3.5: commit

```bash
git add scripts/sync-content-to-db.ts tests/sync-content-to-db.test.ts
git commit -m "feat(sync): add documents batch upsert (idempotent, slug onConflict, progress callback)"
```

---

## Task 4: wiki_backlinks 동기화 (delete + insert per source)

**Files:**
- Modify: `scripts/sync-content-to-db.ts`
- Modify: `tests/sync-content-to-db.test.ts`

### Step 4.1: 실패 테스트 추가

```typescript
describe('syncWikiBacklinks (mocked client)', () => {
  test('빈 인덱스 → 0 inserts', async () => {
    const ops: string[] = []
    const mockClient = {
      from: (table: string) => ({
        delete: () => ({
          in: async (col: string, vals: string[]) => {
            ops.push(`delete:${table}:${vals.length}`)
            return { error: null }
          },
        }),
        insert: async (rows: any[]) => {
          ops.push(`insert:${table}:${rows.length}`)
          return { error: null }
        },
      }),
    } as any
    const result = await syncWikiBacklinks(mockClient, {}, {})
    assert.equal(result.totalInserted, 0)
    assert.equal(ops.length, 0)
  })

  test('3개 source × 평균 2 backlinks → delete + insert', async () => {
    const ops: any[] = []
    const mockClient = {
      from: (table: string) => ({
        delete: () => ({
          in: async (col: string, vals: string[]) => {
            ops.push({ op: 'delete', table, n: vals.length })
            return { error: null }
          },
        }),
        insert: async (rows: any[]) => {
          ops.push({ op: 'insert', table, n: rows.length })
          return { error: null }
        },
      }),
    } as any
    const slugToId: Record<string, string> = {
      'a': 'id-a',
      'b': 'id-b',
      'c': 'id-c',
    }
    const backlinks: Record<string, { from: string; anchor?: string; link_text?: string }[]> = {
      'a': [{ from: 'b' }, { from: 'c', anchor: 'sec1' }],
      'b': [{ from: 'a' }],
      'c': [{ from: 'a' }, { from: 'b' }],
    }
    const result = await syncWikiBacklinks(mockClient, backlinks, slugToId)
    assert.equal(result.totalInserted, 5)
    // delete는 source_doc_id 배열로 한 번
    const deletes = ops.filter((o) => o.op === 'delete')
    assert.equal(deletes.length, 1)
    assert.equal(deletes[0].n, 3) // 3 source ids
  })

  test('slugToId에 없는 source → skip + warn (반환 미카운트)', async () => {
    const ops: any[] = []
    const mockClient = {
      from: (table: string) => ({
        delete: () => ({ in: async () => { ops.push('del'); return { error: null } } }),
        insert: async (rows: any[]) => {
          ops.push(rows)
          return { error: null }
        },
      }),
    } as any
    const slugToId = { 'a': 'id-a' }
    const backlinks = {
      'a': [{ from: 'b' }],         // a는 매핑됨
      'missing-slug': [{ from: 'a' }], // missing은 X
    }
    const result = await syncWikiBacklinks(mockClient, backlinks, slugToId)
    // missing-slug는 skip, 'a'만 inserted
    assert.equal(result.totalInserted, 1)
    assert.equal(result.skippedSources.length, 1)
    assert.equal(result.skippedSources[0], 'missing-slug')
  })
})
```

### Step 4.2: 테스트 실행 → FAIL

### Step 4.3: 구현 추가

```typescript
export interface WikiBacklinkInsert {
  source_doc_id: string
  target_slug: string
  anchor: string | null
  link_text: string | null
  line: number | null  // D3: sync에서 채우지 않음 → 항상 null
}

export interface SyncBacklinksResult {
  totalInserted: number
  skippedSources: string[]
}

export async function syncWikiBacklinks(
  client: SupabaseClient,
  /**
   * kb-index의 wiki_backlinks 구조. Record<targetSlug, Backlink[]> 인데,
   * sync의 관점은 *source 페이지가 어떤 페이지를 가리키는가*. 그래서 입력은
   * Record<sourceSlug, { from: targetSlug, anchor?, link_text? }[]> 형태.
   *
   * **주의**: 인덱스의 wiki_backlinks는 target perspective (target slug → backlinks from sources).
   * 호출 시 caller가 source perspective로 invert해서 넘겨야 한다.
   * 변환 유틸리티는 `invertBacklinksToSourcePerspective` (아래).
   */
  bySource: Record<string, { from: string; anchor?: string; link_text?: string }[]>,
  slugToId: Record<string, string>,
): Promise<SyncBacklinksResult> {
  // 1. source_doc_ids 매핑
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
        target_slug: link.from,
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

  // 3. 신규 insert (batch)
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
 * 입력: { 'target-slug': [{ from: 'source-slug', anchor?, link_text? }] }
 * 출력: { 'source-slug': [{ from: 'target-slug', anchor?, link_text? }] }
 *
 * "from" 필드는 출력에서도 *target slug*를 가리킴 (DB column이 target_slug라 호환).
 */
export function invertBacklinksToSourcePerspective(
  byTarget: Record<string, { from: string; anchor?: string; link_text?: string }[]>,
): Record<string, { from: string; anchor?: string; link_text?: string }[]> {
  const bySource: Record<string, { from: string; anchor?: string; link_text?: string }[]> = {}
  for (const [targetSlug, links] of Object.entries(byTarget)) {
    for (const link of links) {
      const sourceSlug = link.from
      if (!bySource[sourceSlug]) bySource[sourceSlug] = []
      bySource[sourceSlug].push({
        from: targetSlug, // source perspective: from = target slug
        anchor: link.anchor,
        link_text: link.link_text,
      })
    }
  }
  return bySource
}
```

### Step 4.4: 테스트 재실행 → PASS

### Step 4.5: invertBacklinksToSourcePerspective 단위 테스트도 추가

```typescript
test('invertBacklinksToSourcePerspective: target perspective → source', () => {
  const byTarget = {
    'page-a': [{ from: 'page-b' }, { from: 'page-c', anchor: 'sec' }],
    'page-c': [{ from: 'page-a' }],
  }
  const bySource = invertBacklinksToSourcePerspective(byTarget)
  assert.deepEqual(bySource['page-b'], [{ from: 'page-a' }])
  assert.deepEqual(bySource['page-c'], [{ from: 'page-a' }])
  assert.deepEqual(bySource['page-a'], [{ from: 'page-c' }])
})
```

### Step 4.6: 회귀 + commit

```bash
git add scripts/sync-content-to-db.ts tests/sync-content-to-db.test.ts
git commit -m "feat(sync): add wiki_backlinks sync (delete+insert per source, D5 idempotent)"
```

---

## Task 5: CLI entry + dry-run + 실 운영 적용

**Files:**
- Modify: `scripts/sync-content-to-db.ts` (main 추가)
- Modify: `package.json` (scripts)

### Step 5.1: CLI main 함수 추가

```typescript
import { getAdminClient } from '@/lib/supabase/admin'

interface MainOptions {
  dryRun: boolean
}

async function main(opts: MainOptions): Promise<void> {
  const startedAt = Date.now()
  const index = kbIndex as unknown as {
    documents: KBDocumentSummary[]
    wiki_backlinks: Record<string, { from: string; anchor?: string; link_text?: string }[]>
  }
  const { documents, wiki_backlinks } = index

  console.log(`[sync] 입력: ${documents.length} documents, ${Object.keys(wiki_backlinks).length} target slugs`)

  // 1. transform (전체)
  const rows: DocumentRow[] = []
  for (const doc of documents) {
    const body = loadBody(doc.filePath)
    rows.push(transformDocumentRow(doc, body))
  }

  // 2. dry-run validation
  const slugCounts: Record<string, number> = {}
  for (const r of rows) slugCounts[r.slug] = (slugCounts[r.slug] ?? 0) + 1
  const duplicates = Object.entries(slugCounts).filter(([, n]) => n > 1)
  if (duplicates.length > 0) {
    throw new Error(`slug 중복 ${duplicates.length}건: ${duplicates.slice(0, 5).map((d) => d[0]).join(', ')}...`)
  }

  if (opts.dryRun) {
    console.log(`[sync] DRY-RUN — transform ${rows.length} rows OK. DB write 생략.`)
    console.log(`[sync] backlinks (source perspective): ${
      Object.keys(invertBacklinksToSourcePerspective(wiki_backlinks)).length
    } source pages`)
    return
  }

  // 3. admin client + upsert
  const client = getAdminClient()
  await upsertDocuments(client, rows, {
    batchSize: 50,
    onProgress: (done, total) => {
      if (done % 100 === 0 || done === total) {
        console.log(`[sync] documents ${done}/${total}`)
      }
    },
  })

  // 4. slug → id 매핑 fetch
  const { data: idRows, error: fetchError } = await client
    .from('documents')
    .select('id, slug')
  if (fetchError) throw new Error(`documents id fetch 실패: ${fetchError.message}`)
  const slugToId: Record<string, string> = {}
  for (const r of idRows ?? []) slugToId[r.slug as string] = r.id as string

  // 5. backlinks sync
  const bySource = invertBacklinksToSourcePerspective(wiki_backlinks)
  const backlinksResult = await syncWikiBacklinks(client, bySource, slugToId)

  console.log(`[sync] backlinks inserted: ${backlinksResult.totalInserted}, skipped sources: ${backlinksResult.skippedSources.length}`)
  if (backlinksResult.skippedSources.length > 0) {
    console.warn(`[sync] skipped sources sample: ${backlinksResult.skippedSources.slice(0, 5).join(', ')}`)
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`[sync] 완료 (${elapsed}s) — documents ${rows.length}, backlinks ${backlinksResult.totalInserted}`)
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run')
  main({ dryRun }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
```

### Step 5.2: `package.json` scripts 추가

```json
"kb:sync": "node --env-file=.env.local --import tsx scripts/sync-content-to-db.ts",
"kb:sync:dry-run": "node --env-file=.env.local --import tsx scripts/sync-content-to-db.ts --dry-run"
```

### Step 5.3: dry-run 실행 + 검증

```bash
npm run kb:sync:dry-run
```

Expected: 
```
[sync] 입력: 535 documents, N target slugs
[sync] DRY-RUN — transform 535 rows OK. DB write 생략.
[sync] backlinks (source perspective): M source pages
```

duplicate slug 0건, transform 실패 0건. M은 invert 결과 source pages 수.

dry-run 통과 못 하면 stop + 원인 분석.

### Step 5.4: 실 운영 적용

⚠️ 운영 DB 변경. Task 4 (M1) 적용보다 큰 규모 — 535건 + ~1000 backlinks.

```bash
npm run kb:sync
```

Expected: 
```
[sync] documents 100/535
[sync] documents 200/535
...
[sync] documents 535/535
[sync] backlinks inserted: N, skipped sources: 0
[sync] 완료 (XXs) — documents 535, backlinks N
```

### Step 5.5: 적용 확인 — Supabase 통합 테스트 재실행

기존 `tests/migrations/0001_init_kb.test.ts`의 4번째 테스트 (taxonomy "RLS true")는 여전히 0 rows일 것 (taxonomy_terms 시드 X). 그러나 documents/chunks/backlinks는 더 이상 *완전 빈 상태*가 아님.

**문제**: 기존 4 select 테스트가 `assert.deepEqual(data, [])`를 기대하는데 documents에 535 draft rows가 있으면 published 0건이라 anon select 결과는 여전히 [] (RLS 정확 작동). **이 테스트는 PASS 유지 예상**. 그러나 명시 검증을 위해:

```bash
npm run test:integration 2>&1 | tail -15
```

Expected: 5/5 PASS (draft 535건이 anon에게 노출되지 않음 확인 = RLS 게이트 정확 작동).

### Step 5.6: commit

```bash
git add scripts/sync-content-to-db.ts package.json package-lock.json
git commit -m "feat(sync): add CLI entry with dry-run + main pipeline (transform → upsert → backlinks)"
```

---

## Task 6: RLS 통합 테스트 fixture 확장 (carry-over 3)

**Files:**
- Create: `tests/migrations/0001_init_kb_rls.test.ts`

### Step 6.1: 새 테스트 파일 작성 (실 데이터 fixture 검증)

M2 적용 후 운영 DB 상태: documents 535 draft, wiki_backlinks ~1000건 (모두 draft 부모).

다음 7~8건 테스트로 확장:

```typescript
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

const skipReason =
  !url || !anonKey || !secretKey
    ? 'env 미설정 (test:integration으로 실행 필요)'
    : ''

describe('0001_init_kb RLS fixture (M2 sync 후)', { skip: skipReason }, () => {
  let anon: SupabaseClient
  let admin: SupabaseClient

  before(() => {
    anon = createClient(url!, anonKey!)
    admin = createClient(url!, secretKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  test('precondition: documents에 draft rows 535건 (admin)', async () => {
    const { count, error } = await admin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')
    assert.equal(error, null)
    assert.ok(count !== null && count >= 500, `draft count 너무 적음: ${count}`)
  })

  test('anon은 draft documents를 read할 수 없음', async () => {
    const { data, error } = await anon
      .from('documents')
      .select('id, slug, status')
      .eq('status', 'draft')
      .limit(5)
    assert.equal(error, null) // RLS는 row 필터, 에러는 안 남
    assert.deepEqual(data, []) // 모두 차단되어 빈 배열
  })

  test('admin이 한 페이지를 published로 전환 + anon에게 노출 + 원복', async () => {
    // 첫 draft 페이지 1건 선택
    const { data: sample } = await admin
      .from('documents')
      .select('id, slug')
      .eq('status', 'draft')
      .limit(1)
      .single()
    assert.ok(sample)

    // published 전환
    const { error: e1 } = await admin
      .from('documents')
      .update({ status: 'published' })
      .eq('id', sample.id)
    assert.equal(e1, null)

    try {
      // anon에서 노출 확인
      const { data: anonRead } = await anon
        .from('documents')
        .select('id, slug, status')
        .eq('id', sample.id)
        .single()
      assert.equal(anonRead?.status, 'published')
      assert.equal(anonRead?.slug, sample.slug)
    } finally {
      // 원복 (테스트 격리)
      await admin
        .from('documents')
        .update({ status: 'draft' })
        .eq('id', sample.id)
    }
  })

  test('anon은 wiki_backlinks를 source 기준으로 차단 (draft 부모)', async () => {
    const { data } = await anon
      .from('wiki_backlinks')
      .select('id')
      .limit(5)
    assert.deepEqual(data, [])
  })

  test('published 페이지의 backlinks는 anon이 read 가능 (D6 — target_slug 노출 invariant)', async () => {
    // backlinks 있는 페이지 1건 선택
    const { data: sourceDoc } = await admin
      .from('documents')
      .select('id, slug')
      .eq('status', 'draft')
      .limit(1)
      .single()
    assert.ok(sourceDoc)

    // 해당 페이지의 backlinks가 있는지
    const { data: blinks, count } = await admin
      .from('wiki_backlinks')
      .select('id, target_slug', { count: 'exact' })
      .eq('source_doc_id', sourceDoc.id)
    if ((count ?? 0) === 0) {
      // backlinks가 없는 페이지면 skip (다른 페이지로 보강 가능, 일단 skip)
      return
    }

    // published 전환
    await admin
      .from('documents')
      .update({ status: 'published' })
      .eq('id', sourceDoc.id)
    try {
      // anon이 backlinks read 가능
      const { data: anonBlinks } = await anon
        .from('wiki_backlinks')
        .select('id, target_slug')
        .eq('source_doc_id', sourceDoc.id)
      assert.ok((anonBlinks?.length ?? 0) > 0)
      // D6: target_slug가 draft 문서를 가리키더라도 노출 OK (slug는 git public)
    } finally {
      await admin
        .from('documents')
        .update({ status: 'draft' })
        .eq('id', sourceDoc.id)
    }
  })

  test('anon은 wiki_backlinks insert 불가 (RLS)', async () => {
    const { error } = await anon
      .from('wiki_backlinks')
      .insert({ source_doc_id: '00000000-0000-0000-0000-000000000000', target_slug: 'fake' })
    assert.notEqual(error, null)
    assert.equal(error?.code, '42501')
  })

  test('anon은 documents status를 update 불가', async () => {
    const { data: sample } = await admin
      .from('documents')
      .select('id')
      .limit(1)
      .single()
    assert.ok(sample)
    const { error, count } = await anon
      .from('documents')
      .update({ status: 'published' })
      .eq('id', sample.id)
      .select('*', { count: 'exact', head: true })
    // RLS는 row visibility 필터라 update affected 0 + error null이거나 explicit error
    if (error === null) {
      assert.equal(count, 0, 'anon update가 row 변경 안 함 (RLS row visibility)')
    } else {
      assert.match(error.code ?? '', /42501|PGRST/)
    }
  })
})
```

### Step 6.2: 테스트 실행 → 7건 PASS

```bash
npm run test:integration 2>&1 | tail -15
```

Expected: 기존 5건 + 새 7건 = 12 tests, all PASS.

만약 일부 fail이면 분석. 예상 가능한 fail:
- backlinks를 가진 첫 draft 페이지에 backlinks가 0건이면 5번째 테스트 skip (정상)
- admin update 후 finally rollback 누락 시 다음 실행 영향 — finally 정확히 들어가 있는지 확인

### Step 6.3: commit

```bash
git add tests/migrations/0001_init_kb_rls.test.ts
git commit -m "test(rls): expand fixture with admin/anon round-trip (carry-over 3, D6 target_slug invariant 명시)"
```

---

## Task 7: codex-rescue 마일스톤 리뷰

> 글로벌 CLAUDE.md "마일스톤 단위 codex-rescue dispatch" 규칙.

### Step 7.1: dispatch

```
Agent(
  subagent_type="codex:codex-rescue",
  description="Phase 2 M2 마일스톤 리뷰",
  prompt="""
webfortd Phase 2 M2 마일스톤 리뷰. 변경 범위 (master 위 N commits):
- src/lib/supabase/{admin,client}.ts (신규)
- scripts/sync-content-to-db.ts (신규)
- tests/sync-content-to-db.test.ts (신규)
- tests/migrations/0001_init_kb_rls.test.ts (신규)
- package.json (kb:sync, kb:sync:dry-run scripts)
- .env.local.example (SUPABASE_SECRET_KEY placeholder)

운영 적용 완료: webfortd-prod (ref djaeeqdxkynjxngwvzyn). documents 535 draft + wiki_backlinks ~1000건. 통합 테스트 5+7 = 12 PASS, 회귀 89+N unit tests 그린, 빌드 564 페이지.

핵심 설계 결정 (plan 박힘): D1~D8. 특히:
- D1 status=draft 강제 (M5 검수 자동화 전까지 anon 노출 0건)
- D3 wiki_backlinks.line = null (sync 미저장, future-reserved)
- D5 backlinks delete+insert per source (idempotent)
- D6 target-side 게이트 추가 X (마크다운 정본 git public 근거)
- D8 service role key는 sync 스크립트 한정 (browser 노출 차단)

리뷰 포커스:
1. **idempotency**: 같은 sync를 N번 실행해도 documents row count 535 유지 + backlinks row count 동일 유지. 부분 실패 시 부분 상태가 생기는지.
2. **slug → id 매핑의 race**: upsert 직후 fetch가 535건을 모두 받는지. paging 안 걸리는지 (Supabase 기본 limit 1000).
3. **service role key 노출 경로**: getAdminClient가 browser 또는 client bundle로 import되지 않는지. Next.js 빌드 분석.
4. **transform 정합성**: KB_ARCHITECTURE.md §3 Document 스키마 vs DocumentRow 인터페이스. 누락 필드 / extra 필드.
5. **D5 backlinks idempotency**: delete-then-insert가 동시 실행에서 race condition 발생 가능성 (sync 스크립트는 단일 인스턴스 가정이지만).
6. **D6 invariant 정당성**: 마크다운이 git public이라 slug 비밀 아님 — 정합. 다만 PII가 슬러그에 들어간 경우 (예: 사람 이름)는 별도 invariant 필요한지.
7. **카운트 검증**: dry-run의 transform 535건과 운영 적용 후 admin select count가 일치하는지.

CLAUDE.md 행동 규칙 준수: 동일 계층 반복 지적 시 계층 선택 의심. 스타일은 후속 coderabbit 양보.
"""
)
```

### Step 7.2: 결과 처리

- OK: Task 8 진행
- CONCERN: 항목별 fix step 추가
- BLOCK: 위원장 보고

---

## Task 8: PR + 위원장 보고 + 메모리 갱신

### Step 8.1: codex-rescue concern 반영 (있으면)

plan 정정 + fix commit.

### Step 8.2: TTS 요약 작성

`~/.claude/tts-summary.txt`에 비개발자용 4~6 문장 요약 작성.

### Step 8.3: 메모리 갱신

- `project_phase_status.md`에 "Phase 2 M2 완료" 섹션 추가
- `MEMORY.md` Quick Reference에 한 줄 추가
- webfortd/CLAUDE.md 변경 이력에 한 줄

### Step 8.4: push + PR

```bash
git push -u origin phase-2-m2-sync-content
gh pr create --title "Phase 2 M2: 빌드 인덱스 → Supabase 동기화" --body "..."
```

PR body 포함:
- Summary (sync 스크립트 구조 + 535/1000 적용 결과)
- 설계 결정 D1~D8
- codex-rescue 결과
- 통합 테스트 12/12 + 회귀 92/92 + 빌드 564
- 다음 단계 (M3 Supabase Auth 이메일 매직링크)

### Step 8.5: master 머지 위원장 의사 확인 후 진행 (자동 머지 X)

---

## Branch Strategy

```bash
git checkout master && git pull
git checkout -b phase-2-m2-sync-content
```

이후 모든 commit은 이 브랜치에.

---

## 후속 plan 예고 (M3~M5)

| 마일스톤 | 범위 | 예상 plan 파일명 |
|---------|------|------------------|
| M3 | Supabase Auth (이메일 매직링크) + `(wiki)` 그룹 쓰기 액션 게이트 + `proxy.ts` 세션 갱신 | `2026-05-2x-phase-2-m3-auth-magic-link.md` |
| M4 | `editor_roles` 테이블 + write RLS 정책 확장 (검수자 권한) | `2026-05-2x-phase-2-m4-editor-roles.md` |
| M5 | draft → published 검수 자동화 스크립트 + 가드 (reviewed_by, accessibility, source 등) | `2026-05-2x-phase-2-m5-publish-workflow.md` |
| Phase 3 | 임베딩 파이프라인 + RAG 챗봇 + ivfflat REINDEX (M1 carry-over 2 처리) | `2026-05-2x-phase-3-rag-spec.md` |

---

## Self-Review 체크리스트

- [x] 모든 task에 정확한 파일 경로
- [x] 모든 step에 실행 가능한 코드 또는 명령
- [x] TDD 흐름 (Task 2~4 모두 *실패 테스트 → 구현 → 통과* 순)
- [x] 빈번한 commit (각 task마다 1 commit)
- [x] codex-rescue가 마지막 단계로 박혀 있음 (Task 7)
- [x] 비개발자용 설명 섹션 포함 (위원장 요청)
- [x] 후속 plan 예고로 전체 Phase 2 흐름 명시
- [x] 위험 시점 사전 확인 (Task 5의 dry-run 의무)
- [x] D6 invariant 명시 (target_slug 노출이 안전한 근거)
- [x] M1 carry-over 4건 모두 반영 (D3·D4·Task 6·D6)

## Plan 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-21 | 초기 작성 — Phase 2 M2 (빌드 인덱스 → Supabase 동기화) |
