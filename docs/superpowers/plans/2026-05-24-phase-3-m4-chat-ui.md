# Phase 3 M4 Chat UI Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하드코드 mock 응답을 사용하는 `ChatMockUI`를 Vercel AI Elements + AI SDK v6 `useChat` 기반 `ChatUI`로 교체한다. M3에서 가동 중인 `/api/chat` RAG Route Handler(스트리밍 + `messageMetadata.sourceRefs`)와 연결한다. PR A 단독 범위 — M5 DB 히스토리는 별도 사이클.

**Architecture:** AI Elements는 selective install(`npx ai-elements@latest add message conversation prompt-input sources suggestion loader`)로 필요 컴포넌트만 `src/components/ai-elements/`에 scaffold(풀세트 `all.json` 금지 — `@base-ui/react` 버전 충돌 회피). `useChat()` 기본 transport(`DefaultChatTransport({ api: '/api/chat' })`)를 그대로 사용하고 응답은 `messages[].parts` 순회로 렌더(assistant는 `MessageResponse` markdown, user는 `MessageContent` 평문). 출처 인용은 미니멀 칩 `<Source>`로 응답 메시지의 `metadata.sourceRefs`에서 1회 렌더. 비로그인은 useState로만 메시지 보유(reload 시 휘발) + 안내 배너 1줄. M5 thread 저장 분기는 같은 컴포넌트에 placeholder만 두고 별도 PR에서 구현.

**Tech Stack:** Next.js 16 (App Router, RSC + `'use client'`) · React 19 · AI SDK v6 (`ai@^6.0.190`, 기존) + 신규 `@ai-sdk/react@^3.0.x` · Vercel AI Elements (shadcn registry, selective install) · shadcn/ui (기존 `components.json` + `src/components/ui/`) · Tailwind CSS 4 · Vitest 3.x + `@testing-library/react` 16.x + `@vitejs/plugin-react` 5.x + `jsdom` 26.x (신규, components 단위만) · 기존 `node:test` + `tsx` (백엔드·script·migration 그대로)

---

## 0. Context (zero-context 엔지니어용 짧은 브리핑)

**webfortd가 무엇인가**: 장교조(함께하는장애인교원노동조합)가 구축하는 장애인교원 정책 지식베이스 + RAG 채팅 Next.js 풀스택. 535개 마크다운 정본을 Supabase로 동기화 → pgvector 검색 → Gemini 응답. 시범 모델이지만 교육부-중부대 사업 자문 근거 자산이라 품질·접근성 협상 불가. 위원장(사용자)이 시각장애인이고 사용자 다수가 장애인교원이라 모든 UI는 키보드·VoiceOver·`aria-live` 의무.

**M3까지 완료된 것**:
- M1: 535 docs → 1606 청크 임베딩 (`gemini-embedding-2-preview`, 1536-dim, hnsw)
- M2: `src/lib/rag/{types,embed-query,retrieval}.ts` server-only RAG 검색 함수
- M3: `src/app/api/chat/route.ts` Route Handler — 스트리밍 응답 + `toUIMessageStreamResponse({ messageMetadata: sourceRefs })` 작동 중

**M4의 역할**: M3가 이미 RAG 응답을 스트리밍하는데 UI가 아직 mock(`ChatMockUI.tsx` + `chat-mock-responses.ts`)이라 실 응답을 못 받는다. M4는 **순수 UI 교체** — 실 mock 사라지고 실 RAG가 작동. M5(DB 히스토리), M6(sessionStorage + PIPA UI)는 후속.

