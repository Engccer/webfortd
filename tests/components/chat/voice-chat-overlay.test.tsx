/**
 * Phase 7 M4 — VoiceChatOverlay Vitest.
 *
 * useGeminiLive를 모킹하므로 AudioContext/genai 호출 없음.
 * 검증:
 *   - dialog role + aria-label (열림 상태)
 *   - aria-live 상태 영역 존재
 *   - 종료 버튼 접근성
 *   - 닫힘 상태에서 렌더 없음
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VoiceChatOverlay } from '@/components/chat/VoiceChatOverlay'

vi.mock('@/hooks/useGeminiLive', () => ({
  useGeminiLive: () => ({
    state: 'listening',
    warmupAudio: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    toggleMute: vi.fn(),
    isMuted: false,
    transcripts: [],
    functionStatus: null,
    errorMessage: null,
  }),
}))

describe('VoiceChatOverlay', () => {
  it('열림 상태에서 dialog role + aria-label', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label')
  })

  it('aria-live 상태 영역 존재', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  it('종료 버튼 접근 가능', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /종료|닫기/ })).toBeTruthy()
  })

  it('닫힘 상태에서는 아무것도 렌더하지 않음', () => {
    const { container } = render(<VoiceChatOverlay open={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
