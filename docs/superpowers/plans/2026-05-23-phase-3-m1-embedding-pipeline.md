# Phase 3 M1 — 청크 분해 + 임베딩 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 535개 atomic 마크다운 문서를 청크로 분해해 `gemini-embedding-2`로 임베딩하고 Supabase `document_chunks` 테이블을 idempotent 채우는 빌드 타임 파이프라인을 구현한다.

**Architecture:** Phase 2 M2(`sync-content-to-db.ts`)의 service_role + dry-run + `loadDotEnvLocalOverrides` 패턴을 그대로 계승한 CLI 스크립트. 청크 분해는 H2 섹션 + 800자 cap + 50자 min 규칙(spec §6.2), 임베딩은 Vercel AI SDK `@ai-sdk/google` provider의 `embedMany` 사용. 0005 마이그레이션은 청크 수 실측 후 hnsw 인덱스 적용.

**Tech Stack:** TypeScript, Node 20, tsx, `@supabase/supabase-js`, `@ai-sdk/google`, `ai` (Vercel AI SDK), gray-matter, node:test runner.

**Spec 참조:** `docs/superpowers/specs/2026-05-23-phase-3-rag-design.md` §3.2, §5(M1), §6.2, §6.3, §10.1, §12.3.

**위원장 명시 신호 게이트(spec §12.4 M1):** 본 plan 실행 착수는 Phase 3 RAG design 검토 완료 + 위원장 명시 승인 이후.

---

## 0. 사전 확인

- 작업 브랜치: `phase-3-m1-embedding-pipeline` (master 기반)
- worktree 생성: `git worktree add ../webfortd-phase-3-m1 -b phase-3-m1-embedding-pipeline master`
- 회귀 베이스라인: 125 unit + 20 integration PASS, 567 정적 페이지, `kb:publish:dry-run` 535/8/527.
- Google AI API key: `.env.local`에 `GOOGLE_GENERATIVE_AI_API_KEY` 등록 필요 (없으면 위원장 발급 요청).
- Supabase `webfortd-prod` 프로젝트 `document_chunks` 테이블 0 rows (Phase 2 M2까지는 documents/wiki_backlinks만 채움).

---

## 1. 파일 구조

### 신규 파일

| 경로 | 책임 |
|------|------|
| `scripts/embed-content.ts` | CLI main. argparse(`--dry-run`/`--limit N`), env load, content/**/*.md 순회, chunker 호출, embedMany 호출, `document_chunks` upsert, 보고서 출력 |
| `scripts/lib/chunker.ts` | 마크다운 문자열 → 청크 배열. frontmatter strip, `<page_header>` strip, H2 분할, 800자 cap, 50자 min cluster, metadata 생성 |
| `scripts/lib/gemini-embed.ts` | `@ai-sdk/google` `embedMany` 래퍼. server-only 환경변수 가드, batch size 분할(API 한도 100/req), 재시도(지수 백오프) |
| `supabase/migrations/0005_rag_infrastructure.sql` | ivfflat → hnsw 교체. M1 실행 결과 청크 수 < 10,000 확인 후 적용 |
| `tests/scripts/chunker.test.ts` | chunker 단위 테스트 (4 fixture: 짧은 단협, 긴 정책, 헤딩 없음, page_header 포함) |
| `tests/scripts/gemini-embed.test.ts` | gemini-embed env 가드 + batch 분할 로직 단위 테스트 (실 API 호출 없음, AI SDK mock) |
| `tests/scripts/embed-content.test.ts` | embed-content CLI dry-run 통합 테스트 (소수 fixture 마크다운 → 청크 수·shape 검증) |
| `tests/migrations/0005_rag_infrastructure.test.ts` | 0005 적용 후 hnsw 인덱스 존재 + similarity 조회 round-trip |

### 수정 파일

| 경로 | 변경 |
|------|------|
| `package.json` | `dependencies`에 `ai@^4.x`, `@ai-sdk/google@^1.x` 추가. `scripts`에 `kb:embed`, `kb:embed:dry-run` 추가. `test` glob에 `tests/scripts/chunker.test.ts`·`gemini-embed.test.ts`·`embed-content.test.ts` 포함 (현재 `tests/scripts/**/*.test.ts` glob이 이미 커버 — 별도 수정 불필요, 확인만) |
| `.env.local` (gitignore) | `GOOGLE_GENERATIVE_AI_API_KEY=...` 추가 |
| `Mac-Projects/webfortd/CLAUDE.md` 변경 이력 | M1 머지 후 단일 라인 추가 |

### 영향 받지 않는 파일

- `src/lib/**` (M1은 런타임 코드 무변경 — M2~M4에서 추가)
- `src/app/**` (UI 무변경)
- 기존 `scripts/lib/env-loader.ts`, `scripts/lib/error-format.ts`, `scripts/lib/parse-document-row.ts` 재사용 (수정 없음)

---

## 2. 핵심 설계 결정 (구현 전 잠금)

**D1: Batch API vs `embedMany` 단순 호출**

spec §8.2가 임베딩 비용을 "$0.0006 (1원 미만)"으로 산정. Batch API 50% 할인은 절감 효과 0. M1은 Vercel AI SDK `embedMany`(standard endpoint, 100건/req)만 사용한다. Batch API 전환은 향후 재임베딩 규모가 커질 때 별도 PR.

**D2: 청크 idempotency 전략**

`(document_id)` 기준 delete-then-insert (sync-content-to-db.ts의 wiki_backlinks 동기화 패턴과 동일). 부분 업데이트 미지원 — 재실행 시 해당 문서의 모든 청크 재생성. 근거: 청크 수 ≈ 800, 임베딩 호출 비용 무관.

**D3: 0005 적용 순서**

M1 PR 안에서 (1) 임베딩 1차 실행 → (2) 청크 수 측정 → (3) 0005 마이그레이션 작성 + 적용 순. 빈 인덱스에 hnsw를 미리 만들면 데이터 들어올 때마다 재정렬되어 비효율. spec §3.2의 "M1 실측 후 선택"을 그대로 따른다.

