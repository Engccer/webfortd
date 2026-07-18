'use client'

/**
 * 음성 녹음 훅 — gildongmu 판 이식(2026-07-18, 기존 dodo-planet 계열 교체).
 *
 * - MediaRecorder Web API + 120초 자동 종료 (spec §D4)
 * - WebM Opus 우선 → audio/webm → audio/mp4 fallback
 * - 최소 녹음 300ms 미만 reject (ms 기준 — floored 초 비교의 오거부 버그 차단)
 * - chunks 합성 후 FormData POST /api/transcribe (ko 강제, locale 없음)
 *
 * 견고화(gildongmu 리뷰 누적분):
 * - busyRef in-flight 잠금 — 빠른 더블탭의 중복 getUserMedia 차단
 * - mountedRef — 언마운트 후 setState/콜백 발화 방지 + getUserMedia 대기 중
 *   언마운트 시 트랙 즉시 정리(마이크 스트림 누수 차단)
 * - AbortController — 진행 중 STT fetch 취소
 * - onstop/ondataavailable 해제 — 정지 후 중복/지연 발화 방지
 */

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from 'react'

export type RecordingState = 'idle' | 'recording' | 'processing'

// 브라우저 음성 입력 지원 여부 — useSyncExternalStore로 서버/클라 스냅샷을
// 분리해 hydration mismatch를 막는다. 값이 마운트 중 바뀌지 않으므로 subscribe는 noop.
const subscribeSupport = () => () => {}
const getSupportSnapshot = () =>
  !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
const getSupportServerSnapshot = () => false

/**
 * 오류 코드 — 사용자 문구 번역은 소비 컴포넌트(VoiceRecordButton)가 담당한다.
 * 훅은 사람이 읽는 문자열을 직접 만들지 않는다(표시 채널·문구 결정과 분리).
 */
export type VoiceRecorderErrorCode =
  | 'mic_denied' // 마이크 권한 거부(NotAllowedError)
  | 'mic_failed' // 그 외 마이크 시작 실패(장치 없음 등)
  | 'no_audio' // 녹음된 오디오 청크 없음
  | 'too_short' // 최소 길이(0.3초) 미달
  | 'no_text' // STT 422 — 음성을 텍스트로 인식 못 함
  | 'stt_failed' // 그 외 STT 실패/네트워크/예외

interface UseVoiceRecorderOptions {
  maxDuration?: number // 기본 120초 (spec §D4)
  onTranscribed?: (text: string) => void
  onError?: (code: VoiceRecorderErrorCode) => void // 코드만 — 번역은 소비자 담당
}

