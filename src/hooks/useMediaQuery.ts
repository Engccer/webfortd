"use client"

import { useEffect, useState } from "react"

/**
 * SSR-safe media query hook.
 *
 * @param query - CSS media query string (e.g. "(min-width: 1280px)"). **Assumed static**
 *                across the consumer's lifetime — if the prop changes, the hook will
 *                re-subscribe to the new query but `matches` will retain the previous
 *                value until the next `change` event fires on the new query. Consumers
 *                that need dynamic queries should adopt `useSyncExternalStore` instead.
 *                This trade-off is intentional to comply with the project's
 *                `react-hooks/set-state-in-effect` lint rule without scaffolding around it.
 * @param initialValue - SSR/first-render value before client mount. Defaults to false.
 *                       Pass true when the server should optimistically assume the query
 *                       matches (e.g., desktop-first defaults wired from a cookie).
 *
 * Two-phase pattern:
 *   1. SSR / first render: returns initialValue (no window access).
 *   2. After mount: effect subscribes to matchMedia and updates on change.
 *
 * The lazy useState initializer reads matchMedia.matches on the client at first render
 * so SSR↔client value mismatch is avoided. The effect only wires the change listener
 * — no synchronous setState inside the effect body.
 */
export function useMediaQuery(query: string, initialValue: boolean = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return initialValue
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}
