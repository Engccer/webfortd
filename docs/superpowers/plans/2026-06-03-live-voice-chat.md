# 라이브 음성 채팅 구현 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gemini Live API로 장애인교원 제도·정책을 RAG 근거 기반으로 안내하는 실시간 양방향 음성 채팅을 webfortd에 추가한다 (로그인 필수, 음성 전용).

**Architecture:** 서버 `/api/voice/session`이 Supabase 세션 검증 후 `@google/genai`의 `authTokens.create()`로 ephemeral 토큰 발급 → 브라우저가 `live.connect()`로 native audio 모델에 직접 연결 → 모델이 `search_policy` 함수를 호출하면 `/api/voice/execute`가 기존 `retrieveChunks`로 RAG 검색해 청크+출처 반환 → 근거 기반 음성 응답. dodo-planet 라이브 채팅 코드를 직접 이식하되 카메라/travel/다로케일을 제거해 슬림화한다.

**Tech Stack:** Next.js 16 App Router, `@google/genai` (Live), AI SDK(기존 RAG), Supabase Auth, AudioWorklet(PCM), node:test/vitest, Playwright+axe.

**참조 spec:** `docs/superpowers/specs/2026-06-03-live-voice-chat-design.md`
**이식 원본:** `/Users/hunyongkim/Mac-Projects/dodo-planet/` (sibling repo).

---

## 파일 구조 (decomposition)

**신규 — 서버**
- `src/lib/gemini-live.ts` — GoogleGenAI 클라이언트 팩토리 + `LIVE_MODEL` 상수
- `src/lib/voice/voice-prompt.ts` — `buildVoiceSystemPrompt()` (음성 모드 시스템 프롬프트)
- `src/lib/voice/search-policy.ts` — `SEARCH_POLICY_DECLARATION` (도구 선언) + 상수
- `src/lib/voice/types.ts` — 클라이언트·서버 공유 타입 (값 없음)
- `src/app/api/voice/session/route.ts` — 토큰 발급
- `src/app/api/voice/execute/route.ts` — search_policy → retrieveChunks

**신규 — 클라이언트 코어**
- `src/lib/voice/pcm-base64.ts` — `base64ToArrayBuffer` / `arrayBufferToBase64` (순수)
- `src/lib/voice/barge-in.ts` — 바지인 판정 순수 함수 + 상수
- `src/lib/voice/audio-session.ts` — W3C Audio Session (dodo verbatim 포트)
- `src/hooks/useAudioIO.ts` — 마이크 캡처 + 재생 (dodo 포트, pcm-base64 사용)
- `src/hooks/useGeminiLive.ts` — Live 세션 훅 (dodo 포트 + 슬림화)
- `public/worklets/pcm-capture-processor.js` — dodo verbatim 복사
- `public/worklets/pcm-playback-processor.js` — dodo verbatim 복사

**신규 — UI**
- `src/components/chat/VoiceChatOverlay.tsx` — 풀스크린 음성 대화 오버레이

**수정**
- `package.json` — `@google/genai` 추가
- `src/components/chat/ChatUI.tsx` — "음성으로 대화" 버튼 + warmup + 오버레이 마운트

**테스트**
- `tests/voice/voice-prompt.test.ts`, `tests/voice/search-policy.test.ts`, `tests/voice/pcm-base64.test.ts`, `tests/voice/barge-in.test.ts`
- `tests/api/voice-session.test.ts`, `tests/api/voice-execute.test.ts`
- `tests/a11y/voice-overlay.spec.ts` (Playwright+axe)

---

## M1 — 서버 토대 (토큰 발급)

### Task 1: `@google/genai` 의존성 + Live 클라이언트 팩토리

**Files:**
- Modify: `package.json`
- Create: `src/lib/gemini-live.ts`
- Test: `tests/voice/gemini-live.test.ts`

- [ ] **Step 1: 패키지 설치**

```bash
npm install @google/genai@^1.49.0
```

설치 후 `package.json` dependencies에 `"@google/genai": "^1.49.0"` 추가 확인. (dodo 정렬 버전. 설치 직후 `npm view @google/genai version`로 최신 확인하고, major 동일하면 latest로 올려도 무방.)

- [ ] **Step 2: 실패 테스트 작성**

`tests/voice/gemini-live.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIVE_MODEL, getLiveAuthClient } from '../../src/lib/gemini-live.ts'

test('LIVE_MODEL은 native audio live 모델', () => {
  assert.equal(LIVE_MODEL, 'gemini-3.1-flash-live-preview')
})

test('getLiveAuthClient: 키 없으면 throw', () => {
  const prev = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  assert.throws(() => getLiveAuthClient(), /GOOGLE_GENERATIVE_AI_API_KEY/)
  if (prev !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prev
})

test('getLiveAuthClient: 키 있으면 GoogleGenAI 인스턴스', () => {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'
  const client = getLiveAuthClient()
  assert.ok(client)
  assert.ok(typeof client.authTokens?.create === 'function')
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- tests/voice/gemini-live.test.ts`
Expected: FAIL (`Cannot find module '../../src/lib/gemini-live.ts'`)

- [ ] **Step 4: 구현**

`src/lib/gemini-live.ts`:
```ts
/**
 * Phase 7 — Gemini Live (실시간 음성) 서버 클라이언트 팩토리.
 *
 * Live API는 Vercel AI Gateway를 경유하지 않고 @google/genai 직결이다.
 * 임베딩(scripts/lib/gemini-embed.ts)과 동일한 GOOGLE_GENERATIVE_AI_API_KEY 직접 키 경로.
 * authTokens.create()로 발급한 ephemeral 토큰만 클라이언트에 내려가며,
 * raw 키는 절대 브라우저에 노출되지 않는다.
 */
import { GoogleGenAI } from '@google/genai'

/** native audio 양방향 Live 모델. dodo MODELS.live 정렬. */
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview'

/** ephemeral 토큰 발급용 서버 클라이언트. v1alpha (Live/authTokens 필수). */
export function getLiveAuthClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error('Missing required environment variable: GOOGLE_GENERATIVE_AI_API_KEY')
  }
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } })
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/voice/gemini-live.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/gemini-live.ts tests/voice/gemini-live.test.ts
git commit -m "feat(phase-7-m1): @google/genai 추가 + Live 클라이언트 팩토리"
```

---

### Task 2: 음성 모드 시스템 프롬프트

