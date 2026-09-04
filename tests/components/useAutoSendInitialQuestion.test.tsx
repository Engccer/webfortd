/**
 * useAutoSendInitialQuestion Vitest — 홈 옴니박스에서 넘어온 첫 질문의 1회 전송.
 *
 * 자동 전송의 유일한 함정은 재전송이다: (a) 리렌더·Strict Mode 이중 실행 (b) 주소에
 * 질문이 남은 채로 새로고침. (a)는 ref 가드, (b)는 전송 직후 주소에서 q 제거로 막는다.
 * 주소 정리는 router.replace 대신 history.replaceState를 쓴다 — 서버 재렌더를 일으키지
 * 않아 스트리밍 중인 채팅 상태를 건드리지 않는다.
 */

import { StrictMode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAutoSendInitialQuestion } from '@/hooks/useAutoSendInitialQuestion'

function setUrl(url: string) {
  window.history.replaceState(null, '', url)
}

beforeEach(() => {
  setUrl('/chat')
})

describe('useAutoSendInitialQuestion', () => {
  it('질문이 있으면 mount 시 1회 전송한다', () => {
    const send = vi.fn()
    renderHook(() => useAutoSendInitialQuestion({ question: '병가 일수', send }))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('병가 일수')
  })

  it('리렌더에도 다시 전송하지 않는다', () => {
    const send = vi.fn()
    const { rerender } = renderHook(
      ({ q }: { q?: string }) => useAutoSendInitialQuestion({ question: q, send }),
      { initialProps: { q: '병가 일수' } },
    )
    rerender({ q: '병가 일수' })
    rerender({ q: '병가 일수' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('StrictMode 이중 실행에도 1회만 전송한다', () => {
    const send = vi.fn()
    setUrl('/chat?q=%EB%B3%91%EA%B0%80')
    renderHook(() => useAutoSendInitialQuestion({ question: '병가', send }), {
      wrapper: StrictMode,
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('')
  })

  it('질문이 없거나 공백뿐이면 전송하지 않는다', () => {
    const send = vi.fn()
    renderHook(() => useAutoSendInitialQuestion({ question: undefined, send }))
    renderHook(() => useAutoSendInitialQuestion({ question: '   ', send }))
    expect(send).not.toHaveBeenCalled()
  })

  it('전송한 질문은 앞뒤 공백을 다듬는다', () => {
    const send = vi.fn()
    renderHook(() => useAutoSendInitialQuestion({ question: '  전보 가산점  ', send }))
    expect(send).toHaveBeenCalledWith('전보 가산점')
  })

  it('전송 후 주소에서 q 파라미터만 제거한다 (새로고침 재전송 차단)', () => {
    setUrl('/chat?q=%EB%B3%91%EA%B0%80&thread=abc')
    renderHook(() => useAutoSendInitialQuestion({ question: '병가', send: vi.fn() }))
    expect(window.location.pathname).toBe('/chat')
    expect(window.location.search).toBe('?thread=abc')
  })

  it('전송하지 않으면 주소를 건드리지 않는다', () => {
    setUrl('/chat?thread=abc')
    renderHook(() => useAutoSendInitialQuestion({ question: undefined, send: vi.fn() }))
    expect(window.location.search).toBe('?thread=abc')
  })
})
