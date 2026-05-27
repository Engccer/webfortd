"use client"

import { useState } from "react"
import { LIBRARY_ITEMS, filterLibraryItems, type LibraryCategory } from "@/lib/library-catalog"
import { LibraryCard } from "./LibraryCard"
import { LibrarySearch } from "./LibrarySearch"

export function LibraryGrid() {
  const [filtered, setFiltered] = useState(LIBRARY_ITEMS)

  return (
    <div>
      <LibrarySearch
        onChange={({ category, query }) => {
          const opts = {
            category: category === "all" ? undefined : (category as LibraryCategory),
            query,
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
