"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import type { LibraryCategory } from "@/lib/library-catalog"

const CATEGORY_OPTIONS: Array<{ value: LibraryCategory | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "guide", label: "안내서" },
  { value: "policy", label: "정책 보고서" },
  { value: "manual", label: "매뉴얼" },
  { value: "agreement", label: "단체협약" },
]

interface LibrarySearchProps {
  onChange: (state: { category: LibraryCategory | "all"; query: string }) => void
}

export function LibrarySearch({ onChange }: LibrarySearchProps) {
  const [category, setCategory] = useState<LibraryCategory | "all">("all")
  const [query, setQuery] = useState("")

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="library-search" className="sr-only">자료실 검색</label>
        <input
          id="library-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange({ category, query: e.target.value })
          }}
          placeholder="자료 제목·기관 검색"
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="library-category" className="sr-only">자료실 카테고리</label>
        <select
          id="library-category"
          value={category}
          onChange={(e) => {
            const next = e.target.value as LibraryCategory | "all"
            setCategory(next)
            onChange({ category: next, query })
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
