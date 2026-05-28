"use client"

import { useEffect, useState, type ReactNode } from "react"
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut"
import { writeSidebarCookieClient } from "@/lib/sidebar-cookie"
import { SkipLink } from "@/components/accessibility/SkipLink"
import { FocusManager } from "@/components/accessibility/FocusManager"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { Header } from "./Header"
import { AppSidebar } from "./AppSidebar"
import { Footer } from "./Footer"
import { cn } from "@/lib/utils"

export interface AppShellProps {
  children: ReactNode
  initialExpanded: boolean
}

export function AppShell({ children, initialExpanded }: AppShellProps) {
  // SSR-safe initial isMobile: assume desktop (true initialValue means xl matches)
  // until client mount confirms the actual viewport. Cookie's initialExpanded
  // is desktop-only state; mobile overlay is ephemeral and always starts closed.
  const isDesktop = useMediaQuery("(min-width: 1280px)", true)
  const isMobile = !isDesktop

  return (
    <SidebarProvider initialExpanded={initialExpanded} initialIsMobile={isMobile}>
      <SidebarSync isMobile={isMobile} />
      <FocusManager />
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  )
}

/**
 * Sync isMobile from viewport into the SidebarContext when the breakpoint
 * crosses 1280px mid-session. Pure effect — does not affect SSR.
 */
function SidebarSync({ isMobile }: { isMobile: boolean }) {
  const { setIsMobile } = useSidebar()
  useEffect(() => {
    setIsMobile(isMobile)
  }, [isMobile, setIsMobile])
  return null
}

function AppShellInner({ children }: { children: ReactNode }) {
  const { isExpanded, isMobile, isMobileOpen, toggle, openSidebar } = useSidebar()
  const [liveMessage, setLiveMessage] = useState("")

  // 접근성 설정 모달 상태 — AppSidebar에서 위로 올림.
  // 사이드바가 inert 상태(닫힘/모바일 오버레이 밖)일 때도 Alt+0으로 열 수 있도록
  // 모달을 사이드바 inert 영역 바깥(AppShell 레벨)에서 렌더링.
  const [a11yOpen, setA11yOpen] = useState(false)

  // Alt+0: 접근성 설정 모달 열기 (DOM click 대신 커스텀 이벤트 — inert 영역 무관하게 동작)
  // Alt+2: 사이드바 포커스 이동 + 필요 시 열기 (main-nav → app-sidebar id 변경 대응)
  useEffect(() => {
    const handler = () => setA11yOpen(true)
    const sidebarHandler = () => {
      openSidebar()
      // 포커스 이동은 다음 렌더 후 사이드바가 visible 상태가 된 뒤 수행
      requestAnimationFrame(() => {
        const sidebar = document.getElementById("app-sidebar")
        if (sidebar instanceof HTMLElement) sidebar.focus()
      })
    }
    window.addEventListener("webfortd:open-accessibility", handler)
    window.addEventListener("webfortd:open-sidebar", sidebarHandler)
    return () => {
      window.removeEventListener("webfortd:open-accessibility", handler)
      window.removeEventListener("webfortd:open-sidebar", sidebarHandler)
    }
  }, [openSidebar])

  // Cmd+B: toggle sidebar
  useKeyboardShortcut({ key: "b", mod: true }, () => {
    toggle()
  })

  // Cmd+K: focus search input
  useKeyboardShortcut({ key: "k", mod: true }, () => {
    const el = document.getElementById("search-input")
    if (el instanceof HTMLElement) el.focus()
  })

  // Desktop toggle: persist to cookie + announce via aria-live.
  // `react-hooks/set-state-in-effect` 규칙 준수: setLiveMessage를 setTimeout으로 감싸
  // 동기 setState 직접 호출 → cascading render 를 회피한다.
  useEffect(() => {
    if (isMobile) return
    writeSidebarCookieClient(isExpanded)
    const msg = isExpanded ? "메뉴를 펼쳤습니다." : "메뉴를 접었습니다."
    const announce = setTimeout(() => setLiveMessage(msg), 0)
    const clear = setTimeout(() => setLiveMessage(""), 1500)
    return () => {
      clearTimeout(announce)
      clearTimeout(clear)
    }
  }, [isExpanded, isMobile])

  // Spec D5 focus trap: when mobile overlay is open, mark the content wrapper
  // (Header + main + Footer) inert so Tab cannot escape into background content.
  // Uses React 19's native `inert` prop (HTML attribute).
  // NOTE: moved from <main> to the wrapping div to also trap Header and Footer.
  const contentInert = isMobile && isMobileOpen

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* SkipLink는 DOM의 가장 첫 위치 — 페이지 진입 첫 Tab으로 도달 가능해야 함.
          모바일 overlay 활성 시는 inert 처리: '본문 바로가기'는 inert main을 가리켜
          무의미하고, '메뉴 바로가기'는 이미 overlay 안에 있는 사이드바를 가리켜 redundant. */}
      <div inert={contentInert}>
        <SkipLink />
      </div>
      <AppSidebar onOpenAccessibility={() => setA11yOpen(true)} />
      {/* AccessibilityToolbar는 사이드바 inert 영역 바깥에 위치 — Alt+0 이벤트 수신 시에도 동작 */}
      <AccessibilityToolbar open={a11yOpen} onOpenChange={setA11yOpen} hideTrigger />
      <div
        className={cn(
          "flex flex-col min-h-screen transition-[padding-left] duration-200 ease-out motion-reduce:transition-none",
          !isMobile && isExpanded ? "xl:pl-72" : "pl-0",
        )}
        inert={contentInert}
      >
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1"
        >
          {children}
        </main>
        <Footer />
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </div>
  )
}
