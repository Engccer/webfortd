/**
 * VoiceRecordButton Vitest — gildongmu 판 이식(2026-07-18) 계약.
 *
 * 검증 (JSDOM 한계 명시):
 *   - JSDOM은 MediaRecorder/getUserMedia 기본 미지원 → 모든 테스트가 isSupported=false 상태
 *   - "음성 입력 미지원 브라우저예요" aria-label + aria-disabled가 기본
 *   - 실 동작(네이티브 권한 프롬프트 · 녹음 · 정지 · 효과음 · 재포커스 · STT)은
 *     위원장 실 마이크 수동 검수
 *
 * 검증:
 *   - 미지원 환경에서 적절한 aria-label + aria-disabled
 *   - disabled prop 추가 시에도 aria-disabled (native disabled 금지 — WCAG 2.4.3 포커스 유지)
 *   - polite announcer 렌더 (단일 role=status sr-only — 오류는 부모 role=alert 채널)
 *   - VOICE_ERROR_MESSAGES 6개 코드 완전성(코드→한국어 문구 계약)
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VoiceRecordButton, VOICE_ERROR_MESSAGES } from '@/components/chat/VoiceRecordButton'
import type { VoiceRecorderErrorCode } from '@/hooks/useVoiceRecorder'

describe('VoiceRecordButton (받아쓰기 — gildongmu 이식)', () => {
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

  it('polite announcer 렌더 (role=status sr-only) — assertive 채널 없음', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    const announcer = document.querySelector('[role="status"][aria-live="polite"]')
    expect(announcer).toBeInTheDocument()
    expect(announcer).toHaveClass('sr-only')
    expect(document.querySelector('[aria-live="assertive"]')).not.toBeInTheDocument()
  })

  it('VOICE_ERROR_MESSAGES — 6개 오류 코드 전부 비어 있지 않은 한국어 문구', () => {
    const codes: VoiceRecorderErrorCode[] = [
      'mic_denied',
      'mic_failed',
      'no_audio',
      'too_short',
      'no_text',
      'stt_failed',
    ]
    for (const code of codes) {
      expect(VOICE_ERROR_MESSAGES[code]).toBeTruthy()
      expect(VOICE_ERROR_MESSAGES[code].length).toBeGreaterThan(5)
    }
  })
})