**Files:**
- Create: `src/lib/voice/voice-prompt.ts`
- Test: `tests/voice/voice-prompt.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/voice/voice-prompt.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVoiceSystemPrompt } from '../../src/lib/voice/voice-prompt.ts'

test('정체성·톤 영구 원칙 보존', () => {
  const p = buildVoiceSystemPrompt()
  assert.match(p, /대한민국 장애인교원 관련 제도와 정책을 안내/)
  assert.match(p, /다정하고 명료한 말투/)
})

test('search_policy 도구 사용 지시 포함', () => {
  assert.match(buildVoiceSystemPrompt(), /search_policy/)
})

test('음성 모드: 마크다운 금지 지시 + 청크 placeholder 미포함', () => {
  const p = buildVoiceSystemPrompt()
  assert.match(p, /마크다운/)
  assert.doesNotMatch(p, /\{retrievedChunksFormatted\}/)
  assert.doesNotMatch(p, /\[참고 자료\]/)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/voice/voice-prompt.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

`src/lib/voice/voice-prompt.ts`:
```ts
/**
 * Phase 7 — 음성 대화 모드 시스템 프롬프트.
 *
 * 정체성·톤·답변 원칙은 텍스트 채팅과 동일한 단일 기준점(SYSTEM_PROMPT_TEMPLATE)을
 * 재사용한다(DRY, 영구 원칙 정합). 단 Live는 세션 생성 시 프롬프트를 한 번만 박고
 * 청크는 search_policy 도구로 런타임 주입되므로, [참고 자료] 섹션을 떼고
 * 도구 사용 지시 + 음성 모드 지시를 덧붙인다.
 */
import { SYSTEM_PROMPT_TEMPLATE } from '@/lib/rag/prompt-builder'

export function buildVoiceSystemPrompt(): string {
  // SYSTEM_PROMPT_TEMPLATE의 [참고 자료] 이후를 제거 — 정체성/톤/원칙만 유지.
  const base = SYSTEM_PROMPT_TEMPLATE.split('[참고 자료]')[0].trim()
  return `${base}

[정보 검색 — search_policy 도구]
사용자가 제도·정책·지원·법령을 물으면 추측하지 말고 반드시 search_policy 도구를
호출해 관련 자료를 찾은 뒤, 그 내용을 근거로 답해요. 도구가 돌려준 자료에 없는
내용은 "이 부분은 확인된 자료에 없어요. 소속 교육청에 문의해 보세요"라고 안내해요.

[음성 대화 모드]
- 지금은 음성으로 대화하고 있어요. 짧고 자연스러운 구어체로 답해요.
- 마크다운, 글머리표, 번호 목록, 긴 포맷은 쓰지 마세요. 말하듯이 풀어서 설명해요.
- search_policy를 호출하기 직전에 "잠깐만요, 찾아볼게요" 같은 짧은 말을 먼저 건네
  1초 이상 침묵하지 않아요.
- 출처는 자연스럽게 말로 언급해요. 예: "이건 ○○ 자료에 나와 있어요."
- 답변 끝에 "참고용이니 실제 절차는 소속 교육청에 확인해 주세요"를 자연스럽게 덧붙여요.`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/voice/voice-prompt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/voice/voice-prompt.ts tests/voice/voice-prompt.test.ts
git commit -m "feat(phase-7-m1): 음성 모드 시스템 프롬프트 (영구 원칙 재사용)"
```

---

### Task 3: search_policy 도구 선언 + `/api/voice/session` 라우트

**Files:**
- Create: `src/lib/voice/search-policy.ts`
- Create: `src/app/api/voice/session/route.ts`
- Test: `tests/voice/search-policy.test.ts`, `tests/api/voice-session.test.ts`

- [ ] **Step 1: 도구 선언 실패 테스트**

`tests/voice/search-policy.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEARCH_POLICY_DECLARATION } from '../../src/lib/voice/search-policy.ts'

test('search_policy 선언 shape', () => {
  assert.equal(SEARCH_POLICY_DECLARATION.name, 'search_policy')
  assert.ok(SEARCH_POLICY_DECLARATION.parameters?.properties?.query)
  assert.deepEqual(SEARCH_POLICY_DECLARATION.parameters?.required, ['query'])
})
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `npm test -- tests/voice/search-policy.test.ts` → FAIL

`src/lib/voice/search-policy.ts`:
```ts
/**
 * Phase 7 — Live 세션이 RAG를 호출하는 단일 함수 선언.
 * dodo의 travel 함수 14종을 정책 검색 1종으로 대체.
 */
import { Type, type FunctionDeclaration } from '@google/genai'

export const SEARCH_POLICY_TOOL_NAME = 'search_policy'

/** voice/execute가 search_policy 결과 청크 텍스트를 자를 상한 (TTS 스트림 안정). */
export const MAX_CHUNK_CHARS = 500
/** search_policy 검색 topK. */
export const SEARCH_POLICY_TOP_K = 5

export const SEARCH_POLICY_DECLARATION: FunctionDeclaration = {
  name: SEARCH_POLICY_TOOL_NAME,
  description:
    '대한민국 장애인교원 관련 제도·정책·지원·법령 자료를 검색해 관련 내용을 가져온다. ' +
    '사용자가 제도/정책/지원/법령에 대해 물으면 답하기 전에 반드시 호출한다.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: '검색할 정책 질의 — 사용자 발화에서 추출한 핵심 키워드/질문.',
      },
    },
    required: ['query'],
  },
}
```

Run: `npm test -- tests/voice/search-policy.test.ts` → PASS

- [ ] **Step 3: 세션 라우트 실패 테스트 (인증 게이트)**

`tests/api/voice-session.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

// getServerClient를 mock해 비로그인 시 user=null 반환하도록 강제.
// node:test 환경에서 module mock — 간단히 의존성 주입 패턴 권장:
// route는 getServerClient를 직접 호출하므로, 여기서는 통합 동작 대신
// "비인증 401" 계약을 라우트 핸들러 직접 호출로 검증한다.

test('POST /api/voice/session: 비로그인 401', async () => {
  // getServerClient mock: auth.getUser → { data: { user: null } }
  const { POST } = await import('../../src/app/api/voice/session/route.ts')
  // 테스트 격리를 위해 Supabase env를 비워 getServerClient가 anon 세션(user=null) 반환하도록 함.
  const req = new Request('http://localhost/api/voice/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const res = await POST(req as never)
  assert.equal(res.status, 401)
})
```

> NOTE: webfortd 기존 라우트 테스트 패턴(`tests/api/*.test.ts`)을 먼저 확인해, mock 방식(전역 fetch stub vs 모듈 DI)을 일치시킬 것. 인증 mock이 불가하면 이 테스트는 `tests/integration`(실 Supabase anon)로 이동하고 단위는 "request schema 검증"만 남긴다.

- [ ] **Step 4: 실패 확인 → 라우트 구현**

Run: `npm test -- tests/api/voice-session.test.ts` → FAIL (module not found)

