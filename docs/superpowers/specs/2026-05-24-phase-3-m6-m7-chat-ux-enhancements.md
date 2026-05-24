# Phase 3 M6 + M7 — 채팅 UX 강화 (dodo-planet 자산 이식 + 파일 첨부 + 음성 받아쓰기)

> **상태**: spec draft (위원장 결정 Q1~Q4 + D1~D11 잠금). 머지 후 M6 plan → M6 impl → 머지 → M7 plan → M7 impl → 머지 순서.
> **선행 머지**: PR #35 (`9510ba5`, 위키 브랜드명 정책 정합).
> **선행 마일스톤**: Phase 3 M3 (Route Handler + AI Gateway OIDC + 시스템 프롬프트 영구 원칙, PR #27+#28), Phase 3 M5 (DB 채팅 히스토리 + ThreadDrawer + Vercel cron, PR #34).

## §0 컨텍스트

Phase 3 M3~M5 머지로 RAG 채팅 기본 인프라(Route Handler · 시스템 프롬프트 · ThreadDrawer · DB 히스토리)는 완성. 이번 M6+M7은 **일상 사용성 + 접근성 + 정책 질의 복잡도**를 끌어올리는 보완 라운드.

### 자산 출처

| 자산 | 위치 | 가져올 패턴 |
|---|---|---|
| `useChat.ts` (4시간 세션 타임아웃) | `~/Mac-Projects/dodo-planet/src/hooks/useChat.ts:122-145` | `SESSION_TIMEOUT_MS = 4*60*60*1000` 감지 → 자동 새 thread |
| `useChat.ts` (lastFailedMessage retry) | 위 파일 :50-56, :407-413 | `FailedMessage` state + `retryLastMessage()` callback |
| `MessageBubble.tsx` (CopyButton dual mode) | `~/Mac-Projects/dodo-planet/src/components/chat/MessageBubble.tsx:64-100` | markdown/plain 듀얼 + `markdownToPlainText` util + aria-live 안내 |
| `useVoiceRecorder.ts` + `VoiceRecordButton.tsx` + `useMicrophonePermission.ts` + `MicrophonePermissionPrompt.tsx` + `useSound.ts` | `~/Mac-Projects/dodo-planet/src/hooks/` + `src/components/chat/` | 마이크 권한 흐름 + 녹음 사운드 피드백 + aria-live 안내 (one-shot 패턴) |
| `/api/speech-to-text/route.ts` | `~/Mac-Projects/dodo-planet/src/app/api/speech-to-text/route.ts` | Deepgram Nova-2 서버 프록시 (FormData → DeepgramResponse → `{text, language_code, confidence}`) |
| `SuggestionList.tsx` + `getSuggestions(tripPhase)` | `~/Mac-Projects/dodo-planet/src/components/chat/SuggestionList.tsx` + ChatInterface 조건부 분기 | 사용자 상태별 동적 추천 패턴 (webfortd는 thread 상태로 변형) |

### webfortd 컨텍스트 정합

- **앱 정체성**: "장애인교원 교육전념 여건 지원 사업 자산" — 채팅은 *정책·제도 안내*. 7개 기능 모두 그 정체성 강화 방향.
- **사용자**: 장애인교원·예비교사·학부모·정책 입안자 다층. 시각장애인 우선.
- **금기**: dodo-planet의 가족 여행 + Function Calling + 멀티모달 PWA 컨텍스트는 그대로 가져오지 않음. 음성·이미지·피드 공유 등 §장기 과제는 별도.

## §1 결정 잠금

### Q1 — 파일 형식 우선순위: **C안 (PDF + HWPX + HWP + 이미지)** ✓

| 형식 | 처리 경로 | 근거 |
|---|---|---|
| PDF | Gemini Flash native multimodal (직접 전달) | Gemini 3.5 Flash가 PDF 페이지 단위 OCR + 표 인식 지원. 추출 코드 0 |
| HWPX | Upstage Document Parse API → 텍스트 추출 | XML 직접 파싱은 표·이미지·다단 레이아웃에서 손실. Upstage가 한국어 정책 문서 표 재현 우위 |
| HWP | Upstage Document Parse API → 텍스트 추출 | Vercel serverless에서 한컴 자동화 불가. Upstage가 HWP 직접 지원 |
| 이미지 (png/jpg/webp/heic) | Gemini Flash native multimodal | 정책 스크린샷·공문 사진·표 캡쳐 등 실무 흔함 |

### Q2 — 파일 저장 정책: **a안 (임시 메모리, turn 1회 사용 후 폐기)** ✓

- 첨부 파일은 클라이언트 → Vercel Function body (multipart/form-data 또는 base64) → Gemini/Upstage 호출 → 즉시 폐기
- DB 저장 X (chat_messages에 attachments 컬럼 추가 안 함). 같은 파일 재질의는 사용자가 재첨부 필요
- PIPA·비용·복잡도 최소화. 시범 단계 부담 적음
- **장기 carry**: 사용 패턴 누적 후 Vercel Blob 영구 저장 검토 (chat_messages 스키마 마이그레이션 별도)

### Q3 — 음성 받아쓰기 패턴: **Y안 (dodo-planet Deepgram Nova-2 패턴 그대로)** ✓

- 모델: `nova-2`, language: `ko-KR` 강제, smart_format: true
- 동작: one-shot 녹음 (마이크 버튼 클릭 → 녹음 → 멈춤 버튼/타임아웃 → STT → 텍스트 input에 채움)
- 권한: `useMicrophonePermission` 훅 그대로 + `MicrophonePermissionPrompt` 모달 그대로
- 접근성: `aria-live="polite"` announcer + 사운드 피드백(`useSound` 훅 채택)
- 서버 프록시: `/api/transcribe` Route Handler. API 키는 `DEEPGRAM_API_KEY` 서버 env, 클라이언트 노출 X

### Q4 — 마일스톤 분리: **II안 (M6 UI 5 → M7 인프라 2)** ✓

- **M6 (UI 개선, 클라이언트 단독, 3-4일)**: 답변 복사 / 에러 재시도 / 자동 스크롤 / 세션 타임아웃 / 동적 SUGGESTIONS
- **M7 (서버 인프라, 4-6일)**: 파일 첨부 (PDF·HWPX·HWP·이미지) + 음성 받아쓰기 (Deepgram)
- spec은 통합 (이 문서), plan/impl은 마일스톤별 분리

### D1 — HWP/HWPX 처리 위임

- **Upstage Document Parse API** (`https://api.upstage.ai/v1/document-digitization`) 사용. 위원장 보유 키 `UPSTAGE_API_KEY` 재사용
- 응답에서 markdown 본문만 추출 → Gemini system prompt 추가 컨텍스트로 전달
- 실패 시 사용자 안내: "정책 문서 파싱 중 오류가 발생했어요. 다른 형식(PDF)으로 다시 시도해 보세요"

### D2 — PDF·이미지 처리 경로

- Gemini Flash multimodal 입력은 `messages[].parts`에 `{ type: 'file', mediaType, data }` 또는 `{ type: 'image', image }` 형태로 첨부
- Vercel AI SDK v6 `convertToModelMessages`가 `FilePart` / `ImagePart` 변환 처리
- system prompt에는 "사용자가 첨부한 문서를 컨텍스트로 활용해 답변하세요" 한 줄 추가
- RAG 검색 결과(top-k=5)는 그대로 유지 — 첨부 파일은 *추가* 컨텍스트, 대체 X

### D3 — 파일 크기 / 개수 한계

- 파일당 최대 **10MB** (Vercel Pro plan body limit 100MB 내, 메모리 부담 회피)
- 동시 첨부 **1개** (단순화. 여러 문서 비교는 user thread 누적으로 우회)
- 클라이언트 사전 검증: 크기·MIME type 화이트리스트 (`application/pdf`, `application/vnd.hancom.hwp`, `application/vnd.hancom.hwpx`, `image/png|jpeg|webp|heic`)

### D4 — Deepgram 옵션 / 비용 가드

- 녹음 형식: WebM Opus (브라우저 MediaRecorder 기본)
- 최대 녹음 길이 **120초** (한 질의 평균 30초, 우산 마진)
- 비용 가드: Deepgram Nova-2 기준 분당 약 .0043 — 시범 단계 월 100건 가정 시 1달러 미만
- 실패 시: 한국어 토스트 + 텍스트 입력으로 fallback 안내

### D5 — 세션 타임아웃 정책

- **4시간** (dodo-planet 기본값). 마지막 메시지 timestamp 기준
- 4시간 초과 후 사용자가 신규 질의 → 새 thread 자동 생성 (이전 thread는 ThreadDrawer에 그대로 유지)
- 위원장 검토 후 조정 carry (예: 정책 안내 컨텍스트는 더 길게 유지하고 싶을 수 있음 → 8/12/24시간)

### D6 — 동적 SUGGESTIONS 후보 분기

| 상태 | 추천 질문 |
|---|---|
| 비로그인 + 신규 thread | 현재 3개 유지 + "로그인하면 대화가 저장돼요" 안내 |
| 로그인 + 신규 thread | "최근 살펴본 정책에 대해 더 묻기" / "비슷한 사례 더 보기" 류 (실제 RAG 결과는 무관, 사용자 진입 유도) |
| 로그인 + 기존 thread 재진입 | 이전 마지막 assistant 답변의 axis(예: policies)에서 인접 슬러그 후보 (M7 plan에서 구체화) |

### D7 — 자동 스크롤 정책

- 기본: 새 메시지마다 `messagesEndRef.scrollIntoView({ behavior: 'smooth' })`
- 사용자 위로 스크롤 감지: `IntersectionObserver`로 messagesEndRef 가시성 추적. 가시성 손실 시 자동 스크롤 *일시 정지*
- 일시 정지 중 새 응답 들어오면 우하단 floating "↓ 새 응답" 버튼 (44px, aria-label="최신 응답으로 이동")
- VoiceOver는 `aria-live` 그대로 (스크롤과 무관하게 음성 안내)

### D8 — 답변 복사 동작

- assistant 메시지 hover 또는 focus 시 우상단 Copy 아이콘 노출 (모바일은 항상 노출, 44px)
- 클릭 시 작은 popover/modal — "마크다운으로 복사" / "평문으로 복사" 2개 버튼
- `navigator.clipboard.writeText()` 호출 후 aria-live `"복사되었어요"` 안내 + 아이콘 1.5초간 Check 변경
- `markdownToPlainText` util은 webfortd `src/lib/utils/` 신규 또는 기존 `src/lib/utils.ts`에 추가

### D9 — 에러 재시도 동작

- streamText 실패(Gateway 5xx, retrieval 0건, validateUIMessages 실패 등) 시 `lastFailedMessage` state 저장
- 에러 메시지 옆에 "다시 시도" 버튼 (44px, aria-label="마지막 질문 다시 보내기")
- 클릭 시 동일 messages + threadId로 재전송. retry count 한도 X (사용자 판단)
- 한국어 에러 텍스트 분기:
  - retrieval 0건: "관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요"
  - Gateway 5xx: "응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요"
  - validateUIMessages: "메시지 형식 오류가 발생했어요"

### D10 — 음성 받아쓰기 UX 흐름

```
[마이크 버튼] (PromptInput 우측, Submit 옆)
  ↓ 클릭
  ↓ 권한 미부여: MicrophonePermissionPrompt 모달 → 권한 요청
  ↓ 권한 부여 후
[녹음 시작 사운드] + 버튼 상태 → 빨간색 [정지] + "녹음 중..." aria-live
  ↓ 사용자가 [정지] 클릭 또는 120초 자동 종료
[녹음 정지 사운드] + 버튼 상태 → "변환 중..." aria-live + Spinner
  ↓ /api/transcribe POST (FormData with audio blob)
  ↓ Deepgram Nova-2 호출
  ↓ {text, confidence} 응답
[텍스트 input에 자동 채움] + 버튼 원복 + 입력 포커스
  ↓ 사용자가 수정/전송
```

### D11 — 파일 첨부 UX 흐름

```
[클립 아이콘] (PromptInput 좌측)
  ↓ 클릭
[파일 선택 다이얼로그] (accept: PDF, HWPX, HWP, image/*)
  ↓ 파일 선택
[클라이언트 검증] 크기 ≤10MB, MIME 화이트리스트
  ↓ 통과
[썸네일 카드] PromptInput 상단 (파일명·크기·X 제거 버튼)
  ↓ 사용자가 텍스트 입력 + 전송
[Vercel Function POST] FormData (audio/file + messages + threadId)
  ↓ 라우터 처리
  ├─ PDF/이미지: Gemini messages.parts에 FilePart/ImagePart 추가
  └─ HWP/HWPX: Upstage Document Parse → markdown 추출 → system prompt 추가
[Gemini streamText 호출]
  ↓
[응답 + sourceRefs] (RAG 검색 결과 + 첨부 컨텍스트 통합)
```

## §2 M6 — UI 개선 5건 (클라이언트 단독)

### M6.1 답변 복사 (마크다운/평문 듀얼) 🎯 핵심

**파일**:
- `src/components/chat/CopyButton.tsx` (신규) — Popover/Modal + 듀얼 버튼 + aria-live announcer
- `src/lib/utils/markdown.ts` (신규) — `markdownToPlainText(md: string): string` (정규식 기반: heading `#` 제거, list marker 제거, link `[text](url)` → `text (url)`, bold/italic 제거)
- `src/components/chat/ChatUI.tsx` (수정) — assistant `<MessageContent>` 우상단에 `<CopyButton content={...}>` 삽입

**테스트**:
- `tests/lib/markdown.test.ts` — `markdownToPlainText` 경계 케이스 (heading, list, link, table, code block)
- `tests/components/chat/copy-button.test.tsx` (Vitest) — clipboard mock + aria-live announcer 동작

### M6.2 에러 재시도 🎯 핵심

**파일**:
- `src/components/chat/ChatUI.tsx` (수정) — `useChat` `onError` 핸들러에서 lastFailedMessage state 저장 + 에러 영역에 "다시 시도" 버튼 + `retryLastMessage()` callback
- `src/components/chat/ErrorBanner.tsx` (신규) — 한국어 분기 메시지 + retry 버튼 + role="alert"

**테스트**:
- `tests/components/chat/error-banner.test.tsx` (Vitest) — 분기 메시지·retry 동작·role="alert" 검증

### M6.3 자동 스크롤 🎯 핵심

**파일**:
- `src/components/chat/ChatUI.tsx` (수정) — `messagesEndRef` + `useEffect` 스크롤 + `IntersectionObserver`로 사용자 위로 스크롤 감지 + floating "↓ 새 응답" 버튼

**테스트**: e2e 영역 (자동 테스트는 신뢰도 낮음 — JSDOM IntersectionObserver mock 한계). 위원장 수동 검수 + Chrome MCP 검증

### M6.4 세션 타임아웃 (4시간 자동 분리)

**파일**:
- `src/app/api/chat/threads/route.ts` (수정) — thread 응답에 `last_message_at` 컬럼 추가
- `src/components/chat/ChatUI.tsx` (수정) — initialThreadId 로드 시 last_message_at 확인. 4시간 초과면 신규 thread로 분기. ThreadDrawer는 이전 thread 그대로 표시
- 신규 thread 자동 전환 시 aria-live "새 대화를 시작해요" 안내

**테스트**:
- `tests/components/chat/session-timeout.test.tsx` (Vitest) — fake timer로 4시간 경계 검증

### M6.5 동적 SUGGESTIONS

**파일**:
- `src/lib/chat/suggestions.ts` (신규) — `getSuggestions({ isAuthenticated, threadId, lastAssistantAxis }): string[]`
- `src/components/chat/ChatUI.tsx` (수정) — SUGGESTIONS 상수 → useMemo로 동적 계산

**테스트**:
- `tests/lib/chat/suggestions.test.ts` — 분기 매트릭스 (4 케이스)

### M6 통합

- 마지막 task에 `superpowers:code-reviewer` 1회 + `codex:codex-rescue` 1회 동시 호출 (Phase 3 M3 패턴)
- Vitest 부분 도입 첫 적용 — `tests/components/chat/**/*.test.tsx` (이미 M5에서 source-card.test.tsx로 진입). 회귀 격리
- 검증 baseline: `next build` 568 페이지 유지, `npm test` unit + `npm run test:integration` 그린

## §3 M7 — 서버 인프라 2건 (파일 첨부 + 음성 받아쓰기)

### M7.1 음성 받아쓰기 (Deepgram Nova-2) 🎯 접근성 필수

**파일**:
- `src/app/api/transcribe/route.ts` (신규) — Deepgram 프록시. dodo-planet `speech-to-text/route.ts` 거의 그대로 복사 + `import 'server-only'` + 한국어 에러
- `src/hooks/useVoiceRecorder.ts` (신규) — dodo-planet 그대로 (MediaRecorder + 120초 자동 종료 + chunks 합성)
- `src/hooks/useMicrophonePermission.ts` (신규) — dodo-planet 그대로
- `src/hooks/useSound.ts` (신규) — dodo-planet 그대로 (옵션 — 사용자 선호에 따라 음 소거 가능)
- `src/components/chat/VoiceRecordButton.tsx` (신규) — dodo-planet 그대로 + 한국어 카피
- `src/components/chat/MicrophonePermissionPrompt.tsx` (신규) — dodo-planet 그대로 + 한국어 카피
- `src/components/chat/ChatUI.tsx` (수정) — PromptInput 우측에 `<VoiceRecordButton onTranscribed={(text) => setInput(input + text)}>` 추가
- `.env.local` + Vercel env: `DEEPGRAM_API_KEY` (위원장 발급)

**테스트**:
- `tests/api/transcribe.test.ts` — Deepgram API mock + 한국어 에러 분기 + 파일 크기 검증
- `tests/components/chat/voice-record-button.test.tsx` (Vitest) — 권한 흐름·녹음 상태 전환·aria-live announcer (단, MediaRecorder mock 한계 — 통합은 E2E 수동)

### M7.2 파일 첨부 (PDF + HWPX + HWP + 이미지) 🎯 정책 질의 강화

**파일**:
- `src/components/chat/AttachmentButton.tsx` (신규) — 클립 아이콘 + 파일 선택 다이얼로그 + 클라이언트 검증 (크기·MIME)
- `src/components/chat/AttachmentChip.tsx` (신규) — PromptInput 상단 썸네일 카드 + X 제거
- `src/app/api/chat/route.ts` (수정) — multipart/form-data 받기 + 파일 타입 분기:
  - PDF/이미지: AI SDK v6 `messages.parts`에 FilePart/ImagePart 추가
  - HWP/HWPX: Upstage Document Parse 호출 → markdown → system prompt에 컨텍스트 첨부
- `src/lib/chat/upstage-parse.ts` (신규) — Upstage Document Parse 클라이언트 래퍼 + 실패 시 한국어 에러
- `src/lib/chat/file-validation.ts` (신규) — MIME 화이트리스트 + 크기 검증 + 보안 sanity (PDF magic bytes 등)
- `src/components/chat/ChatUI.tsx` (수정) — useChat sendMessage에 attachment 전달 (DefaultChatTransport `prepareSendMessagesRequest`로 FormData 빌드)
- `.env.local`은 이미 `UPSTAGE_API_KEY` 보유, Vercel env에 추가 등록 (없으면)

**Gemini multimodal 부분 (D2 정합)**:
```typescript
// 의사 코드 — plan에서 구체화
const messages = await convertToModelMessages([
  ...history,
  {
    role: 'user',
    content: [
      { type: 'text', text: userText },
      ...(attachment?.type === 'pdf' ? [{ type: 'file', mediaType: 'application/pdf', data: attachment.bytes }] : []),
      ...(attachment?.type === 'image' ? [{ type: 'image', image: attachment.bytes }] : []),
    ],
  },
])
const result = streamText({ model: gateway('google/gemini-3.5-flash'), system, messages, ... })
```

**테스트**:
- `tests/api/chat-attachment.test.ts` — 4종 파일 타입 분기 검증 (mock Upstage·Gemini)
- `tests/lib/chat/file-validation.test.ts` — MIME·크기·magic bytes 검증
- `tests/lib/chat/upstage-parse.test.ts` — Upstage response 파싱 + 한국어 에러

### M7 통합

- 마지막 task에 `superpowers:code-reviewer` + `codex:codex-rescue` 동시 호출
- Vercel env 등록 (위원장 명시 후): `DEEPGRAM_API_KEY` (신규), `UPSTAGE_API_KEY` (이미 보유, Vercel에 추가)
- 실 API 호출 RUN_SMOKE 테스트: `tests/api/transcribe.smoke.test.ts` + `tests/api/chat-attachment.smoke.test.ts` (Deepgram·Upstage 실 API + 각 100ms 응답 mock 데이터)
- 검증 baseline: `next build` 569+ 페이지 (라우트 2개 추가), 모든 회귀 그린

## §4 접근성 spec

### M6 + M7 공통

- **터치 타깃**: 모든 버튼 최소 44×44px (위원장 §접근성 원칙 정합)
- **aria-live**: 복사 안내, 재시도 안내, 자동 스크롤 일시 정지, 녹음 상태, 변환 상태, 첨부 추가/제거 모두 `polite`
- **role 정합**: 에러는 `role="alert"`, 일반 상태 변경은 `role="status"`, 모달은 `role="dialog" aria-modal="true"`
- **키보드**: 마이크 버튼 Enter/Space로 토글, 첨부 버튼 Enter로 다이얼로그, X 제거 버튼 Enter로 삭제
- **VoiceOver 검증**: iOS Safari + macOS Safari 모두. 시각장애인 위원장 직접 검증 → 이슈 발견 시 즉시 수정 (codex-rescue 미루지 않음)
- **모바일**: 헤더·드로어·첨부 칩 모두 가로 스크롤 금지. 세로/가로 회전 모두 동작

### M6.1 Copy 전용

- Copy 아이콘은 데스크탑 hover 노출, 모바일은 항상 노출 (hover 불가)
- popover/modal 키보드 접근: Tab → 마크다운 버튼 → Tab → 평문 버튼 → ESC 닫기
- 복사 성공 시 visible Check 아이콘 (시각 피드백) + aria-live "마크다운으로 복사되었어요" (음성 피드백) 동시

### M7.1 음성 전용

- 녹음 중에는 input 비활성 (`disabled` + aria-disabled). 텍스트 입력 동시 가능하면 흐름 혼란
- 정지 버튼은 같은 위치에 색만 빨강으로 변경 (마우스 위치 이동 없음 — 시각장애인 + 운동장애 사용자 우호)
- 권한 거부 후 재요청 흐름 명확 안내 (브라우저 권한 변경 가이드 카피)

### M7.2 첨부 전용

- 클립 아이콘 옆 "파일 첨부" 텍스트 라벨 (시각 + 음성 양쪽). 아이콘만 단독 X
- 첨부 칩의 X 버튼 aria-label="첨부 제거"
- 파싱 진행 중("문서 분석 중...") aria-live status 안내

## §5 PIPA / 보안

### 파일 첨부

- 임시 처리 (D2). 서버 메모리에서 호출 후 즉시 폐기. 디스크 저장 X
- 로그에 파일 본문·이름·크기 기록 X. 호출 성공/실패만 (token usage 처리와 동일 원칙)
- HWP/HWPX는 Upstage에 외부 전송 → 사용자 동의 UI 필요? → 시범 단계 단순화 위해 첨부 버튼 옆 "파일은 안전한 외부 분석 서비스(Upstage)로 전송되며, 처리 후 즉시 폐기됩니다" 한 줄 안내. 첨부 시 implicit 동의로 간주
- 정책 문서 = 일반적으로 공공 자료라 민감도 낮음. 다만 사용자가 본인 학교 인사 자료를 잘못 첨부할 가능성 — 안내 카피로 환기

### 음성 받아쓰기

- 마이크 권한 명시 요청 (브라우저 표준). MicrophonePermissionPrompt에서 사용 목적 명시 ("질문을 음성으로 입력할 수 있어요")
- 녹음 데이터 = 사용자 음성. Deepgram에 외부 전송 → 첨부와 동일하게 한 줄 안내 ("음성은 안전한 외부 변환 서비스(Deepgram)로 전송되며, 처리 후 즉시 폐기됩니다")
- 서버 메모리에서 transcribe 후 즉시 폐기. 디스크·DB 저장 X
- 로그에 transcribed text 기록 X. 길이·언어·confidence만

### 환경 변수

- `DEEPGRAM_API_KEY` 서버 env (NEXT_PUBLIC_ X)
- `UPSTAGE_API_KEY` 서버 env (NEXT_PUBLIC_ X). 이미 `.env.local`에 보유, Vercel 등록만 추가
- `.env.example`에 두 변수 명시 추가

## §6 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| Upstage Document Parse 응답 지연 (HWP 대용량) | 사용자 대기 시간 ↑ | timeout 30초 설정 + "문서 분석 중..." aria-live + 한국어 에러 fallback |
| Deepgram 한국어 인식률 낮은 사용자 (방언·전문 용어) | 받아쓰기 부정확 | 텍스트 input 즉시 수정 가능 + 재녹음 버튼 + 일반 텍스트 입력 fallback 권유 |
| Gemini multimodal PDF 처리 비용 | 1M token PDF 1건 입력 0.075 (gemini-3.5-flash) | 파일당 10MB 한계 + 사용자당 일 첨부 횟수 제한 carry (Phase 4) |
| MediaRecorder 브라우저 호환성 (iOS Safari 14 이전) | 음성 받아쓰기 미동작 | 권한 요청 전 `typeof MediaRecorder` 체크 + 미지원 시 텍스트 input 안내 |
| `IntersectionObserver` JSDOM 한계 | 자동 스크롤 unit 테스트 불가 | E2E 수동 검증 + Chrome MCP 자동화 |
| 첨부 + RAG 컨텍스트 token 폭증 | 비용·응답 지연 | RAG top-k 5 그대로, 첨부 1개로 제한 (D3). 추가는 Phase 4 carry |
| 음성 녹음 중 사용자 의도치 않은 길이 | 비용·메모리 | 120초 자동 종료 (D4) + 정지 버튼 visible |
| 첨부 파일 악성 (PE/스크립트 위장 PDF) | 서버 RCE | MIME + magic bytes 검증 + Vercel sandbox(serverless V8) 격리. file-validation.ts |
| Deepgram API quota 초과 | STT 일시 중단 | 한국어 에러 + 텍스트 input fallback. Vercel 운영 모니터링 |

## §7 비용 시나리오

### 시범 단계 (월 100건 채팅, 10건 음성·5건 첨부 가정)

| 항목 | 단가 | 월 비용 |
|---|---|---|
| Gemini 3.5 Flash (RAG 응답) | $0.075/M in + $0.30/M out | 약 .50 |
| Deepgram Nova-2 (음성) | $0.0043/분 | 약 .04 (10건 × 평균 30초) |
| Upstage Document Parse | $0.012/page | 약 .60 (5건 × 평균 10페이지) |
| Gemini PDF multimodal | $0.075/M token | 약 .50 (5건 × 평균 10페이지) |
| **합계** | | **약 .64/월** |

### 본격 단계 (월 1000건 채팅, 100건 음성·50건 첨부 가정)

- 약 .40/월 (대부분 RAG 응답 + PDF multimodal)
- Phase 4 본격 확산 시 사용자당 일 한도·캐싱·이미지 압축 도입 검토

## §8 영향 받는 문서

- `webfortd/CLAUDE.md` §개발 방향 — Phase 3 마일스톤 표에 M6+M7 추가 (이 spec 머지와 함께)
- `docs/DIRECTION_2026.md` §4 채팅 — 보완 라운드 명시
- `docs/superpowers/specs/2026-05-23-phase-3-rag-design.md` §6.x — M6+M7 추가 명시 (별도 patch PR 또는 본 spec 머지 시 동시 갱신)
- `docs/superpowers/plans/2026-05-24-phase-3-m6-chat-ui.md` (이 spec 머지 후 작성)
- `docs/superpowers/plans/2026-05-24-phase-3-m7-attachment-voice.md` (M6 머지 후 작성)
- `.env.example` (M7에서 `DEEPGRAM_API_KEY` + `UPSTAGE_API_KEY` 추가)
- `tests/components/setup.ts` (M6에서 Vitest 부분 도입 확장 — 이미 M5에서 진입)

## §9 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-05-24 | 초안 작성. 위원장 결정 Q1=C / Q2=a / Q3=Y / Q4=II + D1~D11 잠금. dodo-planet 자산 출처 + Upstage·Deepgram 처리 경로 명시. |
