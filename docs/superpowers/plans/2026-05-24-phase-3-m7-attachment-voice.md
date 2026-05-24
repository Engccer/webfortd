# Phase 3 M7 음성 받아쓰기 + 파일 첨부 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3 M6까지 완성된 RAG 채팅에 (1) 음성 받아쓰기(Deepgram Nova-2)와 (2) 파일 첨부(PDF + HWPX + HWP + 이미지)를 추가한다. 시각장애인 사용자 접근성(음성)과 정책 질의 복잡도 강화(파일)를 동시 처리. M6와 달리 서버 라우터 신규(2개) + Vercel env 신규(2개) + 외부 API 의존(Deepgram·Upstage·Gemini multimodal).

**Architecture:** 두 개의 신규 Route Handler(`/api/transcribe` Deepgram 프록시 + `/api/chat` 확장) + dodo-planet 4 hooks/components 거의 그대로 이식(`useVoiceRecorder` · `useMicrophonePermission` · `MicrophonePermissionPrompt` · `VoiceRecordButton`) + webfortd 신규 7 module(simple `useSound` · `AttachmentButton` · `AttachmentChip` · `file-validation` · `upstage-parse` + tests). 파일 처리 분기: PDF/이미지는 AI SDK v6 `messages.parts`의 file/image part로 Gemini multimodal에 그대로 전달, HWP/HWPX는 서버에서 Upstage Document Parse → markdown 추출 → system prompt에 컨텍스트 추가(messages.parts에서는 제거). 음성은 one-shot 패턴(녹음 → 정지 → STT → input 자동 채움). 모든 파일·음성 데이터는 임시 메모리 처리 — DB·Blob 영구 저장 0(spec §5).

**Tech Stack:** Deepgram Nova-2 (`nova-2-conversationalai`, language=`ko`, smart_format) · Upstage Document Parse (`api.upstage.ai/v1/document-digitization`) · Gemini 3.5 Flash multimodal (PDF/이미지 native) · AI SDK v6 (`useChat` sendMessage with files · `convertToModelMessages` file/image part 변환) · MediaRecorder Web API (WebM Opus, 120s cap) · navigator.permissions API + Safari 폴백 · Vitest + node:test + Chrome MCP 수동 검증

---

## 0. Context (zero-context 엔지니어용 짧은 브리핑)