`src/app/api/voice/session/route.ts`:
```ts
/**
 * Phase 7 M1 — Live 음성 세션 ephemeral 토큰 발급.
 *
 * 흐름: Supabase 세션 검증(비로그인 401) → 음성 시스템 프롬프트 조립
 *       → search_policy 도구 선언 → authTokens.create() → { token, model, voiceConfig }
 *
 * 설계: docs/superpowers/specs/2026-06-03-live-voice-chat-design.md §4.1
 * 불변식: raw Gemini 키 미노출(토큰만), 로그인 필수, AI Gateway 미경유(직접 키).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Modality, StartSensitivity, EndSensitivity } from '@google/genai'
import { getLiveAuthClient, LIVE_MODEL } from '@/lib/gemini-live'
import { getServerClient } from '@/lib/supabase/server'
import { buildVoiceSystemPrompt } from '@/lib/voice/voice-prompt'
import { SEARCH_POLICY_DECLARATION } from '@/lib/voice/search-policy'

export const runtime = 'nodejs'
export const maxDuration = 30

// 한국어 단일 — dodo의 4로케일 분기 제거.
const VOICE_NAME = 'Puck'
const LANGUAGE_CODE = 'ko-KR'

const SessionRequestSchema = z.object({
  resumeHandle: z.string().optional(),
})

export async function POST(request: Request) {
  // 로그인 필수 — 비로그인 401 (Live native audio 비용 통제).
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = SessionRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { resumeHandle } = parsed.data

  try {
    const systemInstruction = buildVoiceSystemPrompt()
    const ai = getLiveAuthClient()

    const token = await ai.authTokens.create({
      config: {
        httpOptions: { apiVersion: 'v1alpha' },
        uses: 0, // 무제한 (session resumption 대응)
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
              // languageCode 생략 — native audio 모델 자동 언어 감지.
            },
            systemInstruction: { parts: [{ text: systemInstruction }] },
            tools: [{ functionDeclarations: [SEARCH_POLICY_DECLARATION] }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 20,
                silenceDurationMs: 300,
              },
            },
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
            contextWindowCompression: {
              triggerTokens: '10000',
              slidingWindow: { targetTokens: '512' },
            },
          },
        },
      },
    })

    return NextResponse.json({
      token: token.name,
      model: LIVE_MODEL,
      voiceConfig: { voice: VOICE_NAME, locale: LANGUAGE_CODE },
    })
  } catch (error) {
    console.error('Voice session error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/api/voice-session.test.ts tests/voice/search-policy.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/voice/search-policy.ts src/app/api/voice/session/route.ts tests/voice/search-policy.test.ts tests/api/voice-session.test.ts
git commit -m "feat(phase-7-m1): search_policy 선언 + voice/session 토큰 발급 라우트"
```

---

## M2 — RAG 도구 실행

### Task 4: 공유 타입 + `/api/voice/execute` 라우트

**Files:**
- Create: `src/lib/voice/types.ts`
- Create: `src/app/api/voice/execute/route.ts`
- Test: `tests/api/voice-execute.test.ts`

- [ ] **Step 1: 공유 타입 작성** (테스트 불요 — 타입만)

`src/lib/voice/types.ts`:
```ts
/**
 * Phase 7 — 음성 채팅 클라이언트·서버 공유 타입 (값 없음, 타입만).
 */
import type { SourceRef } from '@/lib/rag/types'

/** /api/voice/session 응답 */
export interface VoiceSessionResponse {
  token: string
  model: string
  voiceConfig: { voice: string; locale: string }
}

/** /api/voice/execute search_policy 응답 — Live 모델이 functionResponse로 읽는 shape. */
export interface SearchPolicyResult {
  results: Array<{ text: string; slug: string; title: string }>
  sources: SourceRef[]
}

export type { SourceRef }
```

- [ ] **Step 2: execute 라우트 실패 테스트**

`tests/api/voice-execute.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { truncateChunk, buildSearchPolicyResult } from '../../src/app/api/voice/execute/route.ts'
import type { RetrievalResult } from '../../src/lib/rag/types.ts'

test('truncateChunk: MAX_CHUNK_CHARS 초과분 절단 + ellipsis', () => {
  const long = 'a'.repeat(600)
  const out = truncateChunk(long)
  assert.ok(out.length <= 501) // 500 + ellipsis
  assert.match(out, /…$/)
})

test('truncateChunk: 짧은 텍스트는 그대로', () => {
  assert.equal(truncateChunk('짧음'), '짧음')
})

test('buildSearchPolicyResult: chunk text 절단 + sources 통과', () => {
  const retrieval: RetrievalResult = {
    chunks: [
      { chunkId: 'c1', documentId: 'd1', chunkText: 'x'.repeat(600), section: null,
        chunkIndex: 0, metadata: {}, similarity: 0.5, documentSlug: 'slug-a',
        documentTitle: '제목 A', documentAxis: 'policies', documentType: 'guide',
        documentStatus: 'published' },
    ],
    sources: [{ slug: 'slug-a', title: '제목 A', axis: 'policies', type: 'guide', href: '/policies/slug-a' }],
  }
  const out = buildSearchPolicyResult(retrieval)
  assert.equal(out.results.length, 1)
  assert.equal(out.results[0].slug, 'slug-a')
  assert.match(out.results[0].text, /…$/)
  assert.equal(out.sources[0].href, '/policies/slug-a')
})
```

- [ ] **Step 3: 실패 확인 → 구현**

Run: `npm test -- tests/api/voice-execute.test.ts` → FAIL

`src/app/api/voice/execute/route.ts`:
```ts
/**
 * Phase 7 M2 — search_policy 도구 실행 프록시.
 *
 * Live 모델의 functionCall(search_policy) → 기존 retrieveChunks RAG 재사용 →
 * 청크 텍스트(절단) + 출처 반환. 새 RAG 로직 0줄.
 *
 * 불변식: 로그인 필수(401), search_policy 외 도구 거부(403),
 *         published-only(admin Draft Mode만 includeDrafts — /api/chat 정합),
 *         PIPA(query 본문 미로그).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { retrieveChunks } from '@/lib/rag/retrieval.ts'
import { getServerClient } from '@/lib/supabase/server'
import { getPreviewActive } from '@/lib/admin/preview'
import {
  SEARCH_POLICY_TOOL_NAME,
  SEARCH_POLICY_TOP_K,
  MAX_CHUNK_CHARS,
} from '@/lib/voice/search-policy'
import type { RetrievalResult } from '@/lib/rag/types'
import type { SearchPolicyResult } from '@/lib/voice/types'

export const runtime = 'nodejs'
export const maxDuration = 30

const ExecuteRequestSchema = z.object({
  name: z.string().min(1),
  args: z.object({ query: z.string().min(1) }),
})

/** 청크 텍스트를 MAX_CHUNK_CHARS로 절단 (TTS 스트림 안정 — dodo payload 절단 교훈). */
export function truncateChunk(text: string): string {
  return text.length > MAX_CHUNK_CHARS ? text.slice(0, MAX_CHUNK_CHARS) + '…' : text
}

/** RetrievalResult → Live functionResponse shape. */
export function buildSearchPolicyResult(retrieval: RetrievalResult): SearchPolicyResult {
  return {
    results: retrieval.chunks.map((c) => ({
      text: truncateChunk(c.chunkText),
      slug: c.documentSlug,
      title: c.documentTitle,
    })),
    sources: retrieval.sources,
  }
}

export async function POST(request: Request) {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = ExecuteRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { name, args } = parsed.data

  if (name !== SEARCH_POLICY_TOOL_NAME) {
    return NextResponse.json(
      { error: `Function "${name}" is not allowed in voice mode` },
      { status: 403 },
    )
  }

  try {
    const includeDrafts = await getPreviewActive() // admin Draft Mode만 draft 인용
    const retrieval = await retrieveChunks(args.query, {
      topK: SEARCH_POLICY_TOP_K,
      includeDrafts,
    })
    // PIPA: query 본문 미로그 — 카운트만.
    console.log('[voice/execute] search_policy', {
      chunks: retrieval.chunks.length,
      sources: retrieval.sources.length,
    })
    return NextResponse.json(buildSearchPolicyResult(retrieval))
  } catch (error) {
    console.error('Voice execute error (search_policy):', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/api/voice-execute.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/voice/types.ts src/app/api/voice/execute/route.ts tests/api/voice-execute.test.ts
git commit -m "feat(phase-7-m2): voice/execute — search_policy → retrieveChunks 재사용"
```

