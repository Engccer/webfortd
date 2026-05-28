"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/navigation"

export interface SidebarNavProps {
  items: NavItem[]
  pathname: string
  onNavigate: () => void
}

/**
 * 현재 pathname까지의 경로에 있는 부모 항목의 href 집합을 반환한다.
 * 예) pathname="/legacy/about/purpose"이고 "/legacy/about" 하위에
 * "/legacy/about/purpose"가 있으면 Set(["/legacy/about"])를 반환.
 */
function pathToBranch(items: NavItem[], pathname: string): Set<string> {
  const result = new Set<string>()
  function visit(level: NavItem[]): boolean {
    for (const item of level) {
      const onThisHref = pathname === item.href || pathname.startsWith(item.href + "/")
      if (onThisHref) {
        // 자식이 있고 pathname이 더 깊은 경우에만 이 부모를 확장
        if (item.children && item.children.length > 0 && pathname !== item.href) {
          result.add(item.href)
          visit(item.children)
        }
        return true
      }
    }
    return false
  }
  visit(items)
  return result
}

export function SidebarNav({ items, pathname, onNavigate }: SidebarNavProps) {
  const autoExpanded = useMemo(() => pathToBranch(items, pathname), [items, pathname])

  /**
   * 사용자 명시 오버라이드를 두 집합으로 관리한다.
   * - forcedOpen: 사용자가 명시적으로 펼친 항목
   * - forcedClosed: 사용자가 명시적으로 접은 항목
   *
   * 최종 확장 집합 = (autoExpanded ∪ forcedOpen) \ forcedClosed
   *
   * useEffect 없이 pathname 변경 시 autoExpanded가 재계산되면
   * expandedHrefs도 자동으로 갱신된다.
   */
  const [forcedOpen, setForcedOpen] = useState<Set<string>>(() => new Set<string>())
  const [forcedClosed, setForcedClosed] = useState<Set<string>>(() => new Set<string>())

  /**
   * pathname 변경을 감지해 forcedClosed를 클리어한다.
   * 이렇게 해야 사용자가 서브트리를 떠났다가 다시 들어왔을 때 forced-close가
   * 캐리오버되지 않아 활성 페이지가 `hidden` ul 안에 묻히는 BLOCKER 회귀 차단.
   * WCAG 2.4.3 / 2.4.1: 활성 페이지는 항상 Tab/스크린리더로 도달 가능해야 함.
   *
   * AppSidebar T6 패턴과 동일: useRef로 이전 pathname 추적 + useEffect로 변경 감지.
   * render-body setState 패턴 회피 — commit 후 한 번만 실행되어 cascading render 없음.
   * setForcedClosed는 항상 안정적인 참조이므로 deps에 포함해도 무한 루프 없음.
   */
  const lastPathnameRef = useRef(pathname)
  useEffect(() => {
    if (pathname === lastPathnameRef.current) return
    lastPathnameRef.current = pathname
    // pathname 변경 시 사용자 강제 접기 초기화 — 활성 페이지가 hidden ul에 묻히는 a11y 회귀 차단.
    // 루프 없음: 다음 실행 시 ref 가드(pathname === lastPathnameRef.current)가 early-return.
    // setForcedClosed는 useState의 안정적 참조이므로 deps 포함 시에도 무한 루프 없음.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pathname 변경 시 강제 접기 초기화는 외부 상태(URL) 동기화 목적이므로 허용
    setForcedClosed(new Set())
  }, [pathname, setForcedClosed])

  const expandedHrefs = useMemo(() => {
    const result = new Set(autoExpanded)
    for (const href of forcedOpen) result.add(href)
    for (const href of forcedClosed) result.delete(href)
    return result
  }, [autoExpanded, forcedOpen, forcedClosed])

  /**
   * 항목의 현재 확장 상태를 반전시킨다.
   * currentlyOpen: 호출 시점의 expandedHrefs 기반 상태를 전달받아
   * effect 없이 올바른 방향으로 처리한다.
   */
  const toggleExpand = useCallback((href: string, currentlyOpen: boolean) => {
    if (currentlyOpen) {
      setForcedClosed((prev) => new Set([...prev, href]))
      setForcedOpen((prev) => {
        const next = new Set(prev)
        next.delete(href)
        return next
      })
    } else {
      setForcedOpen((prev) => new Set([...prev, href]))
      setForcedClosed((prev) => {
        const next = new Set(prev)
        next.delete(href)
        return next
      })
    }
  }, [])

  return (
    <nav aria-label="주 메뉴">
      <ul className="space-y-0.5">
        {items.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            pathname={pathname}
            level={0}
            expandedHrefs={expandedHrefs}
            toggleExpand={toggleExpand}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  )
}

interface SidebarNavItemProps {
  item: NavItem
  pathname: string
  level: number
  expandedHrefs: Set<string>
  toggleExpand: (href: string, currentlyOpen: boolean) => void
  onNavigate: () => void
}

function SidebarNavItem({
  item,
  pathname,
  level,
  expandedHrefs,
  toggleExpand,
  onNavigate,
}: SidebarNavItemProps) {
  const hasChildren = !!item.children && item.children.length > 0
  const open = expandedHrefs.has(item.href)
  const isActive = pathname === item.href
  // children 컨테이너 id — 슬래시는 `_`로 구별 인코딩 후 나머지 비영숫자는
  // `-`로 대체. `/a/b`와 `/a-b`가 같은 id로 충돌하는 것을 회피.
  const childrenId = `sidebar-children-${item.href
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "-")}`

  // TODO(post-T12): ↑↓ 형제 간 이동 (spec D8). Tab/Shift+Tab으로 동일 동작 가능
  // 하므로 deferred — VoiceOver 사용자는 VO 키를 사용하므로 우선순위 낮음.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLAnchorElement>) => {
      if (!hasChildren) return
      if (e.key === "ArrowRight") {
        e.preventDefault()
        if (!open) toggleExpand(item.href, false)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        if (open) toggleExpand(item.href, true)
      }
    },
    [hasChildren, open, toggleExpand, item.href],
  )

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md transition-colors",
          isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        )}
        style={{ paddingLeft: `${level * 12}px` }}
      >
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          onClick={onNavigate}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 min-h-11 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring rounded-md",
            isActive ? "font-medium text-primary" : "text-foreground",
          )}
        >
          {item.title}
        </Link>
        {hasChildren && (
          <button
            type="button"
            aria-controls={childrenId}
            aria-expanded={open}
            aria-label={`${item.title} 하위 메뉴 ${open ? "접기" : "펼치기"}`}
            onClick={() => toggleExpand(item.href, open)}
            className="min-h-11 min-w-11 flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-md"
          >
            <ChevronRight
              className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      {hasChildren && (
        /* hidden: React 상태 보존 + Tab 포커스 제외 (collapsed 자식 키보드 unreachable) */
        <ul id={childrenId} hidden={!open} className="mt-0.5 space-y-0.5">
          {item.children!.map((child) => (
            <SidebarNavItem
              key={child.href}
              item={child}
              pathname={pathname}
              level={level + 1}
              expandedHrefs={expandedHrefs}
              toggleExpand={toggleExpand}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