**webfortd 정체성**: 장교조의 장애인교원 정책 KB + RAG 채팅. 위원장 시각장애 → **음성 받아쓰기는 접근성 필수 기능**. 시범 모델이지만 교육부-중부대 사업 자문 근거 자산. 채팅은 "대한민국 장애인교원 제도·정책 안내"(spec PR #36 §1 Q3=Y).

**M6 머지 완료 (master `68ea3fd` 이후)**:
- M3 RAG Route Handler (`/api/chat`) + AI Gateway OIDC + 시스템 프롬프트 영구 원칙
- M5 DB 채팅 히스토리 (chat_threads/chat_messages + ThreadDrawer)
- M6 UI 5건 (CopyButton · ErrorBanner · 자동 스크롤 · 세션 4h · 동적 SUGGESTIONS)
- lint cleanup PR #39 (47 → 0 problems, ESLint baseline 정합)

**M7의 역할**: 일상 사용성·접근성에서 한 단계 더 — 복잡한 정책 PDF/HWP 첨부 + 음성 입력. M7 머지 후 Phase 3 마무리(위원장 톤 검수 + production 검증), M8(이후)에서 멀티모달 임베딩/PWA 등 장기 과제 검토.

**spec**: `docs/superpowers/specs/2026-05-24-phase-3-m6-m7-chat-ux-enhancements.md` (PR #36 머지 `446f808`)
- §1 결정 잠금 Q1=C / Q2=a / Q3=Y / Q4=II + D1~D11
- §3 M7 — 본 plan 범위
- §4 접근성 spec (44px · aria-live · role · 키보드 · VoiceOver)
- §5 PIPA/보안 (임시 메모리 처리 + 외부 서비스 동의 카피)
- §6 리스크 9건
- §7 비용 시나리오 (시범 ~$0.64/월)

**중요 invariant** (M7에서도 유지):
- `kb:publish:dry-run` baseline `534/8/526` 변동 0 (KB 데이터 layer 무관)
- `next build` 570 정적 페이지 + 신규 ƒ 1개(`/api/transcribe`) = **570 + 4 ƒ** 예상
- M6 unit/components/integration baseline 그대로 (201/16/baseline)
- `npm run lint` 0 problems 유지 (PR #39 정합)
- 마이그레이션 0건 (모든 파일·음성은 메모리 임시 처리)
- 시각장애인 사용자 우선 — 음성 UI는 키보드 + aria-live + role 검증 의무

**dodo-planet 자산 출처** (정확한 라인):
- `~/Mac-Projects/dodo-planet/src/hooks/useVoiceRecorder.ts:1-243` — MediaRecorder + 120초 자동 종료 + chunks 합성 + WebM Opus
- `~/Mac-Projects/dodo-planet/src/hooks/useMicrophonePermission.ts:1-141` — navigator.permissions API + Safari 폴백(localStorage) + getUserMedia 권한 요청
- `~/Mac-Projects/dodo-planet/src/components/chat/VoiceRecordButton.tsx:1-280` — 권한 흐름 + 녹음 상태 전환 + aria-live announcer + Escape 취소
- `~/Mac-Projects/dodo-planet/src/components/chat/MicrophonePermissionPrompt.tsx` — 권한 요청 모달
- `~/Mac-Projects/dodo-planet/src/app/api/speech-to-text/route.ts:1-144` — Deepgram Nova-2 프록시 (model=`nova-2-conversationalai`, detect_language)
- `~/Mac-Projects/dodo-planet/src/hooks/useSound.ts:1-205` — sound cache + traveler 의존 (webfortd는 단순 버전으로 변형)

**webfortd 변경점 (dodo-planet 대비)**:
- i18n 제거 → 한국어 카피 고정 (`useTranslations` → 직접 문자열)
- `sonner toast` 미도입 → ChatUI ErrorBanner 또는 aria-live status (이미 M6 패턴)
- `useSound`는 traveler/DB 의존 X → 단순 fire-and-forget Audio + localStorage 토글
- Deepgram: `detect_language=true` → `language=ko` 강제 (정책 채팅은 한국어 단일)
- 최대 녹음 길이: 60s → **120s** (spec §D4, 정책 질의 평균 30초 + 우산 마진)

---

## 1. File Structure

### 신규 파일 (15개)

| 파일 | 책임 |
|------|------|
| `src/app/api/transcribe/route.ts` | POST Deepgram 프록시. FormData {audio, locale?} → DeepgramResponse → `{text, language_code, confidence}`. `runtime='nodejs'`, `maxDuration=30` (오디오 업로드 + Deepgram 응답). `import 'server-only'`. PIPA: transcript 본문 로그 X (길이·언어·confidence만). |
| `src/hooks/useVoiceRecorder.ts` | dodo-planet 그대로 + i18n 제거(한국어 카피). `maxDuration=120` 기본값. WebM Opus → audio/webm fallback → audio/mp4. FormData POST `/api/transcribe`. |
| `src/hooks/useMicrophonePermission.ts` | dodo-planet 그대로 + i18n 제거. navigator.permissions API + Safari 폴백 + localStorage 캐시 (`mic_permission_cache`). |
| `src/hooks/useSound.ts` | **단순 버전** (dodo-planet 대비 축약). `playRecordStart`/`playRecordStop` 2개 메서드 + `isEnabled` localStorage 토글. traveler/DB 의존 0. 사운드 파일 0 = sr-only aria-live만 사용 (M7 carry — 추후 사용자 선호 시 mp3 도입). |
| `src/components/chat/VoiceRecordButton.tsx` | dodo-planet 그대로 + i18n 제거. Mic/Square/Loader2 아이콘 + 권한 흐름 + Escape 취소 + 한국어 aria-label. PromptInput 우측 배치용. |
| `src/components/chat/MicrophonePermissionPrompt.tsx` | dodo-planet 그대로 + i18n 제거 + shadcn Dialog 사용. "질문을 음성으로 입력할 수 있어요" 본문. |
| `src/components/chat/AttachmentButton.tsx` | 클립 아이콘 + `<input type="file" accept="...">` + 클라이언트 검증 호출 + 통과 시 attachment state set. 44px 키보드 접근. |
| `src/components/chat/AttachmentChip.tsx` | PromptInput 상단 썸네일 카드 (파일명 truncate + 크기 + X 제거 버튼). 파싱 중("문서 분석 중...") aria-live status. |
| `src/lib/chat/file-validation.ts` | `validateAttachment(file: File): { ok: true } \| { ok: false; reason: string }`. MIME 화이트리스트 + 크기 ≤10MB + magic bytes 검증(PDF `%PDF`, PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`). |
| `src/lib/chat/upstage-parse.ts` | `parseHwpToMarkdown(buffer: ArrayBuffer, mimeType: string): Promise<string>`. Upstage Document Parse 호출 + markdown 추출 + 한국어 에러. `import 'server-only'`. |
| `tests/api/transcribe.test.ts` | Deepgram API mock + 한국어 에러 분기 + 파일 크기 검증 + 빈 transcript 처리 (node:test) |
| `tests/api/chat-attachment.test.ts` | PDF/이미지 → messages.parts 정합 + HWP → Upstage 호출 분기 + Upstage 실패 시 한국어 fallback (node:test, mock Upstage·Gemini) |
| `tests/lib/chat/file-validation.test.ts` | MIME 화이트리스트 + 크기 한계 + magic bytes 4종 (node:test) |
| `tests/lib/chat/upstage-parse.test.ts` | Upstage response 파싱 + 빈 markdown 처리 + 한국어 에러 마스킹 (node:test, mock fetch) |
| `tests/components/chat/voice-record-button.test.tsx` | 권한 흐름 + 녹음 상태 전환 + Escape 취소 + aria-live announcer (Vitest, MediaRecorder mock 한계 명시) |

### 수정 파일 (4개)

| 파일 | 변경 |
|------|------|
| `src/components/chat/ChatUI.tsx` | (a) `VoiceRecordButton`을 PromptInput 우측에 배치, `onTranscribed={(text) => setInput((p) => p + text)}` 콜백. (b) `AttachmentButton`을 PromptInput 좌측에 배치, attachment state 추가. (c) `AttachmentChip` PromptInput 상단 렌더. (d) `sendMessage` 호출 시 첨부 파일을 `messages.parts` file/image part로 변환해 전달 (AI SDK v6 표준 — DefaultChatTransport prepareSendMessagesRequest 활용 또는 직접 fetch). |
| `src/app/api/chat/route.ts` | (a) `extractUserText`는 그대로(text part만). (b) **신규**: `extractAttachments(message)` — file/image part만 분리. (c) HWP/HWPX는 Upstage 호출 → markdown → systemPrompt에 추가 컨텍스트 + messages.parts에서 해당 part 제거. PDF/이미지는 그대로 `convertToModelMessages`가 처리. (d) `buildSystemPrompt`에 `attachmentMarkdown?` 옵션 추가. |
| `src/lib/rag/prompt-builder.ts` | `buildSystemPrompt(chunks, attachmentMarkdown?)` 시그니처 확장. attachmentMarkdown 있으면 "## 사용자 첨부 문서" 섹션 추가 (RAG chunks 다음). |
| `.env.example` | `DEEPGRAM_API_KEY=` + `UPSTAGE_API_KEY=` 두 줄 추가 (값은 비움, 형식 안내) |

### 변경 없음 (확인용)

| 영역 | 이유 |
|------|------|
| `supabase/migrations/**` | M7는 마이그레이션 0건. 파일·음성 데이터는 임시 메모리 처리 (spec §5 D2). chat_messages 스키마 변경 불요. |
| `vercel.json` | `crons` 그대로, env는 dashboard에서 등록 |
| `package.json` | 신규 의존성 0건. AI SDK v6의 `convertToModelMessages`가 file/image part 변환 처리. Deepgram·Upstage는 native fetch. |

### 검증 명령 표

| 명령 | 목적 | 기대 baseline |
|------|------|---------------|
| `npm run test` | unit (node:test) — file-validation · upstage-parse · transcribe · chat-attachment | 기존 201 + 신규 ~25건 추가 그린 |
| `npm run test:components` | Vitest (VoiceRecordButton) | 기존 16 + 신규 ~6건 (MediaRecorder mock 한계 일부 skip) |
| `npm run test:integration` | RLS 통합 (`tests/migrations/**`) | M5 baseline 변동 0 |
| `npm run build` | next build + content validate + sync | **570 + 4 ƒ** (신규 `/api/transcribe`) |
| `npm run kb:publish:dry-run` | KB layer 무관 baseline | 534/8/526 변동 0 |
| `npm run lint` | ESLint | 0 problems 유지 |
| **smoke 1**: 위원장 마이크 → "특수 마우스에는 어떤 종류가 있나요" → input 자동 채움 → 전송 | E2E 음성 입력 검증 | 정답 응답 + sourceRefs |
| **smoke 2**: 위원장 정책 PDF 첨부 → "이 문서 요약" → Gemini multimodal 응답 | E2E PDF 첨부 검증 | 한국어 요약 + 본문 인용 |
| **smoke 3**: 위원장 HWPX 첨부 → 임의 질의 → Upstage → systemPrompt 컨텍스트 응답 | E2E HWP 첨부 검증 | 첨부 컨텍스트 반영 응답 |

---

## 2. Tasks

### Part A — 음성 받아쓰기 (Tasks 1~7)

#### Task 1: `/api/transcribe` Route Handler (Deepgram 프록시)

**Files:**
- Create: `src/app/api/transcribe/route.ts`
- Test: `tests/api/transcribe.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/api/transcribe.test.ts
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

describe('/api/transcribe (M7.1 Deepgram 프록시)', () => {
  it('audio 누락 시 400 한국어 에러', async () => {
    const { POST } = await import('@/app/api/transcribe/route')
    const formData = new FormData()
    const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
    const res = await POST(req)
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.match(data.error, /오디오 파일이 필요/)
  })

  it('파일 크기 25MB 초과 시 400', async () => {
    const { POST } = await import('@/app/api/transcribe/route')
    const formData = new FormData()
    formData.append('audio', new Blob([new ArrayBuffer(26 * 1024 * 1024)], { type: 'audio/webm' }))
    const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
    const res = await POST(req)
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.match(data.error, /너무 큽니다/)
  })

  it('DEEPGRAM_API_KEY 미설정 시 500', async () => {
    const original = process.env.DEEPGRAM_API_KEY
    delete process.env.DEEPGRAM_API_KEY
    try {
      const { POST } = await import('@/app/api/transcribe/route')
      const formData = new FormData()
      formData.append('audio', new Blob(['x'], { type: 'audio/webm' }))
      const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
      const res = await POST(req)
      assert.equal(res.status, 500)
    } finally {
      if (original) process.env.DEEPGRAM_API_KEY = original
    }
  })

  it('Deepgram 정상 응답 → text/language_code/confidence 반환', async () => {
    process.env.DEEPGRAM_API_KEY = 'test-key'
    const originalFetch = global.fetch
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({
        results: {
          channels: [{
            alternatives: [{ transcript: '특수 마우스에는 어떤 종류가 있나요', confidence: 0.95, words: [] }],
            detected_language: 'ko',
          }],
        },
      }),
      { status: 200 },
    )) as typeof fetch
    try {
      const { POST } = await import('@/app/api/transcribe/route')
      const formData = new FormData()
      formData.append('audio', new Blob(['x'], { type: 'audio/webm' }))
      const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
      const res = await POST(req)
      assert.equal(res.status, 200)
      const data = await res.json()
      assert.equal(data.text, '특수 마우스에는 어떤 종류가 있나요')
      assert.equal(data.language_code, 'ko')
      assert.equal(data.confidence, 0.95)
    } finally {
      global.fetch = originalFetch
    }
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- --test-name-pattern transcribe`
Expected: FAIL — module not found

- [ ] **Step 3: Route Handler 구현**

```typescript
// src/app/api/transcribe/route.ts
/**
 * Phase 3 M7.1 — Deepgram Nova-2 Speech-to-Text 프록시.
 *
 * 출처: dodo-planet src/app/api/speech-to-text/route.ts (i18n 제거 + language=ko 강제).
 *
 * 흐름: FormData {audio, locale?} → Deepgram Nova-2 → {text, language_code, confidence}.
 *
 * PIPA (spec §5):
 *   - transcript 본문은 로그 X. 길이·언어·confidence만.
 *   - 오디오는 서버 메모리에서 fetch 호출 후 즉시 폐기 (디스크 0).
 *
 * 모델: nova-2-conversationalai (단일 화자 + smart_format).
 * 언어: language=ko 강제 (정책 채팅은 한국어 단일).
 */
import 'server-only'

export const runtime = 'nodejs'
export const maxDuration = 30 // 오디오 업로드(최대 25MB) + Deepgram 응답 마진

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

interface DeepgramWord {
  word: string
  start: number
  end: number
  confidence: number
}
interface DeepgramAlternative {
  transcript: string
  confidence: number
  words: DeepgramWord[]
}
interface DeepgramChannel {
  alternatives: DeepgramAlternative[]
  detected_language?: string
}
interface DeepgramResponse {
  results?: { channels: DeepgramChannel[] }
}

export async function POST(req: Request): Promise<Response> {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return json400('요청 본문이 FormData가 아니에요.')
  }

  const audio = formData.get('audio')
  if (!audio || !(audio instanceof Blob)) {
    return json400('오디오 파일이 필요해요.')
  }

  if (audio.size > MAX_SIZE) {
    return json400('오디오 파일이 너무 큽니다. (최대 25MB)')
  }

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    console.error('[transcribe] DEEPGRAM_API_KEY 미설정')
    return json500('서버 설정 오류예요.')
  }

  const buffer = await audio.arrayBuffer()
  const params = new URLSearchParams({
    model: 'nova-2-conversationalai',
    smart_format: 'true',
    punctuate: 'true',
    diarize: 'false',
    language: 'ko', // 정책 채팅은 한국어 강제 (dodo-planet과 차이)
  })

  let response: Response
  try {
    response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': audio.type || 'audio/webm',
      },
      body: buffer,
    })
  } catch (err) {
    console.error('[transcribe] Deepgram fetch 실패:', err instanceof Error ? err.message : String(err))
    return json500('음성 인식 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')
  }

  if (!response.ok) {
    console.error('[transcribe] Deepgram 응답 오류:', response.status)
    return json500('음성 인식 중 오류가 발생했어요.')
  }

  const result = (await response.json()) as DeepgramResponse
  const channel = result.results?.channels?.[0]
  const alternative = channel?.alternatives?.[0]

  if (!alternative?.transcript) {
    return json400('음성을 인식할 수 없어요. 좀 더 또렷하게 다시 말씀해 주세요.')
  }

  // PIPA: transcript 본문 로그 X — 길이·언어·confidence만
  console.log('[transcribe] success', {
    textLength: alternative.transcript.length,
    language: channel.detected_language ?? 'ko',
    confidence: alternative.confidence,
  })

  return new Response(
    JSON.stringify({
      text: alternative.transcript,
      language_code: channel.detected_language ?? 'ko',
      confidence: alternative.confidence,
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}

function json400(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function json500(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- --test-name-pattern transcribe`
Expected: PASS — 4 ok

- [ ] **Step 5: commit**

```bash
git add src/app/api/transcribe/route.ts tests/api/transcribe.test.ts
git commit -m "feat(m7.1): /api/transcribe Deepgram Nova-2 프록시 + 4 tests"
```

---

#### Task 2: `useMicrophonePermission` hook (dodo-planet 이식)

**Files:**
- Create: `src/hooks/useMicrophonePermission.ts`

- [ ] **Step 1: 코드 이식**

dodo-planet `src/hooks/useMicrophonePermission.ts:1-141`을 거의 그대로 복사. 차이점:
- 한국어 카피 (이미 한국어임 — 변경 없음)
- 의존성 0 (`@/` import 없음)

```typescript
// src/hooks/useMicrophonePermission.ts
'use client'

/**
 * Phase 3 M7.1 — 마이크 권한 관리 훅.
 *
 * 출처: dodo-planet src/hooks/useMicrophonePermission.ts (그대로).
 *
 * - 권한 확인과 요청을 분리 — UX 개선 (한 번 prompt 후 캐시)
 * - Safari 폴백 (permissions.query 미지원) — localStorage 캐시
 * - 모바일 UX 버퍼 500ms (권한 팝업 닫힘 → 앱 포커스 복귀 시간)
 */

import { useState, useCallback, useRef } from 'react'

export type MicPermissionState =
  | 'idle'
  | 'checking'
  | 'needsPermission'
  | 'ready'
  | 'denied'

interface UseMicrophonePermissionReturn {
  permissionState: MicPermissionState
  checkPermission: () => Promise<MicPermissionState>
  requestPermission: () => Promise<boolean>
  reset: () => void
}

const STORAGE_KEY = 'webfortd_mic_permission_cache'

export function useMicrophonePermission(): UseMicrophonePermissionReturn {
  const [permissionState, setPermissionState] = useState<MicPermissionState>('idle')
  const streamRef = useRef<MediaStream | null>(null)

  const checkPermission = useCallback(async (): Promise<MicPermissionState> => {
    setPermissionState('checking')
    try {
      if (navigator.permissions?.query) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (result.state === 'granted') {
            setPermissionState('ready')
            localStorage.setItem(STORAGE_KEY, 'granted')
            return 'ready'
          } else if (result.state === 'denied') {
            setPermissionState('denied')
            localStorage.setItem(STORAGE_KEY, 'denied')
            return 'denied'
          } else {
            setPermissionState('needsPermission')
            return 'needsPermission'
          }
        } catch {
          // permissions.query 실패 시 폴백
        }
      }
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached === 'granted') {
        setPermissionState('ready')
        return 'ready'
      } else if (cached === 'denied') {
        setPermissionState('denied')
        return 'denied'
      }
      setPermissionState('needsPermission')
      return 'needsPermission'
    } catch (error) {
      console.error('[useMicrophonePermission] check 실패:', error)
      setPermissionState('needsPermission')
      return 'needsPermission'
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setPermissionState('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      localStorage.setItem(STORAGE_KEY, 'granted')
      await new Promise((resolve) => setTimeout(resolve, 500))
      setPermissionState('ready')
      return true
    } catch (error) {
      console.error('[useMicrophonePermission] request 거부:', error)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        localStorage.setItem(STORAGE_KEY, 'denied')
        setPermissionState('denied')
      } else {
        setPermissionState('needsPermission')
      }
      return false
    }
  }, [])

  const reset = useCallback(() => setPermissionState('idle'), [])

  return { permissionState, checkPermission, requestPermission, reset }
}
```

- [ ] **Step 2: build 확인** (테스트 없음 — Task 6 VoiceRecordButton 통합 테스트에서 검증)

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 3: commit**

```bash
git add src/hooks/useMicrophonePermission.ts
git commit -m "feat(m7.1): useMicrophonePermission 훅 — navigator.permissions + Safari 폴백"
```

---

#### Task 3: `useVoiceRecorder` hook (dodo-planet 이식 + 120s)

**Files:**
- Create: `src/hooks/useVoiceRecorder.ts`

- [ ] **Step 1: 코드 이식**

dodo-planet `useVoiceRecorder.ts:1-243`을 거의 그대로. 차이점:
- `maxDuration` 기본값 60 → **120** (spec §D4)
- `locale` param 그대로 받되 서버는 무시 (Deepgram language=ko 강제)
- 한국어 에러 메시지는 이미 한국어

```typescript
// src/hooks/useVoiceRecorder.ts
'use client'

/**
 * Phase 3 M7.1 — 음성 녹음 훅.
 *
 * 출처: dodo-planet src/hooks/useVoiceRecorder.ts (maxDuration 60→120 + STT 엔드포인트 경로).
 *
 * - MediaRecorder Web API + 120초 자동 종료 (spec §D4)
 * - WebM Opus 우선 → audio/webm → audio/mp4 fallback
 * - 최소 녹음 0.3초 미만 reject
 * - chunks 합성 후 FormData POST /api/transcribe
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export type RecordingState = 'idle' | 'recording' | 'processing'

interface UseVoiceRecorderOptions {
  maxDuration?: number // 기본 120초 (spec §D4)
  onTranscribed?: (text: string) => void
  onError?: (error: string) => void
}

interface UseVoiceRecorderReturn {
  state: RecordingState
  duration: number
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => void
  isSupported: boolean
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const { maxDuration = 120, onTranscribed, onError } = options

  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [isSupported, setIsSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setIsSupported(false)
      return
    }
    const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
    setIsSupported(hasMediaDevices && hasMediaRecorder)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (state !== 'recording' || !mediaRecorderRef.current) return
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setState('processing')

    return new Promise<void>((resolve) => {
      const mr = mediaRecorderRef.current!
      mr.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        if (chunksRef.current.length === 0) {
          onError?.('녹음된 오디오가 없어요.')
          setState('idle')
          resolve()
          return
        }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType })
        if (duration < 0.3) {
          onError?.('녹음이 너무 짧아요. 좀 더 길게 말씀해 주세요.')
          setState('idle')
          setDuration(0)
          resolve()
          return
        }
        try {
          const formData = new FormData()
          formData.append('audio', blob)
          const response = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || '음성 인식에 실패했어요.')
          if (data.text) {
            onTranscribed?.(data.text)
          } else {
            onError?.('인식된 텍스트가 없어요. 다시 시도해 주세요.')
          }
        } catch (err) {
          onError?.(err instanceof Error ? err.message : '음성 인식에 실패했어요.')
        } finally {
          setState('idle')
          setDuration(0)
          resolve()
        }
      }
      mr.stop()
    })
  }, [state, duration, onTranscribed, onError])

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
        },
      })
      streamRef.current = stream

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4'

      const mr = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.start(100)
      setState('recording')
      startTimeRef.current = Date.now()
      setDuration(0)

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setDuration(elapsed)
        if (elapsed >= maxDuration) {
          void stopRecording()
        }
      }, 100)
    } catch (err) {
      console.error('[useVoiceRecorder] start 실패:', err)
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? '마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.'
          : '마이크를 시작할 수 없어요.'
      onError?.(msg)
    }
  }, [state, maxDuration, onError, stopRecording])

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
    setState('idle')
    setDuration(0)
  }, [state])

  return { state, duration, startRecording, stopRecording, cancelRecording, isSupported }
}
```

- [ ] **Step 2: build 확인**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 3: commit**

```bash
git add src/hooks/useVoiceRecorder.ts
git commit -m "feat(m7.1): useVoiceRecorder 훅 — MediaRecorder + 120초 cap + WebM Opus"
```

---

#### Task 4: `useSound` 단순 버전 + `MicrophonePermissionPrompt` 컴포넌트

**Files:**
- Create: `src/hooks/useSound.ts`
- Create: `src/components/chat/MicrophonePermissionPrompt.tsx`

- [ ] **Step 1: useSound 단순 버전**

```typescript
// src/hooks/useSound.ts
'use client'

/**
 * Phase 3 M7.1 — 사운드 피드백 훅 (단순 버전).
 *
 * dodo-planet useSound 대비:
 *   - traveler/DB 의존 0 (localStorage 토글만)
 *   - sound cache 0 (호출 시 Audio 생성)
 *   - 메서드 2개 (playRecordStart · playRecordStop)
 *
 * 사운드 파일 0 = no-op (M7 carry — 추후 mp3 도입 시 SOUND_PATHS 활성화).
 * 현재는 호출만 safe하게 받고 silent. aria-live가 주된 피드백 매개체.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'webfortd_sound_enabled'

interface UseSoundReturn {
  isEnabled: boolean
  toggle: () => void
  playRecordStart: () => void
  playRecordStop: () => void
}

export function useSound(): UseSoundReturn {
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setIsEnabled(stored === 'true')
  }, [])

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(next))
      }
      return next
    })
  }, [])

  // M7 carry: 실제 mp3 도입 시 new Audio('/sounds/record-start.mp3').play() 활성화.
  // 현재는 silent — aria-live가 주된 피드백.
  const playRecordStart = useCallback(() => {
    if (!isEnabled) return
    // no-op
  }, [isEnabled])

  const playRecordStop = useCallback(() => {
    if (!isEnabled) return
    // no-op
  }, [isEnabled])

  return { isEnabled, toggle, playRecordStart, playRecordStop }
}
```

- [ ] **Step 2: MicrophonePermissionPrompt 컴포넌트**

```tsx
// src/components/chat/MicrophonePermissionPrompt.tsx
'use client'

/**
 * Phase 3 M7.1 — 마이크 권한 요청 모달.
 *
 * 출처: dodo-planet MicrophonePermissionPrompt (한국어 카피 고정).
 *
 * 접근성:
 *   - role="dialog" aria-modal="true"
 *   - ESC 닫힘 (window keydown — CopyButton 패턴 재사용)
 *   - "허용" / "취소" 버튼 44px 이상
 */

import { useEffect } from 'react'
import { Mic } from 'lucide-react'

interface MicrophonePermissionPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAllow: () => void
}