---

## M3 — 클라이언트 코어

### Task 5: PCM base64 순수 헬퍼

**Files:**
- Create: `src/lib/voice/pcm-base64.ts`
- Test: `tests/voice/pcm-base64.test.ts`

- [ ] **Step 1: 실패 테스트**

`tests/voice/pcm-base64.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base64ToArrayBuffer, arrayBufferToBase64 } from '../../src/lib/voice/pcm-base64.ts'

test('roundtrip: arrayBuffer → base64 → arrayBuffer', () => {
  const src = new Uint8Array([0, 1, 2, 254, 255]).buffer
  const b64 = arrayBufferToBase64(src)
  const back = new Uint8Array(base64ToArrayBuffer(b64))
  assert.deepEqual([...back], [0, 1, 2, 254, 255])
})

test('base64ToArrayBuffer: 빈 문자열 → 빈 buffer', () => {
  assert.equal(base64ToArrayBuffer('').byteLength, 0)
})
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `npm test -- tests/voice/pcm-base64.test.ts` → FAIL

`src/lib/voice/pcm-base64.ts`:
```ts
/**
 * Phase 7 — PCM ↔ base64 순수 변환 (dodo의 hook 인라인 로직 추출, 테스트 가능화).
 * atob/btoa는 브라우저·Node 18+ 전역에 존재.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
```

- [ ] **Step 3: 통과 확인 + Commit**

Run: `npm test -- tests/voice/pcm-base64.test.ts` → PASS
```bash
git add src/lib/voice/pcm-base64.ts tests/voice/pcm-base64.test.ts
git commit -m "feat(phase-7-m3): PCM base64 순수 헬퍼 + roundtrip 테스트"
```

---

### Task 6: 바지인 판정 순수 함수

**Files:**
- Create: `src/lib/voice/barge-in.ts`
- Test: `tests/voice/barge-in.test.ts`

- [ ] **Step 1: 실패 테스트**

`tests/voice/barge-in.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BARGE_IN_THRESHOLD, SUSTAINED_LOUD_FRAMES,
  updateLoudFrames, shouldSendAudio, shouldAcceptInterruption,
} from '../../src/lib/voice/barge-in.ts'

test('updateLoudFrames: 임계 초과 N프레임 연속 → sustained', () => {
  let count = 0
  for (let i = 0; i < SUSTAINED_LOUD_FRAMES - 1; i++) {
    const r = updateLoudFrames(count, BARGE_IN_THRESHOLD)
    count = r.count
    assert.equal(r.sustained, false)
  }
  const r = updateLoudFrames(count, BARGE_IN_THRESHOLD)
  assert.equal(r.sustained, true)
})

test('updateLoudFrames: 임계 미만이면 카운트 리셋', () => {
  const r = updateLoudFrames(5, BARGE_IN_THRESHOLD - 0.01)
  assert.equal(r.count, 0)
  assert.equal(r.sustained, false)
})

test('shouldSendAudio: 모델 재생 중 + sustained 아니면 차단(에코)', () => {
  assert.equal(shouldSendAudio({ isMuted: false, modelStillPlaying: true, sustained: false }), false)
  assert.equal(shouldSendAudio({ isMuted: false, modelStillPlaying: true, sustained: true }), true)
  assert.equal(shouldSendAudio({ isMuted: false, modelStillPlaying: false, sustained: false }), true)
  assert.equal(shouldSendAudio({ isMuted: true, modelStillPlaying: false, sustained: true }), false)
})

test('shouldAcceptInterruption: 최근 발화 500ms 이내만 수용', () => {
  assert.equal(shouldAcceptInterruption(499), true)
  assert.equal(shouldAcceptInterruption(501), false)
})
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `npm test -- tests/voice/barge-in.test.ts` → FAIL

`src/lib/voice/barge-in.ts`:
```ts
/**
 * Phase 7 — 바지인(끊어말하기) 판정 순수 함수.
 * dodo useGeminiLive의 인라인 게이팅 로직을 추출해 회귀 테스트 가능화.
 * 글로벌 CLAUDE.md "Gemini Live 음성 씹힘" 교훈: 단일 프레임 스파이크(에코 transient)는
 * sustained로 인정하지 않고, 모델 재생 중에는 sustained 발화만 통과시킨다.
 */
export const BARGE_IN_THRESHOLD = 0.15
export const SUSTAINED_LOUD_FRAMES = 3
export const PLAYBACK_TAIL_MARGIN_MS = 200
export const INTERRUPTION_RECENT_SPEECH_MS = 500

/** 한 PCM 프레임 처리: 연속 큰소리 프레임 카운트 갱신 + sustained 여부. */
export function updateLoudFrames(
  prevCount: number,
  peakLevel: number,
): { count: number; sustained: boolean } {
  const count = peakLevel >= BARGE_IN_THRESHOLD ? prevCount + 1 : 0
  return { count, sustained: count >= SUSTAINED_LOUD_FRAMES }
}

/** 마이크 PCM을 서버로 보낼지 결정. mute거나, 모델 재생 중 sustained 아니면 차단. */
export function shouldSendAudio(args: {
  isMuted: boolean
  modelStillPlaying: boolean
  sustained: boolean
}): boolean {
  if (args.isMuted) return false
  if (args.modelStillPlaying && !args.sustained) return false
  return true
}

