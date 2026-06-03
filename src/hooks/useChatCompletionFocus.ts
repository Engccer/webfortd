'use client'

/**
 * 응답 완료 시 "마지막 질문 헤딩"으로 포커스를 이동하는 훅.
 *
 * 시각장애 사용자 접근성 핵심: 답변 스트리밍이 끝나면 입력창에 머무른 포커스를
 * 사용자의 마지막 질문 헤딩으로 옮긴다. 스크린리더가 그 질문을 읽어주고,
 * 사용자는 그 아래로 막 도착한 새 답변을 자연스럽게 읽어내려갈 수 있다.
 *
 * 발화 조건 (dodo-planet ChatInterface 패턴 이식):
 *   로딩(streaming/submitted) → ready 전이 AND 새 메시지 수 증가 AND 마지막 역할=assistant.
 *   → onComplete() 콜백(채팅 receive 효과음) + 100ms 뒤 lastQueryRef.focus().
 *
 * 100ms 지연은 응답 DOM이 커밋된 뒤 포커스를 옮기기 위함(스트리밍 마지막 청크
 * 렌더 직후 노드가 존재하도록 보장).
 */

import { useEffect, useRef, type RefObject } from 'react'

interface UseChatCompletionFocusParams {
  /** useChat status === 'submitted' || 'streaming' */
  isLoading: boolean
  /** 현재 메시지 개수 (messages.length) */
  messageCount: number
  /** 마지막 메시지의 role ('user' | 'assistant' | ...) */
  lastMessageRole: string | undefined
  /** 응답 완료 시점 1회 콜백 (효과음 재생 등) */
  onComplete?: () => void
}

export function useChatCompletionFocus({
  isLoading,
  messageCount,
  lastMessageRole,
  onComplete,
}: UseChatCompletionFocusParams): RefObject<HTMLHeadingElement | null> {
  const lastQueryRef = useRef<HTMLHeadingElement>(null)
  const wasLoadingRef = useRef(false)
  const prevCountRef = useRef(messageCount)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const completed =
      wasLoadingRef.current &&
      !isLoading &&
      messageCount > prevCountRef.current &&
      lastMessageRole === 'assistant'

    if (completed) {
      onComplete?.()
      timeoutRef.current = setTimeout(() => {
        // 언마운트/노드 제거 시 ref는 null — optional chaining으로 안전.
        lastQueryRef.current?.focus()
      }, 100)
    }

    // 로딩 중이 아닐 때만 기준 카운트 갱신 (스트리밍 중간 증가는 무시).
    if (!isLoading) prevCountRef.current = messageCount
    wasLoadingRef.current = isLoading
  }, [isLoading, messageCount, lastMessageRole, onComplete])

  // 언마운트 시 대기 중 타이머 정리.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return lastQueryRef
}
