'use client'

/**
 * Phase 3 M4 — RAG 채팅 UI.
 *
 * M3 /api/chat Route Handler와 연결:
 *   - 스트리밍 응답 (toUIMessageStreamResponse)
 *   - messageMetadata.sourceRefs로 출처 5개 전달
 *
 * M5 carry-over (별도 PR):
 *   - threadId/userId body, onFinish DB 저장, ThreadDrawer
 *   - 본 PR은 비로그인 useState 휘발 모드만 + 안내 배너 1줄
 *
 * 접근성 (위원장 톤 검수 게이트):
 *   - <Conversation> 컨테이너 aria-label
 *   - 추천 클릭 후 inputRef focus handoff 보존
 *   - 비로그인 안내 배너 role="status"
 *   - <Spinner>는 자체 role="status" + aria-label
 */

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useState } from 'react'
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
import { SourceCard } from '@/components/chat/SourceCard'
import type { SourceRef } from '@/lib/rag/types'

const SUGGESTIONS = [
  '특수 마우스에는 어떤 종류가 있나요?',
  '편의지원 조례를 제정한 시도교육청은 어디인가요?',
  '학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?',
] as const

interface AssistantMetadata {
  sourceRefs?: SourceRef[]
}

export function ChatUI() {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // useChat() — DefaultChatTransport는 v6 명시 transport.
  // M5에서 body로 threadId/userId 동봉 예정 (PR B).
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    sendMessage({ text: trimmed })
    setInput('')
    // 추천 버튼 클릭 후 키보드 사용자 focus 잃지 않도록 input 복귀
    inputRef.current?.focus()
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 sm:px-6">
      {/* aria-live="polite" — codex-rescue PR #31 P2 권고.
          AI Elements Conversation은 role="log"만 갖는다(implicit polite).
          VoiceOver 스트리밍 낭독을 확실히 보장하기 위해 명시. spec §6.1 정합. */}
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
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts?.map((part, i) => {
                      if (part.type === 'text') {
                        // assistant는 MessageResponse(markdown 의무 — AI SDK v6),
                        // user는 평문 <span>
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
            })
          )}
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
              <Spinner aria-label="응답을 작성하고 있어요" />
              <span>응답을 작성하고 있어요…</span>
            </div>
          )}
        </ConversationContent>
      </Conversation>

      <p
        role="status"
        className="mt-2 mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      >
        로그인하면 대화가 저장돼요. 지금은 새로고침하면 사라져요.
      </p>

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