/** 서버 interrupted 메시지 수용 여부 — 최근 sustained 발화가 있었을 때만. */
export function shouldAcceptInterruption(msSinceLoud: number): boolean {
  return msSinceLoud < INTERRUPTION_RECENT_SPEECH_MS
}
```

- [ ] **Step 3: 통과 확인 + Commit**

Run: `npm test -- tests/voice/barge-in.test.ts` → PASS
```bash
git add src/lib/voice/barge-in.ts tests/voice/barge-in.test.ts
git commit -m "feat(phase-7-m3): 바지인 판정 순수 함수 + 에코 transient 가드 테스트"
```

---

### Task 7: AudioWorklet 파일 복사

**Files:**
- Create: `public/worklets/pcm-capture-processor.js`
- Create: `public/worklets/pcm-playback-processor.js`

- [ ] **Step 1: dodo verbatim 복사** (프로젝트 무관 — 수정 0)

```bash
mkdir -p public/worklets
cp /Users/hunyongkim/Mac-Projects/dodo-planet/public/worklets/pcm-capture-processor.js public/worklets/
cp /Users/hunyongkim/Mac-Projects/dodo-planet/public/worklets/pcm-playback-processor.js public/worklets/
```

- [ ] **Step 2: 복사 검증**

Run: `head -3 public/worklets/pcm-capture-processor.js && head -3 public/worklets/pcm-playback-processor.js`
Expected: 두 파일 모두 PCM processor 주석 헤더 출력.

- [ ] **Step 3: Commit**

```bash
git add public/worklets/pcm-capture-processor.js public/worklets/pcm-playback-processor.js
git commit -m "feat(phase-7-m3): PCM capture/playback AudioWorklet (dodo verbatim)"
```

---

### Task 8: W3C Audio Session 헬퍼 포트

**Files:**
- Create: `src/lib/voice/audio-session.ts`

- [ ] **Step 1: dodo verbatim 복사** (W3C 표준, 프로젝트 무관 — VoiceOver ducking 방지)

```bash
cp /Users/hunyongkim/Mac-Projects/dodo-planet/src/lib/voice/audio-session.ts src/lib/voice/audio-session.ts
```

- [ ] **Step 2: 검증** — import 경로 의존성 없음(전역 navigator만 사용). lint 통과 확인.

Run: `npm run lint -- src/lib/voice/audio-session.ts` (또는 전체 lint)
Expected: 0 error

- [ ] **Step 3: Commit**

```bash
git add src/lib/voice/audio-session.ts
git commit -m "feat(phase-7-m3): W3C Audio Session 헬퍼 (VoiceOver ducking 방지)"
```

---

### Task 9: `useAudioIO` 훅 포트

**Files:**
- Create: `src/hooks/useAudioIO.ts`

- [ ] **Step 1: dodo 파일 복사**

```bash
cp /Users/hunyongkim/Mac-Projects/dodo-planet/src/hooks/useAudioIO.ts src/hooks/useAudioIO.ts
```

- [ ] **Step 2: 적응 — `arrayBufferToBase64`를 pcm-base64.ts에서 import로 교체**

`src/hooks/useAudioIO.ts` 수정:
1. 파일 상단 import에 추가:
```ts
import { arrayBufferToBase64 } from "@/lib/voice/pcm-base64";
```
2. 훅 내부의 `const arrayBufferToBase64 = useCallback(...)` 정의 **블록 삭제**.
3. `startCapture`의 `useCallback` 의존성 배열 `[arrayBufferToBase64]` → `[]`로 변경 (이제 모듈 스코프 import라 안정).

나머지는 그대로 유지 (worklet 경로 `/worklets/pcm-capture-processor.js`·`/worklets/pcm-playback-processor.js`는 Task 7에서 동일 위치에 복사됨).

- [ ] **Step 3: 빌드/타입 검증**

Run: `npx tsc --noEmit` (또는 `npm run build` 일부)
Expected: useAudioIO 관련 타입 에러 0.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAudioIO.ts
git commit -m "feat(phase-7-m3): useAudioIO 포트 (pcm-base64 import)"
```

---

### Task 10: `useGeminiLive` 훅 포트 + 슬림화

**Files:**
- Create: `src/hooks/useGeminiLive.ts`

- [ ] **Step 1: dodo 파일 복사 (베이스)**

```bash
cp /Users/hunyongkim/Mac-Projects/dodo-planet/src/hooks/useGeminiLive.ts src/hooks/useGeminiLive.ts
```

- [ ] **Step 2: 슬림화 편집** — 아래 항목을 순서대로 적용:

**(a) import 정리** — 파일 상단 import를 다음으로 교체:
```ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioIO } from "./useAudioIO";
import { setVoiceCallSession, restoreAudioSession } from "@/lib/voice/audio-session";
import { base64ToArrayBuffer } from "@/lib/voice/pcm-base64";
import {
  updateLoudFrames,
  shouldSendAudio,
  shouldAcceptInterruption,
  PLAYBACK_TAIL_MARGIN_MS,
} from "@/lib/voice/barge-in";
import type { SourceRef } from "@/lib/voice/types";
```
> 제거된 import: `CLIENT_OBSERVABLE_FUNCTIONS`, `buildVideoFramePayload`.

**(b) 파일 내 `base64ToArrayBuffer` 함수 정의 블록 삭제** (이제 import).

**(c) 카메라 제거**: `sendVideoFrame` 정의 전체 삭제 + `UseGeminiLiveReturn`·return 객체에서 `sendVideoFrame` 제거 + 관련 JSDoc 삭제.

**(d) builder 제거**: `sendClientText` 정의·인터페이스·return 제거. `ConnectParams`를 다음으로 교체:
```ts
interface ConnectParams {
  resumeHandle?: string;
}
```
> tripId/locale/userTimezone/userLocation/mode 전부 제거 (webfortd 음성 채팅은 컨텍스트 파라미터 불요).

**(e) options 교체** — `UseGeminiLiveOptions`를 다음으로:
```ts
interface UseGeminiLiveOptions {
  /** search_policy 결과의 출처(sources)를 부모(오버레이)에 전달 — 인용 카드 표시용. */
  onSourceRefs?: (sources: SourceRef[]) => void;
}
```
`onFunctionResultRef`/`onUserTranscriptRef` 및 그 useEffect를 `onSourceRefsRef` 하나로 교체:
```ts
const onSourceRefsRef = useRef<UseGeminiLiveOptions["onSourceRefs"]>(options?.onSourceRefs);
useEffect(() => { onSourceRefsRef.current = options?.onSourceRefs; }, [options?.onSourceRefs]);
```
> `currentUserUtteranceRef`/`lastUserChunkAtRef`/`MAX_UTTERANCE_BUFFER_CHARS` 및 inputTranscription 내 누적 콜백 로직 제거 — undo intent(빌더 전용) 불요. inputTranscription은 `addTranscript("user", chunk)`만 유지.

