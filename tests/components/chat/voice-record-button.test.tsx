/**
 * Phase 3 M7.1 — VoiceRecordButton Vitest.
 *
 * 검증 (JSDOM 한계 명시):
 *   - JSDOM은 MediaRecorder/getUserMedia 기본 미지원 → 모든 테스트가 isSupported=false 상태
 *   - "음성 입력 미지원 브라우저예요" aria-label + disabled가 기본
 *   - 실 동작(권한 흐름 · 녹음 · 정지 · STT)은 위원장 수동 검수 (Chrome MCP)
 *
 * 검증:
 *   - 미지원 환경에서 적절한 aria-label + disabled
 *   - disabled prop 추가 시에도 disabled
 *   - aria-live announcer 렌더 (role=status sr-only)
 *   - MicrophonePermissionPrompt 초기 미노출
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton'

describe('VoiceRecordButton (M7.1 음성 받아쓰기)', () => {
  beforeEach(() => {
    try {
      localStorage.clear()
    } catch {
      // 일부 env localStorage 비활성 — silent
    }
  })

  it('JSDOM 미지원 환경 — "음성 입력 미지원 브라우저예요" + disabled', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    const button = screen.getByRole('button', { name: /미지원 브라우저/ })
    expect(button).toBeDisabled()
  })

  it('disabled prop도 disabled 적용', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} disabled />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('aria-live announcer 렌더 (role=status sr-only assertive)', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    const announcer = document.querySelector('[role="status"][aria-live="assertive"]')
    expect(announcer).toBeInTheDocument()
    expect(announcer).toHaveClass('sr-only')
  })

  it('초기 mount 시 MicrophonePermissionPrompt 미노출', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
