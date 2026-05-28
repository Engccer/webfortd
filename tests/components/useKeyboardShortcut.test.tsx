import { describe, it, expect, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut"

function fireKeyDown(init: KeyboardEventInit & { target?: EventTarget }) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  if (init.target) {
    init.target.dispatchEvent(event)
  } else {
    window.dispatchEvent(event)
  }
  return event
}

describe("useKeyboardShortcut", () => {
  it("triggers handler on metaKey+key match", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    fireKeyDown({ key: "b", metaKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("triggers on ctrlKey when mod=true (non-mac)", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    fireKeyDown({ key: "b", ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("does not trigger on bare key without modifier when mod=true", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    fireKeyDown({ key: "b" })
    expect(handler).not.toHaveBeenCalled()
  })

  it("does not trigger when mod=false but modifier is pressed", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "Escape", mod: false }, handler))
    fireKeyDown({ key: "Escape", metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it("calls preventDefault by default", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    const event = fireKeyDown({ key: "b", metaKey: true })
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not call preventDefault when preventDefault=false", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true, preventDefault: false }, handler))
    const event = fireKeyDown({ key: "b", metaKey: true })
    expect(event.defaultPrevented).toBe(false)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("skips handler when focus inside input (IME protection)", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    fireKeyDown({ key: "b", metaKey: true, target: input })
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it("skips when focus in textarea", () => {
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    ta.focus()
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    fireKeyDown({ key: "b", metaKey: true, target: ta })
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(ta)
  })

  it("skips when focus in contentEditable", () => {
    const div = document.createElement("div")
    div.contentEditable = "true"
    document.body.appendChild(div)
    div.focus()
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    fireKeyDown({ key: "b", metaKey: true, target: div })
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(div)
  })

  it("allows in input when allowInInput=true", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true, allowInInput: true }, handler))
    fireKeyDown({ key: "b", metaKey: true, target: input })
    expect(handler).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })

  it("respects shift modifier when shift=true", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "b", mod: true, shift: true }, handler))
    fireKeyDown({ key: "b", metaKey: true, shiftKey: false })
    expect(handler).not.toHaveBeenCalled()
    fireKeyDown({ key: "b", metaKey: true, shiftKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("removes listener on unmount", () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcut({ key: "b", mod: true }, handler))
    unmount()
    fireKeyDown({ key: "b", metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it("uses latest handler ref without re-registering listener", () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    const { rerender } = renderHook(({ h }: { h: () => void }) => useKeyboardShortcut({ key: "b", mod: true }, h), {
      initialProps: { h: h1 },
    })
    fireKeyDown({ key: "b", metaKey: true })
    expect(h1).toHaveBeenCalledTimes(1)
    rerender({ h: h2 })
    fireKeyDown({ key: "b", metaKey: true })
    expect(h2).toHaveBeenCalledTimes(1)
    expect(h1).toHaveBeenCalledTimes(1) // not called again
  })

  it("triggers bare Escape key (mod default false)", () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: "Escape" }, handler))
    fireKeyDown({ key: "Escape" })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
