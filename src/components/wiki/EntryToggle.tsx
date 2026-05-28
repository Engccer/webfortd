"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Archive, BookOpenText } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EntryToggleProps {
  variant?: "default" | "sidebar"
}

export function EntryToggle({ variant = "default" }: EntryToggleProps) {
  const pathname = usePathname()
  const onLegacy = pathname === "/legacy" || pathname.startsWith("/legacy/")

  const isSidebar = variant === "sidebar"

  return (
    <div
      role="group"
      aria-label="사이트 모드 전환"
      className={
        isSidebar
          ? "flex w-full items-center rounded-lg border border-border bg-muted/50 p-0.5 text-sm"
          : "inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs"
      }
    >
      <Link
        href="/"
        aria-current={!onLegacy ? "page" : undefined}
        className={cn(
          isSidebar
            ? "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 font-medium transition-colors"
            : "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          !onLegacy
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <BookOpenText className={isSidebar ? "h-4 w-4" : "h-3 w-3"} aria-hidden="true" />
        위키·채팅
      </Link>
      <Link
        href="/legacy"
        aria-current={onLegacy ? "page" : undefined}
        className={cn(
          isSidebar
            ? "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 font-medium transition-colors"
            : "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          onLegacy
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Archive className={isSidebar ? "h-4 w-4" : "h-3 w-3"} aria-hidden="true" />
        레거시 사이트
      </Link>
    </div>
  )
}
