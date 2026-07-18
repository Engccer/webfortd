'use client'

/**
 * 음성 받아쓰기 버튼 — 탭-토글(탭=시작, 다시 탭=정지·전사), Esc=취소.
 * gildongmu 판 이식(2026-07-18): 기존 dodo-planet 계열(권한 사전 모달 + 장황한
 * 음성 안내) 교체.
 *
 * - 시작/정지/취소는 효과음(useRecordingSound)으로 통지 — 상승음=시작·하강음=정지·
 *   단음=취소. SR에는 aria-label 변화("음성으로 질문 시작"↔"녹음 정지")가 상태 신호.
 *   시작 성공 시 버튼 명시 재포커스로 getUserMedia 대기 중 이탈한 SR 커서를 되돌려
 *   바뀐 라벨을 그 자리에서 읽게 한다. 시작음은 실제 시작 성공 후에만(권한 실패 시
 *   신호 역전 방지).
 * - 권한: getUserMedia 네이티브 프롬프트 단일 경로. NotAllowedError → mic_denied,
 *   그 외 → mic_failed 정확 분류(사전 권한 요청의 중복 호출·오분류 제거).
 * - polite announcer는 라벨 변화로 전달할 수 없는 정보 전용: 시간 마일스톤
 *   ("1분이 지났어요"·"10초 후 자동으로 멈춰요"), 자동 정지, 전사 성공, Esc 취소
 *   (전역 키라 포커스가 버튼 밖일 수 있고 음소거 환경 대비 — 효과음과 병행).
 * - 오류는 코드→한국어 번역 후 부모(ChatUI voiceError role=alert) 단일 채널로만
 *   전달한다 — 버튼 내 별도 assertive announcer를 두지 않는다(이중 낭독 방지).
 */

import { useCallback, useEffect, useRef } from 'react'
import { Mic, Loader2, MicOff, Square } from 'lucide-react'
import { useVoiceRecorder, type VoiceRecorderErrorCode } from '@/hooks/useVoiceRecorder'
import { useRecordingSound } from '@/hooks/useRecordingSound'

interface VoiceRecordButtonProps {
  onTranscribed: (text: string) => void
  onError?: (message: string) => void
  disabled?: boolean
  /** idle 상태 aria-label 오버라이드 — 검색 등 채팅 외 문맥용 (기본: 채팅 카피) */
  idleLabel?: string
  /** 전사 성공 polite 안내 오버라이드 (기본: 채팅 카피) */
  successMessage?: string
}

const MAX_DURATION = 120 // 자동 정지 시각 (spec §D4)

/** 훅의 오류 코드 → 사용자 문구(한국어 단일 로케일). 테스트가 완전성을 고정한다. */
export const VOICE_ERROR_MESSAGES: Record<VoiceRecorderErrorCode, string> = {
  mic_denied: '마이크 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.',
  mic_failed: '마이크를 시작할 수 없어요.',
  no_audio: '녹음된 오디오가 없어요.',
  too_short: '녹음이 너무 짧아요. 좀 더 길게 말씀해 주세요.',
  no_text: '음성을 인식하지 못했어요. 다시 말씀해 주세요.',
  stt_failed: '음성 인식에 실패했어요. 잠시 후 다시 시도해 주세요.',
}

export function VoiceRecordButton({
  onTranscribed,
  onError,
  disabled,
  idleLabel = '음성으로 질문 시작',
  successMessage = '받아쓰기를 입력창에 추가했어요',
}: VoiceRecordButtonProps) {
  const announcerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { playStart, playStop, playCancel } = useRecordingSound()

  // polite announcer — 시간 마일스톤·자동 정지·성공·Esc 취소 전용(오류는 부모 채널).
  const announce = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message
      setTimeout(() => {
        if (announcerRef.current) announcerRef.current.textContent = ''
      }, 2000)
    }
  }, [])

  const { state, duration, startRecording, stopRecording, cancelRecording, isSupported } =
    useVoiceRecorder({
      maxDuration: MAX_DURATION,
      onTranscribed: (text) => {
        // 성공은 polite 통지 (WCAG 4.1.3) — 무음이면 입력창 반영을 알 수 없음
        announce(successMessage)
        onTranscribed(text)
      },
      onError: (code) => onError?.(VOICE_ERROR_MESSAGES[code]),
    })

  const handleClick = useCallback(async () => {
    if (disabled || !isSupported || state === 'processing') return
    if (state === 'recording') {
      playStop()
      await stopRecording()
      return
    }
    // idle → 곧장 녹음 시작. 권한은 getUserMedia 네이티브 프롬프트가 담당.
    const ok = await startRecording()
    if (ok) {
      playStart()
      buttonRef.current?.focus()
    }
  }, [disabled, isSupported, state, startRecording, stopRecording, playStart, playStop])

  // Esc로 녹음 취소. IME 조합 중에는 무시(한글 입력 확정과 충돌 방지).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (e.key === 'Escape' && state === 'recording') {
        playCancel()
        announce('녹음을 취소했어요')
        cancelRecording()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, cancelRecording, playCancel, announce])

  // 녹음 타이머 간헐 안내 — 시각 타이머는 비가청이라 주요 시점만 발화 (매초 발화 금지)
  useEffect(() => {
    if (state !== 'recording') return
    if (duration === 60) announce('1분이 지났어요')
    else if (duration === MAX_DURATION - 10) announce('10초 후 자동으로 멈춰요')
  }, [state, duration, announce])

  // 120초 자동 정지 감지 — recording → processing 전환 시점에 duration이 한계치면 발화
  const prevStateRef = useRef(state)
  useEffect(() => {
    if (prevStateRef.current === 'recording' && state === 'processing' && duration >= MAX_DURATION) {
      announce('녹음 시간이 다 되어 자동으로 멈췄어요')
    }
    prevStateRef.current = state
  }, [state, duration, announce])

  const ariaLabel = !isSupported
    ? '음성 입력 미지원 브라우저예요'
    : state === 'recording'
      ? '녹음 정지'
      : state === 'processing'
        ? '변환 중'
        : idleLabel

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="relative inline-flex items-center">
      <div ref={announcerRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />

      {state === 'recording' && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap" aria-hidden="true">
          <div className="flex items-center gap-1.5 rounded-full bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-lg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      )}

      {/* disabled 대신 aria-disabled — 정지 직후 disabled가 되면 포커스가 소실됨 (WCAG 2.4.3).
          실제 동작 차단은 handleClick 첫머리 가드가 담당. */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-disabled={disabled || !isSupported || state === 'processing'}
        aria-label={ariaLabel}
        className={
          state === 'recording'
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-destructive text-destructive-foreground animate-pulse focus:outline-none focus:ring-2 focus:ring-ring'
            : state === 'processing'
              ? 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-amber-500 text-white cursor-wait focus:outline-none focus:ring-2 focus:ring-ring'
              : 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
        }
      >
        {!isSupported ? (
          <MicOff className="h-5 w-5" aria-hidden="true" />
        ) : state === 'recording' ? (
          <Square className="h-4 w-4 fill-current" aria-hidden="true" />
        ) : state === 'processing' ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
