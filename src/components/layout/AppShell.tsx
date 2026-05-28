"use client"

import { useEffect, useState, type ReactNode } from "react"
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut"
import { writeSidebarCookieClient } from "@/lib/sidebar-cookie"
import { SkipLink } from "@/components/accessibility/SkipLink"
import { FocusManager } from "@/components/accessibility/FocusManager"
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
      <SkipLink />
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
  const { isExpanded, isMobile, isMobileOpen, toggle } = useSidebar()
  const [liveMessage, setLiveMessage] = useState("")

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

  // Spec D5 focus trap: when mobile overlay is open, mark main inert so Tab
  // cannot escape into background content. Uses React 19's native `inert` prop
  // (HTML attribute) on the <main> element.
  const mainInert = isMobile && isMobileOpen

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppSidebar />
      <div
        className={cn(
          "flex flex-col min-h-screen transition-[padding-left] duration-200 ease-out motion-reduce:transition-none",
          !isMobile && isExpanded ? "xl:pl-72" : "pl-0",
        )}
      >
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1"
          inert={mainInert}
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