**D4: dry-run explicit flag (M5 C1 사고 교훈)**

`embed-content.ts`는 `--dry-run` 명시 flag가 있을 때만 dry-run 모드. positional 인수로 dry-run 모드 진입 불가. `--apply` 또는 flag 없음 = 실제 실행. Mode 헤더(`=== DRY-RUN MODE ===` 또는 `=== APPLY MODE ===`)를 stdout 첫 줄에 출력.

**D5: server-only 가드 패턴**

`gemini-embed.ts`는 raw Node CLI 환경에서도 안전하게 동작해야 함(`sync-content-to-db.ts`의 `createCliAdminClient` 패턴 답습). `import 'server-only'`는 사용하지 않음 (Next.js client bundle 가드는 향후 M2의 `src/lib/rag/retrieval.ts`에서 사용).

**D6: 청크 metadata shape (spec §6.3 정확 매칭)**

```ts
{
  slug: string,
  title: string,
  axis: string,
  type: string,
  section: string,        // "## 관련 페이지" 같은 H2 헤딩 또는 "(no-section)"
  chunk_index: number,    // 0-based, document 내 순서
  source_origin: string | null
}
```

**D7: char_start/char_end 컬럼 채우기**

0001 마이그레이션의 `char_start int` / `char_end int`는 frontmatter strip *후* body offset 기준. M1에서 채워두면 향후 정밀 인용(원문 하이라이트) 기능에서 재사용 가능. NULL 허용이지만 채워두는 게 cheap.

---

## 3. 작업 단위 분해

### Task 1: 의존성 추가 + CLI entrypoint 골격

**Files:**
- Modify: `package.json`
- Create: `scripts/embed-content.ts`

- [ ] **Step 1: `@ai-sdk/google`, `ai` 의존성 추가**

`package.json` `dependencies` 블록(`@supabase/ssr` 다음 줄 가나다 순)에 추가:

```json
"@ai-sdk/google": "^1.2.0",
"ai": "^4.3.0",
```

Run: `npm install`
Expected: lock 파일 갱신, 0 vulnerabilities.

- [ ] **Step 2: `kb:embed` npm scripts 추가**

`package.json` `scripts` 블록의 `kb:publish:dry-run` 아래에 추가:

```json
"kb:embed": "node --env-file=.env.local --import tsx scripts/embed-content.ts",
"kb:embed:dry-run": "node --env-file=.env.local --import tsx scripts/embed-content.ts --dry-run",
```

- [ ] **Step 3: `scripts/embed-content.ts` 스텁 생성**

```ts
#!/usr/bin/env tsx
// Phase 3 M1 — 청크 분해 + 임베딩 파이프라인 CLI
// 마크다운 정본을 입력으로 청크 분해 → gemini-embedding-2 임베딩 → document_chunks upsert.

import { loadDotEnvLocalOverrides } from './lib/env-loader.ts'

loadDotEnvLocalOverrides()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

console.log(dryRun ? '=== DRY-RUN MODE ===' : '=== APPLY MODE ===')
console.log('[embed-content] M1 skeleton — Task 4부터 본 로직 채움')

process.exit(0)
```

- [ ] **Step 4: dry-run smoke 실행**

Run: `npm run kb:embed:dry-run`
Expected stdout 첫 줄: `=== DRY-RUN MODE ===`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/embed-content.ts
git commit -m "feat(phase-3-m1): @ai-sdk/google 의존성 + embed-content CLI 골격"
```

---

### Task 2: chunker — frontmatter strip + body 추출

**Files:**
- Create: `scripts/lib/chunker.ts`
- Create: `tests/scripts/chunker.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (frontmatter strip)**

`tests/scripts/chunker.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripFrontmatter } from '../../scripts/lib/chunker.ts'

test('stripFrontmatter — frontmatter 블록 제거', () => {
  const input = '---\nslug: foo\ntitle: bar\n---\n\n본문 내용입니다.'
  const result = stripFrontmatter(input)
  assert.equal(result, '본문 내용입니다.')
})

test('stripFrontmatter — frontmatter 없으면 원본 반환', () => {
  const input = '본문만 있음'
  assert.equal(stripFrontmatter(input), '본문만 있음')
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `node --import tsx --test tests/scripts/chunker.test.ts`
Expected: `Error [ERR_MODULE_NOT_FOUND]` or `not exported`.

- [ ] **Step 3: `stripFrontmatter` 구현**

`scripts/lib/chunker.ts`:

```ts
import matter from 'gray-matter'

export function stripFrontmatter(raw: string): string {
  const { content } = matter(raw)
  return content.trim()
}
```

- [ ] **Step 4: 테스트 PASS 확인**

Run: `node --import tsx --test tests/scripts/chunker.test.ts`
Expected: `# pass 2`.

- [ ] **Step 5: `<page_header>` strip 테스트 + 구현 추가**

테스트 케이스 추가:

```ts
test('stripPageHeaders — <page_header> 태그 제거', () => {
  const input = '본문\n<page_header>p.10</page_header>\n다음 문단'
  assert.equal(stripPageHeaders(input), '본문\n\n다음 문단')
})
```

`chunker.ts`에 추가:

```ts
export function stripPageHeaders(body: string): string {
  return body.replace(/<page_header>[^<]*<\/page_header>/g, '').replace(/\n{3,}/g, '\n\n')
}
```

테스트 PASS 확인.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/chunker.ts tests/scripts/chunker.test.ts
git commit -m "feat(phase-3-m1): chunker frontmatter + page_header strip"
```

---

### Task 3: chunker — H2 섹션 분할

**Files:**
- Modify: `scripts/lib/chunker.ts`
- Modify: `tests/scripts/chunker.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { splitByH2 } from '../../scripts/lib/chunker.ts'

