"use client"

import { useEffect, useRef } from "react"

export interface ShortcutDescriptor {
  /** Key value (case-insensitive, single char like "b" or special like "Escape"). */
  key: string
  /**
   * Require Cmd (mac) or Ctrl (non-mac). Default false.
   *
   * NOTE: when false, the shortcut will NOT fire if Cmd/Ctrl is incidentally
   * held — bare-key matching is strict, not permissive. This is intentional
   * to avoid Cmd+Escape silently triggering an Escape handler.
   */
  mod?: boolean
  /** Require Shift. Default false. */
  shift?: boolean
  /** Require Alt/Option. Default false. */
  alt?: boolean
  /** Call event.preventDefault() before invoking handler. Default true. */
  preventDefault?: boolean
  /**
   * Allow firing when focus is inside text input / textarea / contenteditable.
   * Default false — IME composition protection.
   */
  allowInInput?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  // isContentEditable is the standard property; contentEditable==="true" covers
  // environments (e.g. jsdom) where isContentEditable is not implemented.
  if (target.isContentEditable || target.contentEditable === "true") return true
  return false
}

/**
 * Register a global keyboard shortcut on window.
 *
 * Handler is stored in a ref so re-renders with a new handler do not re-attach
 * the window listener. ShortcutDescriptor changes do re-attach (correct — the
 * matching criteria changed).
 */
export function useKeyboardShortcut(
  shortcut: ShortcutDescriptor,
  handler: (event: KeyboardEvent) => void,
): void {
  const {
    key,
    mod = false,
    shift = false,
    alt = false,
    preventDefault = true,
    allowInInput = false,
  } = shortcut

  const handlerRef = useRef(handler)
  // 렌더마다 최신 핸들러로 갱신 — 리스너 재등록 없이 stale closure 방지
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return
      const modPressed = event.metaKey || event.ctrlKey
      if (mod && !modPressed) return
      if (!mod && modPressed) return
      if (shift !== event.shiftKey) return
      if (alt !== event.altKey) return
      if (!allowInInput && isEditableTarget(event.target)) return
      if (preventDefault) event.preventDefault()
      handlerRef.current(event)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [key, mod, shift, alt, preventDefault, allowInInput])
}