**(f) executeFunctionProxy 교체** — `/api/voice/execute` body를 단순화:
```ts
const executeSearchPolicy = useCallback(
  async (query: string, signal: AbortSignal): Promise<unknown> => {
    const res = await fetch("/api/voice/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "search_policy", args: { query } }),
      signal,
    });
    if (!res.ok) throw new Error(`search_policy failed: ${res.status}`);
    return res.json();
  },
  []
);
```

**(g) connect() session 파라미터 정리** — `/api/voice/session` fetch body를 `{ resumeHandle: resumeHandleRef.current || undefined }`로 축소. `setTranscripts([])` 등 나머지 유지.

**(h) onPcmData 게이팅을 순수 함수로 교체** — `audio.onPcmData.current` 콜백 내부의 인라인 BARGE_IN 상수/판정을 다음으로:
```ts
audio.onPcmData.current = (base64: string, peakLevel: number) => {
  if (isMutedRef.current || !sessionRef.current || disposedRef.current) return;
  const { count, sustained } = updateLoudFrames(consecutiveLoudFramesRef.current, peakLevel);
  consecutiveLoudFramesRef.current = count;
  if (sustained) lastLoudAudioAtRef.current = Date.now();
  const modelStillPlaying = Date.now() < audio.playbackEndAt.current + PLAYBACK_TAIL_MARGIN_MS;
  if (!shouldSendAudio({ isMuted: isMutedRef.current, modelStillPlaying, sustained })) return;
  try {
    sessionRef.current.sendRealtimeInput({ audio: { data: base64, mimeType: "audio/pcm;rate=16000" } });
  } catch { /* 연결 끊김 무시 */ }
};
```
> 파일 상단의 인라인 `BARGE_IN_THRESHOLD`/`SUSTAINED_LOUD_FRAMES`/`PLAYBACK_TAIL_MARGIN_MS` 지역 상수 삭제(barge-in.ts에서 import).

**(i) handleServerMessage interrupted 판정 교체**:
```ts
if (message.serverContent?.interrupted) {
  if (shouldAcceptInterruption(Date.now() - lastLoudAudioAtRef.current)) {
    audio.softFlush();
    setState("listening");
  }
}
```

**(j) functionCall 처리 슬림화** — `CLIENT_OBSERVABLE_FUNCTIONS` 화이트리스트 분기를 search_policy 출처 추출로 교체. `executeFunctionProxy(name, args, signal)` → `executeSearchPolicy(args?.query ?? "", signal)`. 결과에서 sources를 뽑아 콜백:
```ts
const result = await executeSearchPolicy(
  typeof fc.args?.query === "string" ? fc.args.query : "",
  fnAbort.signal
);
// ... setFunctionStatus done ...
const sources = (result as { sources?: SourceRef[] })?.sources;
if (Array.isArray(sources) && sources.length > 0) {
  onSourceRefsRef.current?.(sources);
}
return { id: fc.id, name: fc.name, response: result };
```
> `FUNCTION_TIMEOUT_MS`는 8_000 유지(RAG도 hang 방지). functionStatus 라벨은 `setFunctionStatus({ name: fc.name, status: "executing" })` 유지.

**(k) return 객체 최종형** — 다음만 노출:
```ts
return {
  state, warmupAudio, connect: startSession, disconnect,
  toggleMute, isMuted, transcripts, functionStatus, errorMessage,
};
```

- [ ] **Step 3: 타입/lint 검증**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 error. (미사용 import·변수 잔존 시 제거.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGeminiLive.ts
git commit -m "feat(phase-7-m3): useGeminiLive 포트 + 슬림화 (search_policy/onSourceRefs, 카메라·builder 제거)"
```

---

## M4 — UI + 접근성

### Task 11: VoiceChatOverlay 컴포넌트

**Files:**
- Create: `src/components/chat/VoiceChatOverlay.tsx`
- Test: `tests/components/voice-chat-overlay.test.tsx` (vitest)

- [ ] **Step 1: 실패 테스트 (vitest, 렌더 + a11y 속성)**

`tests/components/voice-chat-overlay.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VoiceChatOverlay } from '@/components/chat/VoiceChatOverlay'

// useGeminiLive를 mock — 훅 내부 AudioContext/genai 의존 제거.
vi.mock('@/hooks/useGeminiLive', () => ({
  useGeminiLive: () => ({
    state: 'listening', warmupAudio: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    toggleMute: vi.fn(), isMuted: false, transcripts: [], functionStatus: null, errorMessage: null,
  }),
}))

describe('VoiceChatOverlay', () => {
  it('열림 상태에서 dialog role + aria-label', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label')
  })
  it('aria-live 상태 영역 존재', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  })
  it('종료 버튼 접근 가능', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /종료|닫기/ })).toBeTruthy()
  })
})
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `npm run test:components -- voice-chat-overlay` → FAIL