**설계 문서**: `docs/superpowers/specs/2026-05-24-phase-3-m4-m5-chat-ui-history-design.md` (PR #29, 머지 `824d015`)
- §1.4 의존성 표
- §2 결정 Snapshot Q1~Q5 + D1~D11
- §4 UI 레이어 — AI Elements 컴포넌트 매핑 + ChatUI 의사 코드
- §6 접근성 spec + §6.3 위원장 톤 검수 체크리스트
- §7 Vitest 부분 도입 전략
- §8.1 PR A 마일스톤 분해
- §9 리스크 (Next/React CVE는 §9.1 별도 PR 권고 — M4 범위 외)
- §10 codex-rescue 포커스 (PR A·B)

**중요 invariant** (M4에서도 유지):
- `kb:publish:dry-run` baseline `535/8/527` 변동 X (M4는 데이터 layer 무관)
- `next build` 568 정적 페이지 + `/api/chat` ƒ 등록 유지
- 185 unit + 29 integration 테스트 그린 유지 (M4에서 신규 Vitest 추가)
- `tests/components/**/*.test.tsx`만 Vitest, 나머지는 node:test 분리 유지
- 모든 RAG 라이브러리(`src/lib/rag/*`)는 `import 'server-only'` 그대로
- AI Elements `all.json` 풀세트 install 금지 — selective install만
- `MessageResponse`는 `@/components/ai-elements/message`에서 import (assistant text는 markdown 의무, raw text 금지 — AI SDK v6 공식 가이드 MANDATORY)
- 위원장 직접 톤 검수(시나리오 1: 비로그인 채팅) 게이트 통과 전 머지 금지

**보안 CVE 메모** (별도 PR로 처리 — M4 범위 외):
- `next` `^16.0.10` → **16.0.11** (CVE-2025-66478 RCE)
- `react` `^19.2.1` → **19.2.4** (CVE-2026-23864 DoS)
- spec §9.1 권고. M4 머지 전·후 별도 sprint로 처리 권고 (위원장 결정 대기).

---

## 1. File Structure

### 신규 파일

| 파일 | 책임 |
|------|------|
| `src/components/chat/ChatUI.tsx` | M3 `/api/chat`과 연결되는 client component. `useChat` + AI Elements wrap. spec §4.2 그대로. |
| `src/components/ai-elements/conversation.tsx` | AI Elements scaffold (CLI 자동 생성) — `Conversation`/`ConversationContent` |
| `src/components/ai-elements/message.tsx` | AI Elements scaffold — `Message`/`MessageContent`/`MessageResponse` |
| `src/components/ai-elements/prompt-input.tsx` | AI Elements scaffold — `PromptInput`/`PromptInputTextarea`/`PromptInputSubmit` |
| `src/components/ai-elements/sources.tsx` | AI Elements scaffold — `Source`/`Sources` |
| `src/components/ai-elements/suggestion.tsx` | AI Elements scaffold — `Suggestion`/`Suggestions` |
| `src/components/ai-elements/loader.tsx` | AI Elements scaffold — `Loader` |
| `src/components/ui/sheet.tsx` | shadcn `Sheet` scaffold — M5에서 `ThreadDrawer`에서 첫 사용. PR A에서 미리 install. |
| `vitest.config.ts` | Vitest 설정 (jsdom env, components 영역만, `@/` alias) |
| `tests/components/setup.ts` | `@testing-library/jest-dom` import (matcher 확장) |
| `tests/components/chat/source-card.test.tsx` | `Source` 칩 렌더 단위 테스트 (Vitest 부분 도입 첫 사례) |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/app/(wiki)/chat/page.tsx` | `ChatMockUI` import 제거 → `ChatUI`. `metadata.description` 갱신("데모" 표현 제거) |
| `package.json` | (a) deps 추가: `@ai-sdk/react`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/dom`, `@vitejs/plugin-react`, `jsdom`. (b) scripts 분리: `test:components` 신규 + `test:all`에 chain 추가 |
| `package-lock.json` | npm install 결과물 |
| `tsconfig.json` | (필요 시) `tests/components`를 include — 기존 tests 패턴 따라 동작 확인 |

### 삭제 파일

| 파일 | 사유 |
|------|------|
| `src/components/chat/ChatMockUI.tsx` | RAG가 mock을 대체. 더 이상 ref 없음 |
| `src/lib/chat-mock-responses.ts` | `matchMockResponse` 호출처가 ChatMockUI 단 1곳 → 동시 삭제 |
| `tests/scripts/chat-mock-responses.test.ts` | mock-responses 단위 테스트 (있으면 삭제, 없으면 skip) |

### 검증 명령 표

| 명령 | 목적 | 기대 baseline |
|------|------|---------------|
| `npm run test` | unit (node:test, 백엔드) | 185 PASS / 1 skipped (M3 sdk-probe) |
| `npm run test:integration` | integration (node:test, Supabase 실 호출) | 29 PASS (`.env.local` 필요) |
| `npm run test:components` | Vitest (신규) | 1 PASS (SourceCard) |
| `npm run test:all` | unit + integration + components chained | 위 셋 모두 |
| `npm run build` | next build | 568 정적 페이지 + `/api/chat` ƒ + 신규 빌드 회귀 0 |
| `npm run lint` | ESLint | 0 error / 0 warning |
| `npm run kb:publish:dry-run` | KB publish baseline 회귀 가드 | candidate 535 / passing 8 / blocked 527 |
| (수동) `npm run dev` + brower | 위원장 톤 검수 시나리오 1 | RAG 응답 + 출처 칩 + 안내 배너 |

---

## 2. Task Decomposition

총 7개 task. 각 task 끝에 commit. 6번 task 위원장 수동 검증 게이트.

### Task 1: 의존성 추가 + Vitest 설정

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/components/setup.ts`
- Modify: `package-lock.json` (npm install 결과)

- [ ] **Step 1: 신규 dev dependencies + runtime dependency 추가**

Run:
```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
npm install @ai-sdk/react@^3.0.0
npm install -D vitest@^3 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/dom@^10 @vitejs/plugin-react@^5 jsdom@^26
```

Expected: `package.json`에 새 의존성 7개 추가, `node_modules` 업데이트.

> 패키지명 확인 — `@testing-library/react` v16부터 React 19 지원. `vitest@^3` 안정 channel. `jsdom@^26` 최신.

- [ ] **Step 2: `vitest.config.ts` 작성**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/components/**/*.test.tsx'],
    setupFiles: ['./tests/components/setup.ts'],
    globals: false, // describe/it/expect는 명시 import (vitest)
    css: false, // shadcn 컴포넌트의 CSS import는 skip (Tailwind는 별도 빌드)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: `tests/components/setup.ts` 작성**

```ts
// tests/components/setup.ts
import '@testing-library/jest-dom/vitest'
```

> `jest-dom/vitest`는 v6 이후의 Vitest 전용 entry — `toBeInTheDocument()` 등 matcher 확장.

- [ ] **Step 4: `package.json` scripts 분리**

Modify `package.json`의 `scripts`:

```json
{
  "scripts": {
    "test": "node --import tsx --test 'tests/*.test.ts' 'tests/auth/**/*.test.ts' 'tests/scripts/**/*.test.ts' 'tests/rag/**/*.test.ts'",
    "test:integration": "node --import tsx --test 'tests/migrations/**/*.test.ts'",
    "test:components": "vitest --run",
    "test:components:watch": "vitest",
    "test:all": "npm run test && npm run test:components && npm run test:integration"
  }
}
```

> 기존 `test` glob에서 `tests/components`가 빠져 있으므로 node:test가 .tsx 파일을 잘못 잡는 사고 회피. `test:integration`은 `.env.local` 필요 — 기존 패턴 유지.

- [ ] **Step 5: Vitest dry-run으로 설정 검증**

Run:
```bash
npm run test:components
```

Expected:
```
No test files found, exiting with code 0
```

(아직 테스트 없으므로 정상)

- [ ] **Step 6: 기존 백엔드 회귀 검증**

Run:
```bash
npm run test
```

Expected: 기존 185 PASS / 1 skipped 유지 (M3 baseline).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/components/setup.ts
git commit -m "$(cat <<'EOF'
chore(phase-3-m4): Vitest 부분 도입 인프라 + AI SDK React deps

@ai-sdk/react@^3.0.0 (useChat v6 transport용) + Vitest 3.x 영역 분리
신설. tests/components/**/*.test.tsx만 Vitest, 백엔드는 node:test 그대로.
test:all chained.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: AI Elements selective install + shadcn Sheet

**Files:**
- Create (via CLI): `src/components/ai-elements/{conversation,message,prompt-input,sources,suggestion,loader}.tsx`
- Create (via CLI): `src/components/ui/sheet.tsx`
- Modify: `package.json`, `package-lock.json` (CLI가 peer deps 추가 시)

- [ ] **Step 1: AI Elements selective install**

Run (한 번에 6개 컴포넌트):
```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
npx ai-elements@latest add message conversation prompt-input sources suggestion loader
```

Expected: 6 파일이 `src/components/ai-elements/`에 생성. peer deps(`streamdown` 등) 자동 install. 프롬프트 나오면 모두 yes.

> 풀세트 `npx ai-elements@latest`만 또는 `add all` 절대 금지 — 48 컴포넌트 install 시 `@base-ui/react` 버전 충돌 위험 (spec §9.2).

- [ ] **Step 2: shadcn Sheet 추가 (M5 ThreadDrawer 사전 준비)**

Run:
```bash
npx shadcn@latest add sheet
```

Expected: `src/components/ui/sheet.tsx` 생성. peer dep `@radix-ui/react-dialog`는 이미 설치됨.

> Sheet는 M4에서 사용 없음 — M5 ThreadDrawer 첫 사용. PR A에서 미리 install해두면 M5 PR diff에 잡음 감소.

- [ ] **Step 3: 설치 결과 검증**

Run:
```bash
ls src/components/ai-elements/
ls src/components/ui/sheet.tsx
```

Expected:
```
conversation.tsx
loader.tsx
message.tsx
prompt-input.tsx
sources.tsx
suggestion.tsx
```
+ `src/components/ui/sheet.tsx` 존재.

- [ ] **Step 4: export 시그니처 grep 검증**

Run:
```bash
grep -E "^export" src/components/ai-elements/message.tsx
grep -E "^export" src/components/ai-elements/sources.tsx
grep -E "^export" src/components/ai-elements/prompt-input.tsx
```

Expected: `MessageResponse`, `MessageContent`, `Message`, `Source`, `Sources`, `PromptInput`, `PromptInputTextarea`, `PromptInputSubmit` 명이 모두 노출. (실제 export 명이 다르면 §3 ChatUI 코드에 반영.)

> 만약 export 명이 spec과 다르면 (e.g., `MessageContent` 대신 `MessageText`), spec §4.1 표에 맞춰 ChatUI에서 alias import — 단 `MessageResponse`만은 정확한 이름이어야 함 (markdown 의무 컴포넌트).

- [ ] **Step 5: 빌드 회귀 확인**

Run:
```bash
npm run build
```

Expected: 기존 568 정적 페이지 그대로 + 빌드 에러 0. (ai-elements/ui 컴포넌트는 어디서도 import 안 했으므로 dead code로 빌드에서 제외.)

- [ ] **Step 6: Commit**

```bash
git add src/components/ai-elements/ src/components/ui/sheet.tsx package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(phase-3-m4): AI Elements selective install + shadcn Sheet

npx ai-elements@latest add message conversation prompt-input sources
suggestion loader (6 컴포넌트) + npx shadcn add sheet (M5 ThreadDrawer 사전).
풀세트 all.json 미사용 (@base-ui/react 버전 충돌 회피).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: SourceCard Vitest 단위 테스트 (TDD)

**Files:**
- Create: `tests/components/chat/source-card.test.tsx`

- [ ] **Step 1: failing 테스트 작성**

Create `tests/components/chat/source-card.test.tsx`:

```tsx
// tests/components/chat/source-card.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Source, Sources } from '@/components/ai-elements/sources'

describe('Source chip (M4 미니멀 출처 인용)', () => {
  it('title을 href와 함께 렌더한다 — axis/slug 경로 정합', () => {
    render(
      <Sources>
        <Source href="/policies/2023-hr-1" title="📄 1) 장애정도">
          📄 1) 장애정도
        </Source>
      </Sources>,
    )
    const link = screen.getByRole('link', { name: /1\) 장애정도/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/policies/2023-hr-1')
  })

  it('여러 출처를 동시에 렌더한다 — top-k=5까지 안정', () => {
    const sources = [
      { href: '/policies/2023-hr-1', title: '1) 장애정도' },
      { href: '/policies/2023-hr-2', title: '2) 신청 절차' },
      { href: '/disability-types/visual', title: '시각장애' },
    ]
    render(
      <Sources>
        {sources.map((s) => (
          <Source key={s.href} href={s.href} title={s.title}>
            📄 {s.title}
          </Source>
        ))}
      </Sources>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})
```

> `Source`의 정확한 props (Step 2의 export 검증에서 확인). AI Elements `Source`가 `<a>` 렌더면 `getByRole('link')`로 잡힘. 만약 그렇지 않으면 (e.g., button + onClick), 테스트를 `getByText('1) 장애정도')` + href attribute 확인으로 변환.

- [ ] **Step 2: 테스트 실행 → 통과 확인**

Run:
```bash
npm run test:components
```

Expected: 2 tests PASS (`Source` 컴포넌트가 AI Elements scaffold로 이미 구현되어 있으므로 testing-library가 render 성공).

> 만약 FAIL이면 export 시그니처/props mismatch — Step 1로 돌아가 ai-elements/sources.tsx 본 후 테스트 수정. 회귀 가드 의미가 살아있으면 OK.

- [ ] **Step 3: Commit**

```bash
git add tests/components/chat/source-card.test.tsx
git commit -m "$(cat <<'EOF'
test(phase-3-m4): Source 칩 Vitest 단위 (M4 출처 인용 회귀 가드)

AI Elements <Source> 렌더 검증 2건. 후속 SDK 업그레이드 시 props
시그니처 회귀 차단. Vitest 부분 도입 첫 사례.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ChatUI 컴포넌트 신규

**Files:**
- Create: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: spec §4.2 의사 코드를 실 ChatUI.tsx로 구체화**

Create `src/components/chat/ChatUI.tsx`:

```tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import { Source, Sources } from '@/components/ai-elements/sources'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { Loader } from '@/components/ai-elements/loader'

/**
 * Phase 3 M4 — RAG 채팅 UI.
 *
 * M3 /api/chat Route Handler와 연결:
 *   - 스트리밍 응답 (toUIMessageStreamResponse)
 *   - messageMetadata.sourceRefs로 출처 5개 전달
 *
 * M5 carry-over (별도 PR):
 *   - threadId/userId body, onFinish로 DB 저장 분기, ThreadDrawer
 *   - 본 PR에서는 비로그인 useState 휘발 모드만
 *
 * 접근성 (위원장 톤 검수 게이트):
 *   - Conversation 컨테이너 aria-label
 *   - 추천 클릭 후 inputRef focus handoff
 *   - 비로그인 안내 배너 <p> (semantic)
 */

interface SourceRef {
  slug: string
  title: string
  axis: string
}

const SUGGESTIONS = [
  '특수 마우스에는 어떤 종류가 있나요?',
  '편의지원 조례를 제정한 시도교육청은 어디인가요?',
  '학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?',
]

export function ChatUI() {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // useChat() — 기본 transport DefaultChatTransport({ api: '/api/chat' }).
  // M5에서 body로 threadId/userId 동봉 추가 예정 (PR B).
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // 자동 스크롤은 Conversation 컴포넌트 내장이므로 별도 처리 불요.

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    sendMessage({ text: trimmed })
    setInput('')
    // 추천 버튼 클릭 후 키보드 사용자 focus 잃지 않도록 input 복귀
    inputRef.current?.focus()
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 sm:px-6">
      <Conversation aria-label="대화 내역" className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="mx-auto mt-8 max-w-2xl text-center">
              <h2 className="text-xl font-semibold text-foreground">
                무엇이든 물어보세요
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                대한민국 장애인교원 제도와 정책에 대해 자연어로 질문할 수 있어요.
              </p>
              <Suggestions aria-label="추천 질문" className="mt-6">
                {SUGGESTIONS.map((s) => (
                  <Suggestion
                    key={s}
                    suggestion={s}
                    onClick={() => send(s)}
                  />
                ))}
              </Suggestions>
            </div>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                {m.parts?.map((part, i) => {
                  if (part.type === 'text') {
                    // assistant는 MessageResponse(markdown 의무 — AI SDK v6 가이드),
                    // user는 MessageContent(평문 — 사용자 입력 그대로)
                    return m.role === 'assistant' ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <MessageContent key={i}>{part.text}</MessageContent>
                    )
                  }
                  return null
                })}
                {m.role === 'assistant' &&
                  (m.metadata as { sourceRefs?: SourceRef[] } | undefined)
                    ?.sourceRefs &&
                  ((m.metadata as { sourceRefs: SourceRef[] }).sourceRefs.length > 0) && (
                    <Sources aria-label="출처">
                      {(m.metadata as { sourceRefs: SourceRef[] }).sourceRefs.map(
                        (src) => (
                          <Source
                            key={src.slug}
                            href={`/${src.axis}/${src.slug}`}
                            title={src.title}
                          >
                            📄 {src.title}
                          </Source>
                        ),
                      )}
                    </Sources>
                  )}
              </Message>
            ))
          )}
          {isLoading && <Loader aria-label="응답을 작성하고 있어요" />}
        </ConversationContent>
      </Conversation>

      <p
        role="status"
        className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      >
        로그인하면 대화가 저장돼요. 지금은 새로고침하면 사라져요.
      </p>

      <form
        onSubmit={onSubmit}
        className="border-t border-border py-4"
        aria-label="질문 입력"
      >
        <PromptInput>
          <PromptInputTextarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문을 입력하세요…"
            disabled={isLoading}
          />
          <PromptInputSubmit
            type="submit"
            aria-label="전송"
            disabled={isLoading || !input.trim()}
          />
        </PromptInput>
      </form>
    </div>
  )
}
```

> 컴포넌트 props 시그니처는 AI Elements scaffold(Task 2 Step 4 grep 결과)에 맞춤. mismatch 발생 시 그 시그니처를 따라 alias·prop 명 조정. `MessageResponse`만은 정확한 이름 사용 필수 (markdown).

- [ ] **Step 2: TypeScript 검증**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 error. (만약 `m.metadata` 타입이 narrow되지 않아 에러 시 cast 패턴 그대로 유지 — `as { sourceRefs?: SourceRef[] } | undefined`. UIMessage `metadata`는 v6에서 `unknown`임.)

- [ ] **Step 3: lint 검증**

Run:
```bash
npm run lint
```

Expected: 0 error / 0 warning. (`useEffect` 없이 작성했으므로 deps lint 무관.)

- [ ] **Step 4: 빌드 회귀**

Run:
```bash
npm run build
```

Expected: 568 정적 페이지 그대로 + `/chat` 페이지가 여전히 mock UI 렌더 (page.tsx 아직 미수정).

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "$(cat <<'EOF'
feat(phase-3-m4): ChatUI 신규 — useChat v6 + AI Elements

M3 /api/chat 스트리밍 응답과 연결. messageMetadata.sourceRefs를
미니멀 칩 Source로 렌더. assistant는 MessageResponse(markdown),
user는 MessageContent(평문). 비로그인 안내 배너 1줄.

M5 carry-over (별도 PR): threadId body, onFinish DB 저장, ThreadDrawer.
본 commit은 page.tsx와 미연결 — Task 5에서 교체.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: chat/page.tsx 교체 + ChatMockUI/mock-responses 삭제

**Files:**
- Modify: `src/app/(wiki)/chat/page.tsx`
- Delete: `src/components/chat/ChatMockUI.tsx`
- Delete: `src/lib/chat-mock-responses.ts`
- Delete (if exists): `tests/scripts/chat-mock-responses.test.ts`

- [ ] **Step 1: `chat/page.tsx`에서 ChatMockUI → ChatUI 교체**

Modify `src/app/(wiki)/chat/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { ChatUI } from '@/components/chat/ChatUI'

