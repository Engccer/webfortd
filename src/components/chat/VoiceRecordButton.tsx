'use client'

/**
 * Phase 3 M7.1 — 음성 녹음 버튼.
 *
 * 출처: dodo-planet VoiceRecordButton (i18n 제거 + sonner toast 제거).
 *
 * 흐름:
 *   1. 클릭 → 권한 확인
 *   2. needsPermission → MicrophonePermissionPrompt 모달
 *   3. ready → 녹음 시작 + aria-live "녹음 중..."
 *   4. 다시 클릭 또는 120초 자동 → 정지 + STT → onTranscribed 콜백
 *   5. ESC 키로 취소
 *
 * 접근성:
 *   - aria-label 상태별 (마이크 시작/정지/변환 중/지원 안 됨)
 *   - role="status" + aria-live="assertive" announcer
 *   - 44px 터치 타깃
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Loader2, MicOff, Square } from 'lucide-react'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useMicrophonePermission } from '@/hooks/useMicrophonePermission'
import { useSound } from '@/hooks/useSound'
import { MicrophonePermissionPrompt } from '@/components/chat/MicrophonePermissionPrompt'

interface VoiceRecordButtonProps {
  onTranscribed: (text: string) => void
  onError?: (error: string) => void
  disabled?: boolean
}

export function VoiceRecordButton({ onTranscribed, onError, disabled }: VoiceRecordButtonProps) {
  const announcerRef = useRef<HTMLDivElement>(null)
  const { playRecordStart, playRecordStop } = useSound()
  const { permissionState, checkPermission, requestPermission } = useMicrophonePermission()
  const [showPrompt, setShowPrompt] = useState(false)

  const { state, duration, startRecording, stopRecording, cancelRecording, isSupported } =
    useVoiceRecorder({
      maxDuration: 120,
      onTranscribed: (text) => {
        playRecordStop()
        onTranscribed(text)
      },
      onError: (error) => {
        console.error('[VoiceRecordButton] error:', error)
        onError?.(error)
      },
    })

  const announce = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message
      setTimeout(() => {
        if (announcerRef.current) announcerRef.current.textContent = ''
      }, 1500)
    }
  }, [])

  const handleAllowed = useCallback(async () => {
    const granted = await requestPermission()
    if (granted) {
      playRecordStart()
      announce('녹음을 시작했어요')
      await new Promise((r) => setTimeout(r, 300))
      await startRecording()
    }
  }, [requestPermission, playRecordStart, startRecording, announce])

  const handleClick = useCallback(async () => {
    if (disabled || !isSupported || state === 'processing') return
    if (state === 'recording') {
      announce('녹음을 멈췄어요')
      await stopRecording()
      return
    }
    const result = permissionState === 'idle' || permissionState === 'checking'
      ? await checkPermission()
      : permissionState
    if (result === 'ready') {
      playRecordStart()
      announce('녹음을 시작했어요')
      await new Promise((r) => setTimeout(r, 300))
      await startRecording()
    } else if (result === 'needsPermission') {
      setShowPrompt(true)
    } else if (result === 'denied') {
      onError?.('마이크 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.')
    }
  }, [disabled, isSupported, state, permissionState, checkPermission, playRecordStart, startRecording, stopRecording, announce, onError])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state === 'recording') {
        announce('녹음을 취소했어요')
        cancelRecording()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, cancelRecording, announce])

  const ariaLabel = !isSupported
    ? '음성 입력 미지원 브라우저예요'
    : state === 'recording'
      ? '녹음 정지'
      : state === 'processing'
        ? '변환 중'
        : '음성으로 질문 시작'

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="relative inline-flex items-center">
      <div ref={announcerRef} role="status" aria-live="assertive" aria-atomic="true" className="sr-only" />

      {state === 'recording' && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap" aria-hidden="true">
          <div className="flex items-center gap-1.5 rounded-full bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-lg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || !isSupported || state === 'processing'}
        aria-label={ariaLabel}
        className={
          state === 'recording'
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-destructive text-destructive-foreground animate-pulse focus:outline-none focus:ring-2 focus:ring-ring'
            : state === 'processing'
              ? 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-amber-500 text-white cursor-wait'
              : 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {!isSupported || permissionState === 'denied' ? (
          <MicOff className="h-5 w-5" aria-hidden="true" />
        ) : state === 'recording' ? (
          <Square className="h-4 w-4 fill-current" aria-hidden="true" />
        ) : state === 'processing' ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <MicrophonePermissionPrompt open={showPrompt} onOpenChange={setShowPrompt} onAllow={handleAllowed} />
    </div>
  )
}