`src/components/chat/VoiceChatOverlay.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
import { useGeminiLive } from "@/hooks/useGeminiLive";
import type { SourceRef } from "@/lib/voice/types";

interface VoiceChatOverlayProps {
  open: boolean;
  onClose: () => void;
}

const STATE_LABEL: Record<string, string> = {
  idle: "대기 중",
  connecting: "연결 중이에요…",
  connected: "연결됐어요",
  listening: "듣고 있어요. 말씀해 주세요.",
  speaking: "답하고 있어요…",
  processing: "자료를 찾고 있어요…",
  reconnecting: "다시 연결하고 있어요…",
  error: "문제가 생겼어요.",
};

export function VoiceChatOverlay({ open, onClose }: VoiceChatOverlayProps) {
  const [sources, setSources] = useState<SourceRef[]>([]);
  const onSourceRefs = useCallback((s: SourceRef[]) => setSources(s), []);
  const {
    state, warmupAudio, connect, disconnect,
    toggleMute, isMuted, transcripts, errorMessage,
  } = useGeminiLive({ onSourceRefs });

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // 오버레이 오픈 시 연결 시작. 닫힐 때 disconnect.
  useEffect(() => {
    if (open) {
      // warmup은 ChatUI 버튼(사용자 제스처)에서 이미 호출됨. 여기서는 connect만.
      void connect({});
      closeBtnRef.current?.focus();
    } else {
      disconnect();
      setSources([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 키보드: Esc=종료, Space=mute (modifier 가드 — 입력 충돌 방지).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === " " || e.code === "Space") { e.preventDefault(); toggleMute(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, toggleMute]);

  // 포커스 트랩 (간단형 — dialog 내부로 Tab 순환).
  useEffect(() => {
    if (!open) return;
    const onFocus = (e: FocusEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        closeBtnRef.current?.focus();
      }
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="음성으로 정책 안내 받기"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background/95 p-6 backdrop-blur"
    >
      {/* 상태 — 스크린리더 즉시 알림 */}
      <p aria-live="polite" className="text-lg font-medium text-foreground">
        {errorMessage ?? STATE_LABEL[state] ?? state}
      </p>

      {/* 시각 인디케이터 (스크린리더는 위 aria-live로 대체) */}
      <div aria-hidden className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        {state === "connecting" || state === "reconnecting" || state === "processing" ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : isMuted ? (
          <MicOff className="h-10 w-10 text-muted-foreground" />
        ) : (
          <Mic className="h-10 w-10 text-primary" />
        )}
      </div>

      {/* transcript */}
      <div className="max-h-48 w-full max-w-md overflow-y-auto text-sm" aria-live="polite">
        {transcripts.map((t, i) => (
          <p key={i} className={t.role === "user" ? "text-foreground" : "text-muted-foreground"}>
            <span className="sr-only">{t.role === "user" ? "나: " : "안내: "}</span>
            {t.text}
          </p>
        ))}
      </div>

      {/* 출처 카드 */}
      {sources.length > 0 && (
        <nav aria-label="인용 출처" className="w-full max-w-md">
          <ul className="flex flex-col gap-1 text-sm">
            {sources.map((s) => (
              <li key={s.slug}>
                <a href={s.href} className="text-primary underline">{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* 컨트롤 — 터치 타깃 44×44 이상 */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={isMuted}
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border px-4 py-2"
        >
          {isMuted ? <MicOff aria-hidden className="h-5 w-5" /> : <Mic aria-hidden className="h-5 w-5" />}
          {isMuted ? "음소거 해제" : "음소거"}
        </button>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground"
        >
          <X aria-hidden className="h-5 w-5" />
          종료
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 통과 확인 + Commit**

Run: `npm run test:components -- voice-chat-overlay` → PASS
```bash
git add src/components/chat/VoiceChatOverlay.tsx tests/components/voice-chat-overlay.test.tsx
git commit -m "feat(phase-7-m4): VoiceChatOverlay (aria-live·키보드·포커스 트랩·출처 카드)"
```

---

### Task 12: ChatUI 진입점 버튼

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: 현재 구조 확인**

Run: `grep -n "export function ChatUI\|export default\|return (\|useState\|import" src/components/chat/ChatUI.tsx | head -30`
목적: 컴포넌트 함수 진입·최상위 return·기존 import를 파악해 버튼/오버레이 삽입 위치를 정한다.

- [ ] **Step 2: 오버레이 상태 + 버튼 + 마운트 추가**

`src/components/chat/ChatUI.tsx` 수정:
1. import 추가:
```ts
import { useState } from "react"; // 이미 있으면 생략
import { Mic } from "lucide-react";
import { VoiceChatOverlay } from "@/components/chat/VoiceChatOverlay";
import { useGeminiLive } from "@/hooks/useGeminiLive";
```
> 단, warmup은 오버레이 밖에서 사용자 제스처 체인 내 호출이 필요하므로 ChatUI에서 별도 `useGeminiLive` 인스턴스를 만들지 말고, **warmup 전용 경량 경로**를 쓴다. 아래 Step 3 참조.

2. ChatUI 함수 본문 상단:
```ts
const [voiceOpen, setVoiceOpen] = useState(false);
```

3. 채팅 입력 영역(텍스트 채팅 컨트롤) 근처에 버튼 추가:
```tsx
<button
  type="button"
  onClick={async () => {
    // 사용자 제스처 체인 내 AudioContext warmup (iOS/Chrome 필수).
    const { warmupAudioStandalone } = await import("@/lib/voice/warmup");
    await warmupAudioStandalone();
    setVoiceOpen(true);
  }}
  className="flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2"
>
  <Mic aria-hidden className="h-5 w-5" />
  음성으로 대화
</button>
```

4. 컴포넌트 return 최상위 말미:
```tsx
<VoiceChatOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} />
```

- [ ] **Step 3: warmup standalone 헬퍼 작성**

`src/lib/voice/warmup.ts`:
```ts
"use client";
/**
 * 사용자 제스처(클릭) 체인 내에서 AudioContext를 미리 깨우는 경량 warmup.
 * 오버레이가 열리기 전에 호출해 iOS Safari/Chrome Autoplay 정책으로 AudioContext가
 * suspended에 빠지는 것을 방지한다. (useAudioIO.warmup과 동일 효과의 standalone판.)
 */
export async function warmupAudioStandalone(): Promise<void> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") await ctx.resume();
    // 즉시 닫지 않고 잠시 유지 — 실제 세션이 자체 AudioContext를 생성하므로 close해도 무방.
    await ctx.close();
  } catch {
    // 미지원 환경 무해 no-op
  }
}
```

- [ ] **Step 4: 빌드/lint + 컴포넌트 테스트 회귀**

Run: `npx tsc --noEmit && npm run lint && npm run test:components`
Expected: 0 error, 기존 컴포넌트 테스트 회귀 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatUI.tsx src/lib/voice/warmup.ts
git commit -m "feat(phase-7-m4): ChatUI 음성 대화 진입 버튼 + AudioContext warmup"
```

---

### Task 13: 접근성 E2E (Playwright + axe)

**Files:**
- Create: `tests/a11y/voice-overlay.spec.ts`

- [ ] **Step 1: 기존 a11y 스펙 패턴 확인**

Run: `ls tests/a11y/ && head -40 tests/a11y/*.spec.ts | head -60`
목적: webfortd Playwright+axe 설정(baseURL, 로그인 우회 방식, axe import)을 일치시킨다.

- [ ] **Step 2: 스펙 작성** (로그인 게이트 때문에 실 Live 연결은 제외 — 오버레이 정적 a11y만 검증; 인증 모킹 또는 컴포넌트 마운트 하니스 사용)

`tests/a11y/voice-overlay.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// 오버레이는 로그인 + 마이크 권한이 필요해 실 연결 E2E는 수동 smoke(M5)로 분리한다.
// 여기서는 /chat 페이지에서 "음성으로 대화" 버튼의 접근성(이름·포커스·터치 타깃)만 검증.
test('chat 페이지 음성 버튼 접근성', async ({ page }) => {
  await page.goto('/chat')
  const btn = page.getByRole('button', { name: '음성으로 대화' })
  // 로그인 게이트로 /chat 접근이 막히면 이 테스트는 인증 하니스 도입까지 skip.
  if (await btn.count() === 0) test.skip(true, '로그인 게이트 — 인증 하니스 필요')
  await expect(btn).toBeVisible()
  const results = await new AxeBuilder({ page }).include('main').analyze()
  expect(results.violations).toEqual([])
})
```
> NOTE: webfortd a11y 스펙이 로그인 우회 fixture를 갖추면 오버레이 오픈 후 dialog/aria-live/포커스 트랩까지 검증으로 확장. 현 단계는 버튼 + 페이지 axe 통과만 게이트.

- [ ] **Step 3: 실행**

Run: `npm run test:a11y -- voice-overlay`
Expected: PASS (또는 로그인 게이트 시 documented skip).

- [ ] **Step 4: Commit**