export const metadata: Metadata = {
  title: '채팅',
  description:
    '대한민국 장애인교원 제도와 정책을 자연어로 질문할 수 있는 채팅이에요.',
}

export default function ChatPage() {
  return <ChatUI />
}
```

> metadata description에서 "데모" 표현 제거. M3 시스템 프롬프트 영구 원칙(다정·명료 톤)에 맞춤.

- [ ] **Step 2: ChatMockUI 삭제**

Run:
```bash
git rm src/components/chat/ChatMockUI.tsx
```

- [ ] **Step 3: chat-mock-responses 삭제 + 호출처 grep**

Run:
```bash
git rm src/lib/chat-mock-responses.ts
ls tests/scripts/chat-mock-responses.test.ts 2>/dev/null && git rm tests/scripts/chat-mock-responses.test.ts || echo "no mock-responses test"
```

- [ ] **Step 4: 잔존 import 검증**

Run:
```bash
grep -rn "ChatMockUI\|chat-mock-responses\|matchMockResponse" src/ tests/ 2>&1
```

Expected: 0 matches. 만약 matches 있으면 추가 정리.

- [ ] **Step 5: TypeScript + lint + build 회귀**

Run:
```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected:
- tsc 0 error
- lint 0 error
- build 568 정적 페이지 (변동 0) + `/chat` 페이지가 ChatUI 렌더 + `/api/chat` ƒ 그대로

