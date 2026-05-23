# Phase 3 M2 Retrieval API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 질의 → 임베딩 → pgvector cosine 검색 → 출처 메타데이터 보강 흐름을 server-only 함수 `retrieveChunks(queryText, opts)` 로 구현한다. 동시에 Phase 3 M1 머지 후 carry된 follow-up 3건을 함께 처리한다.

**Architecture:** `src/lib/rag/` 디렉터리 신설(types / admin-client / embed-query / retrieval). pgvector 검색은 Supabase RPC(`match_chunks`)로 래핑해 서버 코드의 응답 shape을 안정화한다. M1에서 reader gap이 있던 `delete-then-insert` 도 동일한 0006 마이그레이션에 `replace_document_chunks` RPC로 단일 트랜잭션화한다. Route Handler · UI 연결은 M3 범위 밖.

**Tech Stack:** Next.js 16 + React 19 (App Router) · Vercel AI SDK v6 (`ai`) + `@ai-sdk/google` v3 (`gemini-embedding-2-preview`, 1536-dim Matryoshka) · Supabase JS v2 (`@supabase/supabase-js`, service_role) · pgvector 0.7 (`hnsw m=16, ef_construction=64`, 0005에서 도입) · `node:test` + `tsx` (단위·통합 테스트, `allowImportingTsExtensions=true`, M1 setup 계승) · `server-only` 가드 패키지(이미 dependency)

---

## 0. Context (zero-context 엔지니어용 짧은 브리핑)

**webfortd가 무엇인가**: 장애인교원 정책 지식베이스 + RAG 채팅을 구축하는 Next.js 풀스택 프로젝트다. 535개 마크다운 정본(content/**/*.md) → Supabase `documents`·`document_chunks`로 동기화 → pgvector 검색 → Gemini 응답. M1에서 1606 청크 임베딩까지 완료(`gemini-embedding-2-preview`, 1536-dim, hnsw 인덱스).

**M2의 역할**: 채팅 UI나 Gemini 응답 생성은 M3·M4에서. M2는 "질문 → 관련 청크 5개 + 출처 메타데이터" 까지를 깔끔한 서버 전용 함수로 만들고 정밀 단위 테스트한다. M3 Route Handler가 이 함수를 호출하는 형태.

**M1 carry-over 3건** (위원장과 controller가 M1 codex-rescue 후 합의):
1. `applyCharLimits`가 800자 cap을 단일 문단에서 미보장 — 800자 초과 단일 문단을 split하는 fallback 필요.
2. `delete-then-insert` reader gap — embed-content.ts가 DELETE → INSERT 두 단계 사이에 reader가 빈 상태를 볼 수 있음. M3 Route Handler가 진입하기 전에 단일 트랜잭션 RPC로 차단.
3. 모델·dim hardcode — `gemini-embedding-2-preview` / `1536`가 상수로 박혀 있어 향후 모델 교체·실험이 어려움. env override 도입 + 보고서에 model/dim 출력.

**중요 invariant**:
- `kb:publish` dry-run baseline `535/8/527` (전체/passing/blocked) 변동 금지.
- `next build` 567 정적 페이지 유지.
- 162 unit + 23 integration 테스트 기존 그린 유지 (M2에서 ↑).
- 모든 신규 plpgsql 함수는 `set search_path = ''` 가드 필수 (0003·0004 패턴).
- 모든 `src/lib/rag/*` 모듈은 `import 'server-only'` 가드 첫 줄 (`SUPABASE_SECRET_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` 클라이언트 노출 차단).
- 모든 server-side write는 service_role 사용 (Phase 2 finding 1 옵션 B 원칙 — DB write = service_role만).

---

## 1. File Structure

### 신규 파일