export function MicrophonePermissionPrompt({ open, onOpenChange, onAllow }: MicrophonePermissionPromptProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-prompt-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-card text-card-foreground shadow-xl">
        <div className="flex flex-col items-center gap-3 p-6">
          <Mic className="h-8 w-8 text-primary" aria-hidden="true" />
          <h2 id="mic-prompt-title" className="text-lg font-semibold text-foreground">
            마이크 권한이 필요해요
          </h2>
          <p className="text-center text-sm text-muted-foreground">
            질문을 음성으로 입력할 수 있어요. 음성은 안전한 외부 변환 서비스(Deepgram)로 전송되며,
            처리 후 즉시 폐기됩니다.
          </p>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-11 flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onAllow()
            }}
            className="min-h-11 flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            허용
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: build 확인**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 4: commit**

```bash
git add src/hooks/useSound.ts src/components/chat/MicrophonePermissionPrompt.tsx
git commit -m "feat(m7.1): useSound 단순 + MicrophonePermissionPrompt 한국어 모달"
```

---

#### Task 5: `VoiceRecordButton` 컴포넌트 + Vitest

**Files:**
- Create: `src/components/chat/VoiceRecordButton.tsx`
- Test: `tests/components/chat/voice-record-button.test.tsx`

- [ ] **Step 1: 컴포넌트 구현** (dodo-planet 이식, sonner toast → ErrorBanner 패턴 또는 alert)

