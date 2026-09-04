/**
 * ChatUI 자동 전송(홈 옴니박스 `?q=`) 실패 표면 회귀 테스트.
 *
 * 계약: 자동 전송된 질문도 손으로 보낸 질문과 **같은 실패 표면**을 쓴다
 * (`armFailureSurface` → `chatError && lastFailedMessage` → ErrorBanner + 재시도).
 *
 * 왜 회귀 테스트가 필요한가: 자동 전송이 `send()`를 우회해 `sendMessage`를 직접
 * 부르면 `lastFailedMessage`가 비어 오류 배너 조건이 영원히 거짓이 된다. 그러면
 * 완료 신호(효과음·질문 헤딩 포커스)는 나는데 답도 오류도 재시도도 없는 상태가
 * 되어, 화면을 볼 수 없는 사용자는 "0건인지 실패인지 대기인지"를 구분할 수 없다.
 * 리뷰에서 실제로 잡힌 결함이라 계약을 테스트로 고정한다.
 *
 * useChat 옵션을 캡처해 onError를 직접 발화시킨다(dictation-focus 테스트 동형).
 */

import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface ChatOpts {
  onError?: (error: Error) => void
}
let chatOpts: ChatOpts = {}
const sendMessage = vi.fn()

vi.mock('@ai-sdk/react', () => ({
  useChat: (opts: ChatOpts) => {
    chatOpts = opts
    return { messages: [], sendMessage, status: 'ready', stop: vi.fn() }
  },
}))

vi.mock('ai', () => ({ DefaultChatTransport: class {} }))
vi.mock('swr', () => ({ mutate: vi.fn() }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/sound', () => ({
  playChatReceiveSound: vi.fn(),
  playChatSendSound: vi.fn(),
}))
vi.mock('@/lib/voice/warmup', () => ({ warmupAudioStandalone: vi.fn() }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: () => ({
    state: 'idle',
    duration: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    isSupported: true,
  }),
}))
vi.mock('@/hooks/useRecordingSound', () => ({
  useRecordingSound: () => ({ playStart: vi.fn(), playStop: vi.fn(), playCancel: vi.fn() }),
}))

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom 미구현 polyfill
global.IntersectionObserver = MockIntersectionObserver

import { ChatUI } from '@/components/chat/ChatUI'

beforeEach(() => {
  chatOpts = {}
  sendMessage.mockClear()
  window.history.replaceState(null, '', '/chat')
})

describe('ChatUI 자동 전송', () => {
  it('넘겨받은 질문을 1회 전송한다', () => {
    render(<ChatUI initialQuestion="병가 일수" />)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith({ text: '병가 일수' })
  })

  it('자동 전송이 실패하면 오류 배너와 재시도가 뜬다 (무음 실패 금지)', () => {
    render(<ChatUI initialQuestion="병가 일수" />)

    act(() => {
      chatOpts.onError?.(new Error('Gateway 503 Service Unavailable'))
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: '마지막 질문 다시 보내기' })).toBeTruthy()
  })

  it('재시도는 자동 전송된 그 질문을 다시 보낸다', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<ChatUI initialQuestion="병가 일수" />)

    act(() => {
      chatOpts.onError?.(new Error('Gateway 503'))
    })
    sendMessage.mockClear()
    await user.click(screen.getByRole('button', { name: '마지막 질문 다시 보내기' }))

    expect(sendMessage).toHaveBeenCalledWith({ text: '병가 일수' })
  })

  it('질문이 없으면 전송하지 않는다', () => {
    render(<ChatUI />)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('라우트 착지점 h1을 둔다 (FocusManager 전역 계약)', () => {
    render(<ChatUI />)
    expect(screen.getByRole('heading', { level: 1, name: '채팅' })).toBeTruthy()
  })
})
