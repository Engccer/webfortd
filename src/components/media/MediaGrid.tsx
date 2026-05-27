"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { MEDIA_ITEMS, filterMediaItems } from "@/lib/media-curation"
import { MediaCard } from "./MediaCard"

export function MediaGrid() {
  const [filtered, setFiltered] = useState(MEDIA_ITEMS)
  const [query, setQuery] = useState("")

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
          onChange={(e) => {
            setQuery(e.target.value)
            setFiltered(filterMediaItems({ query: e.target.value }))
          }}
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