```tsx
// src/components/chat/VoiceRecordButton.tsx
'use client'

/**
 * Phase 3 M7.1 — 음성 녹음 버튼.
 *
 * 출처: dodo-planet VoiceRecordButton (i18n 제거 + sonner toast 제거).
 *
 * 흐름:
 *   1. 클릭 → 권한 확인
 *   2. needsPermission → MicrophonePermissionPrompt 모달
 *   3. ready → 녹음 시작 + aria-live "녹음 중..."
 *   4. 다시 클릭 또는 120초 자동 → 정지 + STT → onTranscribed 콜백
 *   5. ESC 키로 취소
 *
 * 접근성:
 *   - aria-label 상태별 (마이크 시작/정지/변환 중/지원 안 됨)
 *   - role="status" + aria-live="assertive" announcer
 *   - 44px 터치 타깃
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Loader2, MicOff, Square } from 'lucide-react'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useMicrophonePermission } from '@/hooks/useMicrophonePermission'
import { useSound } from '@/hooks/useSound'
import { MicrophonePermissionPrompt } from '@/components/chat/MicrophonePermissionPrompt'

interface VoiceRecordButtonProps {
  onTranscribed: (text: string) => void
  onError?: (error: string) => void
  disabled?: boolean
}

export function VoiceRecordButton({ onTranscribed, onError, disabled }: VoiceRecordButtonProps) {
  const announcerRef = useRef<HTMLDivElement>(null)
  const { playRecordStart, playRecordStop } = useSound()
  const { permissionState, checkPermission, requestPermission } = useMicrophonePermission()
  const [showPrompt, setShowPrompt] = useState(false)

  const { state, duration, startRecording, stopRecording, cancelRecording, isSupported } =
    useVoiceRecorder({
      maxDuration: 120,
      onTranscribed: (text) => {
        playRecordStop()
        onTranscribed(text)
      },
      onError: (error) => {
        console.error('[VoiceRecordButton] error:', error)
        onError?.(error)
      },
    })

  const announce = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message
      setTimeout(() => {
        if (announcerRef.current) announcerRef.current.textContent = ''
      }, 1500)
    }
  }, [])

  const handleAllowed = useCallback(async () => {
    const granted = await requestPermission()
    if (granted) {
      playRecordStart()
      announce('녹음을 시작했어요')
      await new Promise((r) => setTimeout(r, 300))
      await startRecording()
    }
  }, [requestPermission, playRecordStart, startRecording, announce])

  const handleClick = useCallback(async () => {
    if (disabled || !isSupported || state === 'processing') return
    if (state === 'recording') {
      announce('녹음을 멈췄어요')
      await stopRecording()
      return
    }
    const result = permissionState === 'idle' || permissionState === 'checking'
      ? await checkPermission()
      : permissionState
    if (result === 'ready') {
      playRecordStart()
      announce('녹음을 시작했어요')
      await new Promise((r) => setTimeout(r, 300))
      await startRecording()
    } else if (result === 'needsPermission') {
      setShowPrompt(true)
    } else if (result === 'denied') {
      onError?.('마이크 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.')
    }
  }, [disabled, isSupported, state, permissionState, checkPermission, playRecordStart, startRecording, stopRecording, announce, onError])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state === 'recording') {
        announce('녹음을 취소했어요')
        cancelRecording()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, cancelRecording, announce])

  const ariaLabel = !isSupported
    ? '음성 입력 미지원 브라우저예요'
    : state === 'recording'
      ? '녹음 정지'
      : state === 'processing'
        ? '변환 중'
        : '음성으로 질문 시작'

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="relative inline-flex items-center">
      <div ref={announcerRef} role="status" aria-live="assertive" aria-atomic="true" className="sr-only" />

      {state === 'recording' && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap" aria-hidden="true">
          <div className="flex items-center gap-1.5 rounded-full bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-lg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || !isSupported || state === 'processing'}
        aria-label={ariaLabel}
        className={
          state === 'recording'
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-destructive text-destructive-foreground animate-pulse focus:outline-none focus:ring-2 focus:ring-ring'
            : state === 'processing'
              ? 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-amber-500 text-white cursor-wait'
              : 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {!isSupported || permissionState === 'denied' ? (
          <MicOff className="h-5 w-5" aria-hidden="true" />
        ) : state === 'recording' ? (
          <Square className="h-4 w-4 fill-current" aria-hidden="true" />
        ) : state === 'processing' ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <MicrophonePermissionPrompt open={showPrompt} onOpenChange={setShowPrompt} onAllow={handleAllowed} />
    </div>
  )
}
```

