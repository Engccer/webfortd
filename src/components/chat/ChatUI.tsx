'use client'

/**
 * Phase 3 M4 + M5 — RAG 채팅 UI.
 *
 * M4: ChatMockUI → useChat v6 + AI Elements MessageResponse markdown.
 * M5: 로그인 사용자의 대화를 DB(chat_threads/chat_messages)에 저장.
 *   - useChat body로 threadId 동봉 (prepareSendMessagesRequest로 동적 — stale 회피)
 *   - onFinish에서 message.metadata.threadId 받아 state 동기화 + SWR mutate
 *   - 로그인 시 좌측 ThreadDrawer 렌더 (비로그인은 안내 배너만)
 *   - drawer thread 선택 → window.location 새로고침 (page.tsx searchParams 경유)
 *
 * 접근성:
 *   - <Conversation> aria-live="polite" + aria-relevant="additions text" (codex P2)
 *   - 추천 클릭 후 inputRef focus handoff 보존
 *   - 비로그인 안내 배너 role="status"
 *   - <Spinner> role="status" + aria-label
 */

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { mutate } from 'swr'
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
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { Spinner } from '@/components/ui/spinner'
import { CopyButton } from '@/components/chat/CopyButton'
import { ErrorBanner } from '@/components/chat/ErrorBanner'
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
import { useAuth } from '@/contexts/AuthContext'
import { isStaleThread } from '@/lib/chat/session-timeout'
import type { SourceRef } from '@/lib/rag/types'

const SUGGESTIONS = [
  '특수 마우스에는 어떤 종류가 있나요?',
  '편의지원 조례를 제정한 시도교육청은 어디인가요?',
  '학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?',
] as const

interface AssistantMetadata {
  sourceRefs?: SourceRef[]
  threadId?: string
}

interface ChatUIProps {
  /** drawer 선택 시 page.tsx searchParams.thread → 새 thread로 mount */
  initialThreadId?: string
}

export function ChatUI({ initialThreadId }: ChatUIProps = {}) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  // M6.2 — 마지막 전송 실패 메시지 + 에러 객체 (재시도용)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [chatError, setChatError] = useState<Error | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // M6.3 — 자동 스크롤 + 사용자 위로 스크롤 감지
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showJumpButton, setShowJumpButton] = useState(false)
  // M6.4 — 세션 타임아웃 안내 (aria-live)
  const [staleAnnouncement, setStaleAnnouncement] = useState<string | null>(null)

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

  // useChat v6 — DefaultChatTransport. body는 정적 객체가 아닌 동적 콜백으로.
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages: msgs }) => ({
        body: {
          messages: msgs,
          ...(threadIdRef.current ? { threadId: threadIdRef.current } : {}),
        },
      }),
    }),
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
      // M6.2 — useChat이 status='error'일 때 호출. lastFailedMessage는 send()에서
      // 미리 저장해두므로 여기서는 Error 객체만 추가 저장.
      setChatError(error instanceof Error ? error : new Error(String(error)))
    },
  })

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

  function handleThreadSelect(id: string) {
    // 가장 단순한 thread 전환 — page reload로 새 useChat instance.
    // 더 정교한 router.replace + key remount는 M6 carry.
    if (typeof window !== 'undefined') {
      window.location.href = `/chat?thread=${encodeURIComponent(id)}`
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 sm:px-6">
      {/* 로그인 사용자만 ThreadDrawer 렌더 (비로그인은 drawer 자체 없음) */}
      {user && (
        <div className="mb-2 flex items-center justify-between">
          <ThreadDrawer
            currentThreadId={threadId}
            onSelect={handleThreadSelect}
          />
        </div>
      )}

      {/* aria-live="polite" — codex-rescue PR #31 P2 권고.
          AI Elements Conversation은 role="log"만 갖는다(implicit polite).
          VoiceOver 스트리밍 낭독을 확실히 보장하기 위해 명시. */}
      <Conversation
        aria-label="대화 내역"
        aria-live="polite"
        aria-relevant="additions text"
        className="flex-1"
      >
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
                    className="min-h-11"
                  />
                ))}
              </Suggestions>
            </div>
          ) : (
            messages.map((m) => {
              const metadata = m.metadata as AssistantMetadata | undefined
              const sourceRefs = metadata?.sourceRefs ?? []
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
                      {/* M6.1 — 데스크탑 hover/focus 노출, 모바일 항상 노출 */}
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
            })
          )}
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

      {/* 비로그인 사용자에게만 휘발 안내 — 로그인 후엔 DB 저장이라 안내 불요 */}
      {!user && (
        <p
          role="status"
          className="mt-2 mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          로그인하면 대화가 저장돼요. 지금은 새로고침하면 사라져요.
        </p>
      )}

      <PromptInput
        onSubmit={(message) => send(message.text)}
        aria-label="질문 입력"
        className="border-t border-border pt-3"
      >
        <PromptInputTextarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요…"
          disabled={isLoading}
        />
        <PromptInputSubmit
          status={status}
          aria-label="전송"
          disabled={!input.trim()}
        />
      </PromptInput>
    </div>
  )
}
