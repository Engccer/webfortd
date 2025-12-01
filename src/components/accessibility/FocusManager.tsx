"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

export function FocusManager() {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // 첫 로드 시에는 스킵 (브라우저 기본 동작 유지)
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // 페이지 이동 시 h1으로 포커스 이동
    const h1 = document.querySelector("h1")
    if (h1) {
      h1.setAttribute("tabindex", "-1")
      h1.focus()
    }
  }, [pathname])

  return null
}