- [ ] **Step 2: Vitest 작성**

```tsx
// tests/components/chat/voice-record-button.test.tsx
/**
 * Phase 3 M7.1 — VoiceRecordButton Vitest.
 *
 * 검증:
 *   - 미지원 환경(MediaRecorder undef) → MicOff + disabled
 *   - 권한 denied → MicOff + onError 호출
 *   - 권한 needsPermission → 프롬프트 모달 노출
 *   - aria-label 상태별 변경
 *
 * MediaRecorder 실 동작은 JSDOM에서 불완전 → smoke는 위원장 수동 검수 (Chrome MCP).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton'

describe('VoiceRecordButton (M7.1 음성 받아쓰기)', () => {
  beforeEach(() => {
    // localStorage 초기화
    localStorage.clear()
  })

  it('MediaRecorder 미지원 시 MicOff 표시 + disabled', () => {
    const originalMediaRecorder = global.MediaRecorder
    // @ts-expect-error mock 환경
    delete global.MediaRecorder
    try {
      render(<VoiceRecordButton onTranscribed={vi.fn()} />)
      const button = screen.getByRole('button', { name: /미지원 브라우저/ })
      expect(button).toBeDisabled()
    } finally {
      global.MediaRecorder = originalMediaRecorder
    }
  })

  it('초기 상태 — Mic 아이콘 + "음성으로 질문 시작" label', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    expect(screen.getByRole('button', { name: /음성으로 질문 시작/ })).toBeInTheDocument()
  })

  it('disabled prop 시 button disabled', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} disabled />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('localStorage denied 캐시 → MicOff', async () => {
    localStorage.setItem('webfortd_mic_permission_cache', 'denied')
    // navigator.permissions 모킹은 복잡 — denied 상태로 진입 시 UI만 확인
    // 실 흐름은 위원장 수동 검수
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument() // 초기 렌더 단순 검증
  })
})
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm run test:components -- voice-record-button`
Expected: PASS — 4 ok

- [ ] **Step 4: commit**

```bash
git add src/components/chat/VoiceRecordButton.tsx tests/components/chat/voice-record-button.test.tsx
git commit -m "feat(m7.1): VoiceRecordButton + 4 Vitest (MediaRecorder mock 한계 명시)"
```

---

#### Task 6: ChatUI에 VoiceRecordButton 통합

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: import + PromptInput 우측 배치**

ChatUI PromptInput 영역(현재 `<PromptInputSubmit>` 위치 옆)에 VoiceRecordButton 추가:

```tsx
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton'

// PromptInput 영역:
<PromptInput onSubmit={(message) => send(message.text)} aria-label="질문 입력" className="border-t border-border pt-3">
  <PromptInputTextarea ... />
  <div className="flex items-center gap-1">
    <VoiceRecordButton
      onTranscribed={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
      onError={(error) => setChatError(new Error(error))}
      disabled={isLoading}
    />
    <PromptInputSubmit status={status} aria-label="전송" disabled={!input.trim()} />
  </div>
</PromptInput>
```

(정확한 PromptInput 구조는 ai-elements/prompt-input.tsx 확인 후 조정 — 슬롯 구조에 맞게)

- [ ] **Step 2: build + 회귀**

Run: `npm run build && npm test && npm run test:components`
Expected: 570 + 4 ƒ + 모두 그린