| 파일 | 책임 |
|------|------|
| `src/lib/rag/types.ts` | `RetrievedChunk`·`SourceRef`·`RetrieveOptions`·`RetrievalResult` 타입 (server·client 공용 안전 — 값만, 함수 없음) |
| `src/lib/rag/admin-client.ts` | `createRagAdminClient()` service_role Supabase client (server-only) |
| `src/lib/rag/embed-query.ts` | `embedQuery(queryText)` 단일 임베딩 호출 (server-only, `embedTexts` 재사용) |
| `src/lib/rag/retrieval.ts` | `retrieveChunks(queryText, opts)` 본체 (server-only, `match_chunks` RPC 호출 + slug dedup) |
| `supabase/migrations/0006_rag_runtime_rpcs.sql` | `replace_document_chunks` (M1 carry #2) + `match_chunks` (M2 본체) RPC |
| `tests/rag/types.test.ts` | 타입 export 회귀 가드 (run-time 검증 — 빈 객체 instantiation) |
| `tests/rag/embed-query.test.ts` | `embedQuery` 단위 테스트 (empty input 거부, length-1 검증) |
| `tests/rag/retrieval.test.ts` | `retrieveChunks` 단위 테스트 (mock client, slug dedup) |
| `tests/migrations/0006_rag_runtime_rpcs.test.ts` | RPC 통합 테스트 (replace round-trip, match similarity 점수, RLS service_role 게이트) |
| `tests/scripts/chunker-cap.test.ts` | `splitLongParagraph` 단위 테스트 (M1 carry #1) |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `scripts/lib/chunker.ts` | `splitLongParagraph()` 추가 + `applyCharLimits` 안에서 호출 (M1 carry #1) |
| `scripts/lib/gemini-embed.ts` | `MODEL_NAME`·`OUTPUT_DIMENSIONALITY` 상수를 `getEmbedModel()`·`getEmbedDim()` 함수로 교체 + env override (M1 carry #3) |
| `scripts/embed-content.ts` | (a) `replace_document_chunks` RPC 호출로 deleteExistingChunks+insertChunks 대체 (M1 carry #2). (b) 보고서 헤더에 model/dim 출력 (M1 carry #3) |
| `tests/scripts/chunker.test.ts` | 회귀 (기존 테스트 통과 유지, 신규 cap 동작 확인) |
| `tests/scripts/gemini-embed.test.ts` | 회귀 (env override 적용 가능 확인) |
| `tests/scripts/embed-content.test.ts` | 회귀 (M1에서 만든 보고서 형식 + model/dim line 추가) |

### 변경 안 함

- `supabase/migrations/0005_rag_infrastructure.sql` (hnsw 인덱스 — M1 완료)
- `package.json` (dependencies — `ai`·`@ai-sdk/google`·`@supabase/supabase-js` 모두 이미 있음)
- `src/lib/supabase/server.ts` (Auth용 SSR 클라이언트 — RAG와 무관)

---

## 2. Worktree Setup

이 plan 작성 시점에 `phase-3-m2-plan` 브랜치 worktree(`../webfortd-phase-3-m2-plan`)는 이미 master 기반으로 생성되어 있다. 구현 단계에서는 **별도의 새 worktree**를 만들어 plan 머지 후 구현 작업과 격리한다 (master에 unsaved 13건이 있어 위원장 작업과 충돌 가능).

```bash
# plan 머지 완료 후 (master에 plan 파일이 들어간 상태에서) 구현 worktree 신규 생성
cd /Users/hunyongkim/Mac-Projects/webfortd
git fetch origin
git worktree add -b phase-3-m2-impl ../webfortd-phase-3-m2-impl origin/master
cd ../webfortd-phase-3-m2-impl
```

Implementer subagent는 `cd ../webfortd-phase-3-m2-impl` 가 cwd 라고 가정하고 모든 명령을 실행한다.

---

## 3. 결정 잠금 (변경 금지)

이 plan 내에서 재논의하지 않는다. 모두 위원장·controller 협의·spec §2 결정의 결과.

| ID | 결정 | 근거 |
|----|------|------|
| D1 | `gemini-embedding-2-preview` / 1536-dim 유지. env override는 향후 실험용이지 즉시 변경용 아님. | spec §2 V1, M1 실측 |
| D2 | `replace_document_chunks` RPC는 single-document scope. bulk 일괄 RPC는 lock contention·실패 격리 측면에서 불리. | per-doc 트랜잭션이 reader gap 차단 + 실패 시 다른 doc 영향 없음 |
| D3 | `match_chunks` 는 PostgREST `.rpc()` 로 호출. raw `<=>` SQL 직접 작성 금지 — RPC 안에서 vector cast 통일. | supabase-js는 number[] 인자를 `float8[]` 로 직렬화 → 함수 안에서 `::vector(1536)` cast 안전 |
| D4 | `topK` 기본값 5, `minSimilarity` 기본값 0.0, `includeDrafts` 기본값 true. | spec §7.2 (k=5) + Phase 2 M3 finding (status='draft' 도 검색 가능해야 함) |
| D5 | source_refs는 slug 기준 dedup (첫 등장 1개만). 같은 doc의 청크가 top-k에 여러 개 들어와도 인용 카드는 1개. | spec §4.4 |
| D6 | M2 retrieval 함수는 service_role 사용. RLS 우회. anon 직접 호출 경로는 M3에서 Route Handler를 통해서만 노출. | spec §3.2 결정 기록 |
| D7 | `src/lib/rag/*` 는 `scripts/lib/gemini-embed.ts` 를 relative import. 코드 이동 리팩토링은 plan 범위 밖. | YAGNI — gemini-embed.ts는 server-only context 안에서만 호출 |
| D8 | `splitLongParagraph` 는 (1) sentence boundary split → (2) hard char-slice fallback 2단계. overlap 없음. | spec §6.2 — 검색 정밀도 우선, overlap 중복 검색 회피 |
| D9 | `embed-content.ts` 보고서는 model/dim 을 헤더 첫 줄에 출력. apply mode·dry-run mode 둘 다 동일. | M5 C1 사고 교훈 — 환경 차이를 보고서로 즉시 확인 가능해야 함 |

---

## 4. 마일스톤 분해 (12 tasks)

### 4.1 Part A — M1 carry-over 처리 (Tasks 1~4)

M2 본체 retrieval 함수가 들어가기 전에 carry-over 3건을 먼저 정리한다. Order: chunker 안전성 → env override → RPC 인프라 → embed-content 전환. RPC 작성은 M2 본체 RPC(`match_chunks`)와 같은 0006 마이그레이션 파일에 묶음.

### 4.2 Part B — M2 retrieval API (Tasks 5~9)

types → admin-client → embed-query → retrieval 본체 → 통합/smoke. 각 모듈이 독립 import 경계라서 task가 끝날 때마다 부분 commit 가능.

### 4.3 Part C — 마이그레이션 적용 + 검토 + 머지 (Tasks 10~12)

Supabase CLI로 0006 push → 회귀 통합 테스트 → codex-rescue dispatch → PR 생성.

---

## Task 1: chunker — 단일 문단 800자 cap split fallback (M1 carry #1)

**Why**: `applyCharLimits`가 H2 섹션을 paragraph 단위(`\n\n`)로 자르지만, 단일 paragraph 자체가 800자 초과인 경우 그대로 push되어 cap 미보장. 정책 문서의 긴 표·법령 인용 paragraph 에서 자주 발생.

**Files:**
- Modify: `scripts/lib/chunker.ts`
- Test: `tests/scripts/chunker-cap.test.ts` (신규)
- Test: `tests/scripts/chunker.test.ts` (회귀 — 기존 테스트는 그대로 통과)

- [ ] **Step 1: Write the failing test (단일 문단 > 800자)**

`tests/scripts/chunker-cap.test.ts` 신규:

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  splitLongParagraph,
  applyCharLimits,
  MAX_CHUNK_CHARS,
} from '../../scripts/lib/chunker.ts'

describe('splitLongParagraph (M1 carry #1)', () => {
  test('짧은 문단은 단일 원소 배열 반환', () => {
    const p = '짧은 문단입니다. 800자 미만.'
    assert.deepEqual(splitLongParagraph(p), [p])
  })

  test('800자 초과 문단을 sentence boundary로 split', () => {
    // 한국어 문장 부호로 끝나는 5개 문장, 각 200자 = 총 1000자
    const sentence = '가'.repeat(199) + '.'
    const long = Array(5).fill(sentence).join(' ')
    const result = splitLongParagraph(long)
    assert.ok(result.length >= 2, `2개 이상 split 필요. got ${result.length}`)
    for (const chunk of result) {
      assert.ok(
        chunk.length <= MAX_CHUNK_CHARS,
        `cap 위반: ${chunk.length}자`,
      )
    }
  })

  test('sentence boundary가 없는 800자 초과 문단은 hard slice', () => {
    // 마침표·줄바꿈 없는 1500자
    const noBoundary = '가'.repeat(1500)
    const result = splitLongParagraph(noBoundary)
    assert.ok(result.length >= 2)
    for (const chunk of result) {
      assert.ok(chunk.length <= MAX_CHUNK_CHARS)
    }
    // 모든 글자 보존
    assert.equal(result.join('').length, 1500)
  })

  test('빈 문단은 빈 배열', () => {
    assert.deepEqual(splitLongParagraph(''), [])
  })
})

describe('applyCharLimits + splitLongParagraph 통합', () => {
  test('800자 초과 단일 문단을 포함한 섹션은 cap 모두 통과', () => {
    const section = {
      section: '## 긴 섹션',
      text: '가'.repeat(1500),
    }
    const result = applyCharLimits([section])
    for (const r of result) {
      assert.ok(
        r.text.length <= MAX_CHUNK_CHARS,
        `cap 위반: ${r.text.length}자 in ${r.section}`,
      )
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern="splitLongParagraph"
```

Expected: FAIL — `splitLongParagraph is not exported from chunker.ts` 또는 `cap 위반: 1500자`.

- [ ] **Step 3: Implement splitLongParagraph + applyCharLimits 통합**

`scripts/lib/chunker.ts` 수정:

```ts
// 기존 export const MAX_CHUNK_CHARS = 800 아래에 추가

/**
 * 문장 경계 후보 정규식 — 한국어/영어 마침표·물음표·느낌표·전각부호·줄바꿈
 * lookbehind: 부호 뒤에서만 split (부호는 직전 문장에 붙어 남음)
 */
const SENTENCE_BOUNDARY = /(?<=[\.!\?。！？\n])\s+/

/**
 * 800자 초과 단일 문단을 sentence boundary 단위로 split.
 * sentence가 여전히 800자 초과면 hard char-slice fallback.
 * 모든 글자 보존 (정보 손실 없음).
 */
export function splitLongParagraph(p: string): string[] {
  if (p.length === 0) return []
  if (p.length <= MAX_CHUNK_CHARS) return [p]

  // 1단계: sentence boundary로 split
  const sentences = p.split(SENTENCE_BOUNDARY).filter((s) => s.length > 0)
  const merged: string[] = []
  let buf = ''
  for (const s of sentences) {
    const candidate = buf ? buf + ' ' + s : s
    if (candidate.length > MAX_CHUNK_CHARS && buf) {
      merged.push(buf)
      buf = s
    } else {
      buf = candidate
    }
  }
  if (buf) merged.push(buf)

  // 2단계: 여전히 cap 초과면 hard slice
  const final: string[] = []
  for (const chunk of merged) {
    if (chunk.length <= MAX_CHUNK_CHARS) {
      final.push(chunk)
    } else {
      for (let i = 0; i < chunk.length; i += MAX_CHUNK_CHARS) {
        final.push(chunk.slice(i, i + MAX_CHUNK_CHARS))
      }
    }
  }
  return final
}
```

`applyCharLimits` 안의 큰 섹션 처리 분기에서 `paragraphs` loop을 다음으로 교체:

```ts
    // 큰 섹션은 문단(빈 줄) 단위로 800자 cap 적용
    if (sec.text.length > MAX_CHUNK_CHARS) {
      if (buffer) {
        result.push(buffer)
        buffer = null
      }
      const paragraphs = sec.text.split(/\n\n+/)
      let chunk = ''
      for (const p of paragraphs) {
        // M1 carry #1: 단일 문단이 cap 초과면 split 후 각각 처리
        const pieces = splitLongParagraph(p)
        for (const piece of pieces) {
          if ((chunk + '\n\n' + piece).length > MAX_CHUNK_CHARS && chunk) {
            result.push({ section: sec.section, text: chunk.trim() })
            chunk = piece
          } else {
            chunk = chunk ? chunk + '\n\n' + piece : piece
          }
        }
      }
      if (chunk.trim()) result.push({ section: sec.section, text: chunk.trim() })
      continue
    }
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --test-name-pattern="splitLongParagraph"
npm test -- --test-name-pattern="chunker"
```

Expected: PASS (신규 + 기존 회귀).

- [ ] **Step 5: 회귀 — 535 docs 청크 분해 재실행 dry-run (M1 baseline 1606 유지)**

```bash
npm run kb:embed:dry-run
```

Expected: 보고서에 `청크 총 1606개` 또는 그 근처 (단일 문단 split이 추가 청크를 만들 수도 있음 — Step 6에서 baseline 갱신).

- [ ] **Step 6: dry-run 결과를 plan baseline에 박기 (실측치로 commit message에 기록)**

만약 1606이 1610 이상으로 늘었다면 그게 새 baseline. 0005 통합 테스트의 1000 임계는 그대로 (1606→1610 변화는 1000 이상이라 영향 없음).

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/chunker.ts tests/scripts/chunker-cap.test.ts
git commit -m "$(cat <<'EOF'
fix(chunker): 800자 cap 단일 문단 split fallback (M1 carry #1)

applyCharLimits가 \n\n paragraph 단위로만 자르고 단일 문단 >800자
경우는 그대로 push되어 cap 미보장이던 문제 fix.

splitLongParagraph()을 신규 export — (1) sentence boundary split →
(2) hard char-slice fallback. 모든 글자 보존.

dry-run 청크 baseline 1606 → <실측치> (commit message 갱신).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: gemini-embed — model/dim env override + getter 함수화 (M1 carry #3)

**Why**: `MODEL_NAME` / `OUTPUT_DIMENSIONALITY` 가 모듈 상수로 박혀 있어 향후 모델 교체·실험·dim 변경이 코드 수정을 요구한다. env override + getter 함수로 변경하면 `EMBED_MODEL=gemini-embedding-3 EMBED_DIM=3072 npm run kb:embed` 같은 호출이 가능해진다.

**Files:**
- Modify: `scripts/lib/gemini-embed.ts`
- Modify: `scripts/embed-content.ts`
- Test: `tests/scripts/gemini-embed.test.ts` (회귀)
- Test: `tests/scripts/embed-content-report.test.ts` (신규 — 보고서 헤더 line)

- [ ] **Step 1: Write the failing test (env override)**

`tests/scripts/gemini-embed.test.ts` 끝에 추가:

```ts
import { getEmbedModel, getEmbedDim } from '../../scripts/lib/gemini-embed.ts'

describe('env override (M1 carry #3)', () => {
  test('EMBED_MODEL 미설정 시 기본값 gemini-embedding-2-preview', () => {
    delete process.env.EMBED_MODEL
    assert.equal(getEmbedModel(), 'gemini-embedding-2-preview')
  })

  test('EMBED_MODEL 설정 시 그 값 반환', () => {
    process.env.EMBED_MODEL = 'gemini-embedding-3'
    try {
      assert.equal(getEmbedModel(), 'gemini-embedding-3')
    } finally {
      delete process.env.EMBED_MODEL
    }
  })

  test('EMBED_DIM 미설정 시 1536', () => {
    delete process.env.EMBED_DIM
    assert.equal(getEmbedDim(), 1536)
  })

  test('EMBED_DIM 설정 시 그 값 (number) 반환', () => {
    process.env.EMBED_DIM = '768'
    try {
      assert.equal(getEmbedDim(), 768)
    } finally {
      delete process.env.EMBED_DIM
    }
  })

  test('EMBED_DIM 비숫자 값은 throw', () => {
    process.env.EMBED_DIM = 'abc'
    try {
      assert.throws(() => getEmbedDim(), /EMBED_DIM/)
    } finally {
      delete process.env.EMBED_DIM
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern="env override"
```

Expected: FAIL — `getEmbedModel is not exported`.

- [ ] **Step 3: Implement env override in gemini-embed.ts**

`scripts/lib/gemini-embed.ts` 상단 export 교체:

```ts
// ─── 상수 / env override ───────────────────────────────────────────────────
const DEFAULT_MODEL = 'gemini-embedding-2-preview'
const DEFAULT_DIM = 1536

export function getEmbedModel(): string {
  return process.env.EMBED_MODEL ?? DEFAULT_MODEL
}

export function getEmbedDim(): number {
  const raw = process.env.EMBED_DIM
  if (raw === undefined) return DEFAULT_DIM
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 8192) {
    throw new Error(`Invalid EMBED_DIM env: "${raw}" — must be integer 1..8192`)
  }
  return n
}

export const BATCH_SIZE = 100
// 기존 export const MODEL_NAME / OUTPUT_DIMENSIONALITY는 제거 (named export 깨지지 않게 아래 호환 행 박음)
export const MODEL_NAME = getEmbedModel()
export const OUTPUT_DIMENSIONALITY = getEmbedDim()
```

**주의**: `MODEL_NAME` / `OUTPUT_DIMENSIONALITY` re-export는 모듈 load time에 한 번 evaluate되므로 env override가 늦게 들어오면 stale 값이 됨. 실 호출 경로는 모두 `getEmbedModel()` / `getEmbedDim()` 함수 호출로 교체.

`embedTexts` 내부에서 사용처 교체:

```ts
  if (inputs.length === 0) return []
  assertEmbedEnv()

  const modelName = getEmbedModel()
  const dim = getEmbedDim()
  const model = google.embedding(modelName)
  const results: EmbeddingResult[] = []

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE)
    const values = batch.map((inp) => inp.text)

    let embeddings: number[][]
    try {
      const response = await embedMany({
        model,
        values,
        providerOptions: {
          google: {
            outputDimensionality: dim,
          },
        },
      })
      embeddings = response.embeddings
    } catch (err) {
      const firstRef = batch[0]?.refId ?? '(empty)'
      throw new Error(
        `embedMany 실패 (model=${modelName}, batch start=${i}, first refId=${firstRef}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    if (embeddings.length !== batch.length) {
      const firstRef = batch[0]?.refId ?? '(empty)'
      throw new Error(
        `embedMany 응답 길이 불일치 (batch start=${i}, first refId=${firstRef}): expected ${batch.length}, got ${embeddings.length}`,
      )
    }

    if (i === 0 && embeddings[0]?.length !== dim) {
      throw new Error(
        `embedMany 임베딩 차원 불일치: expected ${dim}, got ${embeddings[0]?.length}. providerOptions.google.outputDimensionality가 무시됐을 가능성. (model=${modelName})`,
      )
    }

    for (let j = 0; j < batch.length; j++) {
      results.push({ refId: batch[j].refId, embedding: embeddings[j] })
    }
  }

  return results
```

- [ ] **Step 4: Run unit tests**

```bash
npm test -- --test-name-pattern="env override"
npm test -- --test-name-pattern="gemini-embed"
```

Expected: PASS (회귀 + 신규).

- [ ] **Step 5: Write the failing test (embed-content 보고서 헤더)**

`tests/scripts/embed-content-report.test.ts` 신규:

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

describe('embed-content 보고서 헤더 (M1 carry #3)', () => {
  test('dry-run 출력에 모델/dim 한 줄 포함', () => {
    const repo = path.resolve(__dirname, '../..')
    const result = spawnSync(
      'node',
      ['--import', 'tsx', 'scripts/embed-content.ts', '--dry-run'],
      { cwd: repo, encoding: 'utf8', timeout: 60_000 },
    )
    // dry-run은 DB·SDK 호출 없이 안전. fixture 없이도 fail 안 함.
    const out = result.stdout + result.stderr
    assert.match(
      out,
      /모델:\s*gemini-embedding-2-preview\s*\/\s*dim:\s*1536/,
      `보고서 헤더에 model/dim 누락. stdout=${result.stdout.slice(0, 500)}`,
    )
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm test -- --test-name-pattern="embed-content 보고서 헤더"
```

Expected: FAIL — 헤더에 model/dim line 없음.

- [ ] **Step 7: Implement 보고서 헤더 in embed-content.ts**

`scripts/embed-content.ts` 의 `main()` 첫 줄에 추가:

```ts
import { embedTexts, getEmbedModel, getEmbedDim, type EmbeddingInput } from './lib/gemini-embed.ts'
// ...
async function main(): Promise<void> {
  console.log(dryRun ? '=== DRY-RUN MODE ===' : '=== APPLY MODE ===')
  console.log(`모델: ${getEmbedModel()} / dim: ${getEmbedDim()}`)
  const docs = loadDocuments()
  // ... 이하 기존 코드
}
```

또한 마지막 보고서 끝에도 footer로 한 번 더 출력:

```ts
  console.log('')
  console.log('=== 임베딩 보고서 ===')
  console.log(`모델: ${getEmbedModel()} / dim: ${getEmbedDim()}`)
  console.log(`문서 ${docs.length}개 / 청크 ${insertRows.length}개`)
  // ... 기존 라인
```

- [ ] **Step 8: Run tests**

```bash
npm test -- --test-name-pattern="embed-content 보고서 헤더"
npm test -- --test-name-pattern="embed-content"
```

Expected: PASS.

- [ ] **Step 9: dry-run 시각 확인**

```bash
npm run kb:embed:dry-run | head -5
```

Expected stdout 첫 3줄:
```
=== DRY-RUN MODE ===
모델: gemini-embedding-2-preview / dim: 1536
[embed-content] 마크다운 문서 535개 로드
```

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/gemini-embed.ts scripts/embed-content.ts tests/scripts/gemini-embed.test.ts tests/scripts/embed-content-report.test.ts
git commit -m "$(cat <<'EOF'
feat(embed): EMBED_MODEL/EMBED_DIM env override + 보고서 헤더 (M1 carry #3)

상수로 박혀있던 gemini-embedding-2-preview / 1536을 env override 가능한
getter 함수로 교체. 향후 모델 교체·실험·dim 변경이 코드 수정 없이 가능.

embed-content.ts 보고서 시작·끝에 "모델: <name> / dim: <n>" 한 줄 추가
— 환경 차이를 즉시 확인 가능 (M5 C1 사고 교훈 연장).

기존 MODEL_NAME / OUTPUT_DIMENSIONALITY named export는 backward compat
보존 (load-time stale 값 주의 — 신규 코드는 getter 사용 권장).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 0006 마이그레이션 — replace_document_chunks + match_chunks RPC

**Why**: (M1 carry #2) `delete-then-insert` 사이 reader gap이 M3 Route Handler 진입 시점에 문제가 됨 — 빈 chunks 상태를 사용자가 볼 수 있음. (M2 본체) Route Handler는 raw SQL을 갖지 않고 RPC만 호출 — vector cast·status 필터·JOIN 로직을 DB에 가둬서 코드 안정성 확보.

두 RPC를 같은 0006 마이그레이션에 묶는 이유: 마이그레이션 번호 절약 + 둘 다 RAG runtime 도메인.

**Files:**
- Create: `supabase/migrations/0006_rag_runtime_rpcs.sql`
- Test: `tests/migrations/0006_rag_runtime_rpcs.test.ts` (신규)

- [ ] **Step 1: Write the failing test (RPC 존재 + replace round-trip + match similarity)**

`tests/migrations/0006_rag_runtime_rpcs.test.ts` 신규:

```ts
/**
 * 0006_rag_runtime_rpcs 통합 테스트.
 *
 * 전제: 0006 마이그레이션이 webfortd-prod에 push되어 있어야 함.
 * Controller가 supabase db push 후 실행한다.
 *
 * 검증:
 *   1) replace_document_chunks RPC 존재 + round-trip (insert→read→re-insert→read 동일)
 *   2) match_chunks RPC 존재 + topK / similarity 점수 형식
 *   3) service_role grant 정합성 (anon 호출 시 거부)
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const skipReason =
  !url || !secretKey || !anonKey
    ? 'env 미설정 (test:integration으로 실행 — URL / SECRET_KEY / ANON_KEY 필요)'
    : false

describe('0006_rag_runtime_rpcs', { skip: skipReason }, () => {
  let admin: SupabaseClient
  let anon: SupabaseClient

  before(() => {
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const s = process.env.SUPABASE_SECRET_KEY!
    const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    admin = createClient(u, s, { auth: { persistSession: false, autoRefreshToken: false } })
    anon = createClient(u, a, { auth: { persistSession: false, autoRefreshToken: false } })
  })

  test('match_chunks RPC — topK=3, 임의 zero-vector → 3건 반환 + similarity 형식', async () => {
    const zeroVec = new Array(1536).fill(0)
    const { data, error } = await admin.rpc('match_chunks', {
      p_query_embedding: zeroVec,
      p_top_k: 3,
      p_min_similarity: -1,  // zero-vector는 cosine 정의불가 → 모든 비교 결과 NaN/0 영역. -1 cap으로 통과
      p_include_drafts: true,
    })
    assert.equal(error, null, error?.message)
    assert.ok(Array.isArray(data))
    assert.ok((data as unknown[]).length === 3 || (data as unknown[]).length === 0,
      `topK=3 expected ≤3 rows, got ${(data as unknown[]).length}`)
    if ((data as unknown[]).length > 0) {
      const row = (data as Array<Record<string, unknown>>)[0]
      assert.ok('chunk_id' in row)
      assert.ok('document_slug' in row)
      assert.ok('similarity' in row)
    }
  })

  test('match_chunks — anon 호출 시 거부 (service_role 전용)', async () => {
    const zeroVec = new Array(1536).fill(0)
    const { error } = await anon.rpc('match_chunks', {
      p_query_embedding: zeroVec,
      p_top_k: 3,
      p_min_similarity: -1,
      p_include_drafts: true,
    })
    // PostgREST는 grant 미충족 시 PGRST 또는 42501 반환
    assert.ok(error, 'anon 호출은 차단되어야 함')
  })

  test('replace_document_chunks — 빈 chunks 배열은 0 반환 + 기존 청크 삭제', async () => {
    // 임의 document 1건 선택
    const { data: docRow } = await admin
      .from('documents')
      .select('id')
      .limit(1)
      .single()
    assert.ok(docRow?.id)

    // 호출 (실수로 production data 날리지 않게 — 호출 후 즉시 복원 책임은 본 테스트 밖)
    // 본 테스트는 production 데이터에 mutate를 일으키므로 cleanup 후 검증
    const { data: before } = await admin
      .from('document_chunks')
      .select('chunk_index, chunk_text, embedding, metadata, section')
      .eq('document_id', docRow.id)
      .order('chunk_index')

    assert.ok(before && before.length > 0, '대상 doc은 청크 존재해야 함')

    // empty array — DELETE만 일어나고 INSERT 0건
    const { data: emptyResult, error: emptyErr } = await admin.rpc(
      'replace_document_chunks',
      { p_document_id: docRow.id, p_chunks: [] },
    )
    assert.equal(emptyErr, null, emptyErr?.message)
    assert.equal(emptyResult, 0)

    // 청크 0건 확인
    const { count: midCount } = await admin
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docRow.id)
    assert.equal(midCount, 0)

    // 원래 청크 재삽입 (mutation 복원)
    const restorePayload = before.map((c) => ({
      chunk_index: c.chunk_index,
      chunk_text: c.chunk_text,
      embedding: c.embedding,
      metadata: c.metadata,
      section: c.section,
    }))
    const { data: restoredCount, error: restoreErr } = await admin.rpc(
      'replace_document_chunks',
      { p_document_id: docRow.id, p_chunks: restorePayload },
    )
    assert.equal(restoreErr, null, restoreErr?.message)
    assert.equal(restoredCount, before.length)
  })

  test('replace_document_chunks — anon 호출 시 거부', async () => {
    const { error } = await anon.rpc('replace_document_chunks', {
      p_document_id: '00000000-0000-0000-0000-000000000000',
      p_chunks: [],
    })
    assert.ok(error, 'anon 호출은 차단되어야 함')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:integration -- --test-name-pattern="0006_rag_runtime"
```

Expected: FAIL — RPC `match_chunks` / `replace_document_chunks` 미존재.

- [ ] **Step 3: Write 0006 마이그레이션 SQL**

`supabase/migrations/0006_rag_runtime_rpcs.sql` 신규:

```sql
-- 0006_rag_runtime_rpcs.sql
-- Phase 3 M2 — RAG runtime RPCs
--   1) replace_document_chunks: single-document atomic delete+insert
--      (M1 carry #2 — reader gap 차단, M3 Route Handler 진입 전 필수)
--   2) match_chunks: pgvector cosine 검색 + documents JOIN + status 필터
--      (M2 본체 retrieval 함수의 DB-side wrapper)
--
-- 두 함수 모두 service_role 전용. anon/authenticated grant 제거.
-- 0003·0004 패턴 계승: set search_path = '' 가드 적용.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) replace_document_chunks
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.replace_document_chunks(
  p_document_id uuid,
  p_chunks jsonb
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int := 0;
begin
  if p_document_id is null then
    raise exception 'replace_document_chunks: p_document_id is required';
  end if;

  -- documents row 존재 확인 (FK 미존재 시 INSERT가 실패하므로 사전 가드)
  if not exists (select 1 from public.documents where id = p_document_id) then
    raise exception 'replace_document_chunks: document_id % not found', p_document_id;
  end if;

  -- atomic delete (트랜잭션 안)
  delete from public.document_chunks
  where document_id = p_document_id;

  -- 빈 배열이면 delete만 수행
  if p_chunks is null or jsonb_array_length(p_chunks) = 0 then
    return 0;
  end if;

  -- jsonb array → row insert (vector cast는 array literal text)
  insert into public.document_chunks (
    document_id,
    chunk_index,
    chunk_text,
    embedding,
    metadata,
    section,
    char_start,
    char_end
  )
  select
    p_document_id,
    (chunk->>'chunk_index')::int,
    chunk->>'chunk_text',
    (chunk->'embedding')::text::public.vector(1536),
    coalesce(chunk->'metadata', '{}'::jsonb),
    chunk->>'section',
    nullif(chunk->>'char_start', '')::int,
    nullif(chunk->>'char_end', '')::int
  from jsonb_array_elements(p_chunks) chunk;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.replace_document_chunks(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_document_chunks(uuid, jsonb) to service_role;

comment on function public.replace_document_chunks(uuid, jsonb) is
  'Phase 3 M2 — single-document atomic delete+insert for chunks. service_role only.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2) match_chunks — pgvector cosine 검색
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.match_chunks(
  p_query_embedding float8[],
  p_top_k int default 5,
  p_min_similarity float default 0.0,
  p_include_drafts boolean default true
) returns table (
  chunk_id uuid,
  document_id uuid,
  chunk_text text,
  section text,
  chunk_index int,
  metadata jsonb,
  document_slug text,
  document_title text,
  document_axis text,
  document_type text,
  document_status text,
  similarity float
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query public.vector(1536) := p_query_embedding::public.vector(1536);
begin
  if p_top_k is null or p_top_k < 1 or p_top_k > 50 then
    raise exception 'match_chunks: p_top_k must be 1..50, got %', p_top_k;
  end if;

  return query
  select
    c.id          as chunk_id,
    c.document_id,
    c.chunk_text,
    c.section,
    c.chunk_index,
    c.metadata,
    d.slug        as document_slug,
    d.title       as document_title,
    d.axis        as document_axis,
    d.type        as document_type,
    d.status      as document_status,
    (1 - (c.embedding <=> v_query))::float as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (p_include_drafts or d.status = 'published')
    and (1 - (c.embedding <=> v_query)) >= p_min_similarity
  order by c.embedding <=> v_query
  limit p_top_k;
end;
$$;

revoke all on function public.match_chunks(float8[], int, float, boolean) from public, anon, authenticated;
grant execute on function public.match_chunks(float8[], int, float, boolean) to service_role;

comment on function public.match_chunks(float8[], int, float, boolean) is
  'Phase 3 M2 — pgvector cosine kNN with documents metadata JOIN. service_role only.';

commit;
```

**SQL 주의사항**:
- `(chunk->'embedding')::text::public.vector(1536)` — jsonb array → text(`[0.1,0.2,…]`) → vector. pgvector 0.5+ 호환.
- `<=>` 는 cosine distance (0=동일, 2=정반대). similarity = `1 - distance`.
- `p_top_k > 50` 거부 — context 폭발 방어. M3 Route Handler에서도 client 측에 cap 둘 것.

- [ ] **Step 4: Smoke verify SQL syntax (local)**

```bash
# Supabase CLI로 dry-validate (실제 push 아님)
supabase db lint --schema public 2>&1 | tail -20
# 또는 마이그레이션 파일을 단독 psql 문법 검증
cat supabase/migrations/0006_rag_runtime_rpcs.sql | grep -E "^(create|drop|alter|grant|revoke|comment)" | wc -l
```

Expected: 문법 에러 없음 + 4개 이상의 DDL 라인.

- [ ] **Step 5: Commit (마이그레이션 + 테스트만, push는 Task 10에서)**

```bash
git add supabase/migrations/0006_rag_runtime_rpcs.sql tests/migrations/0006_rag_runtime_rpcs.test.ts
git commit -m "$(cat <<'EOF'
feat(rag): 0006 마이그레이션 — replace_document_chunks + match_chunks RPC

Phase 3 M2 — RAG runtime RPC 두 개:

1) replace_document_chunks (M1 carry #2)
   single-document atomic delete+insert. reader gap 차단.
   M3 Route Handler가 sync 중 빈 chunks 상태를 보지 않게 함.

2) match_chunks (M2 본체)
   pgvector cosine kNN + documents JOIN + status 필터.
   topK 1..50 cap. service_role 전용.

두 함수 모두 0003·0004 패턴(set search_path = '') 계승.
anon/authenticated grant 제거 + service_role 만 execute.

마이그레이션 push는 Task 10에서 supabase db push로.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: embed-content.ts을 replace_document_chunks RPC 호출로 전환 (M1 carry #2)

**Why**: 기존 `deleteExistingChunks()` + `insertChunks()` 두 단계가 reader gap을 만든다. 0006의 RPC로 단일 트랜잭션 호출로 교체.

**Files:**
- Modify: `scripts/embed-content.ts`
- Test: `tests/scripts/embed-content.test.ts` (회귀)

- [ ] **Step 1: 기존 deleteExistingChunks/insertChunks 함수 제거 + replaceDocumentChunks 신규**

`scripts/embed-content.ts` 의 두 함수를 제거하고 다음 함수로 교체:

```ts
async function replaceDocumentChunks(
  client: SupabaseClient,
  documentId: string,
  chunks: Omit<ChunkInsertRow, 'document_id'>[],
): Promise<number> {
  const payload = chunks.map((c) => ({
    chunk_index: c.chunk_index,
    chunk_text: c.chunk_text,
    embedding: c.embedding,
    metadata: c.metadata,
    section: c.section,
  }))
  const { data, error } = await client.rpc('replace_document_chunks', {
    p_document_id: documentId,
    p_chunks: payload,
  })
  if (error) {
    throw new Error(
      `replace_document_chunks 실패 (document_id=${documentId}): ${formatSupabaseError(error)}`,
    )
  }
  return (data as number) ?? 0
}
```

`ChunkInsertRow` 인터페이스는 `document_id` 를 그대로 유지 (보고서 카운트용). RPC 페이로드는 `Omit<…, 'document_id'>` 로 보냄.

- [ ] **Step 2: main() 안의 DB 쓰기 분기 교체**

기존:

```ts
  const targetDocIds = Array.from(new Set(insertRows.map((r) => r.document_id)))
  const deleted = await deleteExistingChunks(supabase, targetDocIds)
  console.log(`[embed-content] 기존 청크 ${deleted}건 삭제`)
  await insertChunks(supabase, insertRows)
  console.log(`[embed-content] 신규 청크 ${insertRows.length}건 삽입`)
```

신규로 교체:

```ts
  // M1 carry #2: per-doc atomic replace. reader gap 차단.
  const rowsByDoc = new Map<string, ChunkInsertRow[]>()
  for (const r of insertRows) {
    const list = rowsByDoc.get(r.document_id) ?? []
    list.push(r)
    rowsByDoc.set(r.document_id, list)
  }

  let totalInserted = 0
  let docIndex = 0
  for (const [documentId, rows] of rowsByDoc) {
    docIndex++
    const inserted = await replaceDocumentChunks(supabase, documentId, rows)
    totalInserted += inserted
    if (docIndex % 50 === 0) {
      console.log(`[embed-content] replace 진행률: ${docIndex}/${rowsByDoc.size} docs`)
    }
  }
  console.log(`[embed-content] 신규 청크 ${totalInserted}건 삽입 (${rowsByDoc.size} docs)`)
```

기존 보고서의 `삭제: ${deleted}건` 라인은 제거 (RPC 안에서 일어남). `삽입: ${insertRows.length}건` 은 유지.

- [ ] **Step 3: 회귀 단위 테스트 확인**

```bash
npm test -- --test-name-pattern="embed-content"
```

Expected: PASS — 기존 보고서 검증 + Task 2 model/dim 라인 검증.

- [ ] **Step 4: Commit**

```bash
git add scripts/embed-content.ts
git commit -m "$(cat <<'EOF'
refactor(embed): per-doc atomic replace RPC 호출 (M1 carry #2)

deleteExistingChunks + insertChunks 두 단계 사이의 reader gap 차단.
각 document의 chunks를 0006 RPC replace_document_chunks 한 번에 처리
(트랜잭션 안에서 delete + insert).

진행률 50 docs마다 로깅 (535 docs * RPC 호출 직렬 — 수십 초 단위).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: src/lib/rag/types.ts — 타입 정의

**Why**: M2 retrieval API의 contract를 명시. `retrieveChunks()` 반환·옵션 shape을 lock-in.

**Files:**
- Create: `src/lib/rag/types.ts`
- Test: `tests/rag/types.test.ts` (신규 — 타입 export 회귀 가드)

- [ ] **Step 1: Write the failing test**

`tests/rag/types.test.ts` 신규:

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type {
  RetrievedChunk,
  SourceRef,
  RetrieveOptions,
  RetrievalResult,
} from '../../src/lib/rag/types.ts'

describe('rag/types — export shape 회귀', () => {
  test('RetrievedChunk 빈 객체로 instantiation 가능', () => {
    const c: RetrievedChunk = {
      chunkId: 'a',
      documentId: 'b',
      chunkText: '',
      section: null,
      chunkIndex: 0,
      metadata: {},
      similarity: 0,
      documentSlug: 's',
      documentTitle: 't',
      documentAxis: 'policies',
      documentType: 'unknown',
      documentStatus: 'draft',
    }
    assert.equal(c.chunkId, 'a')
  })

  test('SourceRef 빈 객체로 instantiation 가능', () => {
    const r: SourceRef = { slug: 's', title: 't', axis: 'a', type: 'u' }
    assert.equal(r.slug, 's')
  })

  test('RetrieveOptions 모든 필드 optional', () => {
    const o1: RetrieveOptions = {}
    const o2: RetrieveOptions = { topK: 5, minSimilarity: 0.5, includeDrafts: false }
    assert.equal(o1.topK, undefined)
    assert.equal(o2.topK, 5)
  })

  test('RetrievalResult shape', () => {
    const r: RetrievalResult = { chunks: [], sources: [] }
    assert.deepEqual(r, { chunks: [], sources: [] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern="rag/types"
```

Expected: FAIL — `src/lib/rag/types.ts` 미존재.

- [ ] **Step 3: Implement types**

`src/lib/rag/types.ts` 신규:

```ts
/**
 * Phase 3 M2 — RAG retrieval API 타입 정의.
 *
 * 이 파일은 server·client 둘 다 import 가능 (값 없음, 타입만).
 * 단, retrieval.ts / embed-query.ts / admin-client.ts 는 server-only.
 */

/** match_chunks RPC 응답의 한 row (camelCase로 변환된 형태) */
export interface RetrievedChunk {
  chunkId: string
  documentId: string
  chunkText: string
  section: string | null
  chunkIndex: number
  metadata: Record<string, unknown>
  similarity: number
  documentSlug: string
  documentTitle: string
  documentAxis: string
  documentType: string
  documentStatus: 'draft' | 'published'
}

/** 인용 카드용 — slug 기준 dedup 후 사용자에게 노출되는 메타 */
export interface SourceRef {
  slug: string
  title: string
  axis: string
  type: string
}

/** retrieveChunks() 호출 옵션 — 모두 optional, 기본값은 retrieval.ts에서 정의 */
export interface RetrieveOptions {
  /** 반환 청크 최대 개수. 기본 5, 최대 50. */
  topK?: number
  /** 유사도 임계 (cosine sim, 0=무관, 1=동일). 기본 0.0 (필터 없음). */
  minSimilarity?: number
  /** draft 문서도 포함 여부. 기본 true (Phase 3는 draft도 검색 가능). */
  includeDrafts?: boolean
}

/** retrieveChunks() 반환 — 청크 본문 + 인용 카드용 dedup된 sources */
export interface RetrievalResult {
  chunks: RetrievedChunk[]
  sources: SourceRef[]
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- --test-name-pattern="rag/types"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/types.ts tests/rag/types.test.ts
git commit -m "$(cat <<'EOF'
feat(rag): types — RetrievedChunk / SourceRef / RetrieveOptions / RetrievalResult

Phase 3 M2 retrieval API contract. 값 없음 — server·client 공용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: src/lib/rag/admin-client.ts — server-only Supabase admin client

**Why**: RAG retrieval은 service_role로 호출되어 RLS 우회. 이 클라이언트는 `SUPABASE_SECRET_KEY` 를 사용하므로 반드시 server-only.

**Files:**
- Create: `src/lib/rag/admin-client.ts`
- Test: `tests/rag/admin-client.test.ts` (신규)

- [ ] **Step 1: Write the failing test**

`tests/rag/admin-client.test.ts` 신규:

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('rag/admin-client', () => {
  test('createRagAdminClient — 환경변수 누락 시 throw', async () => {
    // 격리 위해 env 백업·복원
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const origKey = process.env.SUPABASE_SECRET_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SECRET_KEY

    try {
      const mod = await import('../../src/lib/rag/admin-client.ts')
      assert.throws(
        () => mod.createRagAdminClient(),
        /SUPABASE_URL|SECRET_KEY/,
      )
    } finally {
      if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
      if (origKey) process.env.SUPABASE_SECRET_KEY = origKey
    }
  })

  test('createRagAdminClient — 환경변수 있으면 client 인스턴스 반환', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'fake-key'
    try {
      const { createRagAdminClient } = await import('../../src/lib/rag/admin-client.ts')
      const client = createRagAdminClient()
      assert.ok(client)
      assert.equal(typeof client.from, 'function')
      assert.equal(typeof client.rpc, 'function')
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SECRET_KEY
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern="rag/admin-client"
```

Expected: FAIL — module 미존재.

- [ ] **Step 3: Implement admin-client**

`src/lib/rag/admin-client.ts` 신규:

```ts
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 3 M2 — RAG retrieval 전용 service_role Supabase client.
 *
 * - service_role 키 사용 → RLS 우회
 * - persistSession=false → server-side 호출이라 세션 불필요
 * - 호출자(retrieval.ts / Route Handler)가 매 호출 시 새 인스턴스 생성
 *   (Next.js Route Handler는 짧은 생명 — singleton 캐싱 이득 미미 + 테스트 격리 우위)
 *
 * 절대 client 번들에 포함되면 안 됨 — `import 'server-only'` 가드.
 */
export function createRagAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url) {
    throw new Error('createRagAdminClient: NEXT_PUBLIC_SUPABASE_URL 미설정')
  }
  if (!secretKey) {
    throw new Error('createRagAdminClient: SUPABASE_SECRET_KEY 미설정')
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

**Note**: `tests/rag/admin-client.test.ts` 가 `import 'server-only'` 모듈을 import 할 때 `next` 가 ESM 가드를 활성화한다. node:test 직접 실행 환경에서는 `server-only` 모듈이 dummy export(`{}`)라 throw 안 함. 만약 fail이면 `vi.mock` 없이도 testable.

만약 `server-only` 가 test runner에서도 throw 한다면, test 파일 첫 줄에:

```ts
// node:test 에서 'server-only' guard를 우회. 실 빌드에서는 client import가 차단됨.
process.env.NEXT_RUNTIME = 'nodejs'
```

추가. 일단 실행 후 보고.

- [ ] **Step 4: Run test**

```bash
npm test -- --test-name-pattern="rag/admin-client"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/admin-client.ts tests/rag/admin-client.test.ts
git commit -m "$(cat <<'EOF'
feat(rag): admin-client — server-only service_role Supabase client

retrieveChunks 등 server-side RAG 함수가 사용. SUPABASE_SECRET_KEY 노출
차단을 위해 'server-only' 가드 첫 줄.

env 누락 시 명확한 에러로 조기 실패 (URL / SECRET_KEY 각각).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: src/lib/rag/embed-query.ts — embedQuery 함수

**Why**: 사용자 질의를 단일 임베딩으로 변환. `scripts/lib/gemini-embed.ts`의 `embedTexts()` 를 length=1 wrapper로 재사용.

**Files:**
- Create: `src/lib/rag/embed-query.ts`
- Test: `tests/rag/embed-query.test.ts` (신규)

- [ ] **Step 1: Write the failing test**

`tests/rag/embed-query.test.ts` 신규:

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { embedQuery } from '../../src/lib/rag/embed-query.ts'

describe('rag/embed-query', () => {
  test('빈 문자열 — throw', async () => {
    await assert.rejects(() => embedQuery(''), /empty/)
  })

  test('whitespace-only — throw', async () => {
    await assert.rejects(() => embedQuery('   '), /empty/)
  })

  // 실제 SDK 호출 테스트는 smoke (Task 9) 에서. 본 단위 테스트는 입력 검증만.
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern="rag/embed-query"
```

Expected: FAIL — module 미존재.

- [ ] **Step 3: Implement embed-query**

`src/lib/rag/embed-query.ts` 신규:

```ts
import 'server-only'
import { embedTexts } from '../../../scripts/lib/gemini-embed.ts'

/**
 * Phase 3 M2 — 사용자 질의 단일 임베딩 호출.
 *
 * scripts/lib/gemini-embed.ts 의 embedTexts() 를 length=1 wrapper로 재사용.
 * scripts/ 디렉터리 import는 의도된 cross-boundary: gemini-embed.ts 는
 * CLI(embed-content.ts)와 Route Handler 둘 다에서 호출되며 server-only 가드가
 * 호출 chain 어딘가에 박혀 있다 (이 파일이 그 가드).
 *
 * 모델·dim env override는 자동 반영 (Task 2 getter 함수 통과).
 */
export async function embedQuery(queryText: string): Promise<number[]> {
  if (!queryText || queryText.trim().length === 0) {
    throw new Error('embedQuery: queryText is empty')
  }

  const results = await embedTexts([{ refId: 'query', text: queryText }])
  if (results.length !== 1) {
    throw new Error(
      `embedQuery: expected 1 result, got ${results.length}`,
    )
  }
  return results[0].embedding
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- --test-name-pattern="rag/embed-query"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/embed-query.ts tests/rag/embed-query.test.ts
git commit -m "$(cat <<'EOF'
feat(rag): embed-query — 사용자 질의 단일 임베딩 wrapper

server-only 가드. scripts/lib/gemini-embed.ts 재사용 (length=1 호출).
모델·dim env override는 Task 2 getter로 자동 반영.

빈/whitespace-only 질의는 호출 전 throw로 SDK 비용 절감.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: src/lib/rag/retrieval.ts — retrieveChunks 본체 + slug dedup

**Why**: M2 본체. embedQuery → match_chunks RPC → camelCase 변환 + slug dedup → `RetrievalResult` 반환.

**Files:**
- Create: `src/lib/rag/retrieval.ts`
- Test: `tests/rag/retrieval.test.ts` (신규 — mock client + slug dedup)

- [ ] **Step 1: Write the failing test (slug dedup + RPC 호출 형식)**

`tests/rag/retrieval.test.ts` 신규:

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

/**
 * retrieveChunks 단위 테스트.
 *
 * 실 SDK·Supabase 호출은 smoke (Task 9). 본 테스트는 mock으로 다음 검증:
 *   - match_chunks RPC 호출 시 인자 shape
 *   - 응답 row → RetrievedChunk 변환 정합성
 *   - sources slug dedup (같은 doc의 청크 여러 개 → 인용 카드 1개)
 *   - topK / minSimilarity / includeDrafts 기본값
 *
 * 의존 함수(embedQuery / createRagAdminClient)는 module mocking 대신
 * factory 패턴 우회 — retrieveChunks 가 직접 호출하는 두 모듈을 mocking.
 *
 * 전략: dynamic import + import map 우회 어려움 → retrieval.ts 가
 * createRagAdminClient·embedQuery 를 default가 아닌 named import 받는다.
 * 본 테스트는 두 함수를 mock하는 helper를 globalThis 에 부착.
 *
 * 더 깔끔한 방법: retrieval.ts 가 dependency injection 가능한 두 번째 시그니처
 * 노출 — retrieveChunksWith(deps). 본 plan은 후자 채택.
 */
import {
  retrieveChunksWith,
  type RetrievalDeps,
} from '../../src/lib/rag/retrieval.ts'

const FAKE_ROWS = [
  {
    chunk_id: 'c1', document_id: 'd1', chunk_text: 'text1', section: '## 섹션 A',
    chunk_index: 0, metadata: { slug: 'slug-a' }, similarity: 0.85,
    document_slug: 'slug-a', document_title: '제목 A', document_axis: 'policies',
    document_type: '안내서', document_status: 'published',
  },
  {
    chunk_id: 'c2', document_id: 'd1', chunk_text: 'text2', section: '## 섹션 B',
    chunk_index: 1, metadata: { slug: 'slug-a' }, similarity: 0.80,
    document_slug: 'slug-a', document_title: '제목 A', document_axis: 'policies',
    document_type: '안내서', document_status: 'published',
  },
  {
    chunk_id: 'c3', document_id: 'd2', chunk_text: 'text3', section: '## 섹션 C',
    chunk_index: 0, metadata: { slug: 'slug-b' }, similarity: 0.75,
    document_slug: 'slug-b', document_title: '제목 B', document_axis: 'disability-types',
    document_type: '안내서', document_status: 'draft',
  },
]

function buildMockDeps(opts: {
  expectArgs?: (args: Record<string, unknown>) => void
  rows?: typeof FAKE_ROWS
} = {}): RetrievalDeps {
  return {
    embedQuery: async (_text: string) => new Array(1536).fill(0.1),
    createClient: () => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        assert.equal(name, 'match_chunks')
        opts.expectArgs?.(args)
        return { data: opts.rows ?? FAKE_ROWS, error: null }
      },
    }) as unknown as ReturnType<RetrievalDeps['createClient']>,
  }
}

describe('rag/retrieval', () => {
  test('기본값 — topK=5, minSimilarity=0, includeDrafts=true', async () => {
    let captured: Record<string, unknown> = {}
    const deps = buildMockDeps({
      expectArgs: (args) => { captured = args },
    })
    await retrieveChunksWith('테스트 질의', {}, deps)
    assert.equal(captured.p_top_k, 5)
    assert.equal(captured.p_min_similarity, 0)
    assert.equal(captured.p_include_drafts, true)
    assert.ok(Array.isArray(captured.p_query_embedding))
    assert.equal((captured.p_query_embedding as number[]).length, 1536)
  })

  test('opts.topK 전달', async () => {
    let captured: Record<string, unknown> = {}
    const deps = buildMockDeps({
      expectArgs: (args) => { captured = args },
    })
    await retrieveChunksWith('q', { topK: 10 }, deps)
    assert.equal(captured.p_top_k, 10)
  })

  test('camelCase 변환 정합성', async () => {
    const result = await retrieveChunksWith('q', {}, buildMockDeps())
    assert.equal(result.chunks.length, 3)
    assert.equal(result.chunks[0].chunkId, 'c1')
    assert.equal(result.chunks[0].documentSlug, 'slug-a')
    assert.equal(result.chunks[0].similarity, 0.85)
    assert.equal(result.chunks[2].documentStatus, 'draft')
  })

  test('sources — slug dedup (slug-a 청크 2개 → 인용 카드 1개)', async () => {
    const result = await retrieveChunksWith('q', {}, buildMockDeps())
    assert.equal(result.sources.length, 2)  // slug-a, slug-b
    assert.equal(result.sources[0].slug, 'slug-a')
    assert.equal(result.sources[0].title, '제목 A')
    assert.equal(result.sources[1].slug, 'slug-b')
  })

  test('빈 질의 — embedQuery 호출 전 throw', async () => {
    await assert.rejects(
      () => retrieveChunksWith('   ', {}, buildMockDeps()),
      /empty/,
    )
  })

  test('RPC 에러 — Error throw + 메시지 보존', async () => {
    const deps: RetrievalDeps = {
      embedQuery: async () => new Array(1536).fill(0),
      createClient: () => ({
        rpc: async () => ({ data: null, error: { message: 'foo', code: 'PGRST' } }),
      }) as unknown as ReturnType<RetrievalDeps['createClient']>,
    }
    await assert.rejects(
      () => retrieveChunksWith('q', {}, deps),
      /match_chunks/,
    )
  })

  test('빈 결과 — 빈 배열 두 개', async () => {
    const deps = buildMockDeps({ rows: [] })
    const result = await retrieveChunksWith('q', {}, deps)
    assert.deepEqual(result, { chunks: [], sources: [] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern="rag/retrieval"
```

Expected: FAIL — module 미존재.

- [ ] **Step 3: Implement retrieval**

`src/lib/rag/retrieval.ts` 신규:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { embedQuery as defaultEmbedQuery } from './embed-query.ts'
import { createRagAdminClient as defaultCreateClient } from './admin-client.ts'
import type {
  RetrievedChunk,
  SourceRef,
  RetrieveOptions,
  RetrievalResult,
} from './types.ts'

/**
 * match_chunks RPC 응답 한 row의 원시 shape (snake_case from PostgREST).
 */
interface MatchChunksRow {
  chunk_id: string
  document_id: string
  chunk_text: string
  section: string | null
  chunk_index: number
  metadata: Record<string, unknown> | null
  document_slug: string
  document_title: string
  document_axis: string
  document_type: string
  document_status: string
  similarity: number
}

/**
 * Dependency injection — 테스트에서 embedQuery/createClient를 mock 하기 위함.
 * Production code는 retrieveChunks() 호출 (default deps 자동 주입).
 */
export interface RetrievalDeps {
  embedQuery: (text: string) => Promise<number[]>
  createClient: () => SupabaseClient
}

const DEFAULT_TOP_K = 5
const DEFAULT_MIN_SIMILARITY = 0.0
const DEFAULT_INCLUDE_DRAFTS = true
const MAX_TOP_K = 50  // 0006 match_chunks 의 raise exception 과 정합

/**
 * Phase 3 M2 — 사용자 질의 → 임베딩 → pgvector kNN → 출처 메타 보강.
 *
 * default deps 자동 주입. 테스트는 retrieveChunksWith() 직접 호출.
 */
export async function retrieveChunks(
  queryText: string,
  opts: RetrieveOptions = {},
): Promise<RetrievalResult> {
  return retrieveChunksWith(queryText, opts, {
    embedQuery: defaultEmbedQuery,
    createClient: defaultCreateClient,
  })
}

export async function retrieveChunksWith(
  queryText: string,
  opts: RetrieveOptions,
  deps: RetrievalDeps,
): Promise<RetrievalResult> {
  if (!queryText || queryText.trim().length === 0) {
    throw new Error('retrieveChunks: queryText is empty')
  }

  const topK = opts.topK ?? DEFAULT_TOP_K
  const minSimilarity = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY
  const includeDrafts = opts.includeDrafts ?? DEFAULT_INCLUDE_DRAFTS

  if (topK < 1 || topK > MAX_TOP_K) {
    throw new Error(`retrieveChunks: topK must be 1..${MAX_TOP_K}, got ${topK}`)
  }

  const queryEmbedding = await deps.embedQuery(queryText)

  const supabase = deps.createClient()
  const { data, error } = await supabase.rpc('match_chunks', {
    p_query_embedding: queryEmbedding,
    p_top_k: topK,
    p_min_similarity: minSimilarity,
    p_include_drafts: includeDrafts,
  })
  if (error) {
    throw new Error(`match_chunks RPC 실패: ${error.message ?? String(error)}`)
  }

  const rows = (data ?? []) as MatchChunksRow[]
  const chunks: RetrievedChunk[] = rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    chunkText: r.chunk_text,
    section: r.section,
    chunkIndex: r.chunk_index,
    metadata: r.metadata ?? {},
    similarity: r.similarity,
    documentSlug: r.document_slug,
    documentTitle: r.document_title,
    documentAxis: r.document_axis,
    documentType: r.document_type,
    documentStatus: (r.document_status as 'draft' | 'published'),
  }))

  // slug 기반 dedup — 같은 doc의 청크가 top-k에 여러 개 들어와도 인용 카드 1개
  const seen = new Set<string>()
  const sources: SourceRef[] = []
  for (const c of chunks) {
    if (seen.has(c.documentSlug)) continue
    seen.add(c.documentSlug)
    sources.push({
      slug: c.documentSlug,
      title: c.documentTitle,
      axis: c.documentAxis,
      type: c.documentType,
    })
  }

  return { chunks, sources }
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- --test-name-pattern="rag/retrieval"
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/retrieval.ts tests/rag/retrieval.test.ts
git commit -m "$(cat <<'EOF'
feat(rag): retrieval — retrieveChunks 본체 + slug dedup

Phase 3 M2 본체. server-only.

retrieveChunks(queryText, opts) — embedQuery → match_chunks RPC →
camelCase 변환 → slug 기반 sources dedup.

retrieveChunksWith(queryText, opts, deps) — DI 노출 (단위 테스트용).

기본값: topK=5, minSimilarity=0, includeDrafts=true (Phase 3는 draft도
검색 가능 — Route Handler가 M3에서 인증 분기 결정).

topK 1..50 cap (0006 match_chunks와 정합).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: server-only 가드 검증 + smoke 테스트 (실제 Supabase)

**Why**: M2 본체가 클라이언트 번들에 노출되지 않음을 빌드 단계에서 확인. 그리고 실 Supabase에 sample 질의를 던져 유사도 점수가 합리적인지 (>0.5 정도) 확인.

**Files:**
- Test: `tests/rag/smoke.test.ts` (신규 — 실 Supabase + Gemini API 호출, test:integration 분류)

- [ ] **Step 1: server-only 가드 빌드 검증 — 가짜 클라이언트 import 차단 확인**

`/tmp/server-only-check.ts` (commit 안 함):

```ts
// 이 파일은 commit 안 함. server-only 가드가 실제로 ESM context에서 동작하는지만 확인.
import { retrieveChunks } from '../src/lib/rag/retrieval.ts'
console.log(typeof retrieveChunks)
```

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-phase-3-m2-impl
node --import tsx -e "import('./src/lib/rag/retrieval.ts').then(m => console.log('imported:', typeof m.retrieveChunks))"
```

Expected: server-only 패키지는 node:test 환경에서 throw 안 함 (실 next 빌드 환경에서만 강제). 본 검증은 import 자체가 성공하는지 확인.

`next build` 단계에서 server-only 가드가 작동 — Task 10 에서 검증.

- [ ] **Step 2: Write the smoke test**

`tests/rag/smoke.test.ts` 신규:

```ts
/**
 * Phase 3 M2 — RAG retrieval smoke 테스트 (실 Supabase + Gemini API).
 *
 * 전제:
 *   - 0006 마이그레이션 push 완료 (Task 10)
 *   - 1606 청크 임베딩 존재 (M1 완료 상태)
 *   - .env.local 에 SUPABASE_SECRET_KEY + GOOGLE_GENERATIVE_AI_API_KEY
 *
 * 분류: test:integration (실 API 비용 발생 — 한 번에 약 $0.000001).
 *
 * 검증:
 *   - retrieveChunks('편의지원 신청', {topK: 5}) → 5건 미만일 수 있으나 ≥1건
 *   - 최상위 청크 similarity >= 0.5 (의미 있는 매칭)
 *   - sources.length <= chunks.length (slug dedup 작동)
 *   - 모든 chunks의 documentSlug 가 content/**/*.md 어딘가에 존재할 만한 형식
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'
import { retrieveChunks } from '../../src/lib/rag/retrieval.ts'

const skipReason =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SECRET_KEY ||
  !process.env.GOOGLE_GENERATIVE_AI_API_KEY
    ? 'env 미설정 (test:integration으로 실행 — Supabase + Google AI 키 필요)'
    : false

describe('rag/smoke — retrieveChunks 실 API', { skip: skipReason }, () => {
  before(() => {
    loadDotEnvLocalOverrides()
  })

  test('편의지원 신청 질의 — top-5 청크 반환 + similarity 합리적', async () => {
    const result = await retrieveChunks('편의지원 신청 절차가 어떻게 되나요', {
      topK: 5,
    })

    assert.ok(result.chunks.length >= 1, '최소 1건 이상 반환되어야 함')
    assert.ok(result.chunks.length <= 5, 'topK=5 cap')

    // 최상위 similarity 합리적 (zero-vector 대비 의미 있는 점수)
    const top = result.chunks[0]
    assert.ok(
      top.similarity >= 0.3,
      `top similarity 너무 낮음: ${top.similarity.toFixed(3)} (질의: 편의지원 신청)`,
    )

    // sources dedup 작동 (slug 중복 없음)
    const slugSet = new Set(result.sources.map((s) => s.slug))
    assert.equal(slugSet.size, result.sources.length, 'slug 중복')
    assert.ok(result.sources.length <= result.chunks.length)

    // documentSlug 형식 — content/* 어딘가에 존재할 식별자
    for (const c of result.chunks) {
      assert.ok(c.documentSlug.length > 0)
      assert.ok(['policies', 'disability-types', 'agreements', 'domains', 'regions', 'resources'].includes(c.documentAxis),
        `예상 외 axis: ${c.documentAxis}`)
    }
  })

  test('topK=1 — 정확히 1건', async () => {
    const result = await retrieveChunks('장애인교원의 권리', { topK: 1 })
    assert.equal(result.chunks.length, 1)
    assert.equal(result.sources.length, 1)
  })

  test('의도적으로 무관한 질의 — minSimilarity 필터링', async () => {
    const result = await retrieveChunks('지구는 둥글다', {
      topK: 5,
      minSimilarity: 0.7,  // 매우 높은 임계
    })
    // 0건이 정상일 수 있고 1~2건도 정상 (cosine similarity는 의미적 거리)
    assert.ok(result.chunks.length <= 5)
  })
})
```

- [ ] **Step 3: smoke 실행 (Task 10 이후, 0006 push 완료 가정)**

본 step은 Task 10 이후에 다시 실행. 일단 commit만.

- [ ] **Step 4: Commit**

```bash
git add tests/rag/smoke.test.ts
git commit -m "$(cat <<'EOF'
test(rag): smoke — retrieveChunks 실 Supabase + Gemini API 통합

test:integration 분류. 0006 push + 1606 청크 임베딩 완료 가정.

검증: topK / similarity / slug dedup / axis 형식.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 0006 마이그레이션 push + 회귀 통합 테스트 + next build 검증

**Why**: SQL 마이그레이션을 webfortd-prod 에 실제로 적용하고 전체 회귀 테스트 + next build 통과 확인.

**Files:**
- None (DB / 빌드 검증)

- [ ] **Step 1: Supabase CLI로 0006 push**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-phase-3-m2-impl
set -a; source .env.local; set +a
supabase link --project-ref djaeeqdxkynjxngwvzyn 2>&1 | tail -5
supabase db push -p $SUPABASE_DB_PASSWORD 2>&1 | tail -20
```

Expected:
```
Applying migration 20XX0006_rag_runtime_rpcs.sql...
Finished supabase db push.
```

- [ ] **Step 2: 통합 테스트 — 0006 RPC 검증**

```bash
npm run test:integration -- --test-name-pattern="0006_rag_runtime"
```

Expected: 4 tests PASS (match_chunks topK, anon reject, replace round-trip, replace anon reject).

- [ ] **Step 3: 전체 회귀 — unit + integration**

```bash
npm test 2>&1 | tail -5
npm run test:integration 2>&1 | tail -5
```

Expected: 162 unit + 23 integration → ~170+ unit + ~26+ integration (Task별 신규 테스트 추가량). 모두 PASS, 0 fail.

- [ ] **Step 4: next build**

```bash
npm run build 2>&1 | tail -10
```

Expected: 567 정적 페이지 생성 + 빌드 성공. server-only 가드가 RAG 모듈을 client 번들에서 차단했음을 빌드 로그로 확인 (별도 verification 명령 불필요 — server-only 가 client import 시 빌드 fail).

- [ ] **Step 5: kb:publish 회귀**

```bash
npm run kb:publish:dry-run 2>&1 | tail -10
```

Expected: `Total: 535 / Passing: 8 / Blocked: 527` baseline 변동 0.

- [ ] **Step 6: smoke 테스트 재실행 (Task 9에서 작성)**

```bash
npm run test:integration -- --test-name-pattern="rag/smoke"
```

Expected: 3 smoke tests PASS. 실 Gemini + Supabase 호출.

- [ ] **Step 7: 결과를 PR description에 묶기 위해 메모로 캡쳐**

```bash
echo "=== M2 검증 결과 ===" > /tmp/m2-verification.txt
npm test 2>&1 | tail -3 >> /tmp/m2-verification.txt
npm run test:integration 2>&1 | tail -3 >> /tmp/m2-verification.txt
npm run kb:publish:dry-run 2>&1 | tail -3 >> /tmp/m2-verification.txt
cat /tmp/m2-verification.txt
```

- [ ] **Step 8: Commit (검증 결과는 코드 변경 없음 — 별도 commit 불필요. 다음 task에서 PR 본문에 인용)**

---

## Task 11: codex-rescue dispatch — cross-cutting invariant gap 검토

**Why**: M1·M2 cross-cutting 영역을 외부 시각에서 검토. 글로벌 CLAUDE.md "마일스톤급 작업은 codex-rescue 명시 dispatch" 원칙.

**Files:**
- None (codex 결과는 별도 메모로 캡쳐)

- [ ] **Step 1: codex-rescue background dispatch (effort low)**

`Agent({ subagent_type: 'codex:codex-rescue', description: 'M2 retrieval API cross-cutting review', prompt: <below>, run_in_background: true })` — controller 가 백그라운드로 dispatch.

Prompt (Korean):

```
webfortd Phase 3 M2 — RAG retrieval API + M1 carry-over 처리 종합 검토.

브랜치: phase-3-m2-impl (master 기반)
range: master..HEAD

검토 포커스 (effort low — 표면 스타일 무시, 도메인·아키텍처 invariant gap만):

1. **server-only 가드 누락 경로**:
   - src/lib/rag/* 모든 파일에 'server-only' 첫 줄 있는지
   - retrieval.ts → embed-query.ts → admin-client.ts 호출 chain 중간에 client-side 누출 가능성
   - GOOGLE_GENERATIVE_AI_API_KEY / SUPABASE_SECRET_KEY 가 클라이언트 번들에 들어갈 경로 없는지

2. **0006 RPC 안전성**:
   - replace_document_chunks: 단일 트랜잭션 안에서 DELETE+INSERT가 atomic 인가? security definer + set search_path = '' 가드 정합?
   - match_chunks: topK cap (1..50) 적정? p_query_embedding float8[] → vector cast 시 type confusion 없음?
   - 둘 다 service_role only grant 확인 — anon/authenticated에 우발적 grant 없는지

3. **chunker cap fallback (M1 carry #1)**:
   - splitLongParagraph 가 sentence boundary 없는 경우 hard slice 정확히 동작?
   - applyCharLimits 통합 후 1606 청크 baseline 변동량 합리적?

4. **env override (M1 carry #3)**:
   - getEmbedModel() / getEmbedDim() 호출 시점 (load-time vs call-time) 정합?
   - 기존 named export MODEL_NAME / OUTPUT_DIMENSIONALITY 가 stale 값 반환할 위험 — 사용처 없는지?

5. **slug dedup**:
   - 같은 doc의 청크가 top-k에 5개 모두 들어오면 sources.length = 1 + 정보 손실 (어느 chunk가 가장 관련도 높은지)? — 의도된 결정인지 확인.

6. **PostgREST 1000 row limit / pagination**:
   - match_chunks topK ≤ 50 이라 무관. 다른 곳에서 .range() 누락 없는지.

7. **delete-then-insert reader gap (M1 carry #2)**:
   - replace_document_chunks 호출이 535 docs 직렬이라 전체 임베딩 작업이 약 1분. 각 doc 단위로 atomic이지만 535 docs 전체 sync 동안 reader가 "일부만 sync된" 상태를 볼 수 있는가? 그게 문제인지 design 검토.

8. **Vercel AI SDK v3+v6 호환**:
   - @ai-sdk/google v3, ai v6 조합에서 embedMany providerOptions.google.outputDimensionality 가 stale 가설 아님 확인 (M1에서 정정한 부분이 회귀 안 했는지).

9. **테스트 격리**:
   - tests/rag/admin-client.test.ts 의 process.env 조작이 다른 테스트와 race 없는지 (node:test 병렬 실행)
   - 0006 RPC 통합 테스트의 production data mutation (replace round-trip) 이 cleanup 완전한가?

10. **Phase 4 의존성 차단**:
    - retrieval API 가 chat_threads / chat_messages (M5) 에 의존하지 않는지 (M2 독립성)
    - editor_roles 가 RAG 경로에 의존하지 않는지

각 finding을 severity (critical / important / minor) + 위치(file:line) + 권장 조치로 보고.

머지 차단 finding만 critical. 그 외는 follow-up carry-over로 분류.
```

- [ ] **Step 2: codex-rescue 결과 처리**

결과를 메모로 캡쳐 후 controller가 분류:
- **Critical**: 머지 차단. 즉시 fix → 새 commit.
- **Important**: M3 carry-over로 plan §carry-over 박음. 머지 가능.
- **Minor**: 폐기 또는 PR description에만 명시.

글로벌 CLAUDE.md "동일 계층 반복 지적 = 계층 선택 의심" 원칙 적용. 같은 영역에 2회 이상 지적 → 아키텍처 수준 재검토.

- [ ] **Step 3: critical fix 적용 (있을 시)**

```bash
# fix는 별도 commit으로
git add <fixed files>
git commit -m "fix(rag): codex-rescue critical — <issue summary>"
```

- [ ] **Step 4: codex-rescue 메모 저장**

`docs/superpowers/notes/2026-05-23-m2-codex-rescue.md` 신규 (commit 안 함 — gitignore 또는 PR description에 inline). 또는 PR description 본문에 inline 인용.

---

## Task 12: PR 생성 + 머지

**Files:**
- None (PR 메타데이터)

- [ ] **Step 1: master fetch + base rebase 필요 여부 확인**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-phase-3-m2-impl
git fetch origin master
git log --oneline origin/master..HEAD | head -20
git log --oneline HEAD..origin/master | head -5
```

Expected: HEAD..origin/master 비어 있음 (master 가 plan 머지 후 진전 없음). 만약 있으면 rebase.

- [ ] **Step 2: 브랜치 push**

```bash
git push -u origin phase-3-m2-impl
```

- [ ] **Step 3: gh pr create**

```bash
gh pr create --title "Phase 3 M2: retrieval API + M1 carry-over 3건" --body "$(cat <<'EOF'
## Summary

Phase 3 M2 — RAG retrieval API 본체 + Phase 3 M1 머지 후 carry된 follow-up 3건 일괄 처리.

### M1 carry-over (3건)

1. **chunker 800자 cap 단일 문단 split fallback** (Task 1)
   - `splitLongParagraph()` 신규 — sentence boundary split → hard slice 2단계
   - dry-run 청크 baseline 1606 → <실측치>

2. **delete-then-insert reader gap** (Task 3+4)
   - 0006 마이그레이션에 `replace_document_chunks` RPC (single-document atomic transaction)
   - `embed-content.ts` 가 deleteExistingChunks + insertChunks 두 단계 호출을 per-doc RPC 호출로 교체

3. **모델/dim env override** (Task 2)
   - `EMBED_MODEL` / `EMBED_DIM` env override + `getEmbedModel()` / `getEmbedDim()` getter 함수
   - `embed-content.ts` 보고서 헤더에 model/dim 한 줄 출력 (M5 C1 사고 교훈 연장)

### M2 본체 (retrieval API)

- `supabase/migrations/0006_rag_runtime_rpcs.sql` — `match_chunks` RPC (pgvector cosine + documents JOIN + status 필터, service_role only, topK 1..50 cap)
- `src/lib/rag/types.ts` — `RetrievedChunk` / `SourceRef` / `RetrieveOptions` / `RetrievalResult`
- `src/lib/rag/admin-client.ts` — server-only service_role Supabase client
- `src/lib/rag/embed-query.ts` — server-only 단일 임베딩 wrapper
- `src/lib/rag/retrieval.ts` — `retrieveChunks(queryText, opts)` 본체 + slug dedup, `retrieveChunksWith(deps)` DI 노출 (테스트용)

### 검증

- <unit count> unit + <integration count> integration tests PASS
- `next build` 567 정적 페이지 유지
- `kb:publish:dry-run` baseline 535/8/527 변동 0
- smoke: `편의지원 신청` 질의 → top-1 similarity ≥ 0.3, slug dedup 정상
- codex-rescue (effort low) <APPROVE / APPROVE_WITH_FOLLOWUP / BLOCK_MERGE> — finding 요약 ↓

### codex-rescue 결과

<inline 메모 — critical 0, important N, minor M>

### M3 carry-over (있을 경우)

<TBD>

## Test plan

- [x] `npm test` (전체 unit)
- [x] `npm run test:integration` (0006 RPC + smoke 포함)
- [x] `npm run build`
- [x] `npm run kb:publish:dry-run`
- [x] codex-rescue dispatch (effort low)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL 출력. `https://github.com/khudt-org/webfortd/pull/<N>`

- [ ] **Step 4: validate workflow 자동 완료 + auto-merge 등록**

```bash
gh pr merge --auto --squash --delete-branch
```

또는 위원장 명시 신호 후 수동 머지. controller scope는 PR 생성까지만 — 머지는 위원장 결정.

- [ ] **Step 5: 머지 후 controller 후속 액션 (위원장 신호 후)**

1. `cd /Users/hunyongkim/Mac-Projects/webfortd && git pull --ff-only origin master`
2. CLAUDE.md §변경 이력 표에 1줄 추가 (Phase 3 M2 머지 entry)
3. `~/.claude/projects/-Users-hunyongkim-Mac-Projects-webfortd/memory/project_phase_status.md` 갱신
4. `MEMORY.md` master sha 갱신
5. worktree 정리: `git worktree remove ../webfortd-phase-3-m2-impl && git worktree remove ../webfortd-phase-3-m2-plan`

---

## 5. Carry-over 정책

M3 진입 전 plan §carry-over 박을 후보:

1. **chat_messages.source_slugs 저장 책임**: M2 retrieval은 `sources` 반환만 함. M3 Route Handler가 응답 완료 후 chat_messages에 INSERT 시 source_slugs 저장 책임. M5에서 chat_history 도입 시 그 흐름 정합 검토.

2. **Context Caching eligibility**: M3에서 시스템 프롬프트 토큰 수 측정 후 Gemini 최소 캐시 단위 (32K tokens) 미달 여부 결정. 미달이면 비용 시나리오 1.5x 상향.

3. **draft documents RAG 노출 정책 재검토**: 현재 `includeDrafts=true` 기본값. 위원장 명시 승인 시 published 만으로 강화 가능. UI에서 사용자에게 "이 답변은 검수 전 draft 정책 정보를 포함합니다" 고지 필요 여부.

4. **PostgREST `match_chunks` 호출 시 vector array 직렬화 오버헤드**: 1536 floats * 535 documents 직렬 호출 = 약 1MB payload. 본격 단계 (Phase 3 M5 cron job, M6 정기 재임베딩) 진입 시 batched RPC 검토.

5. **smoke 테스트 비용**: 매 CI 호출마다 Gemini API 호출 = 시범 단계 무시 가능하나 CI 자주 돌리면 누적. `test:integration` 분류로 분리되어 있어 일반 `npm test` 영향 없음.

---

## 6. Self-Review

**Spec coverage**:
- spec §M2 신규 파일 3개 (retrieval.ts / types.ts / retrieval.test.ts) → Task 5·6·7·8 커버 ✓
- spec §M2 핵심 결정 — server-only / service_role / slug dedup → D6·D5·Task 6·8 커버 ✓
- spec §M2 검증 — 단위 테스트 + smoke → Task 8·9 커버 ✓
- spec §M2 codex-rescue 포커스 — server-only / RLS / slug null → Task 11 prompt 박음 ✓
- M1 carry-over 3건 — Task 1·2·3·4 커버 ✓

**Placeholder scan**:
- "TBD" 1개 발견 — Task 12 Step 3 PR body 안 `M3 carry-over (있을 경우) <TBD>` — 의도된 placeholder (codex 결과 후 채움). 허용.
- 기타 placeholder 없음.

**Type consistency**:
- `RetrievedChunk` / `SourceRef` / `RetrieveOptions` / `RetrievalResult` 모든 task에서 동일 이름 사용 ✓
- `retrieveChunks` (default deps) vs `retrieveChunksWith` (DI) 둘 다 일관 ✓
- `replace_document_chunks` / `match_chunks` SQL 함수명 모든 task 일관 ✓
- `getEmbedModel()` / `getEmbedDim()` getter 이름 일관 ✓
- `MatchChunksRow` shape SQL `returns table (...)` 정의와 정합 ✓

**무결성 보강 — Step 5 (RPC 회귀)에서 `data: before` 와 `restoredCount` 동일 검증 명시. mutation 복원 누락 시 production data 손실 위험 — production 환경에서는 staging 환경 분리 검토 (Phase 3 M5에서 staging supabase project 분리 권고).

---

## 7. 실행 옵션

이 plan은 **Subagent-Driven Development** 로 실행 권장 (controller가 마일스톤 단위로 dispatch).

- Task 1·2·3·4·5·6·7·8·9 는 각각 implementer subagent + 2-stage review (spec + code-quality)
- Task 10 은 controller 직접 수행 (Supabase CLI + 회귀 검증)
- Task 11 은 controller 가 codex-rescue dispatch (background, effort low)
- Task 12 는 controller 가 PR 생성 + 위원장 명시 신호 대기

Inline Execution 선택 시 superpowers:executing-plans 의 batch 모드로 Tasks 1~9 묶음 → Task 10·11·12 controller 직접 수행.
