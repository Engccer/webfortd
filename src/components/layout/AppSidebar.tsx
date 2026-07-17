/**
 * NOTE — Focus trap dependency (spec D5):
 *
 * The mobile overlay uses `role="dialog"` + `aria-modal="true"`, which signals
 * assistive technologies but does NOT enforce keyboard focus containment by
 * itself. AppShell (T12) is responsible for applying `inert` to the
 * Header + main + Footer wrapper div whenever `isMobile && isMobileOpen` is true.
 * Without that, Tab from inside the sidebar can escape to Header/Footer DOM.
 *
 * T12 codex-rescue F1: inert이 <main>에만 걸려 있었을 때 Header/Footer로 탈출 가능하던
 * 문제를 래퍼 div로 이동해 완전 차단. Playwright 회귀 가드 추가 (sidebar.spec.ts).
 *
 * Do NOT remove or alter the spec D5 contract without updating both this file
 * and AppShell.
 */

import { useCallback, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { Settings, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNavigation } from "@/lib/navigation"
import { wikiEntries } from "@/lib/wiki-entries"
import { useSidebar } from "@/contexts/SidebarContext"
import { SidebarNav } from "./SidebarNav"
import { WikiEntriesNav } from "./WikiEntriesNav"
import { EntryToggle } from "@/components/wiki/EntryToggle"
import { SignInButton } from "@/components/auth/SignInButton"

export interface AppSidebarProps {
  /** 접근성 설정 모달 열기 콜백. AppShell에서 주입 — 사이드바 inert 바깥에서 모달 제어. */
  onOpenAccessibility: () => void
}

export function AppSidebar({ onOpenAccessibility }: AppSidebarProps) {
  const pathname = usePathname()
  const { isExpanded, isMobileOpen, isMobile, closeMobile } = useSidebar()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const isOpen = isMobile ? isMobileOpen : isExpanded

  // 모바일 overlay: 트랜지션 완료 후 닫기 버튼에 포커스.
  useEffect(() => {
    if (!isMobile || !isMobileOpen) return
    // 100ms: 사이드바 slide-in transition 300ms 시작 후 포커스 이동
    // (전체 트랜지션 완료를 기다리지 않고, 시각적 시작 직후로 SR 사용자 응답성 확보)
    const t = setTimeout(() => closeButtonRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [isMobile, isMobileOpen])

  // 모바일 overlay: 열려 있는 동안 body 스크롤 잠금.
  useEffect(() => {
    if (!isMobile || !isMobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobile, isMobileOpen])

  // 모바일 overlay: ESC 키로 닫기.
  useEffect(() => {
    if (!isMobile || !isMobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      // 다른 dialog(접근성 설정 등)가 열려 있으면 그쪽 Escape 처리에 양보 —
      // 사이드바까지 동시에 닫히는 것을 방지.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      e.preventDefault()
      closeMobile()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isMobile, isMobileOpen, closeMobile])

  // 모바일: pathname 변경 시 자동 닫기.
  // useRef를 effect 안에서 읽고 쓰면 react-hooks/refs 룰을 통과한다(render 중이 아니라 commit 후).
  // 초기 mount는 lastPathnameRef.current === pathname이라 guard가 short-circuit →
  // initialMobileOpen=true 테스트에서 즉시 닫히지 않는다.
  const lastPathnameRef = useRef(pathname)
  useEffect(() => {
    if (pathname === lastPathnameRef.current) return
    lastPathnameRef.current = pathname
    if (isMobile && isMobileOpen) closeMobile()
  }, [pathname, isMobile, isMobileOpen, closeMobile])

  const isLegacyMode = pathname === "/legacy" || pathname.startsWith("/legacy/")

  const handleNavigate = useCallback(() => {
    if (isMobile) closeMobile()
  }, [isMobile, closeMobile])

  const containerCls = cn(
    "flex flex-col bg-background border-r border-border",
    isMobile
      ? cn(
          "fixed top-0 left-0 z-50 h-[100dvh] w-72 shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )
      : cn(
          // Cmd+B 키보드 토글(고빈도)은 무애니메이션 — transition을 다시 걸지 말 것
          "fixed top-0 left-0 z-30 h-[100dvh]",
          isOpen ? "w-72" : "w-0 overflow-hidden",
        ),
  )

  return (
    <>
      {isMobile && (
        // Backdrop z-40. T9 AppShell must render the sidebar AFTER the page header
        // so the backdrop visually covers the sticky header. If header z exceeds 40,
        // raise backdrop to z-[41].
        <div
          aria-hidden="true"
          onClick={closeMobile}
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none",
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          )}
        />
      )}

      <aside
        id="app-sidebar"
        role={isMobile ? "dialog" : "complementary"}
        aria-modal={isMobile ? "true" : undefined}
        // 모바일 overlay는 dialog라 접근명이 필수 — 그때만 이름 부여.
        // 데스크탑 complementary는 무명(landmark 노이즈 최소화, 미니멀 접근성).
        aria-label={isMobile ? "주 메뉴" : undefined}
        aria-hidden={!isOpen}
        // tabIndex={-1}: Alt+2 단축키(src/lib/accessibility.ts)가 포커스를
        // 이 요소로 옮길 수 있도록 프로그래매틱 포커스를 허용.
        // 탭 순서에 추가하지 않음(음수 값).
        tabIndex={-1}
        // React 19 native `inert` prop: 닫힌 사이드바 내부 포커스 제거.
        // aria-hidden만으로는 focusable elements가 Tab 순서에 남아 axe
        // aria-hidden-focus 위반 발생 — inert로 완전히 차단.
        inert={!isOpen}
        className={containerCls}
      >
        {/* 헤더: 메뉴 제목 + 모바일 닫기 버튼 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-base font-semibold text-foreground">메뉴</span>
          {isMobile && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMobile}
              aria-label="메뉴 닫기"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* 스크롤 가능한 내비게이션 영역 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3">
            {isLegacyMode ? (
              <SidebarNav items={mainNavigation} pathname={pathname} onNavigate={handleNavigate} />
            ) : (
              <WikiEntriesNav items={wikiEntries} pathname={pathname} onNavigate={handleNavigate} />
            )}
          </div>

          <div className="border-t border-border" />

          {/* 사이트 모드 전환 */}
          <div className="p-3">
            <EntryToggle variant="sidebar" />
          </div>

          <div className="border-t border-border" />

          {/* 접근성 설정 — onClick은 AppShell이 주입한 onOpenAccessibility.
               AccessibilityToolbar는 AppShell 레벨에서 렌더링되어 사이드바 inert 영향을 받지 않음. */}
          <div className="p-3">
            <button
              type="button"
              onClick={onOpenAccessibility}
              className="flex w-full items-center gap-2 min-h-11 px-3 py-2.5 rounded-md text-sm text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="접근성 설정 열기"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              접근성 설정
            </button>
          </div>
        </div>

        {/* 푸터: 로그인/로그아웃 */}
        <div className="border-t border-border p-3">
          <SignInButton />
        </div>
      </aside>
    </>
  )
}