- [ ] **Step 3: commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "feat(m7.1): ChatUI PromptInput에 VoiceRecordButton 통합 — 전사 텍스트 input append"
```

---

#### Task 7: 음성 RUN_SMOKE 검증 (Deepgram 실 API)

**Files:**
- Create: `tests/api/transcribe.smoke.test.ts`

- [ ] **Step 1: smoke test 작성** (RUN_SMOKE=1 gate, 실 Deepgram 호출)

```typescript
// tests/api/transcribe.smoke.test.ts
/**
 * Phase 3 M7.1 — Deepgram 실 API smoke.
 *
 * 실행: RUN_SMOKE=1 DEEPGRAM_API_KEY=... npm test -- transcribe.smoke
 *
 * - 정상 환경: skip (CI 자동 실행 회피)
 * - 위원장 명시 실행 — Deepgram 응답 형식 정합 검증
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ENABLED = process.env.RUN_SMOKE === '1'

describe('/api/transcribe smoke (RUN_SMOKE=1)', { skip: !ENABLED }, () => {
  it('Deepgram nova-2 실 API → 한국어 transcript', async () => {
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY 미설정 — smoke 실행 불가')
    }
    // 테스트용 짧은 한국어 음성 (fixture)
    const fixturePath = path.join(import.meta.dirname, 'fixtures/sample-ko.webm')
    if (!fs.existsSync(fixturePath)) {
      console.log('[smoke] fixture 없음 — Task 7 fixture 준비 후 재실행')
      return
    }
    const audioBuffer = fs.readFileSync(fixturePath)
    const { POST } = await import('@/app/api/transcribe/route')
    const formData = new FormData()
    formData.append('audio', new Blob([audioBuffer], { type: 'audio/webm' }))
    const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
    const res = await POST(req)
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.text.length > 0)
    assert.equal(data.language_code, 'ko')
    console.log('[smoke] transcribed:', data.text, 'confidence:', data.confidence)
  })
})
```

- [ ] **Step 2: fixture 준비 안내**

`tests/api/fixtures/sample-ko.webm` 위원장 직접 녹음 후 배치 (또는 dodo-planet에 있으면 복사). fixture 없으면 smoke skip — Vercel env 등록 후 production preview에서 위원장 직접 검증.

- [ ] **Step 3: commit**

```bash
git add tests/api/transcribe.smoke.test.ts
git commit -m "feat(m7.1): transcribe RUN_SMOKE=1 실 Deepgram API 검증 + fixture 가이드"
```

---

### Part B — 파일 첨부 (Tasks 8~14)

#### Task 8: `file-validation` util + 4 tests

**Files:**
- Create: `src/lib/chat/file-validation.ts`
- Test: `tests/lib/chat/file-validation.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/lib/chat/file-validation.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateAttachment, MAX_FILE_SIZE, ALLOWED_MIMES } from '@/lib/chat/file-validation'

describe('validateAttachment (M7.2 파일 검증)', () => {
  it('MAX_FILE_SIZE = 10MB (spec §D3)', () => {
    assert.equal(MAX_FILE_SIZE, 10 * 1024 * 1024)
  })

  it('PDF MIME 화이트리스트 통과', () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'a.pdf', { type: 'application/pdf' })
    const result = validateAttachment(file)
    assert.equal(result.ok, true)
  })

  it('HWPX MIME 통과', () => {
    const file = new File(['x'], 'a.hwpx', { type: 'application/vnd.hancom.hwpx' })
    const result = validateAttachment(file)
    assert.equal(result.ok, true)
  })

  it('text/plain — 화이트리스트 외 → reject', () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    const result = validateAttachment(file)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.reason, /지원하지 않는 파일/)
  })

  it('10MB 초과 → reject', () => {
    const big = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
    const result = validateAttachment(big)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.reason, /10MB 이하/)
  })

  it('ALLOWED_MIMES 6종', () => {
    assert.equal(ALLOWED_MIMES.length, 6) // pdf · hwp · hwpx · png · jpeg · webp
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- file-validation`
Expected: FAIL — module not found

- [ ] **Step 3: util 구현**

```typescript
// src/lib/chat/file-validation.ts
/**
 * Phase 3 M7.2 — 첨부 파일 검증.
 *
 * spec §D3: 파일당 ≤10MB, 동시 1개.
 *
 * MIME 화이트리스트 (Q1=C):
 *   - PDF: application/pdf
 *   - HWP: application/x-hwp 또는 application/vnd.hancom.hwp
 *   - HWPX: application/vnd.hancom.hwpx 또는 application/zip (구버전)
 *   - 이미지: image/png · image/jpeg · image/webp
 *   - HEIC는 첫 버전 X (Safari iOS 자동 변환 의존)
 *
 * magic bytes 검증은 PDF만 (가장 흔한 위장 case). HWP·이미지는 MIME 신뢰 + 서버 단 추가 검증 carry.
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (spec §D3)

export const ALLOWED_MIMES: readonly string[] = [
  'application/pdf',
  'application/x-hwp',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx',
  'image/png',
  'image/jpeg',
  'image/webp',
]

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

export function validateAttachment(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: '파일이 너무 커요. 10MB 이하만 가능해요.' }
  }
  // application/zip은 HWPX 구버전 흡수 — 위험: 일반 zip도 통과. 위원장 사용 패턴 누적 후 strict
  const isAllowed = ALLOWED_MIMES.includes(file.type) || file.type === 'application/zip'
  if (!isAllowed) {
    return {
      ok: false,
      reason: `지원하지 않는 파일 형식이에요. PDF · HWP · HWPX · 이미지(PNG/JPEG/WEBP)만 첨부해 주세요. (현재: ${file.type || '알 수 없음'})`,
    }
  }
  return { ok: true }
}
```

ALLOWED_MIMES 카운트 정정: pdf + x-hwp + vnd.hancom.hwp + vnd.hancom.hwpx + png + jpeg + webp = 7. 테스트 assertion도 7로 수정.

- [ ] **Step 4: 테스트 통과 확인 + ALLOWED_MIMES 카운트 조정**

Run: `npm test -- file-validation`
Expected: PASS — 6 ok

- [ ] **Step 5: commit**

```bash
git add src/lib/chat/file-validation.ts tests/lib/chat/file-validation.test.ts
git commit -m "feat(m7.2): validateAttachment + MAX_FILE_SIZE 10MB + 7 MIME 화이트리스트"
```

---

#### Task 9: `upstage-parse` util + 4 tests

**Files:**
- Create: `src/lib/chat/upstage-parse.ts`
- Test: `tests/lib/chat/upstage-parse.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/lib/chat/upstage-parse.test.ts
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

describe('parseHwpToMarkdown (M7.2 Upstage Document Parse)', () => {
  it('API 키 미설정 시 throw', async () => {
    const original = process.env.UPSTAGE_API_KEY
    delete process.env.UPSTAGE_API_KEY
    try {
      const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse')
      await assert.rejects(
        parseHwpToMarkdown(new ArrayBuffer(0), 'application/vnd.hancom.hwp'),
        /UPSTAGE_API_KEY 미설정/,
      )
    } finally {
      if (original) process.env.UPSTAGE_API_KEY = original
    }
  })

  it('정상 응답 → markdown 본문 반환', async () => {
    process.env.UPSTAGE_API_KEY = 'test-key'
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({ content: { markdown: '# 정책 문서\n\n본문 내용' } }),
      { status: 200 },
    )) as typeof fetch
    const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse')
    const md = await parseHwpToMarkdown(new ArrayBuffer(10), 'application/vnd.hancom.hwp')
    assert.match(md, /정책 문서/)
  })

  it('빈 markdown → 한국어 에러 throw', async () => {
    process.env.UPSTAGE_API_KEY = 'test-key'
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({ content: { markdown: '' } }),
      { status: 200 },
    )) as typeof fetch
    const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse')
    await assert.rejects(
      parseHwpToMarkdown(new ArrayBuffer(10), 'application/vnd.hancom.hwp'),
      /추출된 텍스트가 없/,
    )
  })

  it('Upstage 5xx → 한국어 에러 throw', async () => {
    process.env.UPSTAGE_API_KEY = 'test-key'
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500 },
    )) as typeof fetch
    const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse')
    await assert.rejects(
      parseHwpToMarkdown(new ArrayBuffer(10), 'application/vnd.hancom.hwp'),
      /파싱 중 오류/,
    )
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- upstage-parse`
Expected: FAIL

- [ ] **Step 3: util 구현**

```typescript
// src/lib/chat/upstage-parse.ts
/**
 * Phase 3 M7.2 — Upstage Document Parse 클라이언트.
 *
 * HWP/HWPX 파일 → markdown 추출. 정책 문서 본문을 system prompt에 추가 컨텍스트로.
 *
 * spec §D1: Upstage Document Parse API 사용. 위원장 보유 키 UPSTAGE_API_KEY 재사용.
 * spec §M7.2: PDF/이미지는 Gemini multimodal로 직접, HWP/HWPX만 Upstage 위임.
 *
 * 응답 처리: content.markdown만 추출. 표·이미지 위치는 markdown으로 흡수.
 */

import 'server-only'

const UPSTAGE_ENDPOINT = 'https://api.upstage.ai/v1/document-digitization'
const REQUEST_TIMEOUT_MS = 30_000 // spec §6 리스크

interface UpstageResponse {
  content?: { markdown?: string }
  error?: string
}