- [ ] **Step 6: Commit**

```bash
git add src/app/\(wiki\)/chat/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase-3-m4): chat/page → ChatUI 교체 + mock 자산 삭제

ChatMockUI / chat-mock-responses / 해당 단위 테스트 삭제.
metadata.description에서 "데모" 표현 제거 — M3 시스템 프롬프트
영구 원칙(다정·명료 톤)에 정합.

잔존 import 0건 grep 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 회귀 검증 + 위원장 톤 검수 게이트

**Files:** 코드 변경 없음. 검증·수동 검수 게이트.

- [ ] **Step 1: 모든 자동 테스트 그린**

Run:
```bash
npm run test:all
```

Expected:
- `test`: 185 PASS / 1 skipped (M3 baseline 유지)
- `test:components`: 2 PASS (Task 3에서 추가)
- `test:integration`: 29 PASS (.env.local 필요 — 환경 없으면 skip 메시지 + 통과)

> 만약 integration이 환경 부재로 fail이면 `.env.local` 셋업 후 재실행 (CLAUDE.md §환경 — webfortd 디렉터리에서 direnv 자동).

- [ ] **Step 2: KB 데이터 layer baseline 회귀 가드**

Run:
```bash
npm run kb:publish:dry-run
```

Expected: `candidate 535 / passing 8 / blocked 527` (M3 baseline 변동 0). M4는 데이터 layer 무관이므로 변동 있으면 회귀 — 디버그 진입.

- [ ] **Step 3: 빌드 + dev server 띄우기**

Run:
```bash
npm run build
npm run dev
```

Expected: build 568 정적 페이지 + `/api/chat` ƒ, dev server `http://localhost:3000`.

