/**
 * Phase 3 M7.1 — VoiceRecordButton Vitest.
 *
 * 검증 (JSDOM 한계 명시):
 *   - JSDOM은 MediaRecorder/getUserMedia 기본 미지원 → 모든 테스트가 isSupported=false 상태
 *   - "음성 입력 미지원 브라우저예요" aria-label + aria-disabled가 기본
 *   - 실 동작(권한 흐름 · 녹음 · 정지 · STT)은 위원장 수동 검수 (Chrome MCP)
 *
 * 검증:
 *   - 미지원 환경에서 적절한 aria-label + aria-disabled
 *   - disabled prop 추가 시에도 aria-disabled
 *
 * NOTE: a11y 패치(2026-06-11)로 native disabled → aria-disabled 패턴 전환
 *   (disabled는 포커스를 body로 떨어뜨려 스크린리더 사용자가 길을 잃음 — WCAG 2.4.3).
 *   클릭 차단은 컴포넌트 내부 가드가 담당.
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

  it('JSDOM 미지원 환경 — "음성 입력 미지원 브라우저예요" + aria-disabled', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    const button = screen.getByRole('button', { name: /미지원 브라우저/ })
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('disabled prop도 aria-disabled 적용 (포커스 유지 패턴)', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} disabled />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('aria-live announcer 렌더 (role=status sr-only polite)', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    const announcer = document.querySelector('[role="status"][aria-live="polite"]')
    expect(announcer).toBeInTheDocument()
    expect(announcer).toHaveClass('sr-only')
  })

  it('초기 mount 시 MicrophonePermissionPrompt 미노출', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
