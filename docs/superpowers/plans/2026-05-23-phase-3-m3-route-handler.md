# Phase 3 M3 — Route Handler + AI Gateway + 시스템 프롬프트

**작성일**: 2026-05-23
**브랜치 예정**: `phase-3-m3-impl`
**worktree 예정**: `/Users/hunyongkim/Mac-Projects/webfortd-phase-3-m3-impl`
**전제 baseline**: master `c822032` (PR #26 squash, Phase 3 M2 머지 직후)
**상위 spec**: `docs/superpowers/specs/2026-05-23-phase-3-rag-design.md` §M3

---

## §0. 목표

`app/api/chat/route.ts` Route Handler를 만들어, 사용자 질의가 들어오면:

1. M2의 `retrieveChunks()`로 top-k 청크 + source_refs 보강
2. 시스템 프롬프트 + retrieved chunks + history(in-memory) + 사용자 질의 조립
3. Vercel AI Gateway 경유 `google/gemini-3.5-flash`(또는 Task 1 실측 모델 ID) 스트리밍 응답
4. 응답 종료 시 `source_refs`를 UI message stream의 message metadata로 전달

**M3 범위 밖**:
- ChatUI 교체 (M4)
- chat_threads / chat_messages DB 저장 (M5)
- sessionStorage 분기 / Export·Delete (M6)
- Context Caching 적용 (smoke 결과 후 M4 이후 재평가, design §10.3 #3 결정)

---

## §1. 핵심 결정 잠금 (변경 시 plan 갱신)

### D1. AI SDK v6 표준 패턴 강제

M1/M2에서 SDK 버전 정정 라운드가 발생한 경험을 plan 진입 단계에서 차단.

- `convertToModelMessages(messages)` → **`await`** (v6에서 async)
- 응답 반환은 **`result.toUIMessageStreamResponse()`** (NOT `toDataStreamResponse`)
- AI Gateway 라우팅은 `import { gateway } from 'ai'` + `gateway('google/gemini-3.5-flash')` 사용. `createGoogleGenerativeAI({ baseURL: AI_GATEWAY_URL })` 같은 v5 패턴 금지.
- 요청 body 검증은 `validateUIMessages(messages)` 사용.

**검증**: Task 1 entry에서 `node_modules/ai/dist/index.d.ts` grep으로 `gateway`·`validateUIMessages`·`convertToModelMessages`·`toUIMessageStreamResponse` 4개 export 실재 확인. 누락 시 즉시 BLOCKED 보고.

### D2. 모델 ID는 Task 1 실측 정정 필수

M1에서 `gemini-embedding-2` → `gemini-embedding-2-preview`로 정정한 패턴 재발 방지.

- design spec의 `google/gemini-3.5-flash`는 *가설*로 취급.
- Task 1에서 실 호출(저비용 더미 질의)로 200 응답 확인. 실패 시 `google/gemini-2.5-flash`·`google/gemini-2.0-flash` 등 대체 후보 순차 시도 후 plan §1 D2와 §시스템 프롬프트 헤더 갱신.

**Task 1 실측 결과 (2026-05-23)**: `google/gemini-3.5-flash` 직접 provider 호출 200 응답 정상. 응답 텍스트 확인 (재실행 시 응답 텍스트는 비결정적).

### D3. 시스템 프롬프트 단일 기준점

**기준 문서 3종** (변경 시 위원장 명시 결정 필요):

- `webfortd/CLAUDE.md` §앱 정체성과 채팅의 역할 (영구 원칙, 2026-05-23)
- `docs/DIRECTION_2026.md` §4 채팅 — 정체성/톤/사용자/균형
- `docs/superpowers/specs/2026-05-23-phase-3-rag-design.md` §10.3 #1 (2026-05-23 결정)

**채팅 정체성 초안 (시스템 프롬프트 본문)**:

```
당신은 대한민국 장애인교원 관련 제도와 정책을 안내하는 AI입니다.
"장애인교원 교육전념 여건 지원" 사업의 일환으로 운영됩니다.

[역할]
- 장애인교원·예비교사·장애학생 부모·정책 입안자 등 다양한 사용자에게
  관련 제도와 정책을 이해하기 쉽게 안내합니다.

[톤]
- 다정하고 명료한 톤. 격식체와 관공서 어투를 피하고, 평이한 표현을 우선합니다.
- "~예요/이에요", "~해요" 같은 친근한 종결어미를 자연스럽게 사용합니다.
- 그러나 정책의 정확성을 절대로 양보하지 않습니다.

[답변 원칙]
1. 쉬운 글을 기본으로 하되, 정책 핵심 정보와 세부 정보가
   누락되지 않고 정확하게 전달되도록 균형을 맞춥니다.
2. 평이한 설명을 먼저 제시하고, 출처 인용으로 정확성을 보강합니다.
3. 제공된 [참고 자료] 안의 내용을 근거로 답변합니다.
   참고 자료에 없는 사항은 추측하지 말고
   "이 부분은 제공된 자료로 확인할 수 없어요. 소속 교육청에 문의해 보세요"
   와 같이 안내합니다.
4. 장애인교원 관련 제도·정책과 무관한 질문은 정중히 유도합니다.
   예: "이 채팅은 장애인교원 관련 제도와 정책을 안내하고 있어요.
        ○○과 관련된 정책이나 지원 제도라면 안내해 드릴 수 있어요."
5. 답변 말미에 반드시 다음 면책 안내를 포함합니다:
   "본 답변은 참고용입니다. 실제 적용 절차는 소속 교육청·관할 기관에
    확인해 주세요."

[참고 자료]
{retrievedChunksFormatted}
```

`{retrievedChunksFormatted}`는 `[출처 슬러그 / 제목 / axis]`\n청크 본문 형태로 직렬화.

### D4. 인증 분기 — `includeDrafts` 정책

Q2 결정(권장 (a)) 적용:

- **익명·로그인 모두** `includeDrafts: true` (M2 default 유지).
- 근거: 현 baseline 535 docs 중 published 8건, draft 527건이라 published-only는 정보 자산 활용 불가. M5에서 검수 자동화 진척에 따라 분기 도입 검토.
- Route Handler는 인증 상태를 *읽기*는 하지만 `includeDrafts`에는 미반영. 로그 메타로만 기록(M5에서 chat_messages.user_id 저장 시 사용).

### D5. History 슬라이딩 윈도우 = 최근 5턴

Q4 결정 적용:

- Route Handler가 받는 `messages` 배열에서 **최근 5턴(user+assistant 10 messages) + 마지막 user 질의** 슬라이스.
- 시스템 프롬프트는 항상 messages[0] 위치에 prepend.
- 클라이언트(M4)에서 클립 없이 보내도 서버에서 안전하게 절단 — 비용 방어.

### D6. Rate Limit = Vercel AI Gateway 기본만

Q5 결정 적용:

- M3 application-level rate limit 미도입.
- AI Gateway가 provider 측 429를 받으면 그대로 클라이언트로 전달 — UI(M4)에서 한국어 에러 메시지·재시도 버튼.
- per-IP limiter는 시범 단계 트래픽 측정 후 M4 이후 검토.

### D7. Context Caching 미적용 (M3)

Q3 결정 적용:

- `google/gemini-3.5-flash` Context Caching은 최소 32k 토큰 요건. 시스템 프롬프트만으로 미달.
- M3 smoke에서 비용/지연 측정 → M4 이후 평가.

### D8. AI Gateway 인증 — OIDC 단일 경로

Vercel AI SDK v6 표준은 **OIDC(`VERCEL_OIDC_TOKEN`) 기본 인증**이다. 정적 API key 발급/등록은 본 마일스톤에서 채택하지 않는다(자동 회전이라 운영 부담 0).

**채택 경로** (KHUDT Vercel Pro plan):

- **Production / Preview deploy**: webfortd Vercel 프로젝트 Settings → AI Gateway 활성화만 하면 OIDC 토큰 자동 주입.
- **로컬 dev**: `vercel link` 1회 + `vercel env pull .env.local`로 OIDC 토큰 발급(24h short-lived JWT). 만료 시 동일 명령 재실행.
- **CI/비-Vercel 환경**: 본 M3 범위 밖. 도입 시 별도 시크릿 관리 정책 결정.

**근거**: ai-gateway 스킬 가이드 — "vercel env pull provisions a `VERCEL_OIDC_TOKEN` (short-lived JWT, ~24h). No provider-specific keys needed". OIDC는 토큰 자동 회전이라 수동 rotation 비용 0.

**Task 1 도입 사전 확인**:
- webfortd Vercel 프로젝트 Settings에서 AI Gateway 활성화 여부 확인 (위원장 작업, 미활성 시 활성화 요청).
- 로컬 `.env.local`에 기존 `GOOGLE_GENERATIVE_AI_API_KEY`(M1에서 등록) 유지 — Task 1 모델 ID 폴백 검증 시 사용.

### D9. server-only 가드 일관성

M2 패턴 그대로 — 신규 파일 `src/lib/rag/prompt-builder.ts`, Route Handler 본체 모두 `import 'server-only'` 또는 server module 의존성 보유 (Route Handler는 Next.js가 자동 server-side, server-only import는 prompt-builder만).

### D10. 출처 인용 데이터 전송

`source_refs`를 UI Message Stream의 data part로 전송:

```ts
const result = streamText({...})
return result.toUIMessageStreamResponse({
  messageMetadata: ({ part }) => {
    if (part.type === 'finish') {
      return { sourceRefs: sources }  // 클라이언트(M4)에서 message.metadata로 접근
    }
  }
})
```

대안(Task 3 진입 시 SDK 6.x 실측으로 확정): `experimental_attachments`·custom data part. 둘 중 v6 안정 API를 Task 3에서 결정 후 plan §D10 갱신.

---

## §2. 마일스톤 진입 절차 (controller 직접)

1. **본체 worktree 동기화 확인** — `git status` clean / `master c822032` HEAD.
2. **impl worktree 생성**:
   ```bash
   git worktree add -b phase-3-m3-impl ../webfortd-phase-3-m3-impl origin/master
   cd ../webfortd-phase-3-m3-impl && npm ci && npm run sync:content
   ```
3. **baseline 회귀 확인** — `npm test`: 169 unit + 29 integration (master baseline). decompose-source 1 fail 허용(master baseline).
4. **Task 1부터 subagent dispatch** — implementer per task + 2단계 review.

---

## §3. Task 분해

각 Task는 implementer subagent dispatch → spec compliance reviewer → code-quality reviewer 2단계 review. cheap model(1·2·5) vs standard model(3·4·6·7·8·9·10) 분리.

### Part A — 기반 라이브러리 (Tasks 1~3)

#### Task 1 — SDK v6 import 검증 + 모델 ID 실측 확정

**Model**: cheap

**범위**:
- `node_modules/ai/dist/index.d.ts`에서 `gateway`, `streamText`, `convertToModelMessages`, `validateUIMessages`, `toUIMessageStreamResponse` (또는 result 메서드) 5개 export 실재 grep.
- `@ai-sdk/google` v3 패키지가 `google` provider 함수 export하는지 확인.
- **모델 ID 실측 검증 경로**: 본 M3에서는 AI Gateway 인증 미준비(D8 — Task 8에서 활성화). Task 1은 **직접 Google provider** 경로로 모델 ID 존재만 확인:
  ```ts
  import { streamText } from 'ai'
  import { google } from '@ai-sdk/google'
  const result = streamText({
    model: google('gemini-3.5-flash'),
    messages: [{ role: 'user', content: '안녕' }],
    maxTokens: 10,
  })
  for await (const chunk of result.textStream) { /* 토큰 1개 이상 */ }
  ```
- API key: `GOOGLE_GENERATIVE_AI_API_KEY="$GEMINI_API_KEY"` (글로벌 env의 `GEMINI_API_KEY` 사용, M1 패턴).
- 실패 시 (`API key invalid` 외): `gemini-2.5-flash` / `gemini-2.0-flash` / `gemini-1.5-flash` 순차 시도. 최종 ID를 plan §1 D2와 §3 Task 4 헤더에 박음.
- Gateway 라우팅 검증은 **Task 8 production deploy 시 수행** (직접 provider 검증과 Gateway 검증은 분리).

**산출물**: `tests/scripts/m3-sdk-probe.test.ts` (skip 가능, `RUN_PROBE=1`로만 실행, 실 API 호출 비용 ~$0.0001).

**검증**: 실 호출 1회 성공 + plan §D2 갱신 commit.

---

#### Task 2 — `src/lib/rag/prompt-builder.ts` (시스템 프롬프트 + history 슬라이딩)

**Model**: cheap

**신규 파일**: `src/lib/rag/prompt-builder.ts`

**API**:
```ts
import 'server-only'
import type { RetrievedChunk } from './types.ts'
import type { UIMessage } from 'ai'

export const SYSTEM_PROMPT_TEMPLATE: string  // D3 본문, {retrievedChunksFormatted} placeholder

export function formatRetrievedChunks(chunks: RetrievedChunk[]): string
//  [출처: slug / 제목 / axis]\n청크 본문 형태 N개 연결

export function buildSystemPrompt(chunks: RetrievedChunk[]): string
//  SYSTEM_PROMPT_TEMPLATE의 {retrievedChunksFormatted} 치환

export function clampHistory(messages: UIMessage[], maxTurns: number = 5): UIMessage[]
//  최근 maxTurns 턴(user+assistant) + 마지막 user 메시지 slice
//  D5: 기본 5턴 = 최대 11 messages (10 + 마지막 user)
```

**테스트** (`tests/rag/prompt-builder.test.ts`, unit):
1. `formatRetrievedChunks` 출력에 slug·title·axis·chunk_text 모두 포함
2. `formatRetrievedChunks([])` → 빈 문자열 처리 (no chunks fallback 메시지)
3. `buildSystemPrompt` placeholder 치환 정상
4. `buildSystemPrompt` — 정체성 키워드("장애인교원 관련 제도와 정책")·면책 안내 키워드("참고용") 포함 회귀 가드
5. `clampHistory` — 12 messages 입력 시 11개 슬라이스 (5턴 + 1 user)
6. `clampHistory` — 3 messages 입력 시 3 그대로
7. `clampHistory` — 마지막이 assistant이면 마지막 user까지 보존하도록 알고리즘 검증

**검증**: 7 unit tests PASS + 시스템 프롬프트 본문 4종 키워드 회귀 가드.

---

#### Task 3 — Route Handler 본체 `app/api/chat/route.ts`

**Model**: standard

**신규 파일**: `app/api/chat/route.ts`

**구조**:
```ts
import { gateway, streamText, convertToModelMessages, validateUIMessages, type UIMessage } from 'ai'
import { retrieveChunks } from '@/lib/rag/retrieval'
import { buildSystemPrompt, clampHistory } from '@/lib/rag/prompt-builder'

export const runtime = 'nodejs'   // server-only 모듈 사용 (Edge 회피, retrieval RPC + service_role 안전)
export const maxDuration = 60     // streamText는 60초 timeout 충분

interface ChatRequestBody {
  messages: UIMessage[]
}

export async function POST(req: Request) {
  try {
    const body: ChatRequestBody = await req.json()
    const validated = validateUIMessages(body.messages)
    const clamped = clampHistory(validated, 5)

    const lastUserMessage = clamped.findLast((m) => m.role === 'user')
    if (!lastUserMessage) {
      return new Response('마지막 user 메시지를 찾을 수 없습니다', { status: 400 })
    }
    const queryText = extractUserText(lastUserMessage)  // parts 배열에서 text 추출

    const { chunks, sources } = await retrieveChunks(queryText, { topK: 5 })

    const systemPrompt = buildSystemPrompt(chunks)
    const modelMessages = await convertToModelMessages([
      { id: 'sys', role: 'system', parts: [{ type: 'text', text: systemPrompt }] },
      ...clamped,
    ])

    const result = streamText({
      model: gateway('google/gemini-3.5-flash'),  // Task 1 정정 ID
      messages: modelMessages,
      onFinish: ({ usage }) => {
        // 로그 (M5 chat_messages 저장은 별도 마일스톤)
        console.log('[chat] usage', usage)
      },
    })

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === 'finish') {
          return { sourceRefs: sources }
        }
      },
    })
  } catch (err) {
    return jsonError(err)
  }
}
```

**테스트** (`tests/rag/route-handler.test.ts`, unit with mocks):
1. POST 본문 검증 — empty messages → 400
2. messages에 user 메시지 0개 → 400
3. `retrieveChunks` mock + `streamText` mock — 응답 헤더 `content-type` text/event-stream 확인
4. mock 결과의 sources가 metadata로 전달되는지 확인 (`messageMetadata` 콜백 호출 검증)
5. clampHistory가 12+ messages 입력에 호출되는지 (간접 검증, 모킹 spy)

**검증**: 5 unit tests PASS + `next build`에서 Route Handler 등록 확인 (no compile error).

---

### Part B — 통합 검증 (Tasks 4~5)

#### Task 4 — Smoke 테스트 (`tests/rag/m3-smoke.test.ts`)

**Model**: cheap

**범위**: `RUN_SMOKE=1` 게이트 (M2 패턴), 실 Supabase + 실 Gemini 호출.

**테스트**:
1. POST `/api/chat` localhost — 질의 "장애인교원에게 보조인력 지원이 있나요?"
2. 응답이 SSE 스트림으로 도착, 토큰 5개 이상 수신, 종료 시 metadata.sourceRefs.length ≥ 1
3. 응답 본문에 "참고용" 단어 포함 (면책 회귀 가드)
4. P50 latency 로깅 (검증은 아니지만 데이터 수집)

**구현**: smoke는 `node --import tsx --test tests/rag/m3-smoke.test.ts` + Next.js dev 서버 별도 기동 필요. Task 4 spec에 절차 명시.

**검증**: RUN_SMOKE=1 환경에서 3 tests PASS + P50/P99 측정값 plan §M3 변경 이력에 기록.

---

#### Task 5 — `(wiki)/chat` 페이지 minimal wiring (M3 단계 verification UI)

**Model**: cheap

**목표**: M4 본격 UI 전 손쉬운 E2E 확인.

**수정 파일**: `src/app/(wiki)/chat/page.tsx`
- 현재 `<ChatMockUI />` 그대로 유지 (M4에서 교체)
- 페이지 하단에 작은 link "M3 verification (devOnly)" → `/api/chat/probe` 또는 별도 dev-only page

**결정 D11**: ChatMockUI 교체는 M4 작업이므로, M3에서는 **소스 변경 0**으로 둔다. Smoke는 curl/test로만 확인.

→ **Task 5는 spec only — 코드 변경 없음**. 위원장의 빠른 확인을 위해 `docs/M3_SMOKE_PROCEDURE.md` 신규 작성:
- `npm run dev` 기동 절차
- curl로 SSE 응답 확인 절차
- 비용 측정 방법

**검증**: 문서 1개 신규 + ChatMockUI 무변경 확인.

---

### Part C — 환경 + 머지 (Tasks 6~10)

#### Task 6 — 환경변수 셋업 가이드 + .env.local 보강

**Model**: cheap

**범위** (OIDC 우선, D8):
- `vercel link` 1회로 webfortd 프로젝트 연결 확인. 이미 연결돼 있으면 skip.
- `vercel env pull .env.local`로 OIDC 토큰(`VERCEL_OIDC_TOKEN`) 발급 — 24h short-lived JWT.
- `.env.local`의 `GOOGLE_GENERATIVE_AI_API_KEY` (M1에서 등록됨, 검증만) — Task 1 모델 ID 폴백 검증 시 사용.
- `docs/M3_SMOKE_PROCEDURE.md` §환경 설정 섹션에 OIDC 토큰 재발급 절차(24h 만료 시 `vercel env pull` 재실행) 명시.
- Route Handler는 Next.js가 `.env.local` 자동 로드 — `--env-file` 옵션 불필요.

**검증**: `.env.local`에 `VERCEL_OIDC_TOKEN` 존재 + `direnv allow` 통과 + `vercel whoami` 응답.

---

#### Task 7 — README + DIRECTION_2026 미세 갱신

**Model**: cheap

**수정 파일**:
- `README.md` — Phase 3 채팅 production endpoint POST `/api/chat` 1줄 추가
- `docs/DIRECTION_2026.md` §변경 이력 — 2026-05-23 entry에 M3 진행 1줄

**검증**: lint 통과.

---

#### Task 8 — Vercel AI Gateway 활성화 (controller 직접, 코드 변경 0)

**Model**: controller 직접 (subagent 불필요)

**범위** (OIDC 우선, D8 — API key 등록 불필요):
- KHUDT Vercel team의 webfortd 프로젝트 Settings → AI Gateway 페이지에서 활성화 (위원장 작업).
- 활성화 후 production deploy 시 OIDC 토큰이 빌드 환경에 자동 주입되는지 확인 (`vercel deploy` 로그에서 `VERCEL_OIDC_TOKEN` 주입 단계 확인).
- 활성화 후 production deploy 후 `/api/chat` POST 200 응답 + AI Gateway 대시보드의 Logs 탭에서 요청 표시 확인.

**검증**: production endpoint POST 200 + AI Gateway 대시보드 요청 로그 1건 이상.

---

#### Task 9 — codex-rescue 마일스톤 검토 (background dispatch, effort low)

**Model**: codex-rescue subagent

**범위**: M3 PR diff 전체 (Tasks 1~7 + 8 환경)에 대한 cross-cutting invariant 검토.

**포커스** (RAG design §12.3 + M3 특화):
1. **서버 전용 가드**: 모든 server-side credentials (`GOOGLE_GENERATIVE_AI_API_KEY`, OIDC 토큰, `SUPABASE_SECRET_KEY`)가 client bundle에 새지 않는지 (`next build` 결과 분석)
2. **시스템 프롬프트 안전**: D3 본문이 정체성/면책 양면 모두 포함, prompt injection 가능성 (사용자 질의가 `[참고 자료]` 태그를 가장하는 경우)
3. **AI SDK v6 API 정합**: `convertToModelMessages` await, `toUIMessageStreamResponse` 사용 확인
4. **D5 history clamp 안전**: 마지막 메시지가 assistant인 경우 user 질의 누락 가능성
5. **rate limit 부재**: AI Gateway 429 전달 경로 + 클라이언트 처리 부재가 M3 시점에 허용 가능한지
6. **PIPA 수집 최소화**: Route Handler가 로그/콘솔에 user query 본문 출력하는지 (현재 console.log usage만, but user query 미출력 확인 필요)
7. **출처 slug 유효성**: source_refs의 slug가 빌드된 페이지에 실재하는지 — M4가 깨진 링크 만들지 않도록 build-time 또는 retrieval-time 가드 검토

**dispatch**: background, effort low. 결과 받으면 BLOCK/CONCERN/APPROVE 분류 후 처리.

---

#### Task 10 — PR 생성 + KHUDT org 수동 squash 머지

**Model**: controller 직접

**범위**:
- `gh pr create --title "feat(phase-3-m3): RAG Route Handler + Gateway + 시스템 프롬프트" --body ...`
- KHUDT org auto-merge 비활성이므로 위원장 명시 신호 후 `gh pr merge {N} --squash --delete-branch --admin`
- 머지 후 본체 worktree `git pull --ff-only origin master`
- impl worktree 정리 (`git worktree remove`, branch delete)

---

## §4. 회귀 게이트

각 Task 완료 시:
- `npm test` — unit 회귀 (M2 168 pass + M3 신규 12 pass = 180+ pass / 1 master baseline)
- `npm run test:integration` — M2 29 pass 유지
- `npm run build` — 567 정적 페이지 유지 + 새 `/api/chat` Route Handler 등록 확인
- `npm run kb:publish -- --dry-run` — 535/8/527 변동 0

Final PR 전:
- Smoke (`RUN_SMOKE=1`) — 3 PASS
- Vercel preview deploy — `/api/chat` POST 200 확인 (curl)

---

## §5. 리스크 표

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Task 1에서 `google/gemini-3.5-flash` 모델 ID 거부 | Task 4·5 전부 BLOCK | D2 fallback 후보 순차 시도. plan §D2 갱신. |
| AI Gateway API key 미발급 / 권한 부족 | smoke·production 불가 | 시범 단계는 `gateway()` 대신 `google()` provider 직접 호출 fallback (관찰성은 일시 손실, 비용 추적은 Supabase로) |
| 시스템 프롬프트의 톤이 위원장 검토에서 거부 | Task 2 재작업 | Task 2 spec에 위원장 검토 게이트 명시. plan §D3 본문 갱신 후 재작성. |
| AI SDK v6 `validateUIMessages` API 미존재 (가설 단계) | Task 3 부분 BLOCK | Task 1 export 검증에서 사전 발견. 부재 시 manual zod validation으로 대체. |
| Vercel runtime=nodejs / Edge 충돌 | Route Handler 빌드 실패 | `export const runtime = 'nodejs'` 명시 (D9). service_role + retrieval RPC가 Edge 비호환. |
| `result.toUIMessageStreamResponse` 시 metadata 전달 API 불일치 | sourceRefs 클라이언트 누락 (M4 영향) | Task 3 진입 시 v6 docs 실측 후 D10 갱신. fallback: 응답 헤더로 source slugs 전달 |

---

## §6. 위원장 게이트

- **plan 검토** → 본 문서 위원장 확인 후 §2 진입 절차 시작.
- **Task 2 시스템 프롬프트 본문** → Task 2 PR 전 위원장 톤 검토 1회 ("다정·명료" 기준 부합 여부).
- **Task 8 AI Gateway 활성화** → webfortd Vercel 프로젝트 Settings → AI Gateway 활성화는 위원장 대시보드 작업 필요 (OIDC 자동 주입, 별도 키 등록 없음).
- **Task 9 codex-rescue 결과 처리** → BLOCK 발견 시 fix 후 재실행.
- **Task 10 머지** → 위원장 명시 신호 후 squash.

---

## §7. 진행 후 갱신 대상

머지 후:
- `webfortd/CLAUDE.md` §변경 이력 — M3 entry 1줄
- `~/.claude/projects/.../memory/MEMORY.md` Quick Reference — M3 머지 / Route Handler / 시스템 프롬프트 모델 ID
- `memory/project_phase_status.md` — Phase 3 M3 머지 완료 섹션 추가, M4 진입 절차 명시
- `docs/DIRECTION_2026.md` §변경 이력 — M3 entry
- `docs/superpowers/specs/2026-05-23-phase-3-rag-design.md` §변경 이력 — M3 실측 결과

---

## 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-23 | 초기 작성. Q1~Q6 위원장 결정 반영 (정체성·톤·includeDrafts·history clamp·rate limit·모델 ID 실측). D1~D11 결정 잠금. Task 1~10 분해. |
| 2026-05-23 | Task 1 — SDK v6 export 5건 (gateway/streamText/convertToModelMessages/validateUIMessages + result.toUIMessageStreamResponse) + @ai-sdk/google v3 `google()` provider 실재 확인. `google('gemini-3.5-flash')` 직접 호출 검증 통과. tests/scripts/m3-sdk-probe.test.ts 신규 (RUN_PROBE=1 gate). |
| 2026-05-23 | Task 2~7 — `src/lib/rag/prompt-builder.ts` (시스템 프롬프트 본문 + clampHistory) + `app/api/chat/route.ts` Route Handler + `tests/rag/{prompt-builder,route-handler,m3-smoke}.test.ts` + `docs/M3_SMOKE_PROCEDURE.md` + README/DIRECTION 미세 갱신. next build 568 페이지 + `/api/chat` 등록. |
| 2026-05-23 | Task 8 검증 완료 — KHUDT Vercel Pro plan에서 AI Gateway는 별도 활성화 불필요 (OIDC 자동 발급). `vercel env pull` 1회로 `VERCEL_OIDC_TOKEN` 발급 + 실 smoke 4건 모두 PASS (Gemini 응답, "참고용" 면책 키워드, sourceRefs metadata, 다중턴 처리). 192 tests / 190 pass / 1 baseline fail / 1 skipped (sdk-probe). 듀레이션 ~44s. |