- [ ] **Step 4: 위원장 톤 검수 시나리오 1 (비로그인 채팅) — 수동**

위원장이 다음을 직접 수행:

1. Chrome (또는 위원장 기본 브라우저)에서 `http://localhost:3000/chat` 접속
2. 비로그인 상태 확인 (로그인 버튼 노출)
3. 안내 배너 "로그인하면 대화가 저장돼요. 지금은 새로고침하면 사라져요." 노출 확인
4. 추천 질문 3개 중 한 개 클릭 ("특수 마우스에는 어떤 종류가 있나요?" 권장)
5. 응답 스트리밍 토큰이 점진적으로 출력되는지 확인
6. 응답 본문이 markdown(`**굵게**`, `## 제목`, 목록) 적절히 렌더 (raw `**` 표시 X)
7. 응답 종료 후 출처 칩 1~5개 표시 + 클릭 시 atomic 페이지로 이동
8. 추천 클릭 후 input focus가 input box로 복귀 (Tab 키 위치 확인)
9. 새로고침 → 대화 휘발 + 빈 채팅 상태 + 추천 질문 다시 노출
10. VoiceOver 켜고 1~9 재현 — 스트리밍 낭독 + focus 흐름 + 안내 배너 본문 인식 검증

위원장이 모든 항목 OK 신호 후 다음 단계.

