import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { useMediaQuery } from "@/hooks/useMediaQuery"

/** SSR 계약 검증용 probe — 훅 값을 텍스트로 렌더. */
function Probe({ query, initial }: { query: string; initial: boolean }) {
  const matches = useMediaQuery(query, initial)
  return <span>{String(matches)}</span>
}

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

  it("클라이언트 렌더는 getSnapshot으로 실제 matchMedia 값을 반영", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery("(min-width: 1280px)", false))
    expect(result.current).toBe(true)
  })

  it("클라이언트 렌더에서는 initialValue가 아니라 matchMedia 값이 우선", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery("(min-width: 1280px)", true))
    expect(result.current).toBe(false)
  })

  it("SSR(renderToString)은 matchMedia가 아니라 initialValue를 렌더 — hydration mismatch 방지", () => {
    // 클라이언트 matchMedia는 false라 답하지만, 서버 렌더는 initialValue(true)를 써야 한다.
    // 서버 HTML이 initialValue로 고정돼야 hydration 시 클라 첫 렌더(server snapshot)와 일치하고,
    // 실제 matchMedia 반영은 hydration 이후로 미뤄져 React #418(서버/클라 분기 mismatch)을 막는다.
    mockMatchMedia(false)
    const html = renderToString(<Probe query="(min-width: 1280px)" initial={true} />)
    expect(html).toContain("true")
    expect(html).not.toContain("false")
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

  it("query prop이 바뀌면 새 query로 재구독·재동기화 (useSyncExternalStore 전환으로 이전 한계 해소)", () => {
    mockMatchMedia(true)
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useMediaQuery(q, false),
      { initialProps: { q: "(max-width: 767px)" } },
    )
    expect(result.current).toBe(true)
    // 다른 query로 교체 — 새 matchMedia mock은 false를 보고.
    mockMatchMedia(false)
    rerender({ q: "(min-width: 1280px)" })
    // 이제 새 query의 값으로 재동기화된다 (subscribe/getSnapshot의 [query] 의존성).
    expect(result.current).toBe(false)
  })
})
