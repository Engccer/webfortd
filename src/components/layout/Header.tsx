"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { useSidebar } from "@/contexts/SidebarContext"
import { SiteSearch } from "@/components/search/SiteSearch"
import { Button } from "@/components/ui/Button"

export function Header() {
  const { isExpanded, isMobile, isMobileOpen, toggle } = useSidebar()
  const open = isMobile ? isMobileOpen : isExpanded
  // 홈은 히어로 옴니박스가 단독 검색 표면이다. 여기서 헤더 검색창까지 렌더하면
  // 한 화면에 검색창이 둘이 되고 id="search-input"(Alt+3·Cmd+K 타깃)도 중복된다.
  // 사이드바가 경로로 모드를 가르는 방식과 같은 패턴 — 상태를 새로 두지 않는다.
  const pathname = usePathname()
  const showSearch = pathname !== "/"

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-controls="app-sidebar"
          aria-expanded={open}
          aria-label={open ? "메뉴 접기" : "메뉴 펼치기"}
          className="min-h-11 min-w-11"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md"
        >
          <span className="text-primary">장애인교원</span>
          <span className="hidden sm:inline">교육전념 여건 지원</span>
        </Link>

        <div className="flex-1" />

        {showSearch && <SiteSearch />}
      </div>
    </header>
  )
}
