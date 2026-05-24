# Phase 3 M6 채팅 UI 보완 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3 M3~M5 머지로 가동 중인 RAG 채팅에 일상 사용성·접근성·세션 관리 5건을 더한다 — 답변 복사(마크다운/평문 듀얼) · 에러 재시도(한국어 분기) · 자동 스크롤(IntersectionObserver + floating "↓ 새 응답") · 세션 타임아웃 4시간 자동 분리 · 동적 SUGGESTIONS(상태 분기). 서버 인프라(파일 첨부 · 음성 받아쓰기)는 별도 M7 plan으로 분리. M6는 클라이언트 단독 — 마이그레이션 0건, env 추가 0건.

**Architecture:** ChatUI.tsx 한 곳에 5건 점진 통합 + 책임별 컴포넌트/util 분리 (CopyButton · ErrorBanner · session-timeout util · suggestions util · markdown util). dodo-planet `useChat.ts:122-145`(4h 타임아웃) + `MessageBubble.tsx:64-100`(CopyButton 듀얼) + `utils.ts:9-42`(markdownToPlainText) 패턴 차용 — webfortd context(AI SDK v6 useChat · threadIdRef · 비로그인 분기)에 맞게 변형. M6.3 자동 스크롤은 dodo-planet에는 없음(직접 설계). 세션 타임아웃은 `chat_threads.updated_at` 그대로 활용 — 0010 `bump_thread_updated_at` 트리거가 chat_messages INSERT 시 자동 갱신하므로 신규 컬럼/마이그레이션 0건. spec §M6.4의 `last_message_at`은 의미상 `updated_at`을 가리키는 동의어로 처리.

**Tech Stack:** React 19 (useState · useRef · useEffect · useMemo · useCallback) · AI SDK v6 (`useChat` `onError` · 기존 `onFinish` 활용) · IntersectionObserver Web API (자동 스크롤 일시 정지) · `navigator.clipboard.writeText` (복사) · Vitest 부분 도입 (`tests/components/chat/**/*.test.tsx`, M5 source-card.test.tsx 동일 구조) · node:test (util 단위) · lucide-react `Copy`/`Check`/`AlertCircle`/`RefreshCw`/`ArrowDown` 아이콘 (이미 deps)

---

## 0. Context (zero-context 엔지니어용 짧은 브리핑)

**webfortd 정체성**: 장교조의 장애인교원 정책 지식베이스 + RAG 채팅. 위원장 시각장애. 시범 모델이지만 교육부-중부대 사업 자문 근거 자산. 접근성은 협상 불가. 시각장애인 사용자가 핵심 타깃 ⇒ 모든 신규 인터랙션은 키보드 + 스크린리더 + aria-live 의무.