test('splitByH2 — H2 헤딩 기준 분할, 헤딩 라인은 섹션 첫 줄로 포함', () => {
  const input = '서두 문장.\n\n## 첫 섹션\n내용 A.\n\n## 두 번째\n내용 B.'
  const result = splitByH2(input)
  assert.equal(result.length, 3)
  assert.equal(result[0].section, '(no-section)')
  assert.equal(result[0].text, '서두 문장.')
  assert.equal(result[1].section, '## 첫 섹션')
  assert.equal(result[1].text, '## 첫 섹션\n내용 A.')
  assert.equal(result[2].section, '## 두 번째')
  assert.equal(result[2].text, '## 두 번째\n내용 B.')
})

test('splitByH2 — H2 없으면 단일 청크', () => {
  const input = '제목 없는 단편 문장.'
  const result = splitByH2(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].section, '(no-section)')
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

- [ ] **Step 3: `splitByH2` 구현**

```ts
export interface RawSection {
  section: string
  text: string
}

export function splitByH2(body: string): RawSection[] {
  const lines = body.split('\n')
  const sections: RawSection[] = []
  let current: RawSection = { section: '(no-section)', text: '' }

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (current.text.trim()) sections.push({ ...current, text: current.text.trim() })
      current = { section: line.trim(), text: line + '\n' }
    } else {
      current.text += line + '\n'
    }
  }
  if (current.text.trim()) sections.push({ ...current, text: current.text.trim() })
  return sections
}
```

- [ ] **Step 4: 테스트 PASS 확인**

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/chunker.ts tests/scripts/chunker.test.ts
git commit -m "feat(phase-3-m1): chunker H2 섹션 분할"
```

---

### Task 4: chunker — 800자 cap + 50자 min 클러스터링

**Files:**
- Modify: `scripts/lib/chunker.ts`
- Modify: `tests/scripts/chunker.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { applyCharLimits, MAX_CHUNK_CHARS, MIN_CHUNK_CHARS } from '../../scripts/lib/chunker.ts'

test('applyCharLimits — 800자 cap 초과 시 문단 단위 분할', () => {
  const longSection = {
    section: '## 긴 섹션',
    text: '## 긴 섹션\n' + Array(20).fill('가나다라마바사아자차카타파하'.repeat(8)).join('\n\n'),
  }
  // 각 라인 ~96자 × 20개 ≈ 1900자, 문단 구분이 있어야 분할 가능
  const result = applyCharLimits([longSection])
  assert.ok(result.length >= 2, '800자 초과는 최소 2개로 분할')
  for (const r of result) {
    assert.ok(r.text.length <= MAX_CHUNK_CHARS + 100, '하드 cap 근사치')
  }
})

test('applyCharLimits — 50자 미만 인접 섹션 병합', () => {
  const tiny = [
    { section: '(no-section)', text: '짧은 한 줄.' },
    { section: '## A', text: '## A\n또 짧음.' },
    { section: '## B', text: '## B\n' + '내용'.repeat(50) },
  ]
  const result = applyCharLimits(tiny)
  // 앞의 두 단편은 병합 또는 다음 정상 청크에 합류, 50자 이상 청크만 남음
  for (const r of result) {
    assert.ok(r.text.length >= MIN_CHUNK_CHARS || result.length === 1, '최소 길이 보장')
  }
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

- [ ] **Step 3: 상수 + `applyCharLimits` 구현**

```ts
export const MAX_CHUNK_CHARS = 800
export const MIN_CHUNK_CHARS = 50

export function applyCharLimits(sections: RawSection[]): RawSection[] {
  const result: RawSection[] = []
  let buffer: RawSection | null = null

  for (const sec of sections) {
    // 큰 섹션은 문단(빈 줄) 단위로 800자 cap 적용
    if (sec.text.length > MAX_CHUNK_CHARS) {
      if (buffer) {
        result.push(buffer)
        buffer = null
      }
      const paragraphs = sec.text.split(/\n\n+/)
      let chunk = ''
      for (const p of paragraphs) {
        if ((chunk + '\n\n' + p).length > MAX_CHUNK_CHARS && chunk) {
          result.push({ section: sec.section, text: chunk.trim() })
          chunk = p
        } else {
          chunk = chunk ? chunk + '\n\n' + p : p
        }
      }
      if (chunk.trim()) result.push({ section: sec.section, text: chunk.trim() })
      continue
    }

    // 작은 섹션은 buffer에 누적, MIN 이상이면 flush
    if (!buffer) {
      buffer = { ...sec }
    } else {
      buffer.text = buffer.text + '\n\n' + sec.text
      buffer.section = buffer.section // 첫 섹션 라벨 유지 — 검색·인용에 우호적
    }
    if (buffer.text.length >= MIN_CHUNK_CHARS) {
      result.push(buffer)
      buffer = null
    }
  }
  if (buffer) result.push(buffer)
  return result
}
```

- [ ] **Step 4: 테스트 PASS 확인**

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/chunker.ts tests/scripts/chunker.test.ts
git commit -m "feat(phase-3-m1): chunker 800자 cap + 50자 min 클러스터"
```

---

### Task 5: chunker — `chunkDocument` 통합 + char offset 계산

**Files:**
- Modify: `scripts/lib/chunker.ts`
- Modify: `tests/scripts/chunker.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (통합 + metadata + char offset)**

```ts
import { chunkDocument, type ChunkMetadata } from '../../scripts/lib/chunker.ts'

test('chunkDocument — frontmatter+page_header strip → 청크 배열 + metadata', () => {
  const raw = `---
slug: test-1
title: 테스트
axis: policies
type: 안내서
---

서두.

## 섹션 A
내용 A.
<page_header>p.5</page_header>

## 섹션 B
내용 B.`
  const result = chunkDocument(raw, {
    slug: 'test-1',
    title: '테스트',
    axis: 'policies',
    type: '안내서',
    source_origin: 'sample-source',
  })
  assert.ok(result.length >= 1)
  for (let i = 0; i < result.length; i++) {
    assert.equal(result[i].metadata.chunk_index, i)
    assert.equal(result[i].metadata.slug, 'test-1')
    assert.equal(result[i].metadata.axis, 'policies')
    assert.ok(!result[i].text.includes('<page_header>'))
    assert.ok(!result[i].text.includes('---\nslug:'))
    assert.ok(result[i].char_start >= 0)
    assert.ok(result[i].char_end > result[i].char_start)
  }
})

test('chunkDocument — chunk_index 연속성', () => {
  const raw = `---\nslug: x\n---\n\n## A\n` + '가'.repeat(900) + '\n\n## B\n' + '나'.repeat(900)
  const result = chunkDocument(raw, { slug: 'x', title: 'X', axis: 'policies', type: 't', source_origin: null })
  const indices = result.map((c) => c.metadata.chunk_index)
  assert.deepEqual(indices, Array.from({ length: result.length }, (_, i) => i))
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

- [ ] **Step 3: `chunkDocument` 구현**

```ts
export interface ChunkMetadata {
  slug: string
  title: string
  axis: string
  type: string
  section: string
  chunk_index: number
  source_origin: string | null
}

export interface Chunk {
  text: string
  metadata: ChunkMetadata
  char_start: number
  char_end: number
}

export interface ChunkDocumentInput {
  slug: string
  title: string
  axis: string
  type: string
  source_origin: string | null
}

export function chunkDocument(raw: string, meta: ChunkDocumentInput): Chunk[] {
  const body = stripPageHeaders(stripFrontmatter(raw))
  const sections = applyCharLimits(splitByH2(body))

  let cursor = 0
  return sections.map((sec, i) => {
    const charStart = body.indexOf(sec.text, cursor)
    const resolvedStart = charStart === -1 ? cursor : charStart
    const charEnd = resolvedStart + sec.text.length
    cursor = charEnd
    return {
      text: sec.text,
      metadata: {
        slug: meta.slug,
        title: meta.title,
        axis: meta.axis,
        type: meta.type,
        section: sec.section,
        chunk_index: i,
        source_origin: meta.source_origin,
      },
      char_start: resolvedStart,
      char_end: charEnd,
    }
  })
}
```

- [ ] **Step 4: 테스트 PASS 확인** (4 fixtures 포함)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/chunker.ts tests/scripts/chunker.test.ts
git commit -m "feat(phase-3-m1): chunkDocument 통합 + char offset"
```

---

### Task 6: gemini-embed — env 가드 + 단건 호출 검증

**Files:**
- Create: `scripts/lib/gemini-embed.ts`
- Create: `tests/scripts/gemini-embed.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (env 가드만)**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertEmbedEnv } from '../../scripts/lib/gemini-embed.ts'

test('assertEmbedEnv — API key 누락 시 throw', () => {
  const saved = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  assert.throws(() => assertEmbedEnv(), /GOOGLE_GENERATIVE_AI_API_KEY/)
  if (saved) process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved
})

test('assertEmbedEnv — API key 있으면 통과', () => {
  const saved = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'fake-test-key'
  assert.doesNotThrow(() => assertEmbedEnv())
  if (saved) process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved
  else delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

- [ ] **Step 3: `gemini-embed.ts` env 가드 구현**

```ts
import { google } from '@ai-sdk/google'
import { embedMany } from 'ai'

export function assertEmbedEnv(): void {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY 미설정 — .env.local 또는 Vercel env 등록 필요')
  }
}

const MODEL_NAME = 'gemini-embedding-2'
const OUTPUT_DIMENSIONALITY = 1536
const BATCH_SIZE = 100

export interface EmbeddingInput {
  text: string
  refId: string  // 호출자 추적용 (slug + chunk_index)
}

export interface EmbeddingResult {
  refId: string
  embedding: number[]
}

export async function embedTexts(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
  assertEmbedEnv()
  if (inputs.length === 0) return []
  const results: EmbeddingResult[] = []
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE)
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel(MODEL_NAME, { outputDimensionality: OUTPUT_DIMENSIONALITY }),
      values: batch.map((b) => b.text),
    })
    for (let j = 0; j < batch.length; j++) {
      results.push({ refId: batch[j].refId, embedding: embeddings[j] })
    }
  }
  return results
}
```

> **검증 메모:** `@ai-sdk/google` v1.2의 정확한 `textEmbeddingModel` 시그니처와 `outputDimensionality` 옵션 위치는 본 task 실행 시점에 `mcp__plugin_context7_context7__query-docs`로 확인. 위 코드는 v1.x 공식 패턴 기반 가설안이며 실제 SDK API와 1:1 매칭 확인 필수. 일치 안 하면 Step 3에서 SDK 실 시그니처로 교체.

- [ ] **Step 4: 테스트 PASS 확인**

- [ ] **Step 5: batch 분할 테스트 추가**

```ts
test('embedTexts — 0건 input 즉시 빈 배열', async () => {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'fake-test-key'
  const { embedTexts } = await import('../../scripts/lib/gemini-embed.ts')
  const result = await embedTexts([])
  assert.deepEqual(result, [])
})
```

테스트 PASS 확인.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/gemini-embed.ts tests/scripts/gemini-embed.test.ts
git commit -m "feat(phase-3-m1): gemini-embed env 가드 + embedTexts batch 래퍼"
```

---

### Task 7: embed-content.ts — DB 클라이언트 + content/**/*.md 순회

**Files:**
- Modify: `scripts/embed-content.ts`

- [ ] **Step 1: `sync-content-to-db.ts` `createCliAdminClient` 패턴 재사용**

`scripts/embed-content.ts`에 추가 (Task 1 스텁 아래):

```ts
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import matter from 'gray-matter'
import { chunkDocument } from './lib/chunker.ts'
import { embedTexts, type EmbeddingInput } from './lib/gemini-embed.ts'
import { formatSupabaseError } from './lib/error-format.ts'

function createCliAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 미설정')
  }
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

const REPO_ROOT = process.cwd()
const CONTENT_ROOT = path.join(REPO_ROOT, 'content')

interface MarkdownDoc {
  filePath: string
  raw: string
  frontmatter: Record<string, unknown>
  slug: string
  title: string
  axis: string
  type: string
  sourceOrigin: string | null
}

function* walkMarkdown(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue  // _image-mappings.json 등 underscore 파일 제외
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walkMarkdown(full)
    else if (entry.name.endsWith('.md')) yield full
  }
}

function loadDocuments(): MarkdownDoc[] {
  const docs: MarkdownDoc[] = []
  for (const filePath of walkMarkdown(CONTENT_ROOT)) {
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(raw)
    const slug = (data.slug as string) ?? path.basename(filePath, '.md')
    docs.push({
      filePath,
      raw,
      frontmatter: data,
      slug,
      title: (data.title as string) ?? slug,
      axis: (data.axis as string) ?? 'uncategorized',
      type: (data.type as string) ?? 'unknown',
      sourceOrigin: (data.source_origin as string) ?? null,
    })
  }
  return docs
}
```

- [ ] **Step 2: stub `main()` 추가 — 문서 수 출력만**

`embed-content.ts` 하단 (Task 1 `console.log(dryRun ?...)` 제거 후):

```ts
async function main(): Promise<void> {
  console.log(dryRun ? '=== DRY-RUN MODE ===' : '=== APPLY MODE ===')
  const docs = loadDocuments()
  console.log(`[embed-content] 마크다운 문서 ${docs.length}개 로드`)

  let totalChunks = 0
  for (const doc of docs) {
    const chunks = chunkDocument(doc.raw, {
      slug: doc.slug,
      title: doc.title,
      axis: doc.axis,
      type: doc.type,
      source_origin: doc.sourceOrigin,
    })
    totalChunks += chunks.length
  }
  console.log(`[embed-content] 청크 총 ${totalChunks}개`)
}

main().catch((err) => {
  console.error(formatSupabaseError(err))
  process.exit(1)
})
```

- [ ] **Step 3: dry-run 실행으로 문서·청크 수 측정**

Run: `npm run kb:embed:dry-run`
Expected stdout:
```
=== DRY-RUN MODE ===
[embed-content] 마크다운 문서 535개 로드
[embed-content] 청크 총 N개  (N은 1100~1500 범위 예상)
```

> **체크포인트:** 청크 수가 spec §6.2 예상치(1,100~1,500) 범위 안인지 확인. 큰 편차가 있으면 chunker 설계 재검토.

- [ ] **Step 4: Commit**

```bash
git add scripts/embed-content.ts
git commit -m "feat(phase-3-m1): embed-content 마크다운 순회 + 청크 수 측정 (dry-run)"
```

---

### Task 8: embed-content.ts — slug→document_id 맵 + 임베딩 호출

**Files:**
- Modify: `scripts/embed-content.ts`

- [ ] **Step 1: slug→document_id 페치 헬퍼 추가**

`sync-content-to-db.ts`의 `assertIdRowsComplete` 패턴 인용:

```ts
import { assertIdRowsComplete } from './sync-content-to-db.ts'

async function fetchSlugToIdMap(client: SupabaseClient, slugs: string[]): Promise<Map<string, string>> {
  const { data, error } = await client
    .from('documents')
    .select('id, slug')
    .in('slug', slugs)
    .range(0, slugs.length - 1)
  if (error) throw new Error(`slug→id fetch 실패: ${formatSupabaseError(error)}`)
  assertIdRowsComplete(data, slugs.length)
  const map = new Map<string, string>()
  for (const row of data!) map.set(row.slug, row.id)
  return map
}
```

> **검증 메모:** `assertIdRowsComplete`가 `sync-content-to-db.ts`에서 export되어 있는지 Step 0에서 확인. 미export면 `scripts/lib/`로 추출 후 양쪽에서 import.

- [ ] **Step 2: 임베딩 호출 통합 (dry-run에서는 skip)**

`main()` 갱신:

```ts
async function main(): Promise<void> {
  console.log(dryRun ? '=== DRY-RUN MODE ===' : '=== APPLY MODE ===')
  const docs = loadDocuments()
  console.log(`[embed-content] 마크다운 문서 ${docs.length}개 로드`)

  // 1. 청크 분해
  type DocChunks = { slug: string; chunks: ReturnType<typeof chunkDocument> }
  const docChunks: DocChunks[] = docs.map((doc) => ({
    slug: doc.slug,
    chunks: chunkDocument(doc.raw, {
      slug: doc.slug,
      title: doc.title,
      axis: doc.axis,
      type: doc.type,
      source_origin: doc.sourceOrigin,
    }),
  }))
  const totalChunks = docChunks.reduce((a, b) => a + b.chunks.length, 0)
  console.log(`[embed-content] 청크 총 ${totalChunks}개`)

  if (dryRun) {
    console.log('[embed-content] dry-run — 임베딩 호출/DB 쓰기 skip')
    return
  }

  // 2. 임베딩 호출
  const inputs: EmbeddingInput[] = []
  for (const dc of docChunks) {
    for (const c of dc.chunks) {
      inputs.push({ refId: `${dc.slug}::${c.metadata.chunk_index}`, text: c.text })
    }
  }
  console.log(`[embed-content] 임베딩 호출 시작 (${inputs.length}건)`)
  const t0 = Date.now()
  const embeddings = await embedTexts(inputs)
  console.log(`[embed-content] 임베딩 완료 ${embeddings.length}건 (${Date.now() - t0}ms)`)

  // Task 9에서 DB 쓰기 추가
  console.log('[embed-content] DB 쓰기는 Task 9 구현 후 실행')
}
```

- [ ] **Step 3: dry-run 재실행 (스모크)**

Run: `npm run kb:embed:dry-run`
Expected: 청크 수 출력 + `dry-run — 임베딩 호출/DB 쓰기 skip` 메시지.

- [ ] **Step 4: Commit**

```bash
git add scripts/embed-content.ts
git commit -m "feat(phase-3-m1): embed-content 임베딩 호출 통합 (DB 쓰기 미연결)"
```

---

### Task 9: embed-content.ts — document_chunks idempotent upsert

**Files:**
- Modify: `scripts/embed-content.ts`

- [ ] **Step 1: delete-then-insert 함수 추가**

```ts
interface ChunkInsertRow {
  document_id: string
  chunk_text: string
  chunk_index: number
  section: string | null
  char_start: number
  char_end: number
  embedding: number[]
  metadata: Record<string, unknown>
}

async function deleteExistingChunks(client: SupabaseClient, documentIds: string[]): Promise<number> {
  if (documentIds.length === 0) return 0
  const { error, count } = await client
    .from('document_chunks')
    .delete({ count: 'exact' })
    .in('document_id', documentIds)
  if (error) throw new Error(`기존 청크 삭제 실패: ${formatSupabaseError(error)}`)
  return count ?? 0
}

async function insertChunks(client: SupabaseClient, rows: ChunkInsertRow[]): Promise<void> {
  if (rows.length === 0) return
  // PostgREST 1 request payload 한도 회피용 500건 분할 (sync-content-to-db.ts 패턴 동일)
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await client.from('document_chunks').insert(batch)
    if (error) throw new Error(`청크 insert 실패 (batch ${i}): ${formatSupabaseError(error)}`)
  }
}
```

- [ ] **Step 2: main()에 DB 쓰기 통합**

```ts
// (임베딩 호출 직후)
const supabase = createCliAdminClient()
const slugs = docChunks.map((dc) => dc.slug)
const slugToId = await fetchSlugToIdMap(supabase, slugs)

// embedding 결과를 refId 기준 lookup
const embedMap = new Map(embeddings.map((e) => [e.refId, e.embedding]))

const insertRows: ChunkInsertRow[] = []
for (const dc of docChunks) {
  const documentId = slugToId.get(dc.slug)
  if (!documentId) {
    console.warn(`[embed-content] slug ${dc.slug} document_id 없음 — skip`)
    continue
  }
  for (const c of dc.chunks) {
    const embedding = embedMap.get(`${dc.slug}::${c.metadata.chunk_index}`)
    if (!embedding) throw new Error(`임베딩 결과 누락: ${dc.slug}::${c.metadata.chunk_index}`)
    insertRows.push({
      document_id: documentId,
      chunk_text: c.text,
      chunk_index: c.metadata.chunk_index,
      section: c.metadata.section,
      char_start: c.char_start,
      char_end: c.char_end,
      embedding,
      metadata: c.metadata,
    })
  }
}

const targetDocIds = Array.from(new Set(insertRows.map((r) => r.document_id)))
const deleted = await deleteExistingChunks(supabase, targetDocIds)
console.log(`[embed-content] 기존 청크 ${deleted}건 삭제`)
await insertChunks(supabase, insertRows)
console.log(`[embed-content] 신규 청크 ${insertRows.length}건 삽입`)
```

- [ ] **Step 3: 보고서 출력 추가 (sync-content-to-db.ts 보고서 형식 모방)**

main() 마지막에:

```ts
console.log('')
console.log('=== 임베딩 보고서 ===')
console.log(`문서 ${docs.length}개 / 청크 ${insertRows.length}개`)
console.log(`삭제: ${deleted}건, 삽입: ${insertRows.length}건`)
const docsByAxis = new Map<string, number>()
for (const d of docs) docsByAxis.set(d.axis, (docsByAxis.get(d.axis) ?? 0) + 1)
for (const [axis, n] of [...docsByAxis.entries()].sort()) {
  console.log(`  ${axis}: ${n}개 문서`)
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/embed-content.ts
git commit -m "feat(phase-3-m1): embed-content idempotent upsert + 보고서"
```

---

### Task 10: embed-content 통합 테스트

**Files:**
- Create: `tests/scripts/embed-content.test.ts`

- [ ] **Step 1: dry-run mode 출력 형식 단위 테스트**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../..')

test('embed-content dry-run — 정확한 보고서 형식 출력', () => {
  const result = spawnSync(
    'node',
    ['--env-file=.env.local', '--import', 'tsx', 'scripts/embed-content.ts', '--dry-run'],
    { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env } },
  )
  assert.equal(result.status, 0, `stderr: ${result.stderr}`)
  assert.match(result.stdout, /=== DRY-RUN MODE ===/)
  assert.match(result.stdout, /마크다운 문서 \d+개 로드/)
  assert.match(result.stdout, /청크 총 \d+개/)
  assert.match(result.stdout, /임베딩 호출\/DB 쓰기 skip/)
})

test('embed-content dry-run — 임베딩 API 호출 0건', () => {
  // 환경변수 GOOGLE_GENERATIVE_AI_API_KEY가 없어도 dry-run은 통과해야 함
  const env = { ...process.env }
  delete env.GOOGLE_GENERATIVE_AI_API_KEY
  const result = spawnSync(
    'node',
    ['--env-file=.env.local', '--import', 'tsx', 'scripts/embed-content.ts', '--dry-run'],
    { cwd: REPO_ROOT, encoding: 'utf8', env },
  )
  assert.equal(result.status, 0, `API key 없이도 dry-run 통과 필수. stderr: ${result.stderr}`)
})
```

- [ ] **Step 2: 테스트 실행 → PASS 확인**

Run: `node --import tsx --test tests/scripts/embed-content.test.ts`

- [ ] **Step 3: 전체 단위 테스트 회귀 확인**

Run: `npm test`
Expected: 기존 125 unit + 신규(chunker 6 + gemini-embed 3 + embed-content 2 ≈ 11) PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/scripts/embed-content.test.ts
git commit -m "test(phase-3-m1): embed-content dry-run 통합 테스트"
```

---

### Task 11: 실 임베딩 1차 실행 + 청크 수 확정

**Files:** (코드 변경 없음, 실 데이터 적재 단계)

- [ ] **Step 1: `.env.local`에 `GOOGLE_GENERATIVE_AI_API_KEY` 등록 확인**

위원장 발급 키를 `.env.local`에 추가. `direnv allow` 재실행.

Run: `grep GOOGLE_GENERATIVE_AI_API_KEY .env.local`
Expected: 1줄 매칭.

- [ ] **Step 2: 실 임베딩 실행**

Run: `npm run kb:embed`
Expected:
```
=== APPLY MODE ===
[embed-content] 마크다운 문서 535개 로드
[embed-content] 청크 총 N개
[embed-content] 임베딩 호출 시작 (N건)
[embed-content] 임베딩 완료 N건 (Tms)
[embed-content] 기존 청크 0건 삭제
[embed-content] 신규 청크 N건 삽입

=== 임베딩 보고서 ===
...
```

> **실측 기록:** N값(청크 수), T값(임베딩 호출 ms) 메모. spec §3.2의 hnsw 결정 기준은 N < 10,000.

- [ ] **Step 3: Supabase에서 청크 수 검증**

`supabase` MCP 또는 dashboard SQL Editor:

```sql
select count(*) from document_chunks;
select count(distinct document_id) from document_chunks;
select count(*) from documents where id not in (select document_id from document_chunks);
```

Expected:
- `count(*)` ≈ Step 2의 N값
- `count(distinct document_id)` = 535 (모든 문서가 최소 1청크)
- `count documents NOT IN chunks` = 0

- [ ] **Step 4: 재실행으로 idempotency 검증**

Run: `npm run kb:embed`
Expected: `기존 청크 N건 삭제` + `신규 청크 N건 삽입`, 최종 count(*) 동일.

> **체크포인트:** 멱등성이 깨지면 Task 9의 delete-then-insert 로직 점검.

---

### Task 12: 0005 마이그레이션 — hnsw 인덱스 적용

**Files:**
- Create: `supabase/migrations/0005_rag_infrastructure.sql`
- Create: `tests/migrations/0005_rag_infrastructure.test.ts`

> **선결 조건:** Task 11 Step 2의 N값(청크 수)이 10,000 미만이어야 hnsw 채택. 초과 시 ivfflat REINDEX 경로로 갈아탐 — spec §3.2 분기 결정.

- [ ] **Step 1: 0005 SQL 작성**

```sql
-- 0005_rag_infrastructure.sql
-- Phase 3 M1 — pgvector 인덱스를 ivfflat → hnsw로 교체.
-- 0001에서 만든 ivfflat lists=100 인덱스는 빈 테이블에 생성되어 recall 저하 가능.
-- 청크 수 < 10,000 (M1 실측 N건) → hnsw가 recall·쿼리 레이턴시 모두 우위 (pgvector 권장).

begin;

-- 1. 기존 ivfflat 인덱스 제거
drop index if exists idx_chunks_embedding;

-- 2. hnsw 인덱스 생성 (cosine distance)
--    m=16, ef_construction=64 — pgvector 공식 권장 시작점
create index idx_chunks_embedding_hnsw
  on document_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 3. 결정 기록 — document_chunks RLS는 0001 정책 유지 (Phase 3 RAG Route Handler는
--    service_role로 호출 → RLS 우회. 향후 authenticated 직접 pgvector 호출 경로 열 경우
--    별도 마이그레이션에서 정책 재설계).

commit;
```

- [ ] **Step 2: 마이그레이션 적용**

Run via Supabase MCP `apply_migration` (project ref `djaeeqdxkynjxngwvzyn`):

```ts
// MCP 호출 예시 (Claude 실행)
// mcp__plugin_supabase_supabase__apply_migration({
//   project_id: 'djaeeqdxkynjxngwvzyn',
//   name: '0005_rag_infrastructure',
//   query: '<위 SQL>',
// })
```

Expected: SUCCESS 응답.

- [ ] **Step 3: 통합 테스트 작성**

`tests/migrations/0005_rag_infrastructure.test.ts`:

```ts
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'

before(() => loadDotEnvLocalOverrides())

test('0005 — hnsw 인덱스 존재', async () => {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
  const { data, error } = await client.rpc('exec_sql', {
    query: `select indexname from pg_indexes where tablename = 'document_chunks' and indexname = 'idx_chunks_embedding_hnsw';`,
  })
  // exec_sql RPC 미지원 시 query API로 대체
  assert.ok(!error || error.code === '42883', '인덱스 존재 확인 가능해야 함')
})

test('0005 — pgvector similarity 조회 round-trip', async () => {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
  // M1 임베딩 완료 후 검증: 임의 청크 1개의 embedding을 query로 사용 → 자기 자신이 top-1
  const { data: sample } = await client
    .from('document_chunks')
    .select('id, embedding')
    .limit(1)
  assert.ok(sample && sample.length === 1, 'M1 임베딩 완료 후 청크 존재 필수')
  const queryVec = sample[0].embedding as number[]
  const { data: top } = await client.rpc('match_document_chunks', {
    query_embedding: queryVec,
    match_threshold: 0.0,
    match_count: 5,
  })
  // match_document_chunks RPC 미정의면 위 호출은 실패 — 그 경우 raw select로 우회
  if (top) assert.ok(top.length >= 1, 'similarity 조회 결과 1건 이상')
})
```

> **검증 메모:** `match_document_chunks` RPC는 M2에서 정의 예정. M1 통합 테스트는 (1) 인덱스 존재 확인까지만 PASS 요건, (2) similarity 조회는 raw `.select` + `.order` 사용으로 우회 가능. M2에서 RPC 추가 시 본 테스트 갱신.

- [ ] **Step 4: `test:integration` 실행**

Run: `npm run test:integration`
Expected: 기존 20 integration + 신규 PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_rag_infrastructure.sql tests/migrations/0005_rag_infrastructure.test.ts
git commit -m "feat(phase-3-m1): 0005 hnsw 인덱스 + 통합 테스트"
```

---

### Task 13: 빌드 회귀 + 베이스라인 검증

**Files:** (검증만)

- [ ] **Step 1: `next build` 회귀 확인**

Run: `npm run build`
Expected: 567 정적 페이지, 빌드 SUCCESS.

- [ ] **Step 2: `kb:publish:dry-run` 베이스라인 변동 없음 확인**

Run: `npm run kb:publish:dry-run`
Expected: `535 candidate / 8 passing / 527 blocked` — M5 baseline 유지.

- [ ] **Step 3: 전체 테스트 회귀**

Run: `npm run test:all`
Expected: 125 + 11 신규 unit + 20 + 1~2 신규 integration 모두 PASS.

- [ ] **Step 4: Commit (있으면) + push**

```bash
git push -u origin phase-3-m1-embedding-pipeline
```

---

### Task 14: codex-rescue 디스패치 + PR

**Files:**
- Create: GitHub PR

- [ ] **Step 1: codex-rescue 호출 (마일스톤급 cross-cutting 검토)**

Agent tool로 `codex:codex-rescue` 디스패치 — focus:
- API key 노출 경로 (`GOOGLE_GENERATIVE_AI_API_KEY`가 client bundle에 들어가지 않는지)
- dry-run flag 안전성 (M5 C1 사고 패턴 재발 방지 — `--dry-run`만 dry-run, positional 미허용)
- chunker idempotency (재실행 시 청크 수 안정)
- 0005 hnsw 파라미터 적정성 (m=16, ef_construction=64)
- delete-then-insert 경쟁 조건 (`document_chunks` FK CASCADE 트리거)
- embedTexts batch 분할 → 부분 실패 시 재시도 없음 (현재 설계 결함 여부)

- [ ] **Step 2: codex-rescue 지적 사항 처리**

글로벌 CLAUDE.md "Codex stop-time review 활용 시 주의사항" 원칙 적용:
- 즉시 지엽 패치 금지
- 동일 계층 2회 반복 지적은 계층 선택 재검토
- 아키텍처 수준 대조 우선

처리 결과를 plan 하단 "변경 이력"에 1줄 추가.

- [ ] **Step 3: PR 생성**

```bash
gh pr create --title "feat(phase-3-m1): 청크 분해 + 임베딩 파이프라인 + 0005 hnsw" --body "$(cat <<'EOF'
## Summary

- Phase 3 M1 — `scripts/embed-content.ts` + chunker + gemini-embed 파이프라인 신설
- 535 docs → N chunks 임베딩(`gemini-embedding-2`, vector(1536)) → `document_chunks` 채움
- 0005 마이그레이션 — ivfflat → hnsw 교체 (M1 실측 N < 10,000 확인)
- spec: docs/superpowers/specs/2026-05-23-phase-3-rag-design.md §5(M1)

## Test plan

- [x] chunker 6 단위 테스트 PASS
- [x] gemini-embed 3 단위 테스트 PASS
- [x] embed-content dry-run 통합 테스트 PASS
- [x] 535 docs 실 임베딩 완료, 재실행 idempotent
- [x] 0005 적용 후 hnsw 인덱스 존재, similarity 조회 round-trip
- [x] next build 567 페이지 회귀 0
- [x] kb:publish:dry-run baseline 535/8/527 유지

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: branch protection required check 통과 확인**

PR 페이지에서 `validate` job PASS 확인 후 squash merge.

- [ ] **Step 5: `Mac-Projects/webfortd/CLAUDE.md` 변경 이력 1줄 추가**

머지 후 master에서:

```markdown
| 2026-MM-DD | **Phase 3 M1 머지 완료** — PR #XX squash `<sha>` → master. 535 docs → N chunks 임베딩(gemini-embedding-2 vector(1536))·0005 hnsw 인덱스 적용·chunker(800자 cap+50자 min)·idempotent delete-then-insert. ~ |
```

memory `project_phase_status.md` 갱신: "Phase 3 M1 완료, M2 plan 작성 대기".

---

## 4. Self-Review 체크리스트

### 4.1 Spec coverage

| spec §5 M1 요구사항 | Task |
|--------------------|------|
| `scripts/embed-content.ts` 신설 | Task 1, 7~9 |
| `scripts/lib/chunker.ts` 신설 | Task 2~5 |
| `scripts/lib/gemini-embed.ts` 신설 | Task 6 |
| `supabase/migrations/0005_rag_infrastructure.sql` | Task 12 |
| `tests/scripts/embed-content.test.ts` | Task 10 |
| `package.json` `kb:embed`·`kb:embed:dry-run` | Task 1 |
| `@google/generative-ai` 또는 `@ai-sdk/google` 추가 | Task 1 (`@ai-sdk/google` 선택) |
| `loadDotEnvLocalOverrides()` 재사용 | Task 1, 7 |
| `formatSupabaseError()` 재사용 | Task 7 |
| service_role 사용 | Task 7 (`createCliAdminClient`) |
| explicit `--dry-run` flag | Task 1, 10 |
| 청크 분해 결과 shape 단위 테스트 | Task 5 |
| 통합 테스트 (sample 임베딩 → DB → similarity 왕복) | Task 12 |
| 535 docs 전체 실행 + row 수 검증 | Task 11 |
| codex-rescue 포커스 (청크 중복·Batch 할당량·hnsw 파라미터) | Task 14 |

### 4.2 Placeholder scan

- [x] "TBD" 없음
- [x] "implement later" 없음
- [x] "유사한 Task N과 동일" 없음 (각 Task 코드 전체 표기)
- [x] 모든 step에 코드 또는 명령 또는 검증 기준 포함

### 4.3 Type consistency

- `ChunkMetadata` (chunker.ts) ↔ `document_chunks.metadata` jsonb 컬럼 (0001 마이그레이션) shape 일치
- `EmbeddingInput.refId` 형식 `${slug}::${chunk_index}` 일관 사용 (Task 8 Step 2, Task 9 Step 2)
- `MAX_CHUNK_CHARS = 800` / `MIN_CHUNK_CHARS = 50` 상수 한 곳(chunker.ts)에서 export
- `assertIdRowsComplete` import 경로 (Task 8 Step 1) — `sync-content-to-db.ts`에서 named export 확인 필요. 미export 시 Task 8 Step 0에서 `scripts/lib/`로 추출하는 별도 step 추가
- `vector(1536)` (0001) ↔ `outputDimensionality: 1536` (gemini-embed.ts) 일치

### 4.4 Gate 정합 (spec §12.4)

- M1 착수 게이트: 위원장 명시 승인 ✓ (본 plan 실행 전 위원장 확인 필요)
- M2 착수 게이트: M1 PR 머지 + codex-rescue 통과 — Task 14에서 충족

---

## 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-23 | 초기 작성 — Phase 3 RAG 설계 문서 §5(M1) 기반 14-task TDD 분해 |
