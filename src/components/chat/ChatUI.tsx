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
import { ArrowDown, Mic } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { AttachmentButton } from '@/components/chat/AttachmentButton'
import { AttachmentChip, type AttachmentStatus } from '@/components/chat/AttachmentChip'
import { CopyButton } from '@/components/chat/CopyButton'
import { ErrorBanner } from '@/components/chat/ErrorBanner'
import { SourceCard } from '@/components/chat/SourceCard'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton'
import { useAuth } from '@/contexts/AuthContext'
import { useChatCompletionFocus } from '@/hooks/useChatCompletionFocus'
import { isStaleThread } from '@/lib/chat/session-timeout'
import { getSuggestions } from '@/lib/chat/suggestions'
import type { SourceRef } from '@/lib/rag/types'
import { playChatReceiveSound, playChatSendSound } from '@/lib/sound'
import { warmupAudioStandalone } from '@/lib/voice/warmup'

// Phase 7 M4 — 음성 오버레이 지연 로드: @google/genai 훅 체인이 채팅 초기 번들에 들어가지
// 않도록 next/dynamic으로 분리. 오버레이 open 시점 로드 지연은 수용.
const VoiceChatOverlay = dynamic(
  () =>
    import('@/components/chat/VoiceChatOverlay').then((m) => m.VoiceChatOverlay),
  { ssr: false },
)

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
  // M7.2 — 파일 첨부 (동시 1개, spec §D3)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentStatus, setAttachmentStatus] = useState<AttachmentStatus>('idle')
  const [attachmentError, setAttachmentError] = useState<string | undefined>(undefined)
  // M7.1 patch — 음성 오류 별도 표시 (시각장애인 핵심: chatError와 분리해 항상 role="alert" 낭독)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  // Phase 7 M4 — 음성 라이브 채팅 오버레이 열림 상태
  const [voiceOpen, setVoiceOpen] = useState(false)

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
  const { messages, sendMessage, status, stop } = useChat({
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

  // 마지막 사용자 질문 id — 이 메시지의 헤딩에만 focus ref를 부착한다.
  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id
    }
    return undefined
  }, [messages])

  // 응답 완료 시: receive 효과음 + 마지막 질문 헤딩으로 포커스 이동 (접근성 핵심).
  const lastQueryRef = useChatCompletionFocus({
    isLoading,
    messageCount: messages.length,
    lastMessageRole: messages[messages.length - 1]?.role,
    onComplete: playChatReceiveSound,
  })

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

  async function send(text: string) {
    // 스트리밍 중 재전송 가드 — textarea를 disabled로 막는 대신 여기서 차단 (포커스 유지, WCAG 2.4.3)
    if (isLoading) return
    const trimmed = text.trim()
    if (!trimmed && !attachment) return
    // 전송 효과음 (accessibility.soundEnabled 게이트)
    playChatSendSound()
    // M6.2 — 전송 시점에 저장. onError 발화 시 retry 가능 (텍스트만)
    setLastFailedMessage(trimmed)
    setChatError(null)

    // M7.2 — 첨부 있으면 file part로 변환해 함께 전송
    if (attachment) {
      try {
        setAttachmentStatus('parsing')
        // M7.2 patch — FileReader.readAsDataURL 표준 패턴.
        // 이전: String.fromCharCode(...new Uint8Array(buffer)) spread는 1MB+에서 stack overflow.
        // FileReader는 브라우저 native 비동기 base64 인코더라 10MB까지 안전.
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result)
            else reject(new Error('FileReader 결과가 string이 아니에요'))
          }
          reader.onerror = () => reject(reader.error ?? new Error('FileReader 오류'))
          reader.readAsDataURL(attachment)
        })
        sendMessage({
          text: trimmed,
          files: [{ type: 'file', mediaType: attachment.type, url: dataUrl, filename: attachment.name }],
        })
        setAttachment(null)
        setAttachmentStatus('idle')
        setAttachmentError(undefined)
      } catch (err) {
        console.error('[ChatUI] attachment encoding 실패:', err)
        setAttachmentStatus('error')
        setAttachmentError('첨부 파일을 읽을 수 없어요.')
        return
      }
    } else {
      sendMessage({ text: trimmed })
    }
    setInput('')
    inputRef.current?.focus()
  }

  // M6.2 — 마지막 실패 메시지를 동일 threadId로 재전송
  function retryLast() {
    if (!lastFailedMessage) return
    const text = lastFailedMessage
    playChatSendSound()
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

      {/* 스트리밍 낭독은 Conversation 내부 role="log"(implicit aria-live=polite)가 담당.
          wrapper의 aria-live="polite"는 순수 중복, aria-relevant="additions text"는 기본값을
          덮어써 스트리밍 중 텍스트 변경까지 반복 낭독 → 둘 다 제거(미니멀 접근성). */}
      <Conversation
        aria-label="대화 내역"
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
                {suggestions.map((s) => (
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
              // 사용자 질문 본문(text part join) — 헤딩으로 렌더해 스크린리더 턴 탐색 + 응답 완료 포커스 타깃.
              const userText =
                m.role === 'user'
                  ? m.parts
                      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                      .map((p) => p.text)
                      .join('') ?? ''
                  : ''
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    <div className="group relative">
                      {m.role === 'user' ? (
                        // 사용자 질문 = 헤딩. 마지막 질문에만 focus ref 부착 (응답 완료 시 이동 타깃).
                        <h2
                          ref={m.id === lastUserMessageId ? lastQueryRef : null}
                          tabIndex={-1}
                          className="whitespace-pre-line text-base font-medium leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {userText}
                        </h2>
                      ) : (
                        m.parts?.map((part, i) =>
                          part.type === 'text' ? (
                            <MessageResponse key={i}>{part.text}</MessageResponse>
                          ) : null,
                        )
                      )}
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

      {/* M7.1 patch — 음성 오류 (시각장애인 핵심: 별도 role=alert, lastFailedMessage 조건 없음) */}
      {voiceError && (
        <div
          role="alert"
          className="my-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span className="flex-1">{voiceError}</span>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            aria-label="음성 오류 닫기"
            className="text-xs underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring"
          >
            닫기
          </button>
        </div>
      )}

      {/* M7.2 patch — 첨부 검증 실패 안내 (WCAG 3.3.1): 파일이 거부되면 attachment가
          null이라 AttachmentChip이 렌더되지 않음 — 칩과 무관하게 항상 보이는 role=alert로 표시 */}
      {attachmentError && !attachment && (
        <div
          role="alert"
          className="my-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span className="flex-1">{attachmentError}</span>
          <button
            type="button"
            onClick={() => {
              setAttachmentError(undefined)
              setAttachmentStatus('idle')
            }}
            aria-label="첨부 오류 닫기"
            className="text-xs underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring"
          >
            닫기
          </button>
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

      {/* M7.2 — 첨부 칩 (파일 선택됨 또는 에러 상태) */}
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

      <PromptInput
        onSubmit={(message) => void send(message.text)}
        className="border-t border-border pt-3"
      >
        <PromptInputTextarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요…"
          aria-label="질문 입력"
        />
        <div className="flex items-center gap-1">
          {/* M7.2 — 파일 첨부: 동시 1개 (spec §D3) */}
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
            disabled={isLoading || !!attachment}
          />
          {/* M7.1 — 음성 받아쓰기: 전사 텍스트는 input 뒤에 append. 오류는 voiceError(role=alert) */}
          <VoiceRecordButton
            onTranscribed={(text) => {
              setInput((prev) => (prev ? `${prev} ${text}` : text))
              setVoiceError(null)
            }}
            onError={(error) => setVoiceError(error)}
            disabled={isLoading}
          />
          {/* Phase 7 M4 — 음성 라이브 채팅 진입 버튼. 클릭 체인 내 AudioContext warmup 필수 (iOS Safari/Chrome Autoplay 정책) */}
          <button
            type="button"
            onClick={async () => {
              await warmupAudioStandalone()
              setVoiceOpen(true)
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50"
            disabled={isLoading}
          >
            <Mic aria-hidden className="h-5 w-5" />
            실시간 음성 대화
          </button>
          {/* 스트리밍/제출 중에는 중단 버튼으로 동작 (WCAG 4.1.2) — onStop은 prompt-input 내장 처리 */}
          <PromptInputSubmit
            status={status}
            onStop={stop}
            aria-label={isLoading ? '응답 중단' : '전송'}
            disabled={!isLoading && !input.trim() && !attachment}
          />
        </div>
      </PromptInput>

      {/* Phase 7 M4 — 음성 라이브 채팅 오버레이 */}
      <VoiceChatOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  )
}
