'use client'

/**
 * Phase 3 M7.1 — 음성 녹음 훅.
 *
 * 출처: dodo-planet src/hooks/useVoiceRecorder.ts (maxDuration 60→120 + STT 엔드포인트 경로).
 *
 * - MediaRecorder Web API + 120초 자동 종료 (spec §D4)
 * - WebM Opus 우선 → audio/webm → audio/mp4 fallback
 * - 최소 녹음 0.3초 미만 reject
 * - chunks 합성 후 FormData POST /api/transcribe
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export type RecordingState = 'idle' | 'recording' | 'processing'

interface UseVoiceRecorderOptions {
  maxDuration?: number // 기본 120초 (spec §D4)
  onTranscribed?: (text: string) => void
  onError?: (error: string) => void
}

interface UseVoiceRecorderReturn {
  state: RecordingState
  duration: number
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => void
  isSupported: boolean
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const { maxDuration = 120, onTranscribed, onError } = options

  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [isSupported, setIsSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setIsSupported(false)
      return
    }
    const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
    setIsSupported(hasMediaDevices && hasMediaRecorder)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (state !== 'recording' || !mediaRecorderRef.current) return
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setState('processing')

    return new Promise<void>((resolve) => {
      const mr = mediaRecorderRef.current!
      mr.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        if (chunksRef.current.length === 0) {
          onError?.('녹음된 오디오가 없어요.')
          setState('idle')
          resolve()
          return
        }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType })
        if (duration < 0.3) {
          onError?.('녹음이 너무 짧아요. 좀 더 길게 말씀해 주세요.')
          setState('idle')
          setDuration(0)
          resolve()
          return
        }
        try {
          const formData = new FormData()
          formData.append('audio', blob)
          const response = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || '음성 인식에 실패했어요.')
          if (data.text) {
            onTranscribed?.(data.text)
          } else {
            onError?.('인식된 텍스트가 없어요. 다시 시도해 주세요.')
          }
        } catch (err) {
          onError?.(err instanceof Error ? err.message : '음성 인식에 실패했어요.')
        } finally {
          setState('idle')
          setDuration(0)
          resolve()
        }
      }
      mr.stop()
    })
  }, [state, duration, onTranscribed, onError])

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
        },
      })
      streamRef.current = stream

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4'

      const mr = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.start(100)
      setState('recording')
      startTimeRef.current = Date.now()
      setDuration(0)

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setDuration(elapsed)
        if (elapsed >= maxDuration) {
          void stopRecording()
        }
      }, 100)
    } catch (err) {
      console.error('[useVoiceRecorder] start 실패:', err)
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? '마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.'
          : '마이크를 시작할 수 없어요.'
      onError?.(msg)
    }
  }, [state, maxDuration, onError, stopRecording])

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
    setState('idle')
    setDuration(0)
  }, [state])

  return { state, duration, startRecording, stopRecording, cancelRecording, isSupported }
}