- [ ] **Step 5: spec §6.3 톤 검수 체크리스트 5건 검증 — 수동**

위원장이 다음 5건 직접 검증:

1. `MessageResponse` markdown 렌더가 `**bold**`·`##`·표·`---`·코드블록을 모두 정상 렌더하는가?
2. 시스템 프롬프트(M3 박힘)가 다정·명료 톤으로 응답을 유도하는가?
3. 면책 조항("참고용입니다") 위치가 응답 말미인가 두미인가? 두미면 응답 흐름 어색하지 않은가?
4. 출처 칩 한 줄에 5개가 모두 가독성 있는가? (한국어 title 길이 편차)
5. VoiceOver로 응답 + 출처 카드 연속 낭독 시 흐름 자연스러운가?

위원장이 모든 항목 OK 신호 + 발견된 fix는 별도 commit으로 처리 후 다음 단계.

- [ ] **Step 6: dev server 종료**

dev terminal에서 `Ctrl+C`.

- [ ] **Step 7: Commit (회귀 검증 결과 메모)**

```bash
# 코드 변경 0건이면 commit skip — Task 7로 직진
echo "회귀 검증 완료, code change 없음 — Task 7로 진행"
```

만약 Step 4·5에서 fix가 있었으면:
```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(phase-3-m4): 위원장 톤 검수 게이트 피드백 N건 반영

[구체 fix 내용 — 위원장 피드백 항목별로]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: PR A 작성 + codex-rescue cross-cutting 검토

**Files:** 코드 변경 없음. PR + 마일스톤급 리뷰.

- [ ] **Step 1: push**

Run:
```bash
git push -u origin phase-3-m4-plan
```

> 브랜치 이름이 plan 작성용이라 plan PR이 머지된 후 별도 구현 브랜치를 따로 만드는 방식이 일관성 (위원장 패턴 PR #24 plan → PR #26 구현). 즉 이 plan PR(#TBD)이 머지된 후 새 브랜치 `phase-3-m4-impl`을 만들고 Task 1~6을 실 코드로 구현 — **이 plan 문서 자체가 1차 PR**, 실 코드는 별도 PR.

> **그러나** 위원장이 "빨리빨리" 의지를 표명했고 plan/구현을 한 호흡에 가는 패턴도 있음 (M1 PR #22가 plan + 구현 합본 — 그래서 plan이 worktree 격리로 PR diff 누락되어 PR #23 별도 머지가 fix-up으로 들어감). 이번에는 두 옵션 명시:
> - **Option α (분리)**: 이 brench가 plan만 — PR 작성 후 머지 → 새 brench `phase-3-m4-impl`로 Task 1~6 실 구현 → 별도 PR
> - **Option β (합본)**: 이 brench에서 Task 1~6 실 구현까지 진행 → plan + impl 한 PR로 머지

> Task 7 Step 2~4는 Option α 기준. Option β 선택 시 본 Step 1~4를 Task 1~6 완료 후 실행.

- [ ] **Step 2: PR 작성**

Run:
```bash
gh pr create --title "docs(phase-3-m4-plan): 채팅 UI 교체 task 분해" --body "$(cat <<'EOF'
## 요약

