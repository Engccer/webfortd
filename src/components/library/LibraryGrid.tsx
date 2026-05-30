"use client"

import { useMemo, useState } from "react"
import type { LibraryCategory, LibraryItem } from "@/lib/library-catalog"
import { LibraryCard } from "./LibraryCard"
import { LibrarySearch } from "./LibrarySearch"

/**
 * M3: items는 server 페이지가 published 게이트(getPreviewActive)를 적용해 주입.
 * 검색·카테고리 필터는 *주입된 items*에서만 파생(useMemo) — 전역 LIBRARY_ITEMS를 client가
 * import하지 않으므로 draft 메타데이터가 번들에 실리지 않고, router.refresh로 items prop이
 * 갱신되면 filtered가 자동 재계산되어 stale state가 없다 (codex-rescue P1 #2·#3).
 */
export function LibraryGrid({ items }: { items: LibraryItem[] }) {
  const [filters, setFilters] = useState<{
    category: LibraryCategory | "all"
    query: string
  }>({ category: "all", query: "" })

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return items.filter((item) => {
      if (filters.category !== "all" && item.category !== filters.category) return false
      if (q) {
        const hay = `${item.title} ${item.organization} ${item.summary}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, filters])

  return (
    <div>
      <LibrarySearch onChange={setFilters} />
      {filtered.length === 0 ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
        >
          검색 결과가 없습니다.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <LibraryCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