```bash
git add tests/a11y/voice-overlay.spec.ts
git commit -m "test(phase-7-m4): 음성 버튼 접근성 axe E2E"
```

---

## M5 — 환경·검증·리뷰

### Task 14: production env 등록 + 수동 smoke 체크리스트

**Files:**
- Create: `docs/PHASE7_ENV_SETUP.md`

- [ ] **Step 1: env 셋업 + smoke 문서 작성**

`docs/PHASE7_ENV_SETUP.md` 내용:
- **로컬**: `GOOGLE_GENERATIVE_AI_API_KEY` 이미 `.env.local`에 존재(임베딩용 재사용). 추가 작업 없음.
- **production**: PR #73 Deepgram 등록 절차 그대로 — engccer Hobby scope(임시 디렉터리 `vercel link --yes --project webfortd` 후 `vercel env add GOOGLE_GENERATIVE_AI_API_KEY production` stdin)에 등록 + KHUDT 복귀 시 동일. **이미 RAG 임베딩 production에 동일 키가 등록돼 있으면 재등록 불요 — `vercel env ls`로 먼저 확인**.
- **수동 smoke 체크리스트**(위원장 실 기기):
  1. 로그인 후 /chat → "음성으로 대화" 클릭 → 마이크 권한 허용.
  2. "장애인교원 편의지원 어떻게 신청해?" 발화 → 모델이 "잠깐만요, 찾아볼게요" 후 근거 답변 + 출처 카드 표시.
  3. 모델 발화 중 끼어들기(바지인) → 응답 중단 후 재청취.
  4. VoiceOver/TalkBack로 상태(aria-live) 읽힘 확인 + Esc 종료 + Space 음소거.
  5. 비로그인 상태에서 버튼 → 401/로그인 안내 확인.

- [ ] **Step 2: production env 확인/등록**

Run: `npx vercel env ls 2>/dev/null | grep GOOGLE_GENERATIVE_AI_API_KEY || echo "미등록 — 등록 필요"`
미등록 시 문서 절차대로 등록.

- [ ] **Step 3: Commit**

```bash
git add docs/PHASE7_ENV_SETUP.md
git commit -m "docs(phase-7-m5): production env 셋업 + 수동 음성 smoke 체크리스트"
```

---

### Task 15: 마일스톤 codex-rescue 리뷰 + 전체 회귀

**Files:** (없음 — 리뷰/검증)

- [ ] **Step 1: 전체 테스트·빌드 회귀**

Run:
```bash
npm test && npm run test:components && npm run lint && npm run build
```
Expected: 신규 voice 단위 테스트 PASS, 기존 회귀 0, 빌드 성공 + `/api/voice/session`·`/api/voice/execute` ƒ 등록, 기존 정적 페이지 카운트 회귀 0.

- [ ] **Step 2: codex-rescue 마일스톤 리뷰 (foreground/`--wait` 강제)**

글로벌 CLAUDE.md 규칙 준수: `codex doctor` 1회 → foreground 경로(`codex exec` 또는 `--wait`)로 diff 전체 리뷰. **리뷰 포커스 명시**:
- 토큰 발급 시 raw 키 미노출 불변식 (session route가 token.name만 반환).
- search_policy published-only 게이트 (admin Draft Mode 외 includeDrafts=false).
- PIPA: query 본문 미로그 (session/execute 양쪽).
- 바지인 게이팅 회귀 (에코 transient 자가승인 차단 — 글로벌 "음성 씹힘" 교훈).
- AudioContext warmup 사용자 제스처 체인 (iOS suspended 방지).
- 인증 게이트 대칭 (session·execute 모두 401).

fail signal(무한 루프/Turn aborted/동일 명령 3회) 감지 시 즉시 TaskStop + 직접 invariant 검수 fallback.

- [ ] **Step 3: 리뷰 지적 처리**

아키텍처 수준 대조 우선(즉시 지엽 패치 금지). 동일 계층 2회 반복 지적 시 계층 선택 재검토. 처리 후 재검증.

- [ ] **Step 4: coderabbit 보완 리뷰 (선택)**

`coderabbit review --plain --base-commit master` — 스타일·관용구·표면 보안. codex-rescue와 동일 결함 지적 시 codex 우선.

- [ ] **Step 5: PR 작성**

```bash
git push -u origin feat/live-voice-chat
gh pr create --title "feat(phase-7): 라이브 음성 채팅 (Gemini Live + RAG)" --body "<요약 + spec/plan 링크 + 수동 smoke 결과>"
```

- [ ] **Step 6: CLAUDE.md 갱신 (위원장 영역 — 머지 후)**

장기 과제 §"실시간 음성 채팅"을 Phase 7 완료로 갱신 + Phase 진행 요약 표에 추가. **위원장 명시 결정 항목** — 머지 확정 후 별도 처리.

---

## Self-Review (작성자 점검)

**1. Spec coverage:** spec §4.1→Task3, §4.2→Task4, §4.3→Task10, §4.4→Task9, §4.5→Task11, §4.6→Task12, §5 인프라→Task1·Task14, §6 출처→Task10·Task11, §7 테스트→각 Task 테스트+Task13, §8 회귀→Task15, §9 마일스톤→M1~M5 정합. 누락 없음.

**2. Placeholder scan:** "TBD/TODO" 없음. 각 코드 스텝은 실제 코드 포함. verbatim 포트(Task7·8·9)는 `cp` + 명시 diff로 재현 가능(코드 재타이핑 대신 원본 복사 — 전사 드리프트 회피). 인증 mock 방식은 "기존 패턴 확인 후 일치"로 위임(webfortd 라우트 테스트 관례 미파악 영역 — 정직하게 표기).

**3. Type consistency:** `SourceRef`(rag/types→voice/types 재노출), `SearchPolicyResult`, `RetrievalResult`, `buildVoiceSystemPrompt`, `SEARCH_POLICY_DECLARATION`/`SEARCH_POLICY_TOOL_NAME`/`SEARCH_POLICY_TOP_K`/`MAX_CHUNK_CHARS`, `LIVE_MODEL`/`getLiveAuthClient`, `updateLoudFrames`/`shouldSendAudio`/`shouldAcceptInterruption`/`PLAYBACK_TAIL_MARGIN_MS`, `base64ToArrayBuffer`/`arrayBufferToBase64`, `warmupAudioStandalone`, `useGeminiLive({ onSourceRefs })` 반환형 — 정의 Task와 사용 Task 간 명칭 일치 확인.

**알려진 위임 영역(구현 시 확인):** (a) 라우트 테스트 인증 mock 방식(기존 `tests/api/*` 관례), (b) `@google/genai` 최신 버전, (c) Live 모델명 현행성(`gemini-3.1-flash-live-preview` API 확인), (d) a11y 스펙 로그인 우회 fixture 유무, (e) ChatUI 정확한 버튼 삽입 위치(현 JSX 구조).
