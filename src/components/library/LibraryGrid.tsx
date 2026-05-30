"use client"

import { useState } from "react"
import { filterLibraryItems, type LibraryCategory, type LibraryItem } from "@/lib/library-catalog"
import { LibraryCard } from "./LibraryCard"
import { LibrarySearch } from "./LibrarySearch"

/**
 * M3: items는 server 페이지가 published 게이트를 적용해 주입.
 * includeUnpublished는 admin Draft Mode 여부 — client 검색 재필터 시에도 동일 정책 유지.
 */
export function LibraryGrid({
  items,
  includeUnpublished,
}: {
  items: LibraryItem[]
  includeUnpublished: boolean
}) {
  const [filtered, setFiltered] = useState(items)

  return (
    <div>
      <LibrarySearch
        onChange={({ category, query }) => {
          const opts = {
            category: category === "all" ? undefined : (category as LibraryCategory),
            query,
            includeUnpublished,
          }
          setFiltered(filterLibraryItems(opts))
        }}
      />
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