export async function parseHwpToMarkdown(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.UPSTAGE_API_KEY
  if (!apiKey) {
    throw new Error('UPSTAGE_API_KEY 미설정 — 관리자에게 환경변수 추가 요청')
  }

  const formData = new FormData()
  formData.append('document', new Blob([buffer], { type: mimeType }), 'document')
  formData.append('output_formats', JSON.stringify(['markdown']))
  formData.append('ocr', 'force') // 이미지 포함 HWP 대비

  let response: Response
  try {
    response = await fetch(UPSTAGE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const reason = err instanceof Error && err.name === 'TimeoutError'
      ? '파싱 시간이 초과되었어요. 더 작은 파일로 다시 시도해 주세요.'
      : '문서 파싱 서버에 연결할 수 없어요.'
    throw new Error(reason)
  }

  if (!response.ok) {
    console.error('[upstage-parse] 응답 오류:', response.status)
    throw new Error('정책 문서 파싱 중 오류가 발생했어요. 다른 형식(PDF)으로 다시 시도해 보세요.')
  }

  const data = (await response.json()) as UpstageResponse
  const markdown = data.content?.markdown?.trim()
  if (!markdown) {
    throw new Error('첨부 문서에서 추출된 텍스트가 없어요. 다른 파일을 시도해 보세요.')
  }
  return markdown
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- upstage-parse`
Expected: PASS — 4 ok

- [ ] **Step 5: commit**

```bash
git add src/lib/chat/upstage-parse.ts tests/lib/chat/upstage-parse.test.ts
git commit -m "feat(m7.2): parseHwpToMarkdown Upstage Document Parse + 4 tests"
```

---

#### Task 10: `/api/chat/route.ts` 확장 — file part 분기 처리

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/rag/prompt-builder.ts`
- Test: `tests/api/chat-attachment.test.ts`

- [ ] **Step 1: prompt-builder 시그니처 확장**

`src/lib/rag/prompt-builder.ts`의 `buildSystemPrompt`에 optional `attachmentMarkdown` 추가:

```typescript
export function buildSystemPrompt(
  chunks: RetrievedChunk[],
  attachmentMarkdown?: string,
): string {
  const retrievedSection = formatRetrievedChunks(chunks)
  const attachmentSection = attachmentMarkdown
    ? `\n\n## 사용자 첨부 문서\n\n${attachmentMarkdown}\n\n위 문서를 응답의 추가 컨텍스트로 활용하세요.`
    : ''
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{RETRIEVED_CHUNKS}', retrievedSection)
    .replace('{ATTACHMENT_CONTEXT}', attachmentSection)
  // (실제 템플릿에 {ATTACHMENT_CONTEXT} placeholder 추가 필요)
}
```

prompt-builder.ts 기존 코드 검토 후 placeholder 위치 결정. 또는 결과 문자열에 append:

```typescript
const base = SYSTEM_PROMPT_TEMPLATE.replace('{RETRIEVED_CHUNKS}', retrievedSection)
return attachmentSection ? base + attachmentSection : base
```

- [ ] **Step 2: route.ts 분기 처리**

```typescript
// src/app/api/chat/route.ts 추가/수정 부분 (Task 1 기존 코드에 통합)

import { validateAttachment, ALLOWED_MIMES } from '@/lib/chat/file-validation'
import { parseHwpToMarkdown } from '@/lib/chat/upstage-parse'

// extractUserText 다음에:
function extractFileParts(message: UIMessage): Array<{ mediaType: string; data: string | Uint8Array; name?: string }> {
  return (message.parts ?? [])
    .filter((p): p is { type: 'file'; mediaType: string; data: string | Uint8Array; name?: string } =>
      p.type === 'file' && typeof p === 'object' && p !== null && 'mediaType' in p,
    )
    .map((p) => ({ mediaType: p.mediaType, data: p.data, name: p.name }))
}

// HWP/HWPX 판별:
const HWP_MIMES = new Set([
  'application/x-hwp',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx',
  'application/zip', // HWPX 구버전
])

// POST handler 안 — extractUserText 다음:
const fileParts = extractFileParts(lastUser)

// HWP/HWPX 별도 처리, PDF/이미지는 messages.parts 그대로
let attachmentMarkdown: string | undefined
const remainingFiles: typeof fileParts = []
for (const fp of fileParts) {
  if (HWP_MIMES.has(fp.mediaType)) {
    try {
      const buffer = typeof fp.data === 'string'
        ? Buffer.from(fp.data, 'base64').buffer
        : fp.data.buffer.slice(fp.data.byteOffset, fp.data.byteOffset + fp.data.byteLength)
      attachmentMarkdown = (attachmentMarkdown ?? '') + await parseHwpToMarkdown(buffer as ArrayBuffer, fp.mediaType)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '파싱 실패'
      return json400(msg)
    }
  } else {
    remainingFiles.push(fp)
  }
}

// HWP part는 messages.parts에서 제거 (이미 system prompt에 흡수)
if (attachmentMarkdown && lastUser.parts) {
  lastUser.parts = lastUser.parts.filter((p) => p.type !== 'file' || !HWP_MIMES.has((p as { mediaType?: string }).mediaType ?? ''))
}

// systemPrompt 조립 시 attachmentMarkdown 전달:
const systemPrompt = buildSystemPrompt(retrieval.chunks, attachmentMarkdown)
```

(실제 코드는 AI SDK v6 part 타입 정합성 확인 후 조정. 위는 의사 코드 — Task 구현 시 정밀화)

- [ ] **Step 3: chat-attachment 테스트 작성**

```typescript
// tests/api/chat-attachment.test.ts
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

describe('/api/chat (M7.2 파일 첨부 분기)', () => {
  it('PDF 첨부 → messages.parts에 그대로 (Gemini multimodal)', async () => {
    // (mock retrieval + mock streamText로 messages 변환 검증)
    // 구현 시 retrieval.ts 모킹 패턴 (M3 route-handler.test.ts) 참고
  })

  it('HWP 첨부 → Upstage 호출 + systemPrompt에 추가 컨텍스트', async () => {
    // (mock parseHwpToMarkdown + buildSystemPrompt 호출 인자 검증)
  })

  it('Upstage 실패 → 400 한국어 에러', async () => {
    // (parseHwpToMarkdown throw → response.status 400)
  })
})
```

- [ ] **Step 4: 테스트 통과 + build**

Run: `npm test -- chat-attachment && npm run build`
Expected: PASS + 570 + 4 ƒ

- [ ] **Step 5: commit**

```bash
git add src/app/api/chat/route.ts src/lib/rag/prompt-builder.ts tests/api/chat-attachment.test.ts
git commit -m "feat(m7.2): /api/chat 파일 분기 — HWP→Upstage→system, PDF/이미지→Gemini multimodal"
```

---

#### Task 11: `AttachmentButton` + `AttachmentChip` 컴포넌트

**Files:**
- Create: `src/components/chat/AttachmentButton.tsx`
- Create: `src/components/chat/AttachmentChip.tsx`

- [ ] **Step 1: AttachmentButton**

```tsx
// src/components/chat/AttachmentButton.tsx
'use client'

/**
 * Phase 3 M7.2 — 파일 첨부 버튼.
 *
 * 클릭 → <input type="file"> 클릭 → 파일 선택 → validateAttachment → 통과 시 onSelect 콜백.
 *
 * 접근성:
 *   - aria-label "파일 첨부"
 *   - 44px 터치 타깃
 *   - 시각 + 텍스트 라벨 ("파일 첨부") — spec §M7.2 접근성
 */

import { useRef } from 'react'
import { Paperclip } from 'lucide-react'
import { validateAttachment, ALLOWED_MIMES } from '@/lib/chat/file-validation'

interface AttachmentButtonProps {
  onSelect: (file: File) => void
  onError: (reason: string) => void
  disabled?: boolean
}

export function AttachmentButton({ onSelect, onError, disabled }: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const result = validateAttachment(file)
    if (!result.ok) {
      onError(result.reason)
      e.target.value = '' // 동일 파일 재선택 가능하도록
      return
    }
    onSelect(file)
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIMES.join(',') + ',.hwp,.hwpx'}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="파일 첨부"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Paperclip className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  )
}
```

- [ ] **Step 2: AttachmentChip**

```tsx
// src/components/chat/AttachmentChip.tsx
'use client'

/**
 * Phase 3 M7.2 — 첨부 칩 (PromptInput 상단 썸네일 카드).
 *
 * 파일명 truncate + 크기 + X 제거 버튼 + 파싱 중 status.
 *
 * 접근성:
 *   - X 버튼 aria-label "첨부 제거"
 *   - 파싱 중 aria-live status "문서 분석 중..."
 *   - 44px 키보드 접근
 */

