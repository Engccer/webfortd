"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { type NavItem } from "@/lib/navigation"

interface SidebarProps {
  items: NavItem[]
  title?: string
}

export function Sidebar({ items, title }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav className="w-64 shrink-0" aria-label="사이드바 메뉴">
      {title && (
        <h2 className="mb-4 text-lg font-bold text-foreground">{title}</h2>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <SidebarItem key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  )
}

interface SidebarItemProps {
  item: NavItem
  pathname: string
  level?: number
}

function SidebarItem({ item, pathname, level = 0 }: SidebarItemProps) {
  const isActive = pathname === item.href
  const isParentActive = pathname.startsWith(item.href) && item.href !== "/"

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          level > 0 && "ml-4 border-l border-border pl-4",
          isActive
            ? "bg-accent font-medium text-primary"
            : isParentActive
              ? "text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {isActive && <ChevronRight className="h-4 w-4" />}
        <span>{item.title}</span>
      </Link>
      {item.children && isParentActive && (
        <ul className="mt-1 space-y-1">
          {item.children.map((child) => (
            <SidebarItem
              key={child.href}
              item={child}
              pathname={pathname}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