**M5 머지 완료 상태 (master `b4193c5` PR #34 + 후속 `9510ba5`/`446f808`)**:
- `chat_threads`/`chat_messages` 테이블 + RLS + 0010 트리거(`bump_thread_updated_at` — chat_messages INSERT 시 chat_threads.updated_at = now())
- `/api/chat` Route Handler가 로그인 사용자 대화를 service_role RPC로 DB 저장 (`onFinish`)
- `/api/chat/threads` GET — 본인 thread 최신 20건 (id · title · updated_at)
- `ThreadDrawer` shadcn Sheet 드로어 (로그인 시만)
- `ChatUI`는 `useChat({ transport: new DefaultChatTransport({ prepareSendMessagesRequest }) })` + `threadIdRef` + `onFinish`로 신규 thread metadata 받음
- 비로그인은 useState 휘발 + 안내 배너만
- AI Elements: `Conversation` / `Message` / `MessageContent` / `MessageResponse` / `PromptInput` / `Suggestion`

**M6의 역할**: M5까지가 "기본 구조 + 저장"이라면 M6는 "일상 사용성 + 접근성 보강". 5건 모두 클라이언트 단독, 서버 영향 0건. 다음 M7(파일 첨부 · 음성 받아쓰기)이 서버 라우터 추가로 분리됨.

**spec**: `docs/superpowers/specs/2026-05-24-phase-3-m6-m7-chat-ux-enhancements.md` (PR #36 `446f808`)
- §1 결정 잠금 Q1=C · Q2=a · Q3=Y · Q4=II + D1~D11
- §2 M6 — 본 plan 범위
- §3 M7 — 분리 (별도 plan)
- §4 접근성 spec
- §5 PIPA/보안 (M6는 클라이언트 단독이라 신규 데이터 흐름 없음)

**중요 invariant** (M6에서도 유지):
- `kb:publish:dry-run` baseline `535 / 8 / 527` 변동 0 (M6는 KB 데이터 layer 무관)
- `next build` 568 정적 페이지 + `/api/chat` ƒ + `/api/chat/threads` ƒ + `/api/cron/cleanup-chats` ƒ 그대로
- M5 unit/components/integration baseline 그린 유지
- 마이그레이션 0건, env 추가 0건 (M7에서 `DEEPGRAM_API_KEY` 등 등록)
- 시각장애인 사용자 우선 — 모든 신규 UI 인터랙션은 키보드 + aria-live + role 검증

**dodo-planet 자산 출처** (spec §0 자산 출처 표):
- `~/Mac-Projects/dodo-planet/src/hooks/useChat.ts:122-145` — `SESSION_TIMEOUT_MS = 4*60*60*1000` 4시간 분리 패턴
- `~/Mac-Projects/dodo-planet/src/hooks/useChat.ts:50-56, 407-413` — `FailedMessage` state + `retryLastMessage()` callback
- `~/Mac-Projects/dodo-planet/src/components/chat/MessageBubble.tsx:64-100` — CopyButton 듀얼 + aria-live announcer + modal
- `~/Mac-Projects/dodo-planet/src/lib/utils.ts:9-42` — `markdownToPlainText` 정규식 기반
- (M6.3 자동 스크롤은 dodo-planet에 미존재 — 직접 설계)
- (M6.5 동적 SUGGESTIONS는 dodo-planet `getSuggestions(tripPhase)` 패턴 차용 — webfortd 분기 매트릭스로 재설계)

---

## 1. File Structure

### 신규 파일

| 파일 | 책임 |
|------|------|
| `src/lib/utils/markdown.ts` | `markdownToPlainText(md: string): string` — dodo-planet 그대로 복사 (정규식 기반: heading/list/link/bold/italic/code block 제거) |
| `src/components/chat/CopyButton.tsx` | 마크다운/평문 듀얼 복사 — `navigator.clipboard.writeText` + aria-live announcer + native modal (ESC 닫기). 모바일 항상 노출 / 데스크탑 hover · focus 노출 |
| `src/components/chat/ErrorBanner.tsx` | 한국어 에러 분기 메시지 + "다시 시도" 버튼 + role="alert". 분기 카피: retrieval 0건 · Gateway 5xx · validateUIMessages · 기타 |
| `src/lib/chat/session-timeout.ts` | `SESSION_TIMEOUT_MS = 4*60*60*1000` 상수 + `isStaleThread(updatedAt: string \| Date): boolean` util |
| `src/lib/chat/suggestions.ts` | `getSuggestions({ isAuthenticated, hasThread, lastAssistantAxis? }): string[]` — D6 분기 매트릭스 |
| `tests/lib/markdown.test.ts` | `markdownToPlainText` 7건 경계 케이스 (heading · list · link · bold · italic · code block · table) — node:test |
| `tests/lib/chat/session-timeout.test.ts` | `isStaleThread` 4시간 경계 ±1초 · 미래 timestamp · ISO string · Date 객체 — node:test |
| `tests/lib/chat/suggestions.test.ts` | 4 분기(비로그인 + 신규 / 로그인 + 신규 / 로그인 + 기존 / lastAssistantAxis 분기) — node:test |
| `tests/components/chat/copy-button.test.tsx` | clipboard mock + modal open/close + 듀얼 버튼 + aria-live announcer — Vitest |
| `tests/components/chat/error-banner.test.tsx` | 한국어 분기 메시지 · retry 동작 · role="alert" · 키보드 — Vitest |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/chat/ChatUI.tsx` | (a) assistant Message 우상단에 `<CopyButton content={...}>`. (b) `useChat` `onError` 핸들러로 `lastFailedMessage` state + `<ErrorBanner onRetry={...}>` 렌더. (c) `messagesEndRef` + `useEffect` scrollIntoView + `IntersectionObserver`로 일시 정지 + floating "↓ 새 응답" 버튼. (d) initialThreadId mount 시 `isStaleThread` 검사 → stale이면 `setThreadId(undefined)` + aria-live "새 대화를 시작해요". (e) SUGGESTIONS 상수 → `useMemo`로 `getSuggestions` 동적 호출. |

### 변경 없음 (확인용)

| 영역 | 이유 |
|------|------|
| `supabase/migrations/**` | M6는 마이그레이션 0건. 세션 타임아웃은 `chat_threads.updated_at`(0010 트리거 자동 갱신) 그대로 활용 |
| `src/app/api/chat/route.ts` · `src/app/api/chat/threads/route.ts` | 서버 응답 shape 변경 0건 (threads route는 이미 `updated_at` 반환 중 — spec §M6.4의 `last_message_at`은 동의어) |
| `.env.local` · `vercel.json` · `package.json` | 신규 의존성 0건. lucide-react · vitest · @testing-library 모두 기존 deps |

### 검증 명령 표

| 명령 | 목적 | 기대 baseline |
|------|------|---------------|
| `npm run test` | unit (node:test) — markdown / session-timeout / suggestions util | 기존 baseline + 신규 3 파일 그린 |
| `npm run test:components` | Vitest (CopyButton · ErrorBanner) | 기존 source-card.test.tsx + 신규 2 파일 그린 |
| `npm run test:integration` | RLS 통합 (`tests/migrations/**`) — M5 변동 없음 확인 | 기존 baseline 그대로 |
| `npm run build` | next build + content validate + sync | 568 정적 페이지 + 3 ƒ 그대로 |
| `npm run kb:publish:dry-run` | KB layer 무관 baseline | 535 / 8 / 527 변동 0 |
| `npm run lint` | ESLint | 0 warning (M6는 lucide 아이콘 신규 import만 추가) |

---

## 2. Tasks

### Task 1: `markdownToPlainText` util + 단위 테스트

**Files:**
- Create: `src/lib/utils/markdown.ts`
- Test: `tests/lib/markdown.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/lib/markdown.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { markdownToPlainText } from '@/lib/utils/markdown'

describe('markdownToPlainText', () => {
  it('헤딩 # 제거', () => {
    assert.equal(markdownToPlainText('# 제목\n본문'), '제목\n본문')
    assert.equal(markdownToPlainText('### H3'), 'H3')
  })

  it('bold/italic 제거', () => {
    assert.equal(markdownToPlainText('**굵게** 일반 *기울임*'), '굵게 일반 기울임')
    assert.equal(markdownToPlainText('__굵__과 _기_'), '굵과 기')
  })

  it('inline code 제거', () => {
    assert.equal(markdownToPlainText('`코드` 일반'), '코드 일반')
  })

  it('code block 본문만 보존', () => {
    assert.equal(
      markdownToPlainText('설명\n```ts\nconst x = 1\n```\n끝'),
      '설명\nconst x = 1\n끝',
    )
  })

  it('링크는 텍스트만 남김', () => {
    assert.equal(
      markdownToPlainText('자세히는 [위키](/wiki/foo)를 보세요'),
      '자세히는 위키를 보세요',
    )
  })

  it('list marker는 bullet으로', () => {
    assert.equal(markdownToPlainText('- 첫째\n- 둘째'), '• 첫째\n• 둘째')
    assert.equal(markdownToPlainText('1. 첫째\n2. 둘째'), '첫째\n둘째')
  })

  it('이미지는 alt만 남김', () => {
    assert.equal(markdownToPlainText('![대체 텍스트](/img.png)'), '대체 텍스트')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- --test-name-pattern markdownToPlainText`
Expected: FAIL — `@/lib/utils/markdown` cannot find module

- [ ] **Step 3: util 구현** (dodo-planet `src/lib/utils.ts:9-42` 그대로 복사)

```typescript
// src/lib/utils/markdown.ts
/**
 * Phase 3 M6 — 마크다운 → 평문 변환.
 *
 * dodo-planet `src/lib/utils.ts:9-42` 그대로. CopyButton 듀얼 모드에서 사용.
 * 정규식 기반이라 nested table·복잡한 GFM은 손실 가능 — webfortd 채팅 응답은
 * 단순 markdown(헤딩/리스트/링크/bold) 위주라 충분.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '')
      return code.trim()
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- --test-name-pattern markdownToPlainText`
Expected: PASS — 7 ok

- [ ] **Step 5: commit**

```bash
git add src/lib/utils/markdown.ts tests/lib/markdown.test.ts
git commit -m "feat(m6.1): markdownToPlainText util + 7 boundary tests"
```

---

### Task 2: `CopyButton` 컴포넌트 + Vitest

**Files:**
- Create: `src/components/chat/CopyButton.tsx`
- Test: `tests/components/chat/copy-button.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/components/chat/copy-button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CopyButton } from '@/components/chat/CopyButton'

describe('CopyButton (M6.1 답변 복사 듀얼)', () => {
  beforeEach(() => {
    // navigator.clipboard mock
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('렌더링 시 Copy 아이콘 버튼 노출', () => {
    render(<CopyButton content="# 제목\n본문" />)
    const button = screen.getByRole('button', { name: /응답 복사/ })
    expect(button).toBeInTheDocument()
  })

  it('버튼 클릭 시 modal 열림 — 평문/마크다운 두 버튼', () => {
    render(<CopyButton content="# 제목" />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /평문으로 복사/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /마크다운으로 복사/ })).toBeInTheDocument()
  })

  it('평문 클릭 시 markdownToPlainText 결과를 clipboard로', async () => {
    render(<CopyButton content="# 제목\n**굵게**" />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.click(screen.getByRole('button', { name: /평문으로 복사/ }))
    // markdownToPlainText("# 제목\n**굵게**") === "제목\n굵게"
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('제목\n굵게')
    })
  })

  it('마크다운 클릭 시 원본 그대로 clipboard로', async () => {
    const original = '# 제목\n**굵게**'
    render(<CopyButton content={original} />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.click(screen.getByRole('button', { name: /마크다운으로 복사/ }))
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(original)
    })
  })

  it('복사 후 aria-live announcer에 한국어 안내', async () => {
    render(<CopyButton content="텍스트" />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.click(screen.getByRole('button', { name: /마크다운으로 복사/ }))
    await vi.waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/복사되었어요/)
    })
  })

  it('ESC 키로 modal 닫힘', () => {
    render(<CopyButton content="텍스트" />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:components -- --reporter=verbose copy-button`
Expected: FAIL — `@/components/chat/CopyButton` cannot find module

- [ ] **Step 3: 컴포넌트 구현**

```tsx
// src/components/chat/CopyButton.tsx
'use client'

/**
 * Phase 3 M6.1 — 답변 복사 (마크다운/평문 듀얼).
 *
 * 패턴 출처: dodo-planet `src/components/chat/MessageBubble.tsx:64-100` CopyButton.
 * 변경점:
 *   - i18n 제거 (한국어 카피 고정)
 *   - shadcn Dialog 대신 native modal (deps 최소화, ESC 핸들러는 useEffect)
 *   - 모바일 항상 노출은 부모(ChatUI)의 wrapper className에서 처리
 *
 * 접근성:
 *   - 버튼 aria-label="응답 복사"
 *   - modal role="dialog" aria-modal="true" aria-labelledby
 *   - aria-live="polite" announcer (복사 직후 1.5초간 표시)
 *   - ESC로 닫힘 (window keydown listener)
 *   - 키보드 Tab — Copy 버튼 → 모달 평문 버튼 → 모달 마크다운 버튼 (focus order)
 */

import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { markdownToPlainText } from '@/lib/utils/markdown'

interface CopyButtonProps {
  /** 복사 대상 마크다운 본문 */
  content: string
}

export function CopyButton({ content }: CopyButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'markdown' | 'text' | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  // ESC로 modal 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  async function handleCopy(type: 'markdown' | 'text') {
    try {
      const text = type === 'markdown' ? content : markdownToPlainText(content)
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setOpen(false)
      setAnnouncement(
        type === 'markdown' ? '마크다운으로 복사되었어요' : '평문으로 복사되었어요',
      )
      setTimeout(() => {
        setCopied(null)
        setAnnouncement(null)
      }, 1500)
    } catch (err) {
      console.error('[CopyButton] clipboard write failed:', err)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="응답 복사"
        className={
          copied
            ? 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:bg-emerald-900 dark:text-emerald-200'
            : 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
        }
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {announcement && (
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-xs overflow-hidden rounded-xl bg-card text-card-foreground shadow-xl">
            <div className="flex items-center justify-center gap-2 p-5">
              <Copy className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 id="copy-modal-title" className="font-semibold text-foreground">
                복사 형식 선택
              </h2>
            </div>
            <div className="space-y-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => handleCopy('text')}
                className="w-full rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                평문으로 복사
              </button>
              <button
                type="button"
                onClick={() => handleCopy('markdown')}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                마크다운으로 복사
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:components -- copy-button`
Expected: PASS — 6 tests ok

- [ ] **Step 5: commit**

```bash
git add src/components/chat/CopyButton.tsx tests/components/chat/copy-button.test.tsx
git commit -m "feat(m6.1): CopyButton 듀얼 모드 + 6 Vitest"
```

---

### Task 3: ChatUI에 CopyButton 통합 (M6.1 완성)

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: 현 ChatUI Message 렌더 영역 확인**

ChatUI.tsx:159-183의 `messages.map` 블록에서 assistant 응답을 렌더하는 영역에 CopyButton을 추가한다. assistant 응답의 텍스트는 `m.parts` 중 `type === 'text'`인 part의 `text` 누적.

- [ ] **Step 2: import 추가 + 통합**

Edit `src/components/chat/ChatUI.tsx`:

`old_string`:
```tsx
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
```

`new_string`:
```tsx
import { CopyButton } from '@/components/chat/CopyButton'
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
```

`old_string`:
```tsx
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts?.map((part, i) => {
                      if (part.type === 'text') {
                        return m.role === 'assistant' ? (
                          <MessageResponse key={i}>{part.text}</MessageResponse>
                        ) : (
                          <span
                            key={i}
                            className="whitespace-pre-line"
                          >
                            {part.text}
                          </span>
                        )
                      }
                      return null
                    })}
                    {m.role === 'assistant' && sourceRefs.length > 0 && (
                      <SourceCard sources={sourceRefs} />
                    )}
                  </MessageContent>
                </Message>
              )
```

`new_string`:
```tsx
              // M6.1 — assistant 메시지 본문(text part만 join)을 CopyButton에 전달.
              const assistantText =
                m.role === 'assistant'
                  ? m.parts
                      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                      .map((p) => p.text)
                      .join('') ?? ''
                  : ''
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    <div className="group relative">
                      {m.parts?.map((part, i) => {
                        if (part.type === 'text') {
                          return m.role === 'assistant' ? (
                            <MessageResponse key={i}>{part.text}</MessageResponse>
                          ) : (
                            <span key={i} className="whitespace-pre-line">
                              {part.text}
                            </span>
                          )
                        }
                        return null
                      })}
                      {/* M6.1 — 데스크탑 hover/focus 노출, 모바일 항상 노출(sm:opacity-0 sm:group-hover:opacity-100) */}
                      {m.role === 'assistant' && assistantText && (
                        <div className="absolute right-0 top-0 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                          <CopyButton content={assistantText} />
                        </div>
                      )}
                    </div>
                    {m.role === 'assistant' && sourceRefs.length > 0 && (
                      <SourceCard sources={sourceRefs} />
                    )}
                  </MessageContent>
                </Message>
              )
```

- [ ] **Step 3: 빌드 + 회귀 검증**

Run: `npm run build && npm test && npm run test:components`
Expected: 568 페이지 + unit baseline + components baseline 모두 그린

- [ ] **Step 4: commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "feat(m6.1): ChatUI assistant 메시지 우상단에 CopyButton 통합"
```

---

### Task 4: `ErrorBanner` 컴포넌트 + Vitest

**Files:**
- Create: `src/components/chat/ErrorBanner.tsx`
- Test: `tests/components/chat/error-banner.test.tsx`

spec §D9 한국어 에러 분기:
- retrieval 0건: "관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요."
- Gateway 5xx: "응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요."
- validateUIMessages: "메시지 형식 오류가 발생했어요."
- 기타: "응답 생성 중 오류가 발생했어요. 다시 시도해 보세요."

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/components/chat/error-banner.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ErrorBanner } from '@/components/chat/ErrorBanner'

describe('ErrorBanner (M6.2 에러 재시도)', () => {
  it('role="alert"로 렌더', () => {
    render(<ErrorBanner error={new Error('whatever')} onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('retrieval 0건 분기 메시지', () => {
    render(
      <ErrorBanner
        error={new Error('관련 정책 문서를 찾지 못했어요')}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요/,
    )
  })

  it('Gateway 5xx (HTTP 502/503/504) 분기 메시지', () => {
    render(
      <ErrorBanner
        error={new Error('Gateway 503 Service Unavailable')}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요/,
    )
  })

  it('validateUIMessages 분기 메시지', () => {
    render(
      <ErrorBanner
        error={new Error('validateUIMessages: invalid shape')}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/메시지 형식 오류/)
  })

  it('알 수 없는 에러 fallback 메시지', () => {
    render(<ErrorBanner error={new Error('TypeError: x is undefined')} onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /응답 생성 중 오류가 발생했어요. 다시 시도해 보세요/,
    )
  })

  it('"다시 시도" 버튼 클릭 시 onRetry 호출', () => {
    const onRetry = vi.fn()
    render(<ErrorBanner error={new Error('any')} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:components -- error-banner`
Expected: FAIL — module not found

- [ ] **Step 3: 컴포넌트 구현**

```tsx
// src/components/chat/ErrorBanner.tsx
'use client'

/**
 * Phase 3 M6.2 — 한국어 에러 분기 + 재시도 버튼.
 *
 * 분기 매트릭스 (spec §D9):
 *   - retrieval 0건: "관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요."
 *   - Gateway 5xx: "응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요."
 *   - validateUIMessages: "메시지 형식 오류가 발생했어요."
 *   - 기타: "응답 생성 중 오류가 발생했어요. 다시 시도해 보세요."
 *
 * 접근성:
 *   - role="alert" — 시각장애인 사용자에게 즉시 낭독
 *   - "다시 시도" 버튼 44px 이상 (위원장 §접근성 원칙)
 *   - aria-label 명시 ("마지막 질문 다시 보내기")
 */

import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorBannerProps {
  error: Error
  onRetry: () => void
}

function classifyError(message: string): string {
  if (/관련 정책 문서를 찾지 못/.test(message)) {
    return '관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요.'
  }
  if (/Gateway|50[234]|Service Unavailable/i.test(message)) {
    return '응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요.'
  }
  if (/validateUIMessages|invalid shape|invalid messages/i.test(message)) {
    return '메시지 형식 오류가 발생했어요.'
  }
  return '응답 생성 중 오류가 발생했어요. 다시 시도해 보세요.'
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const friendly = classifyError(error.message)
  return (
    <div
      role="alert"
      className="my-2 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p>{friendly}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        aria-label="마지막 질문 다시 보내기"
        className="inline-flex min-h-11 items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        다시 시도
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:components -- error-banner`
Expected: PASS — 6 ok

- [ ] **Step 5: commit**

```bash
git add src/components/chat/ErrorBanner.tsx tests/components/chat/error-banner.test.tsx
git commit -m "feat(m6.2): ErrorBanner 한국어 분기 + 재시도 + 6 Vitest"
```

---

### Task 5: ChatUI에 lastFailedMessage state + retry 통합

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: import + state 추가**

Edit `src/components/chat/ChatUI.tsx`:

`old_string`:
```tsx
import { CopyButton } from '@/components/chat/CopyButton'
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
```

`new_string`:
```tsx
import { CopyButton } from '@/components/chat/CopyButton'
import { ErrorBanner } from '@/components/chat/ErrorBanner'
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
```

- [ ] **Step 2: useChat에 onError + lastFailedMessage state**

`old_string`:
```tsx
export function ChatUI({ initialThreadId }: ChatUIProps = {}) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  const inputRef = useRef<HTMLTextAreaElement>(null)
```

`new_string`:
```tsx
export function ChatUI({ initialThreadId }: ChatUIProps = {}) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  // M6.2 — 마지막 전송 실패 메시지 + 에러 객체 (재시도용)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [chatError, setChatError] = useState<Error | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
```

- [ ] **Step 3: useChat에 onError 추가**

`old_string`:
```tsx
    onFinish: ({ message }) => {
      // M5: 신규 thread 생성 시 server가 messageMetadata.threadId를 보낸다.
      const meta = message.metadata as AssistantMetadata | undefined
      if (meta?.threadId && !threadIdRef.current) {
        setThreadId(meta.threadId)
        // SWR 사이드바 즉시 갱신 (revalidateOnFocus 기다리지 않음)
        void mutate('/api/chat/threads')
      }
    },
  })
```

`new_string`:
```tsx
    onFinish: ({ message }) => {
      // M5: 신규 thread 생성 시 server가 messageMetadata.threadId를 보낸다.
      const meta = message.metadata as AssistantMetadata | undefined
      if (meta?.threadId && !threadIdRef.current) {
        setThreadId(meta.threadId)
        // SWR 사이드바 즉시 갱신 (revalidateOnFocus 기다리지 않음)
        void mutate('/api/chat/threads')
      }
      // M6.2 — 성공 시 에러 상태 클리어
      setLastFailedMessage(null)
      setChatError(null)
    },
    onError: (error) => {
      // M6.2 — onError는 useChat이 status='error'일 때 호출. lastFailedMessage는
      // send()에서 미리 저장해두므로 여기서는 Error 객체만 추가 저장.
      setChatError(error instanceof Error ? error : new Error(String(error)))
    },
  })
```

- [ ] **Step 4: send 함수에 lastFailedMessage 저장**

`old_string`:
```tsx
  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    sendMessage({ text: trimmed })
    setInput('')
    inputRef.current?.focus()
  }
```

`new_string`:
```tsx
  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    // M6.2 — 전송 시점에 저장. onError 발화 시 retry 가능
    setLastFailedMessage(trimmed)
    setChatError(null)
    sendMessage({ text: trimmed })
    setInput('')
    inputRef.current?.focus()
  }

  // M6.2 — 마지막 실패 메시지를 동일 threadId로 재전송
  function retryLast() {
    if (!lastFailedMessage) return
    const text = lastFailedMessage
    setChatError(null)
    sendMessage({ text })
    inputRef.current?.focus()
  }
```

- [ ] **Step 5: ErrorBanner 렌더 (Conversation 하단 · PromptInput 위)**

`old_string`:
```tsx
      {/* 비로그인 사용자에게만 휘발 안내 — 로그인 후엔 DB 저장이라 안내 불요 */}
      {!user && (
```

`new_string`:
```tsx
      {/* M6.2 — 에러 발생 시 한국어 분기 + 재시도 버튼 */}
      {chatError && lastFailedMessage && (
        <ErrorBanner error={chatError} onRetry={retryLast} />
      )}

      {/* 비로그인 사용자에게만 휘발 안내 — 로그인 후엔 DB 저장이라 안내 불요 */}
      {!user && (
```

- [ ] **Step 6: 빌드 + 회귀 검증**

Run: `npm run build && npm test && npm run test:components`
Expected: 568 페이지 + unit + components 모두 그린

- [ ] **Step 7: commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "feat(m6.2): ChatUI lastFailedMessage state + onError + ErrorBanner 통합"
```

---

### Task 6: 자동 스크롤 + floating "↓ 새 응답" 버튼 (M6.3)

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

설계:
- `messagesEndRef`: Conversation 마지막 요소에 부착
- `useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])`
- `IntersectionObserver`로 messagesEndRef 가시성 추적
- 가시성 손실 + 새 메시지 도착 → floating "↓ 새 응답" 버튼 우하단에 노출
- 버튼 클릭 → scrollIntoView + 가시성 회복으로 자동 닫힘

- [ ] **Step 1: import + state + ref 추가**

Edit `src/components/chat/ChatUI.tsx`:

`old_string`:
```tsx
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState } from 'react'
import { mutate } from 'swr'
```

`new_string`:
```tsx
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { mutate } from 'swr'
```

`old_string`:
```tsx
  // M6.2 — 마지막 전송 실패 메시지 + 에러 객체 (재시도용)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [chatError, setChatError] = useState<Error | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
```

`new_string`:
```tsx
  // M6.2 — 마지막 전송 실패 메시지 + 에러 객체 (재시도용)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [chatError, setChatError] = useState<Error | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // M6.3 — 자동 스크롤 + 사용자 위로 스크롤 감지
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showJumpButton, setShowJumpButton] = useState(false)
```

- [ ] **Step 2: IntersectionObserver + 자동 스크롤 effect 추가**

`old_string`:
```tsx
  // threadId를 ref로 보관 — useChat transport는 1회 instantiate되지만
  // prepareSendMessagesRequest 콜백에서 매 send마다 최신 ref 값을 읽어 stale 회피.
  const threadIdRef = useRef(threadId)
  useEffect(() => {
    threadIdRef.current = threadId
  }, [threadId])
```

`new_string`:
```tsx
  // threadId를 ref로 보관 — useChat transport는 1회 instantiate되지만
  // prepareSendMessagesRequest 콜백에서 매 send마다 최신 ref 값을 읽어 stale 회피.
  const threadIdRef = useRef(threadId)
  useEffect(() => {
    threadIdRef.current = threadId
  }, [threadId])

  // M6.3 — messagesEndRef 가시성 추적 (사용자가 위로 스크롤하면 false)
  useEffect(() => {
    const target = messagesEndRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting)
        if (entry.isIntersecting) setShowJumpButton(false)
      },
      { threshold: 0.1 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
```

- [ ] **Step 3: messages 변경 시 자동 스크롤 또는 jump button 노출**

`onFinish` 위 또는 별도 useEffect 위치에 추가. ChatUI 함수 본체 안, `const isLoading = ...` 바로 위:

`old_string`:
```tsx
  const isLoading = status === 'submitted' || status === 'streaming'
```

`new_string`:
```tsx
  // M6.3 — 새 메시지마다 (a) 바닥에 있으면 자동 스크롤, (b) 위로 올라가있으면 jump button
  useEffect(() => {
    if (messages.length === 0) return
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      setShowJumpButton(true)
    }
  }, [messages, isAtBottom])

  const isLoading = status === 'submitted' || status === 'streaming'
```

- [ ] **Step 4: messagesEndRef 부착 + floating 버튼 렌더**

ConversationContent 내부 끝에 `<div ref={messagesEndRef} />` 추가, ChatUI 컨테이너 우하단에 floating 버튼.

`old_string`:
```tsx
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
              <Spinner aria-label="응답을 작성하고 있어요" />
              <span>응답을 작성하고 있어요…</span>
            </div>
          )}
        </ConversationContent>
      </Conversation>
```

`new_string`:
```tsx
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
              <Spinner aria-label="응답을 작성하고 있어요" />
              <span>응답을 작성하고 있어요…</span>
            </div>
          )}
          {/* M6.3 — IntersectionObserver target */}
          <div ref={messagesEndRef} aria-hidden="true" className="h-px" />
        </ConversationContent>
      </Conversation>

      {/* M6.3 — 사용자가 위로 스크롤한 상태에서 새 응답 도착 시 floating 버튼 */}
      {showJumpButton && (
        <button
          type="button"
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            setShowJumpButton(false)
          }}
          aria-label="최신 응답으로 이동"
          className="fixed bottom-24 right-6 z-30 inline-flex h-11 min-w-11 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          새 응답
        </button>
      )}
```

- [ ] **Step 5: 빌드 + 회귀 검증**

Run: `npm run build && npm test && npm run test:components`
Expected: 568 페이지 + 모두 그린

> **Note**: M6.3 자동 스크롤은 spec §M6.3 "JSDOM IntersectionObserver mock 한계"에 따라 자동 테스트 생략, 위원장 수동 검수 + Chrome MCP에서 검증.

- [ ] **Step 6: commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "feat(m6.3): 자동 스크롤 + IntersectionObserver + floating 새 응답 버튼"
```

---

### Task 7: `session-timeout` util + 단위 테스트 (M6.4 준비)

**Files:**
- Create: `src/lib/chat/session-timeout.ts`
- Test: `tests/lib/chat/session-timeout.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/lib/chat/session-timeout.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SESSION_TIMEOUT_MS, isStaleThread } from '@/lib/chat/session-timeout'

describe('session-timeout', () => {
  it('SESSION_TIMEOUT_MS = 4시간', () => {
    assert.equal(SESSION_TIMEOUT_MS, 4 * 60 * 60 * 1000)
  })

  it('updatedAt이 5분 전 — stale 아님 (false)', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    assert.equal(isStaleThread(fiveMinAgo), false)
  })

  it('updatedAt이 4시간 1초 전 — stale (true)', () => {
    const justOver = new Date(
      Date.now() - (4 * 60 * 60 * 1000 + 1000),
    ).toISOString()
    assert.equal(isStaleThread(justOver), true)
  })

  it('updatedAt이 3시간 59분 전 — stale 아님 (false)', () => {
    const justUnder = new Date(
      Date.now() - (3 * 60 * 60 * 1000 + 59 * 60 * 1000),
    ).toISOString()
    assert.equal(isStaleThread(justUnder), false)
  })

  it('Date 객체 입력도 지원', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    assert.equal(isStaleThread(oneHourAgo), false)
  })

  it('미래 timestamp (clock skew) — stale 아님 (false)', () => {
    const future = new Date(Date.now() + 60 * 1000).toISOString()
    assert.equal(isStaleThread(future), false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- --test-name-pattern session-timeout`
Expected: FAIL — module not found

- [ ] **Step 3: util 구현**

```typescript
// src/lib/chat/session-timeout.ts
/**
 * Phase 3 M6.4 — 채팅 세션 4시간 자동 분리.
 *
 * 출처: dodo-planet `src/hooks/useChat.ts:126` `SESSION_TIMEOUT_MS`.
 * webfortd 사용: ChatUI mount 시 initialThreadId의 updated_at을 fetch해서
 * isStaleThread() true면 신규 thread로 분기 (이전 thread는 drawer에 그대로 유지).
 *
 * 4시간 = 위원장 1차 결정. 정책 안내 컨텍스트는 더 길게 유지 검토 carry (8/12/24h).
 */

export const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000

/**
 * thread의 마지막 활동 시점(`updated_at`)이 SESSION_TIMEOUT_MS를 초과했는지.
 * 미래 timestamp(clock skew)는 stale 아님으로 처리 (false).
 */
export function isStaleThread(updatedAt: string | Date): boolean {
  const lastMs =
    typeof updatedAt === 'string' ? Date.parse(updatedAt) : updatedAt.getTime()
  if (Number.isNaN(lastMs)) return false
  const now = Date.now()
  const elapsed = now - lastMs
  if (elapsed < 0) return false // 미래 timestamp — clock skew, stale 아님
  return elapsed > SESSION_TIMEOUT_MS
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- --test-name-pattern session-timeout`
Expected: PASS — 6 ok

- [ ] **Step 5: commit**

```bash
git add src/lib/chat/session-timeout.ts tests/lib/chat/session-timeout.test.ts
git commit -m "feat(m6.4): SESSION_TIMEOUT_MS 4h + isStaleThread util + 6 boundary tests"
```

---

### Task 8: ChatUI에 세션 타임아웃 검사 통합 (M6.4 완성)

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

설계:
- initialThreadId가 있을 때만 검사 (없으면 어차피 신규)
- mount 시 `/api/chat/threads` fetch (이미 ThreadDrawer가 SWR 사용 중 — 동일 endpoint 호출은 dedupe)
- 해당 thread의 `updated_at`을 isStaleThread()로 검사
- stale이면 `setThreadId(undefined)` + `setStaleAnnouncement('새 대화를 시작해요. 이전 대화는 사이드바에 그대로 남아 있어요.')` aria-live
- 1.5초 후 announcement 클리어

- [ ] **Step 1: import 추가**

Edit `src/components/chat/ChatUI.tsx`:

`old_string`:
```tsx
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
import { useAuth } from '@/contexts/AuthContext'
import type { SourceRef } from '@/lib/rag/types'
```

`new_string`:
```tsx
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
import { useAuth } from '@/contexts/AuthContext'
import { isStaleThread } from '@/lib/chat/session-timeout'
import type { SourceRef } from '@/lib/rag/types'
```

- [ ] **Step 2: announcement state 추가**

`old_string`:
```tsx
  // M6.3 — 자동 스크롤 + 사용자 위로 스크롤 감지
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showJumpButton, setShowJumpButton] = useState(false)
```

`new_string`:
```tsx
  // M6.3 — 자동 스크롤 + 사용자 위로 스크롤 감지
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showJumpButton, setShowJumpButton] = useState(false)
  // M6.4 — 세션 타임아웃 안내 (aria-live)
  const [staleAnnouncement, setStaleAnnouncement] = useState<string | null>(null)
```

- [ ] **Step 3: mount effect — initialThreadId의 updated_at 검사**

threadIdRef effect 다음에 추가:

`old_string`:
```tsx
  // M6.3 — messagesEndRef 가시성 추적 (사용자가 위로 스크롤하면 false)
  useEffect(() => {
    const target = messagesEndRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting)
        if (entry.isIntersecting) setShowJumpButton(false)
      },
      { threshold: 0.1 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
```

`new_string`:
```tsx
  // M6.3 — messagesEndRef 가시성 추적 (사용자가 위로 스크롤하면 false)
  useEffect(() => {
    const target = messagesEndRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting)
        if (entry.isIntersecting) setShowJumpButton(false)
      },
      { threshold: 0.1 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  // M6.4 — initialThreadId mount 시 4시간 초과 검사. stale이면 신규 thread로 분기.
  // 이전 thread는 ThreadDrawer에 그대로 유지 (사용자가 명시 선택해야 재진입).
  useEffect(() => {
    if (!initialThreadId || !user) return
    let cancelled = false
    fetch('/api/chat/threads')
      .then((r) => r.json())
      .then((data: { threads?: Array<{ id: string; updated_at: string }> }) => {
        if (cancelled) return
        const current = data.threads?.find((t) => t.id === initialThreadId)
        if (current && isStaleThread(current.updated_at)) {
          setThreadId(undefined)
          setStaleAnnouncement(
            '새 대화를 시작해요. 이전 대화는 사이드바에 그대로 남아 있어요.',
          )
          setTimeout(() => setStaleAnnouncement(null), 4000)
        }
      })
      .catch((err) => console.error('[ChatUI] M6.4 stale check failed:', err))
    return () => {
      cancelled = true
    }
    // initialThreadId/user는 mount 1회 검사 — 이후 사용자 thread 전환은 page reload(handleThreadSelect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 4: announcement aria-live 렌더 추가**

ErrorBanner 위 또는 비로그인 안내 위:

`old_string`:
```tsx
      {/* M6.2 — 에러 발생 시 한국어 분기 + 재시도 버튼 */}
      {chatError && lastFailedMessage && (
        <ErrorBanner error={chatError} onRetry={retryLast} />
      )}
```

`new_string`:
```tsx
      {/* M6.4 — 세션 타임아웃 안내 (aria-live polite) */}
      {staleAnnouncement && (
        <div
          role="status"
          aria-live="polite"
          className="mb-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100"
        >
          {staleAnnouncement}
        </div>
      )}

      {/* M6.2 — 에러 발생 시 한국어 분기 + 재시도 버튼 */}
      {chatError && lastFailedMessage && (
        <ErrorBanner error={chatError} onRetry={retryLast} />
      )}
```

- [ ] **Step 5: 빌드 + 회귀 검증**

Run: `npm run build && npm test && npm run test:components`
Expected: 568 페이지 + 모두 그린

- [ ] **Step 6: commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "feat(m6.4): ChatUI initialThreadId 4시간 stale 검사 + aria-live 안내"
```

---

### Task 9: 동적 SUGGESTIONS util + 단위 테스트

**Files:**
- Create: `src/lib/chat/suggestions.ts`
- Test: `tests/lib/chat/suggestions.test.ts`

spec §D6 분기:
- 비로그인 + 신규 thread: 현재 3개 유지 ("특수 마우스" / "편의지원 조례" / "학교생활기록부 비교과")
- 로그인 + 신규 thread: 진입 유도성 추천 ("최근 살펴본 정책 더 묻기" / "비슷한 사례 더 보기" 류)
- 로그인 + 기존 thread (lastAssistantAxis 있을 때): axis별 인접 슬러그 후보 (M6에서는 axis 기반 정적 추천만, 실 RAG 인접 슬러그는 M7 carry)

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/lib/chat/suggestions.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getSuggestions } from '@/lib/chat/suggestions'

describe('getSuggestions (M6.5 분기 매트릭스)', () => {
  it('비로그인 + 신규 thread — 기본 3개', () => {
    const result = getSuggestions({ isAuthenticated: false, hasThread: false })
    assert.equal(result.length, 3)
    assert.ok(result.some((s) => s.includes('특수 마우스')))
    assert.ok(result.some((s) => s.includes('편의지원 조례')))
    assert.ok(result.some((s) => s.includes('학교생활기록부')))
  })

  it('로그인 + 신규 thread — 진입 유도 3개', () => {
    const result = getSuggestions({ isAuthenticated: true, hasThread: false })
    assert.equal(result.length, 3)
    // 기본 3개와 달라야 함 (분기 확인)
    assert.notDeepEqual(
      result,
      getSuggestions({ isAuthenticated: false, hasThread: false }),
    )
  })

  it('로그인 + 기존 thread + axis=policies — 정책 인접 추천', () => {
    const result = getSuggestions({
      isAuthenticated: true,
      hasThread: true,
      lastAssistantAxis: 'policies',
    })
    assert.equal(result.length, 3)
    // axis별 분기 확인 — policies 키워드가 하나 이상 포함
    assert.ok(
      result.some((s) => /정책|제도|규정/.test(s)),
      `policies 추천에 정책 키워드 누락: ${JSON.stringify(result)}`,
    )
  })

  it('로그인 + 기존 thread + axis=disability-types — 장애 유형 인접', () => {
    const result = getSuggestions({
      isAuthenticated: true,
      hasThread: true,
      lastAssistantAxis: 'disability-types',
    })
    assert.equal(result.length, 3)
    assert.ok(
      result.some((s) => /장애|유형|진단/.test(s)),
      `disability-types 추천에 장애 키워드 누락: ${JSON.stringify(result)}`,
    )
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- --test-name-pattern getSuggestions`
Expected: FAIL — module not found

- [ ] **Step 3: util 구현**

```typescript
// src/lib/chat/suggestions.ts
/**
 * Phase 3 M6.5 — 동적 SUGGESTIONS 분기.
 *
 * spec §D6 분기 매트릭스:
 *   - 비로그인 + 신규: 기본 3개 (특수 마우스 / 편의지원 조례 / 학교생활기록부)
 *   - 로그인 + 신규: 진입 유도 3개
 *   - 로그인 + 기존 thread: lastAssistantAxis별 인접 정책 키워드 추천
 *
 * 실제 RAG 인접 슬러그 매핑은 M7 carry — M6는 정적 axis 분기로 시작.
 */

export interface SuggestionContext {
  isAuthenticated: boolean
  /** 활성 thread 보유 여부 (로그인 + DB에 messages 있음) */
  hasThread: boolean
  /** 가장 최근 assistant 응답의 sourceRefs[0].axis (예: 'policies' · 'disability-types' · 'regions' · 'agreements' · 'resources' · 'domains') */
  lastAssistantAxis?: string
}

const DEFAULT_ANON: readonly string[] = [
  '특수 마우스에는 어떤 종류가 있나요?',
  '편의지원 조례를 제정한 시도교육청은 어디인가요?',
  '학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?',
]

const AUTH_NEW: readonly string[] = [
  '제가 받을 수 있는 보조인력 지원은 무엇인가요?',
  '비슷한 사례의 장애인교원은 어떻게 대응했나요?',
  '제 지역(시도)의 편의지원 제도를 알려주세요',
]

const AXIS_RECOMMENDATIONS: Record<string, readonly string[]> = {
  policies: [
    '이 정책의 신청 절차를 더 자세히 알려주세요',
    '관련된 다른 규정도 함께 보고 싶어요',
    '실제 적용 사례가 있는지 궁금해요',
  ],
  'disability-types': [
    '같은 장애 유형의 다른 교원 사례를 보여주세요',
    '이 장애 유형에 대한 진단·인정 기준이 궁금해요',
    '관련 보조공학기기 추천이 있나요?',
  ],
  regions: [
    '이 지역의 편의지원 조례 전문을 알려주세요',
    '인근 시도와 비교했을 때 차이가 있나요?',
    '해당 교육청에 직접 문의할 창구는 어디인가요?',
  ],
  agreements: [
    '같은 단체협약의 다른 조항도 보고 싶어요',
    '단체협약 적용 범위가 어디까지인가요?',
    '협약 위반 시 구제 절차는 어떻게 되나요?',
  ],
  resources: [
    '관련된 다른 자료가 더 있나요?',
    '이 자료를 어디서 인용·인쇄할 수 있나요?',
    '유사 자료를 추천해 주세요',
  ],
  domains: [
    '이 분야의 핵심 제도를 정리해 주세요',
    '이 분야에서 자주 묻는 질문이 무엇인가요?',
    '관련된 단체협약·조례가 있나요?',
  ],
}

const AXIS_FALLBACK: readonly string[] = [
  '관련된 다른 정책도 함께 알려주세요',
  '실제 적용 사례를 들려주세요',
  '제도를 신청하려면 어디로 문의해야 하나요?',
]

export function getSuggestions(ctx: SuggestionContext): string[] {
  if (!ctx.isAuthenticated) return [...DEFAULT_ANON]
  if (!ctx.hasThread) return [...AUTH_NEW]
  const axisList = ctx.lastAssistantAxis
    ? AXIS_RECOMMENDATIONS[ctx.lastAssistantAxis]
    : undefined
  return axisList ? [...axisList] : [...AXIS_FALLBACK]
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- --test-name-pattern getSuggestions`
Expected: PASS — 4 ok

- [ ] **Step 5: commit**

```bash
git add src/lib/chat/suggestions.ts tests/lib/chat/suggestions.test.ts
git commit -m "feat(m6.5): getSuggestions 분기 매트릭스 (비로그인/로그인/axis) + 4 tests"
```

---

### Task 10: ChatUI SUGGESTIONS 동적 통합 (M6.5 완성)

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: import + 상수 제거 + useMemo로 동적 계산**

Edit `src/components/chat/ChatUI.tsx`:

`old_string`:
```tsx
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { mutate } from 'swr'
```

`new_string`:
```tsx
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { mutate } from 'swr'
```

`old_string`:
```tsx
import { isStaleThread } from '@/lib/chat/session-timeout'
import type { SourceRef } from '@/lib/rag/types'

const SUGGESTIONS = [
  '특수 마우스에는 어떤 종류가 있나요?',
  '편의지원 조례를 제정한 시도교육청은 어디인가요?',
  '학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?',
] as const
```

`new_string`:
```tsx
import { isStaleThread } from '@/lib/chat/session-timeout'
import { getSuggestions } from '@/lib/chat/suggestions'
import type { SourceRef } from '@/lib/rag/types'
```

- [ ] **Step 2: useMemo로 suggestions 계산**

`old_string`:
```tsx
  const isLoading = status === 'submitted' || status === 'streaming'
```

`new_string`:
```tsx
  const isLoading = status === 'submitted' || status === 'streaming'

  // M6.5 — 마지막 assistant 응답의 첫 sourceRef axis로 분기.
  const lastAssistantAxis = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role !== 'assistant') continue
      const meta = m.metadata as AssistantMetadata | undefined
      const first = meta?.sourceRefs?.[0]
      if (first?.axis) return first.axis
    }
    return undefined
  }, [messages])

  const suggestions = useMemo(
    () =>
      getSuggestions({
        isAuthenticated: !!user,
        hasThread: !!threadId,
        lastAssistantAxis,
      }),
    [user, threadId, lastAssistantAxis],
  )
```

- [ ] **Step 3: SUGGESTIONS 참조를 suggestions 변수로 교체**

`old_string`:
```tsx
              <Suggestions aria-label="추천 질문" className="mt-6">
                {SUGGESTIONS.map((s) => (
                  <Suggestion
                    key={s}
                    suggestion={s}
                    onClick={() => send(s)}
                    className="min-h-11"
                  />
                ))}
              </Suggestions>
```

`new_string`:
```tsx
              <Suggestions aria-label="추천 질문" className="mt-6">
                {suggestions.map((s) => (
                  <Suggestion
                    key={s}
                    suggestion={s}
                    onClick={() => send(s)}
                    className="min-h-11"
                  />
                ))}
              </Suggestions>
```

- [ ] **Step 4: 빌드 + 회귀 검증**

Run: `npm run build && npm test && npm run test:components && npm run lint`
Expected: 모두 그린 + ESLint 0 warning

- [ ] **Step 5: commit**

```bash
git add src/components/chat/ChatUI.tsx
git commit -m "feat(m6.5): ChatUI 동적 SUGGESTIONS — getSuggestions 분기 + useMemo"
```

---

### Task 11: 회귀 통합 검증 + Vitest baseline 갱신

**Files:**
- (검증만)

- [ ] **Step 1: 전체 회귀**

Run: `npm run build`
Expected: `Generating static pages (568/568)` + `ƒ /api/chat` + `ƒ /api/chat/threads` + `ƒ /api/cron/cleanup-chats`

Run: `npm test`
Expected: 기존 baseline + 신규 3 unit 파일(markdown.test.ts · session-timeout.test.ts · suggestions.test.ts) = 신규 17건 추가 그린

Run: `npm run test:components`
Expected: 기존 source-card.test.tsx + 신규 2 파일(copy-button.test.tsx · error-banner.test.tsx) = 신규 12건 추가 그린

Run: `npm run test:integration`
Expected: M5 baseline 그대로 (M6는 마이그레이션 0건)

Run: `npm run kb:publish:dry-run`
Expected: `535 candidate / 8 passing / 527 blocked` 변동 0

Run: `npm run lint`
Expected: 0 warning

- [ ] **Step 2: 위원장 수동 검수 시나리오 메모** (코드 변경 0건, 다음 task 머지 직전 위원장 명시 액션)

수동 검수 항목 — Chrome MCP 또는 위원장 모바일/데스크탑 VoiceOver:

1. **답변 복사 (M6.1)**: 응답 hover → Copy 아이콘 노출 → 클릭 → modal → 평문/마크다운 → 복사 후 Check 아이콘 + VoiceOver "복사되었어요" 낭독 + ESC로 닫힘
2. **에러 재시도 (M6.2)**: 인위적 에러 유도(예: 네트워크 끊고 전송) → ErrorBanner 한국어 분기 + role=alert 낭독 + "다시 시도" 클릭 → 정상 전송
3. **자동 스크롤 (M6.3)**: 긴 대화에서 위로 스크롤 → 새 응답 도착 → 자동 스크롤 멈춤 + floating "↓ 새 응답" 노출 → 클릭 → 바닥 이동 + floating 닫힘 + VoiceOver는 aria-live로 정상 낭독
4. **세션 타임아웃 (M6.4)**: 4시간 이전 thread URL 직접 접근 → 자동으로 신규 thread + "새 대화를 시작해요" aria-live + 이전 thread는 drawer에 남음
5. **동적 SUGGESTIONS (M6.5)**: 비로그인 → 기본 3개 / 로그인 신규 → 진입 유도 3개 / 로그인 기존 thread (assistant 응답 있음) → axis별 추천 3개

- [ ] **Step 3: commit** (검증만이라 no-op — Task 12에서 PR 본문에 검증 결과 명시)

---

### Task 12: PR 생성 + spec 충족 검증 + codex-rescue 트리거 메모

**Files:**
- (PR 생성)

- [ ] **Step 1: 브랜치 push**

```bash
git push -u origin phase-3-m6-chat-ui
```

- [ ] **Step 2: PR 생성 (head=phase-3-m6-chat-ui base=master)**

PR 본문 템플릿:

```markdown
## Summary
Phase 3 M6 — 채팅 UI 보완 5건 (spec §2 그대로). 클라이언트 단독, 마이그레이션 0건, env 추가 0건.

1. **답변 복사 (M6.1)**: `CopyButton` 마크다운/평문 듀얼 + `markdownToPlainText` util + aria-live announcer
2. **에러 재시도 (M6.2)**: `ErrorBanner` 한국어 분기 (retrieval 0건 · Gateway 5xx · validateUIMessages · 기타) + role="alert" + 재시도 버튼
3. **자동 스크롤 (M6.3)**: `IntersectionObserver` 가시성 추적 + floating "↓ 새 응답" 버튼 (44px)
4. **세션 타임아웃 4시간 (M6.4)**: `isStaleThread` util + initialThreadId mount 시 검사 → stale이면 신규 thread + aria-live 안내
5. **동적 SUGGESTIONS (M6.5)**: `getSuggestions` 분기 매트릭스 (비로그인 + 신규 / 로그인 + 신규 / 로그인 + 기존 axis별)

## spec 정합
- `docs/superpowers/specs/2026-05-24-phase-3-m6-m7-chat-ux-enhancements.md` PR #36 머지 `446f808`
- Q1=C / Q2=a / Q3=Y / Q4=II + D1~D11 잠금 그대로
- §M6.4의 `last_message_at`은 `chat_threads.updated_at`(0010 트리거 자동 갱신)으로 구현 — spec 의도 그대로, 신규 컬럼 불요

## Test Plan
- [ ] `npm run build` → 568 정적 페이지 + 3 ƒ 그대로
- [ ] `npm test` → 신규 17 unit 추가 (markdown 7 · session-timeout 6 · suggestions 4)
- [ ] `npm run test:components` → 신규 12 Vitest 추가 (CopyButton 6 · ErrorBanner 6)
- [ ] `npm run test:integration` → M5 baseline 변동 0
- [ ] `npm run kb:publish:dry-run` → 535/8/527 변동 0
- [ ] `npm run lint` → 0 warning
- [ ] 위원장 수동 검수 5건 (Task 11 Step 2)

## codex-rescue 포커스 (머지 직전)
- M6.1 CopyButton modal accessibility (focus trap · ESC · 키보드 Tab order)
- M6.2 ErrorBanner 분기 매트릭스 누락 케이스 — 추가 카피 필요한지
- M6.3 IntersectionObserver leak (cleanup 누락 여부 · ref nullify)
- M6.4 `/api/chat/threads` fetch race (mount 직후 + drawer SWR fetch 중복 — 같은 endpoint dedupe 의존)
- M6.5 axis 추천이 빈 배열인 axis name 들어왔을 때 fallback 정합
- 시각장애인 사용자 흐름(키보드 + VoiceOver) 전반

## 비고
- `last_message_at` 신규 컬럼 추가 없음 — `updated_at` 동의어 처리
- spec §M6.4 위원장 검토 후 4h → 8/12/24h 조정 가능. 본 PR은 4h로 잠금
```

- [ ] **Step 3: codex-rescue 동시 호출**

PR 생성 후 본 plan executing-plans 사용 시 마지막 step:
- `superpowers:code-reviewer` agent dispatch
- `codex:codex-rescue` agent dispatch

리뷰 결과는 위원장 보고 후 fix carry 결정 (즉시 패치 금지 — 글로벌 CLAUDE.md "동일 계층 반복 지적은 계층 선택 자체 의심" 원칙).

- [ ] **Step 4: 위원장 명시 머지 신호 대기**

위원장 검수 + 위 수동 5건 통과 + (선택) codex-rescue/coderabbit 보완 후 squash merge.

---

## 3. 최종 검증 체크리스트

머지 직전 한 번 더:

- [ ] `npm run build` 568 페이지 + `ƒ /api/chat` + `ƒ /api/chat/threads` + `ƒ /api/cron/cleanup-chats`
- [ ] `npm test` 신규 17 unit 모두 PASS
- [ ] `npm run test:components` 신규 12 Vitest 모두 PASS
- [ ] `npm run test:integration` M5 baseline 변동 0
- [ ] `npm run kb:publish:dry-run` 535/8/527 변동 0
- [ ] `npm run lint` 0 warning
- [ ] CHANGELOG/메모리 갱신 (PR squash 후 master commit hash 기록)
- [ ] 위원장 수동 5건 PASS
- [ ] codex-rescue + code-reviewer 합의 P0 0건

## 4. 후속 작업 (M6 머지 후)

1. **M7 plan 작성** — `docs/superpowers/plans/2026-05-24-phase-3-m7-attachment-voice.md`
   - 파일 첨부 (PDF/HWPX/HWP/이미지) + Upstage Document Parse + Gemini multimodal
   - 음성 받아쓰기 (Deepgram Nova-2)
   - Vercel env 등록 (`DEEPGRAM_API_KEY` 신규 + `UPSTAGE_API_KEY` 추가)
2. **위원장 톤 검수** — M6 머지 후 응답 톤(다정·명료) + UI 카피 전반 점검. 필요시 시스템 프롬프트 patch
3. **세션 타임아웃 4h → ?h 조정** — 위원장 실 사용 후 결정 (carry)