interface UseVoiceRecorderReturn {
  state: RecordingState
  duration: number
  startRecording: () => Promise<boolean> // true = 실제 녹음 시작됨
  stopRecording: () => Promise<void>
  cancelRecording: () => void
  isSupported: boolean
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const { maxDuration = 120, onTranscribed, onError } = options

  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const isSupported = useSyncExternalStore(
    subscribeSupport,
    getSupportSnapshot,
    getSupportServerSnapshot,
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  // 마운트 생존 여부 — 언마운트 후 setState/콜백 발화 방지.
  const mountedRef = useRef(true)
  // 진행 중(in-flight) 잠금 — 빠른 더블탭의 중복 getUserMedia 차단.
  const busyRef = useRef(false)
  // 진행 중 STT fetch 취소용.
  const abortRef = useRef<AbortController | null>(null)
  // startRecording의 타이머 콜백이 후순위로 선언되는 stopRecording을 호출해야 해
  // 순환 참조가 생긴다. ref로 최신 stopRecording을 가리켜 콜백이 항상 현재 버전을
  // 호출하도록 우회한다(React Compiler 규칙 정합, 동작 동일).
  const stopRecordingRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Cleanup on unmount — 타이머·스트림 정리 + 마운트 플래그 해제 + STT fetch 취소.
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      abortRef.current?.abort()
    }
  }, [])

  // 녹음 시작. 실제 시작 성공 여부를 반환.
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (state !== 'idle') return false
    // in-flight 잠금 — 같은 렌더의 stale closure로도 중복 getUserMedia를 못 막는
    // state 가드를 ref로 보완. 시작 실패·정지·취소에서 해제.
    if (busyRef.current) return false
    busyRef.current = true

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
        },
      })

      // getUserMedia 대기 중 언마운트되면 cleanup은 이미 지나간 뒤라, 여기서 직접
      // 트랙을 멈추지 않으면 마이크 스트림이 샌다. setState/recorder 셋업 없이 중단.
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        busyRef.current = false
        return false
      }
      streamRef.current = stream

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(100)
      setState('recording')
      startTimeRef.current = Date.now()
      setDuration(0)

      timerRef.current = setInterval(() => {
        const elapsedMs = Date.now() - startTimeRef.current
        setDuration(Math.floor(elapsedMs / 1000))
        if (elapsedMs >= maxDuration * 1000) {
          void stopRecordingRef.current()
        }
      }, 100)
      return true
    } catch (err) {
      console.error('[useVoiceRecorder] start 실패:', err)
      // 스트림을 확보한 뒤 MediaRecorder 생성/시작이 실패해도 트랙을 반드시 정리한다
      // — 안 하면 마이크가 켜진 채 샌다. getUserMedia 자체 실패면 stream은 null이라 무해.
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      streamRef.current = null
      busyRef.current = false
      if (mountedRef.current) {
        onError?.(err instanceof Error && err.name === 'NotAllowedError' ? 'mic_denied' : 'mic_failed')
      }
      return false
    }
  }, [state, maxDuration, onError])

  // 정지 + 전사.
  const stopRecording = useCallback(async () => {
    if (state !== 'recording' || !mediaRecorderRef.current) return

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setState('processing')

    // 정지 시점의 실제 경과 ms — floored `duration` state는 표시용이라 0.3~0.99초
    // 발화를 0으로 오거부한다. ms로 직접 판정한다.
    const elapsedMs = Date.now() - startTimeRef.current

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!

      mediaRecorder.onstop = async () => {
        // 이벤트 핸들러 해제 — 정지 후 중복/지연 발화 방지.
        mediaRecorder.onstop = null
        mediaRecorder.ondataavailable = null

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        if (chunksRef.current.length === 0) {
          busyRef.current = false
          if (mountedRef.current) {
            onError?.('no_audio')
            setState('idle')
          }
          resolve()
          return
        }

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })

        if (elapsedMs < 300) {
          busyRef.current = false
          if (mountedRef.current) {
            onError?.('too_short')
            setState('idle')
            setDuration(0)
          }
          resolve()
          return
        }

        const controller = new AbortController()
        abortRef.current = controller
        try {
          const formData = new FormData()
          formData.append('audio', blob)

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          })

          // 언마운트 후엔 setState·콜백 발화 금지.
          if (!mountedRef.current) return

          if (!response.ok) {
            // 서버의 한국어 data.error 텍스트 대신 HTTP status로 코드 결정
            // (문구·채널 결정은 소비 컴포넌트 몫 — 422 = 인식 실패).
            onError?.(response.status === 422 ? 'no_text' : 'stt_failed')
            return
          }

          const data = await response.json()
          if (!mountedRef.current) return
          if (data.text) {
            onTranscribed?.(data.text)
          } else {
            onError?.('no_text')
          }
        } catch (err) {
          // abort는 정상 취소이므로 오류로 통지하지 않는다.
          if (err instanceof Error && err.name === 'AbortError') return
          console.error('[useVoiceRecorder] STT 실패:', err)
          if (mountedRef.current) onError?.('stt_failed')
        } finally {
          abortRef.current = null
          busyRef.current = false
          if (mountedRef.current) {
            setState('idle')
            setDuration(0)
          }
          resolve()
        }
      }

      mediaRecorder.stop()
    })
  }, [state, onTranscribed, onError])

  // 타이머 콜백이 ref로 호출하는 stopRecording을 항상 최신 버전으로 유지.
  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  // 전사 없이 폐기.
  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (mediaRecorderRef.current && state === 'recording') {
      // 정지 전 핸들러 해제 — 취소인데 onstop이 STT를 태우지 않게.
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // 진행 중 STT fetch 취소 + in-flight 잠금 해제.
    abortRef.current?.abort()
    abortRef.current = null
    busyRef.current = false

    chunksRef.current = []
    setState('idle')
    setDuration(0)
  }, [state])

  return { state, duration, startRecording, stopRecording, cancelRecording, isSupported }
}