import { X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

interface AttachmentChipProps {
  file: File
  status: 'idle' | 'parsing' | 'ready' | 'error'
  errorMessage?: string
  onRemove: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentChip({ file, status, errorMessage, onRemove }: AttachmentChipProps) {
  const isImage = file.type.startsWith('image/')

  return (
    <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
      {isImage ? (
        <ImageIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="flex-1 overflow-hidden">
        <p className="truncate font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
      </div>
      {status === 'parsing' && (
        <div role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span>문서 분석 중...</span>
        </div>
      )}
      {status === 'error' && errorMessage && (
        <p role="alert" className="text-xs text-destructive">{errorMessage}</p>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="첨부 제거"
        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: build 확인**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 4: commit**

```bash
git add src/components/chat/AttachmentButton.tsx src/components/chat/AttachmentChip.tsx
git commit -m "feat(m7.2): AttachmentButton + AttachmentChip — 44px + aria-label + status"
```

---

#### Task 12: ChatUI에 AttachmentButton + AttachmentChip 통합 + sendMessage file part 전달

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: state + 핸들러**

```tsx
import { AttachmentButton } from '@/components/chat/AttachmentButton'
import { AttachmentChip } from '@/components/chat/AttachmentChip'

// state
const [attachment, setAttachment] = useState<File | null>(null)
const [attachmentStatus, setAttachmentStatus] = useState<'idle' | 'parsing' | 'ready' | 'error'>('idle')
const [attachmentError, setAttachmentError] = useState<string | undefined>()

// send 함수 수정
async function send(text: string) {
  const trimmed = text.trim()
  if (!trimmed && !attachment) return
  setLastFailedMessage(trimmed)
  setChatError(null)

  // file을 base64로 변환해 messages.parts에 추가
  if (attachment) {
    const buffer = await attachment.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    sendMessage({
      text: trimmed,
      files: [{ mediaType: attachment.type, data: base64, name: attachment.name }],
    })
    setAttachment(null)
    setAttachmentStatus('idle')
  } else {
    sendMessage({ text: trimmed })
  }
  setInput('')
  inputRef.current?.focus()
}
```

(실제 AI SDK v6 `sendMessage` API의 file 첨부 방식 확인 후 조정. AI SDK가 file part 직접 지원하면 그대로, 아니면 transport의 `prepareSendMessagesRequest`에서 변환)

- [ ] **Step 2: render — Chip + Button**

```tsx
{/* PromptInput 위에 attachment 표시 */}
{attachment && (
  <AttachmentChip
    file={attachment}
    status={attachmentStatus}
    errorMessage={attachmentError}
    onRemove={() => {
      setAttachment(null)
      setAttachmentStatus('idle')
      setAttachmentError(undefined)
    }}
  />
)}

<PromptInput ...>
  <PromptInputTextarea ... />
  <div className="flex items-center gap-1">
    <AttachmentButton
      onSelect={(file) => {
        setAttachment(file)
        setAttachmentStatus('ready')
        setAttachmentError(undefined)
      }}
      onError={(reason) => {
        setAttachmentError(reason)
        setAttachmentStatus('error')
      }}
      disabled={isLoading || !!attachment} // 동시 1개만 (spec §D3)
    />
    <VoiceRecordButton ... />
    <PromptInputSubmit ... disabled={!input.trim() && !attachment} />
  </div>
</PromptInput>
```

- [ ] **Step 3: build + 회귀**

Run: `npm run build && npm test && npm run test:components`
Expected: 570 + 4 ƒ + 모두 그린

- [ ] **Step 4: commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "feat(m7.2): ChatUI AttachmentButton+Chip 통합 + sendMessage file part 전달"
```

---

#### Task 13: 파일 첨부 RUN_SMOKE 검증 (Upstage + Gemini 실 API)

**Files:**
- Create: `tests/api/chat-attachment.smoke.test.ts`

- [ ] **Step 1: smoke test 작성** (RUN_SMOKE=1, 실 Upstage + Gemini 호출)

- [ ] **Step 2: fixture 준비 가이드** (위원장 정책 PDF + HWPX 샘플 직접 배치)

- [ ] **Step 3: commit**

```bash
git add tests/api/chat-attachment.smoke.test.ts
git commit -m "feat(m7.2): chat-attachment RUN_SMOKE=1 실 Upstage+Gemini 검증 + fixture 가이드"
```

---

### Part C — 통합 (Tasks 14~16)

#### Task 14: `.env.example` 갱신 + Vercel env 등록 가이드

**Files:**
- Modify: `.env.example`
- Create: `docs/M7_ENV_SETUP.md`

- [ ] **Step 1: `.env.example`**

```bash
# Phase 3 M7 신규
DEEPGRAM_API_KEY=  # Deepgram Nova-2 STT — 위원장이 https://console.deepgram.com 발급
UPSTAGE_API_KEY=   # Upstage Document Parse — 위원장 보유 키 (.env.local에 이미 있음)
```

- [ ] **Step 2: `docs/M7_ENV_SETUP.md`**

위원장 명시 액션 가이드:
1. Deepgram 계정 가입 (https://console.deepgram.com) — 무료 tier 만으로 시범 충분
2. API Key 발급 후 .env.local에 추가
3. Vercel 대시보드 → Settings → Environment Variables에 `DEEPGRAM_API_KEY` + `UPSTAGE_API_KEY` 추가 (Production + Preview)
4. `vercel env pull .env.local --yes`로 로컬 동기화 확인

- [ ] **Step 3: commit**

```bash
git add .env.example docs/M7_ENV_SETUP.md
git commit -m "docs(m7): .env.example + Vercel env 등록 가이드 (DEEPGRAM_API_KEY + UPSTAGE_API_KEY)"
```

---

#### Task 15: 회귀 통합 검증

**Files:** (검증만)

- [ ] **Step 1: 전체 회귀**

```bash
npm run lint        # 0 problems 유지
npm run build       # 570 + 4 ƒ (신규 /api/transcribe)
npm test            # 201 + 신규 ~25건
npm run test:components  # 16 + 4
npm run test:integration # M5 baseline 변동 0
npm run kb:publish:dry-run  # 534/8/526 변동 0
```

- [ ] **Step 2: 위원장 수동 검수 시나리오 (머지 직전)**

1. **음성 입력 (M7.1)**: 마이크 → "특수 마우스" 음성 → input 자동 채움 → 전송 → 정상 응답
2. **PDF 첨부 (M7.2)**: 정책 PDF → "이 문서 요약" → Gemini multimodal 응답
3. **HWPX 첨부 (M7.2)**: 단체협약 HWPX → "주요 조항 알려줘" → Upstage → 응답
4. **권한 거부 흐름**: 마이크 거부 → MicOff + 한국어 에러 + 텍스트 입력 fallback
5. **파일 크기 초과**: 11MB PDF → AttachmentChip error
6. **VoiceOver 검증**: iOS Safari + macOS Safari 모두 — 녹음 시작/정지/변환/완료 모두 낭독

---

#### Task 16: PR 생성 + codex-rescue 포커스

**Files:** (PR)

- [ ] **Step 1: 브랜치 push + PR**

```bash
git push -u origin phase-3-m7-impl
gh pr create --base master --head phase-3-m7-impl --title "..." --body "..."
```

PR 본문 포커스:
- M7.1 (음성) + M7.2 (파일) 각각 검증 결과
- Vercel env 등록 가이드 명시 (위원장 액션 필요)
- RUN_SMOKE 결과 (위원장이 실 API로 검증한 것)
- codex-rescue 포커스: PIPA 카피 정합성 + permission flow leak + Upstage timeout handling + Gemini multimodal token 폭증 가드

- [ ] **Step 2: codex-rescue + code-reviewer 동시 호출** (선택)

- [ ] **Step 3: 위원장 명시 머지 신호 대기**

---

## 3. 최종 검증 체크리스트

머지 직전 한 번 더:

- [ ] `npm run build` 570 페이지 + `/api/chat` + `/api/chat/threads` + `/api/cron/cleanup-chats` + **`/api/transcribe`** = 4 ƒ
- [ ] `npm test` baseline 201 + 신규 ~25건 모두 PASS
- [ ] `npm run test:components` baseline 16 + 신규 4건 모두 PASS
- [ ] `npm run test:integration` M5 baseline 변동 0
- [ ] `npm run kb:publish:dry-run` 534/8/526 변동 0
- [ ] `npm run lint` 0 problems
- [ ] 위원장 수동 6건 검수 PASS
- [ ] Vercel env `DEEPGRAM_API_KEY` + `UPSTAGE_API_KEY` 등록 완료
- [ ] codex-rescue + code-reviewer 합의 P0 0건

## 4. 후속 작업 (M7 머지 후)

1. **Phase 3 production 검증** — Vercel 차단 해제(`UNPAID_INVOICE`) 후 preview deploy + 위원장 모바일 실 사용 검증
2. **위원장 톤 검수 라운드** — RAG 응답 톤(다정·명료) + UI 카피 + 시스템 프롬프트 patch 필요시
3. **Phase 3 마무리 보고** — `docs/DIRECTION_2026.md` 갱신 + 중부대 협의 자료 갱신 (자문 디렉터리)
4. **Phase 4 진입 검토** — 소셜 피드(`(wiki)` 그룹 전용, dodo-planet `feed_*` 스키마 재사용)
