"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, BookOpenText } from "lucide-react"
import { cn } from "@/lib/utils"

export function EntryToggle() {
  const pathname = usePathname()
  const onWiki =
    pathname === "/wiki" ||
    pathname.startsWith("/wiki/") ||
    pathname === "/chat" ||
    pathname.startsWith("/chat/")

  return (
    <div
      role="group"
      aria-label="사이트 모드 전환"
      className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs"
    >
      <Link
        href="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          !onWiki
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Building2 className="h-3 w-3" aria-hidden="true" />
        기관용
      </Link>
      <Link
        href="/wiki"
        aria-current={pathname === "/wiki" || pathname.startsWith("/wiki/") ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          onWiki
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <BookOpenText className="h-3 w-3" aria-hidden="true" />
        위키·챗봇
        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
          베타
        </span>
      </Link>
    </div>
  )
}