Phase 3 M4 (채팅 UI 교체) 구현 plan. 7 tasks (의존성 + Vitest / AI Elements install / SourceCard 테스트 / ChatUI 신규 / page 교체 + mock 삭제 / 회귀 검증 + 위원장 톤 검수 / PR + codex-rescue).

## 짝 문서

- spec: `docs/superpowers/specs/2026-05-24-phase-3-m4-m5-chat-ui-history-design.md` (PR #29, 머지 `824d015`)
- §8.1 PR A scope 그대로 task 단위 분해

## 핵심 invariant

- AI Elements `all.json` 풀세트 install 금지 — selective install만
- `MessageResponse`는 `@/components/ai-elements/message`에서 import (assistant text markdown 의무)
- Vitest는 `tests/components/**/*.test.tsx`만, 백엔드 node:test 그대로
- `kb:publish:dry-run` baseline 535/8/527 변동 0
- `next build` 568 정적 페이지 + `/api/chat` ƒ 유지
- 185 unit + 29 integration 그린 유지 + 신규 Vitest 2 PASS

## 위원장 검수 게이트

Task 6 Step 4·5: 비로그인 채팅 시나리오 + spec §6.3 톤 검수 체크리스트 5건. 위원장 명시 OK 후 PR 머지.

## 다음 단계 (머지 후)

새 브랜치 `phase-3-m4-impl`로 Task 1~7 실 구현 → 별도 PR. 또는 위원장 선호에 따라 본 brench에서 이어 구현 + plan + impl 합본 PR로 머지.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: codex-rescue 마일스톤급 검토 (구현 PR 시점, plan PR은 skip 가능)**

Plan PR 자체는 문서라 codex-rescue 불필요. **구현 PR 작성 시점**에 다음 dispatch:

```
Agent({
  description: "Phase 3 M4 구현 PR codex-rescue",
  subagent_type: "codex:codex-rescue",
  prompt: "Phase 3 M4 (채팅 UI 교체) 구현 PR 머지 전 cross-cutting 검토.
spec: docs/superpowers/specs/2026-05-24-phase-3-m4-m5-chat-ui-history-design.md
plan: docs/superpowers/plans/2026-05-24-phase-3-m4-chat-ui.md
브랜치 diff 전체 검토 — spec §10 codex-rescue 포커스(PR A):
  - AI Elements Conversation aria-live 중복 선언
  - 추천 버튼 → input focus handoff 보존
  - Response markdown 렌더의 XSS 안전성 (Streamdown 내장 sanitize 의존)
  - 미로그인 사용자에게 thread drawer 미노출 분기 정확성 (M4에선 drawer 없음 — 미주의 시 M5 carry로 push)
  - useChat v6 transport 누락 (M3 route handler shape와 정합)
+ M5 carry-over로 push할 issue가 있으면 plan §11에 기록 권고.
머지 차단 0건이면 APPROVE, 차단 N건이면 BLOCK + 구체 fix 제안."
})
```

- [ ] **Step 4: codex-rescue 결과 처리**

- **APPROVE**: 위원장 명시 머지 동의 후 squash 머지
- **APPROVE_WITH_FOLLOWUP**: follow-up을 M5 plan §carry-over에 박고 PR 머지
- **CONCERN/BLOCK**: fix commit 후 codex-rescue 재실행 (단 같은 계층 반복 지적 시 글로벌 CLAUDE.md "Codex stop-time review 주의" 원칙 적용 — 지엽 패치 전 아키텍처 대조)

---

## 3. Self-Review

### Spec coverage 검증

spec §8.1 PR A scope 항목별 매핑:

| spec §8.1 항목 | plan task |
|---------------|----------|
| 신규 `src/components/chat/ChatUI.tsx` | Task 4 |
| 신규 `src/components/ai-elements/*` | Task 2 |
| 신규 `src/components/ui/sheet.tsx` | Task 2 (M5 사전 준비) |
| 신규 `tests/components/chat/source-card.test.tsx` | Task 3 |
| 신규 `vitest.config.ts` | Task 1 |
| 신규 `tests/components/setup.ts` | Task 1 |
| 수정 `src/app/(wiki)/chat/page.tsx` | Task 5 |
| 수정 `package.json` (deps + scripts) | Task 1 |
| 삭제 `src/components/chat/ChatMockUI.tsx` | Task 5 |
| 삭제 `src/lib/chat-mock-responses.ts` | Task 5 |
| Vitest 1건 PASS (SourceCard) | Task 3·6 |
| 기존 node:test 회귀 그린 | Task 6 Step 1 |
| `next build` 페이지 카운트 변동 0 | Task 5 Step 5, Task 6 Step 3 |
| 위원장 수동 4개 시나리오 중 (1) 비로그인 채팅 | Task 6 Step 4 |
| codex-rescue 포커스 5건 | Task 7 Step 3 (구현 PR 시점) |

**Gap 0건.** spec §6.3 톤 검수 5건도 Task 6 Step 5에 박힘.

### Placeholder scan

- "TBD", "TODO": 0건 (검색됨)
- "implement later" / "add appropriate error handling": 0건
- "Similar to Task N": 0건
- 모든 step에 실 명령·실 코드 박힘
- Task 6 Step 7 commit message에 "[구체 fix 내용 — 위원장 피드백 항목별로]" placeholder 있음 → **의도된 placeholder** (위원장 피드백 결과에 따라 정해짐, plan 작성 시점에 미정의가 정상)

### Type consistency

- `SourceRef` 타입을 Task 3 (테스트)·Task 4 (ChatUI) 동일하게 `{ slug, title, axis }` shape 사용
- `MessageResponse`·`MessageContent`·`Sources`·`Source`·`Suggestion`·`PromptInput*`·`Loader` import path 모두 selective install 결과(`@/components/ai-elements/<module>`)와 정합
- `useChat` 반환 `messages, sendMessage, status` v6 형식 일관
- `status` 비교는 `'submitted' | 'streaming'` 두 값만 — v6 spec과 정합

### Scope check

- 7 tasks, 각 task 5~7 step → bite-sized
- TDD 적용: Task 3에서 테스트 먼저, 구현(이미 AI Elements scaffold)이 PASS
- 단일 plan으로 PR A 완결 — PR B (M5)는 별도 사이클 명시

### Ambiguity check

- Task 2 Step 4 export 시그니처 grep — mismatch 시 spec alias 패턴 명시
- Task 4 Step 1 `m.metadata` cast — UIMessage v6 metadata가 `unknown`이므로 cast 명시
- Task 7 Step 1 PR 구조(plan vs impl 분리/합본) — 두 옵션 명시 + 위원장 결정 위임

**Self-review 완료 — 인라인 fix 0건.** Plan 그대로 실행 가능.

---

## 4. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-24 | 초안 작성 — spec PR #29 머지 `824d015` 후속, PR A (M4 채팅 UI 교체) 단독 plan. 7 tasks, TDD, 위원장 톤 검수 게이트, codex-rescue 포커스 5건. PR B (M5 DB 히스토리)는 M4 머지 후 별도 사이클. |
