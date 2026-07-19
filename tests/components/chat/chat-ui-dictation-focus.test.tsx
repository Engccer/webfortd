/**
 * ChatUI 음성 받아쓰기 → 전송 버튼 포커스 회귀 테스트 (헌장 §6 신계약).
 *
 * 검증 계약: 전사 완료 시 ChatUI.tsx의 onTranscribed 핸들러가
 *   flushSync(() => { setInput(...); setVoiceError(null) }) 로 입력 상태를
 *   먼저 동기 커밋한 뒤 sendButtonRef.current?.focus()를 호출한다.
 *
 * 이 순서가 중요한 이유: PromptInputSubmit은
 *   disabled={!isLoading && !input.trim() && !attachment} (네이티브 disabled)
 * 를 쓴다. flushSync 없이 setInput 직후 동기 focus()를 호출하면, React의
 * 자동 배치 때문에 그 시점의 DOM에는 아직 이전(빈) input이 반영돼 있어
 * 버튼이 여전히 disabled 상태 — 브라우저는 disabled 요소에 대한 focus()를
 * 조용히 무시한다(에러 없이 실패). flushSync로 상태 반영을 먼저 커밋해야
 * focus() 시점에 버튼이 이미 활성화돼 있다.
 *
 * 리뷰 중 실측: flushSync를 제거한 통제 버전에서 동일 assertion이 실패함을
 * 직접 재현 확인(그 통제 버전은 검증 후 원상 복구, repo에 남기지 않음).
 *
 * VoiceRecordButton 내부 훅(useVoiceRecorder)을 mock해 onTranscribed를
 * 직접 캡처·트리거한다(site-search-voice.test.tsx 동형 패턴). useChat 등
 * ChatUI의 나머지 의존성은 최소 stub만 두고 실제 컴포넌트 트리를 그대로 렌더한다.
 */

import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VoiceRecorderErrorCode } from '@/hooks/useVoiceRecorder'

interface CapturedOpts {
  onTranscribed?: (text: string) => void
  onError?: (code: VoiceRecorderErrorCode) => void
}
let recorderOpts: CapturedOpts = {}

vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: (opts: CapturedOpts) => {
    recorderOpts = opts
    return {
      state: 'idle',
      duration: 0,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      isSupported: true,
    }
  },
}))

vi.mock('@/hooks/useRecordingSound', () => ({
  useRecordingSound: () => ({ playStart: vi.fn(), playStop: vi.fn(), playCancel: vi.fn() }),
}))

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    status: 'ready',
    stop: vi.fn(),
  }),
}))

vi.mock('ai', () => ({
  DefaultChatTransport: class {},
}))

vi.mock('swr', () => ({
  mutate: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('@/lib/sound', () => ({
  playChatReceiveSound: vi.fn(),
  playChatSendSound: vi.fn(),
}))

vi.mock('@/lib/voice/warmup', () => ({
  warmupAudioStandalone: vi.fn(),
}))

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}))

// jsdom 미구현 — tests/components/setup.ts는 matchMedia·ResizeObserver만 stub하므로
// ChatUI의 자동 스크롤 IntersectionObserver는 이 파일에서 직접 stub.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom 미구현 polyfill
global.IntersectionObserver = MockIntersectionObserver

import { ChatUI } from '@/components/chat/ChatUI'

beforeEach(() => {
  recorderOpts = {}
})

describe('ChatUI 받아쓰기 완료 → 전송 버튼 포커스 (§6 신계약)', () => {
  it('전사 완료 시 전송 버튼이 포커스를 받고 disabled가 아니다', () => {
    render(<ChatUI />)
    act(() => {
      recorderOpts.onTranscribed?.('보조공학기기 신청 방법')
    })
    const sendButton = screen.getByRole('button', { name: '전송' })
    expect(sendButton).toHaveFocus()
    expect(sendButton).not.toBeDisabled()
  })
})
