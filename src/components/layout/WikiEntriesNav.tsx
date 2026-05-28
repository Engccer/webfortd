"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { WikiEntry } from "@/lib/wiki-entries"

export interface WikiEntriesNavProps {
  items: WikiEntry[]
  pathname: string
  onNavigate: () => void
}

export function WikiEntriesNav({ items, pathname, onNavigate }: WikiEntriesNavProps) {
  return (
    <nav aria-label="위키 메뉴">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 min-h-11 px-3 py-2.5 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
