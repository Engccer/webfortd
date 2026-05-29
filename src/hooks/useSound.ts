'use client'

/**
 * Phase 3 M7.1 — 사운드 피드백 훅 (단순 버전).
 *
 * dodo-planet useSound 대비:
 *   - traveler/DB 의존 0 (localStorage 토글만)
 *   - sound cache 0 (호출 시 Audio 생성)
 *   - 메서드 2개 (playRecordStart · playRecordStop)
 *
 * 사운드 파일 0 = no-op (M7 carry — 추후 mp3 도입 시 SOUND_PATHS 활성화).
 * 현재는 호출만 safe하게 받고 silent. aria-live가 주된 피드백 매개체.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'webfortd_sound_enabled'

interface UseSoundReturn {
  isEnabled: boolean
  toggle: () => void
  playRecordStart: () => void
  playRecordStop: () => void
}

export function useSound(): UseSoundReturn {
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) {
        // queueMicrotask로 미뤄 set-state-in-effect cascading render 룰 정합
        // (AuthContext와 동일 패턴 — 외부 환경 sync 시 microtask 미루기)
        queueMicrotask(() => setIsEnabled(stored === 'true'))
      }
    } catch {
      // localStorage 비활성(시크릿/iframe) — 기본값 유지
    }
  }, [])

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, String(next))
        }
      } catch {
        // localStorage 비활성 — silent
      }
      return next
    })
  }, [])

  // M7 carry: 실제 mp3 도입 시 new Audio('/sounds/record-start.mp3').play() 활성화.
  // 현재는 silent — aria-live가 주된 피드백.
  const playRecordStart = useCallback(() => {
    if (!isEnabled) return
    // no-op
  }, [isEnabled])

  const playRecordStop = useCallback(() => {
    if (!isEnabled) return
    // no-op
  }, [isEnabled])

  return { isEnabled, toggle, playRecordStart, playRecordStop }
}
