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
 *   - 전사 성공 = 소비자 콜백 먼저 → 받아쓴 결과 원문 polite 통지(헌장 §6 신계약,
 *     훅 옵션 캡처로 직접 발화)
 */

import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VoiceRecorderErrorCode } from '@/hooks/useVoiceRecorder'

// 훅 옵션 캡처 — §6 전사 성공 계약 테스트가 onTranscribed를 직접 트리거한다
// (site-search-voice.test.tsx 동형. vi.mock은 파일 단위라 이 파일 전체에 적용되지만,
// 기존 테스트는 훅 반환값 형태만 같으면 무관하다 — isSupported=true로 바뀌는 것만 반영).
interface CapturedOpts {
  onTranscribed?: (text: string) => void
  onError?: (code: VoiceRecorderErrorCode) => void
}
let recorderOpts: CapturedOpts = {}

vi.mock('@/hooks/useVoiceRecorder', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useVoiceRecorder')>()
  return {
    ...original,
    useVoiceRecorder: (opts: CapturedOpts) => {
      recorderOpts = opts
      return {
        state: 'idle',
        duration: 0,
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        cancelRecording: vi.fn(),
        isSupported: false,
      }
    },
  }
})

import { VoiceRecordButton, VOICE_ERROR_MESSAGES } from '@/components/chat/VoiceRecordButton'

beforeEach(() => {
  recorderOpts = {}
})

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

  it('전사 성공 — 소비자 콜백 먼저, polite 통지는 받아쓴 결과 원문 (§6 신계약)', () => {
    const calls: string[] = []
    render(<VoiceRecordButton onTranscribed={(text) => calls.push(`consumer:${text}`)} />)
    const announcer = document.querySelector('[role="status"][aria-live="polite"]')!
    act(() => {
      recorderOpts.onTranscribed?.('보조공학기기 신청 방법')
    })
    // 소비자(포커스 이동 담당)가 먼저 호출되고, 통지 문구는 일반 안내가 아닌 전사 원문.
    expect(calls).toEqual(['consumer:보조공학기기 신청 방법'])
    expect(announcer).toHaveTextContent('보조공학기기 신청 방법')
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
