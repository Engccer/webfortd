"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut"
import { writeSidebarCookieClient } from "@/lib/sidebar-cookie"
import { FocusManager } from "@/components/accessibility/FocusManager"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { Header } from "./Header"
import { AppSidebar } from "./AppSidebar"
import { Footer } from "./Footer"
import { cn } from "@/lib/utils"

export interface AppShellProps {
  children: ReactNode
  initialExpanded: boolean
  /** AdminBar 등 페이지 최상단 바 슬롯 — 모바일 overlay focus trap(inert) 범위에 포함시키기
      위해 AppShell 내부에서 렌더한다 (WCAG 2.1.2). */
  topBar?: ReactNode
}

export function AppShell({ children, initialExpanded, topBar }: AppShellProps) {
  // SSR-safe initial isMobile: assume desktop (true initialValue means xl matches)
  // until client mount confirms the actual viewport. Cookie's initialExpanded
  // is desktop-only state; mobile overlay is ephemeral and always starts closed.
  const isDesktop = useMediaQuery("(min-width: 1280px)", true)
  const isMobile = !isDesktop

  return (
    <SidebarProvider initialExpanded={initialExpanded} initialIsMobile={isMobile}>
      <SidebarSync isMobile={isMobile} />
      <FocusManager />
      <AppShellInner topBar={topBar}>{children}</AppShellInner>
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

function AppShellInner({ children, topBar }: { children: ReactNode; topBar?: ReactNode }) {
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

  // 모바일 overlay 닫힘: 햄버거 버튼으로 포커스 복귀 + aria-live 알림 (WCAG 2.4.3).
  // 햄버거 버튼은 Header 내부 — id가 없으므로 aria-controls 선택자로 참조.
  // 닫힘 transition과 같은 commit에서 content wrapper inert가 해제되므로 focus 가능.
  const prevMobileOpenRef = useRef(isMobileOpen)
  useEffect(() => {
    const wasOpen = prevMobileOpenRef.current
    prevMobileOpenRef.current = isMobileOpen
    if (!isMobile || !wasOpen || isMobileOpen) return
    const hamburger = document.querySelector<HTMLElement>(
      'button[aria-controls="app-sidebar"]',
    )
    hamburger?.focus()
    const announce = setTimeout(() => setLiveMessage("메뉴를 닫았습니다."), 0)
    const clear = setTimeout(() => setLiveMessage(""), 1500)
    return () => {
      clearTimeout(announce)
      clearTimeout(clear)
    }
  }, [isMobile, isMobileOpen])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 본문/메뉴/검색 '건너뛰기'는 sr-only 링크가 아니라 Alt+1/2/3 단축키로 제공한다
          (src/lib/accessibility.ts). 단일 화면 + 햄버거 수납 메뉴라 시각적 skip link는 실익이 없어 제거. */}
      {/* AdminBar 등 상단 바 — 모바일 overlay focus trap에 포함되도록 inert 동일 적용.
          display:contents(.contents)로 박스를 만들지 않아 sticky 동작을 보존한다. */}
      {topBar && (
        <div className="contents" inert={contentInert}>
          {topBar}
        </div>
      )}
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
