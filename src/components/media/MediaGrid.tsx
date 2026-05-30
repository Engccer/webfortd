"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import type { MediaItem } from "@/lib/media-curation"
import { MediaCard } from "./MediaCard"

/**
 * M3: items는 server 페이지가 published 게이트(getPreviewActive)를 적용해 주입.
 * 검색 필터는 *주입된 items*에서만 파생(useMemo) — 전역 MEDIA_ITEMS를 client가 import하지
 * 않으므로 draft 메타데이터가 번들에 실리지 않고, router.refresh로 items prop이 갱신되면
 * filtered가 자동 재계산되어 stale state가 없다 (codex-rescue P1 #2·#3).
 */
export function MediaGrid({ items }: { items: MediaItem[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (q) {
        const hay = `${item.caption} ${item.alt} ${item.sourceDocTitle}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, query])

  return (
    <div>
      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="media-search" className="sr-only">미디어 자료실 검색</label>
        <input
          id="media-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="캡션·alt·출처 검색"
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {filtered.length === 0 ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
        >
          검색 결과가 없습니다.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <MediaCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
