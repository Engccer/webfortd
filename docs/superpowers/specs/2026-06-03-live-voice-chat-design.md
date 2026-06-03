# 라이브 음성 채팅 설계 (Live Voice Chat)

- **작성일**: 2026-06-03
- **상태**: 설계 승인 (위원장, 2026-06-03) → 구현 plan 작성 대기
- **Phase 지정**: 장기 과제(§CLAUDE.md "실시간 음성 채팅")를 **정식 Phase 7로 승격**. 도입 트리거("RAG 텍스트 채팅 안정화 후") 충족 — Phase 3 RAG + 음성 받아쓰기(PR #73) production 검증 완료.
- **참조**: dodo-planet 라이브 채팅 구현(`useGeminiLive`·`useAudioIO`·`VoiceChatOverlay`·`/api/voice/session`·`/api/voice/execute`), webfortd Phase 3 RAG(`src/lib/rag/retrieval.ts`·`/api/chat`).

## 1. 목적과 배경

시각장애인 위원장 및 장애인교원 사용자에게 **실시간 음성 대화**로 장애인교원 제도·정책을 안내한다. 텍스트 채팅(Phase 3 RAG)·음성 받아쓰기(PR #73, one-shot STT)에 이어, 끊김 없는 양방향 음성 대화를 추가해 시각장애인 핵심 접근성을 끌어올린다.

**채팅 역할은 불변**(CLAUDE.md §앱 정체성): "대한민국 장애인교원 제도·정책 안내", 다정·명료한 톤, 쉬운 설명 + 정확한 출처 인용. 라이브 음성 채팅도 이 단일 기준점을 그대로 따른다. 단지 입출력 modality가 음성일 뿐이다.

## 2. 확정 결정 (위원장 브레인스토밍, 2026-06-03)

| 축 | 결정 | 근거 |
|----|------|------|
| 프로바이더 | **Gemini Live API** (`@google/genai`) | dodo 검증 패턴 재사용, webfortd Gemini 생태계 일관, native audio 양방향 |
| RAG 근거 | **function-calling 도구 `search_policy`** | webfortd "쉬운 설명 + 출처 인용" 원칙 정합, 기존 `retrieveChunks` 0줄 재사용 |
| 접근 권한 | **로그인 필수** | Live native audio 분당 비용 큼, 남용 통제, (wiki) 그룹 게이트 UX 일관 |
| MVP 범위 | **음성 전용** (카메라/영상 제외) | 정책 안내에 카메라 불필요, YAGNI, 복잡도·비용·PII 회피 |
| 구현 전략 | **dodo 직접 이식 + 슬림화** | 에코 transient·바지인·GoAway 엣지케이스 픽스 보존, 불필요 코드 제거 |
| 언어 | **한국어 고정** (ko-KR) | webfortd는 단일 언어, dodo의 4로케일 분기 제거 |

## 3. 아키텍처 (데이터 흐름)

```
[브라우저]                          [Next.js 서버]              [Google]
ChatUI "음성으로 대화" 버튼
  └ warmupAudio (사용자 제스처 내 AudioContext 선초기화 — iOS/Chrome 필수)
  └ VoiceChatOverlay 열기
       └ useGeminiLive.connect()
            │ 1) POST /api/voice/session ───► Supabase 세션 검증 (비로그인 401)
            │                                  시스템 프롬프트 조립 (음성 모드)
            │                                  search_policy 도구 선언
            │                                  ai.authTokens.create() (직접 Gemini 키)
            │ ◄── { token, model, voiceConfig }
            │ 2) @google/genai live.connect(token) ──────────────────► Gemini Live
            │ 3) 마이크 PCM 스트림 ───────────────────────────────────►
            │ ◄─────────────────────── 오디오 청크 + transcript + functionCall
            │ 4) functionCall: search_policy({ query })
            │    └ POST /api/voice/execute ─► retrieveChunks (기존 RAG)
            │    └ functionResponse(청크 + source slug) ──────────────►
            │ ◄─────────────────────── 근거 기반 음성 응답 (출처 구두 언급)
            └ useAudioIO: AudioContext 스케줄 재생 + 바지인 감지
```

**핵심 불변식**:
- 클라이언트는 raw Gemini 키를 절대 보지 않는다 — ephemeral 토큰만 받는다.
- RAG 검색은 항상 서버(`/api/voice/execute`)를 거쳐 published-only 게이트(0009 화이트리스트)를 통과한다. admin Draft Mode 분기는 텍스트 채팅과 동일 규칙.
- Live는 AI Gateway를 경유하지 않는다 — `GOOGLE_GENERATIVE_AI_API_KEY` 직접 경로(임베딩과 동일 키).

## 4. 컴포넌트 명세

### 4.1 서버 — `src/app/api/voice/session/route.ts`

- **책임**: 인증 검증 → 시스템 프롬프트 조립 → 도구 선언 → ephemeral 토큰 발급.
- **인터페이스**: `POST { resumeHandle?: string }` → `{ token: string, model: string, voiceConfig: { voice, locale } }`. 비로그인 401.
- **의존**: `getServerClient`(Supabase 세션), `@google/genai`(`GoogleGenAI.authTokens.create`), `GOOGLE_GENERATIVE_AI_API_KEY`.
- **토큰 config**: `model='gemini-3.1-flash-live-preview'`, `responseModalities=[AUDIO]`, ko-KR voice, `systemInstruction`(음성 모드 프롬프트), `tools=[{ functionDeclarations: [search_policy] }]`, `inputAudioTranscription`/`outputAudioTranscription={}`, VAD 튜닝(`silenceDurationMs≈300`), `sessionResumption`, `contextWindowCompression`.
- **음성 모드 프롬프트 차이**(텍스트 대비): 마크다운/리스트/긴 포맷 금지, 자연스러운 구어, **도구 호출 전 짧은 ack 발화**("잠시만요, 찾아볼게요"), 1초 이상 무음 금지, 출처는 구두로 자연스럽게 언급.

### 4.2 서버 — `src/app/api/voice/execute/route.ts`

- **책임**: `search_policy` 도구 호출만 처리하는 얇은 프록시.
- **인터페이스**: `POST { name: "search_policy", args: { query: string } }` → `{ chunks: [...], sources: [{ slug, title }] }`. 비로그인 401, 알 수 없는 도구 400.
- **의존**: 기존 `src/lib/rag/retrieval.ts` `retrieveChunks(topK=5)` 그대로. **새 RAG 로직 없음**. published-only + admin draftMode 분기(`getPreviewActive`)는 `/api/chat`과 동일.
- **PIPA**: query 본문 미로그, 토큰/카운트만.

### 4.3 클라이언트 — `src/hooks/useGeminiLive.ts` (dodo 이식 + 슬림화)

- **책임**: Live 세션 수명주기 + 상태머신 + transcript + 함수 프록시 + 재연결.
- **인터페이스**: 옵션(입력) `{ onSourceRefs?: (sources) => void }` — dodo `onFunctionResult` 자리를 대체. 반환 `{ state, warmupAudio, connect, disconnect, toggleMute, isMuted, transcripts, functionStatus, errorMessage }`.
- **보존**(dodo 검증 자산): 상태머신(idle→connecting→connected→listening→speaking→processing→reconnecting→error), 바지인 감지(연속 N프레임 피크 — 에코 transient 자가승인 방지), GoAway 재연결 + session resumption, mute, transcript 3초 윈도우 누적, disposed race 가드.
- **제거**: 카메라/`sendVideoFrame`, `profile_builder` 모드, travel 함수, 다로케일, `sendClientText`(빌더 전용).
- **변경**: `onFunctionResult` → `search_policy` 결과에서 source slug 추출 → 부모로 전달(출처 표시).

### 4.4 클라이언트 — `src/hooks/useAudioIO.ts` (dodo 이식 거의 그대로)

- **책임**: 마이크 캡처(PCM) + AudioContext 재생 스케줄링.
- **인터페이스**: dodo와 동일. webfortd 특이사항 없음 → 최소 수정.

### 4.5 UI — `src/components/chat/VoiceChatOverlay.tsx` (이식 + 카메라 제거)

- **책임**: 풀스크린 음성 대화 UI.
- **구성**: 상태 표시(연결/듣는 중/말하는 중) + transcript 영역(사용자/모델) + 출처 카드(`KbSourceFooter` 패턴 재사용 검토) + mute 토글 + 종료 버튼.
- **접근성(협상 불가, WCAG 2.1 AA)**: `aria-live="polite"` 상태/transcript 알림, 키보드 전체 조작(Space=mute, Esc=종료, modifier 가드), 포커스 트랩, 44×44px 터치 타깃, 마이크 권한 거부 시 명료한 안내, 이모지 금지(lucide 아이콘 `aria-hidden`).

### 4.6 진입점 — `src/components/chat/ChatUI.tsx`

- "음성으로 대화" 버튼 추가(lucide 아이콘 + 텍스트 라벨). 클릭(사용자 제스처) 체인에서 `warmupAudio` 호출 후 오버레이 오픈.

## 5. 인프라 / 의존성

- **패키지 추가**: `@google/genai`(dodo 버전 정렬). `ai`+`@ai-sdk/google`은 Live 실시간 미노출 → Live 전용으로 `@google/genai` 필요.
- **모델**: `gemini-3.1-flash-live-preview`.
- **env**: `GOOGLE_GENERATIVE_AI_API_KEY` — 로컬 이미 존재(임베딩용). **production 등록 필요**(engccer Hobby + KHUDT, Deepgram PR #73 절차 재사용). Live는 AI Gateway 미경유.
- **runtime**: `/api/voice/{session,execute}` nodejs(service_role + retrieval RPC, Edge 비호환). `maxDuration` 적정값.

## 6. 출처 인용 처리

`search_policy` functionResponse에 source slug + title 동봉 → `useGeminiLive`의 `onFunctionResult`가 수집 → 오버레이 transcript 하단 출처 카드 표시(텍스트 채팅 `KbSourceFooter`/`sourceRefs` 패턴 정합). 모델은 시스템 프롬프트 지시에 따라 구두로도 출처를 자연스럽게 언급. 접근성: 출처 링크는 키보드 포커스 가능 + 스크린리더 라벨.

## 7. 테스트 전략

webfortd 테스트 분리 정책 준수:
- **node:test/vitest 단위**: 시스템 프롬프트 조립, `search_policy` 도구 선언, blob↔base64, 바지인 판정 로직(순수 함수). 세션 라우트 인증 게이트(비로그인 401), execute 라우트 도구 화이트리스트(알 수 없는 도구 400).
- **Playwright + axe E2E**: 오버레이 키보드 조작·`aria-live`·포커스 트랩(JSDOM 부정확하므로 실 브라우저).
- **수동 smoke**: Live WebSocket 실연결은 위원장 실 마이크 검증(PR #73 종결 패턴 — production 키 로드 + 실제 발화 + RAG 인용 확인).

## 8. 회귀 가드 / 비기능 요구

- Live 실패 시 graceful degradation: 토큰 발급 실패·권한 거부·GoAway 시 명료한 한국어 안내, 텍스트 채팅으로 안내 fallback.
- 비용 통제 1차 = 로그인 게이트. 남용 관측 시 세션 cap 추가(현 단계 미적용 — YAGNI).
- 정적 렌더 불변식: 신규 라우트는 모두 동적(ƒ), 기존 정적 페이지 카운트 회귀 0.

## 9. 마일스톤 분해 (구현 plan에서 상세화)

| M | 범위 | 비고 |
|---|------|------|
| M1 | `@google/genai` 추가 + `/api/voice/session`(토큰 발급, 인증, 프롬프트, 도구 선언) + 단위 테스트 | 서버 토대 |
| M2 | `/api/voice/execute`(search_policy → retrieveChunks 재사용) + 단위 테스트 | RAG 연동 |
| M3 | `useAudioIO` + `useGeminiLive` 이식·슬림화 + 순수 로직 단위 테스트 | 클라이언트 코어 |
| M4 | `VoiceChatOverlay` + `ChatUI` 진입점 + 접근성 + axe E2E | UI·a11y |
| M5 | production env 등록 + 위원장 실 마이크 smoke + codex-rescue 마일스톤 리뷰 | 검증·배포 |

## 10. CLAUDE.md 정합 (위원장 영역)

- 장기 과제 §"실시간 음성 채팅"을 **정식 Phase 7로 승격**. 구현 완료 시 CLAUDE.md Phase 표·장기 과제 표 갱신(위원장 명시 결정 항목).
- 영구 원칙 정합: 채팅 역할·톤(§앱 정체성), 접근성 협상 불가, 메뉴 라벨 이모지 금지, DB write=service_role만(RAG read-only) 모두 준수.

## 11. 실행 모드 검토 (plan 단계 결정)

풀스택 마일스톤(서버 라우트 + 클라이언트 훅 + 오디오 IO + UI + RAG 연동)이라 글로벌 CLAUDE.md상 Agent Teams "우선 검토" 대상. 단 M1~M5가 **순차 의존**(토큰→RAG→훅→UI→검증)이고 `ChatUI`·`useGeminiLive` 공유 파일 편집이 있어 file lock 직렬화 위험 → Phase B 로드맵과 동일하게 **단일 에이전트 + 서브에이전트 분산 + 마일스톤 단위 codex-rescue**가 유력. writing-plans 단계에서 최종 확정.
