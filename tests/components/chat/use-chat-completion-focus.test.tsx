/**
 * useChatCompletionFocus 훅 단위 테스트.
 *
 * 응답 완료(로딩 streaming→ready 전이 + 새 assistant 메시지 도착) 시점에:
 *   - onComplete 콜백 1회 발화 (채팅 receive 효과음 트리거)
 *   - 100ms 뒤 lastQueryRef로 focus 이동 (시각장애 사용자: 답변 완료 후
 *     "내 질문 헤딩"을 스크린리더가 읽고 그 아래 새 답변을 읽어내려감)
 *
 * dodo-planet ChatInterface의 wasLoadingRef + prevMessageCountRef 패턴 이식.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useChatCompletionFocus } from '@/hooks/useChatCompletionFocus'

interface HarnessProps {
  isLoading: boolean
  messageCount: number
  lastMessageRole: string | undefined
  onComplete: () => void
}

function Harness({ isLoading, messageCount, lastMessageRole, onComplete }: HarnessProps) {
  const ref = useChatCompletionFocus({ isLoading, messageCount, lastMessageRole, onComplete })
  return (
    <h2 ref={ref} tabIndex={-1} data-testid="last-question">
      마지막 질문
    </h2>
  )
}

describe('useChatCompletionFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('로딩 종료 + 새 assistant 메시지 도착 시 onComplete 발화 + 100ms 뒤 헤딩 focus', () => {
    const onComplete = vi.fn()
    const { rerender, getByTestId } = render(
      <Harness isLoading={true} messageCount={1} lastMessageRole="user" onComplete={onComplete} />,
    )
    // 응답 도착: 로딩 종료 + assistant 메시지가 추가됨 (1 → 2)
    rerender(
      <Harness isLoading={false} messageCount={2} lastMessageRole="assistant" onComplete={onComplete} />,
    )
    expect(onComplete).toHaveBeenCalledTimes(1)
    // 아직 100ms 전 — focus 미이동
    expect(getByTestId('last-question')).not.toHaveFocus()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(getByTestId('last-question')).toHaveFocus()
  })

  it('로딩과 무관한 리렌더에는 onComplete/focus 미발생', () => {
    const onComplete = vi.fn()
    const { rerender, getByTestId } = render(
      <Harness isLoading={false} messageCount={1} lastMessageRole="user" onComplete={onComplete} />,
    )
    rerender(
      <Harness isLoading={false} messageCount={1} lastMessageRole="user" onComplete={onComplete} />,
    )
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(getByTestId('last-question')).not.toHaveFocus()
  })

  it('로딩 종료됐지만 새 메시지가 없으면(중단 등) focus 안 함', () => {
    const onComplete = vi.fn()
    const { rerender } = render(
      <Harness isLoading={true} messageCount={2} lastMessageRole="user" onComplete={onComplete} />,
    )
    rerender(
      <Harness isLoading={false} messageCount={2} lastMessageRole="user" onComplete={onComplete} />,
    )
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onComplete).not.toHaveBeenCalled()
  })
})
