"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * SSR-safe media query hook (useSyncExternalStore 기반).
 *
 * @param query - CSS media query string (e.g. "(min-width: 1280px)").
 * @param initialValue - 서버 렌더 및 hydration 시 사용할 값. 기본 false.
 *                       데스크톱-우선 기본값이면 true를 넘긴다.
 *
 * 동작:
 *   1. 서버 렌더 + hydration: `getServerSnapshot`(= initialValue)을 사용한다.
 *      → 서버 HTML과 클라이언트 첫 렌더가 항상 일치 (React #418 hydration mismatch 방지).
 *   2. hydration 이후: `getSnapshot`(= 실제 matchMedia)으로 전환되고, 이후 `change`
 *      이벤트마다 자동 갱신된다. query prop이 바뀌면 새 query로 재구독·재동기화된다.
 *
 * 이전 구현(lazy useState 초기화로 첫 렌더에서 window.matchMedia를 읽던 방식)은
 * 서버/클라 분기(`typeof window`)로 hydration mismatch를 유발했다. useSyncExternalStore는
 * 서버 스냅샷과 클라 스냅샷을 분리해 이 문제를 구조적으로 제거한다.
 */
export function useMediaQuery(query: string, initialValue: boolean = false): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    // 클라이언트에서만 호출됨 (서버 렌더는 getServerSnapshot 사용).
    if (typeof window === "undefined" || !window.matchMedia) return initialValue
    return window.matchMedia(query).matches
  }, [query, initialValue])

  const getServerSnapshot = useCallback(() => initialValue, [initialValue])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
