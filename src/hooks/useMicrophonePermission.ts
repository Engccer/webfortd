'use client'

/**
 * Phase 3 M7.1 — 마이크 권한 관리 훅.
 *
 * 출처: dodo-planet src/hooks/useMicrophonePermission.ts (그대로).
 *
 * - 권한 확인과 요청을 분리 — UX 개선 (한 번 prompt 후 캐시)
 * - Safari 폴백 (permissions.query 미지원) — localStorage 캐시
 * - 모바일 UX 버퍼 500ms (권한 팝업 닫힘 → 앱 포커스 복귀 시간)
 */

import { useState, useCallback, useRef } from 'react'

export type MicPermissionState =
  | 'idle'
  | 'checking'
  | 'needsPermission'
  | 'ready'
  | 'denied'

interface UseMicrophonePermissionReturn {
  permissionState: MicPermissionState
  checkPermission: () => Promise<MicPermissionState>
  requestPermission: () => Promise<boolean>
  reset: () => void
}

const STORAGE_KEY = 'webfortd_mic_permission_cache'

// JSDOM/시크릿/iframe 등 localStorage 비활성 환경 대비 safe wrapper.
function safeGetItem(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function safeSetItem(value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value)
    }
  } catch {
    // silent
  }
}

export function useMicrophonePermission(): UseMicrophonePermissionReturn {
  const [permissionState, setPermissionState] = useState<MicPermissionState>('idle')
  const streamRef = useRef<MediaStream | null>(null)

  const checkPermission = useCallback(async (): Promise<MicPermissionState> => {
    setPermissionState('checking')
    try {
      if (navigator.permissions?.query) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (result.state === 'granted') {
            setPermissionState('ready')
            safeSetItem('granted')
            return 'ready'
          } else if (result.state === 'denied') {
            setPermissionState('denied')
            safeSetItem('denied')
            return 'denied'
          } else {
            setPermissionState('needsPermission')
            return 'needsPermission'
          }
        } catch {
          // permissions.query 실패 시 폴백
        }
      }
      const cached = safeGetItem()
      if (cached === 'granted') {
        setPermissionState('ready')
        return 'ready'
      } else if (cached === 'denied') {
        setPermissionState('denied')
        return 'denied'
      }
      setPermissionState('needsPermission')
      return 'needsPermission'
    } catch (error) {
      console.error('[useMicrophonePermission] check 실패:', error)
      setPermissionState('needsPermission')
      return 'needsPermission'
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setPermissionState('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      safeSetItem('granted')
      await new Promise((resolve) => setTimeout(resolve, 500))
      setPermissionState('ready')
      return true
    } catch (error) {
      console.error('[useMicrophonePermission] request 거부:', error)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        safeSetItem('denied')
        setPermissionState('denied')
      } else {
        setPermissionState('needsPermission')
      }
      return false
    }
  }, [])

  const reset = useCallback(() => setPermissionState('idle'), [])

  return { permissionState, checkPermission, requestPermission, reset }
}
