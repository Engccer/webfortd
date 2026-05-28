import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useMediaQuery } from "@/hooks/useMediaQuery"

type MQListener = (e: MediaQueryListEvent) => void

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<MQListener>()
  const mql = {
    matches: initialMatches,
    media: "",
    addEventListener: (_: string, cb: MQListener) => listeners.add(cb),
    removeEventListener: (_: string, cb: MQListener) => listeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return {
    mql,
    fire(matches: boolean) {
      mql.matches = matches
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
    },
  }
}

describe("useMediaQuery", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("lazy initializer reads matchMedia.matches on client first render", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery("(min-width: 1280px)", false))
    expect(result.current).toBe(true)
  })

  it("respects initialValue prop on SSR phase when matchMedia agrees", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery("(min-width: 1280px)", true))
    expect(result.current).toBe(false)
  })

  it("updates on change event", () => {
    const { fire } = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery("(min-width: 1280px)", false))
    expect(result.current).toBe(false)
    act(() => fire(true))
    expect(result.current).toBe(true)
  })

  it("removes listener on unmount", () => {
    const { mql } = mockMatchMedia(false)
    const removeSpy = vi.spyOn(mql, "removeEventListener")
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 1280px)", false))
    unmount()
    expect(removeSpy).toHaveBeenCalledTimes(1)
  })

  it("does not auto-resync matches when query prop changes (known limitation — see JSDoc)", () => {
    mockMatchMedia(true)
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useMediaQuery(q, false),
      { initialProps: { q: "(max-width: 767px)" } },
    )
    expect(result.current).toBe(true)
    // Swap to a different query whose new matchMedia mock reports false.
    mockMatchMedia(false)
    rerender({ q: "(min-width: 1280px)" })
    // matches still reflects the previous query's value — this is the documented trade-off.
    expect(result.current).toBe(true)
  })
})
