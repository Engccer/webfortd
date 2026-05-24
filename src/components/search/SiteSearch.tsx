"use client"

/**
 * 사이트 검색 (flexsearch + combobox aria 패턴) — M2
 *
 * - id="search-input"을 실제 <input>에 부여 → Alt+3 단축키가 정확히 포커스 이동.
 * - 한국어 토큰화: tokenize="forward" — 전방 부분 문자열 인덱싱.
 * - 키보드 내비게이션: ↑↓ Enter Escape + aria-activedescendant.
 * - 결과는 Popover 형태(자체 div). 외부 클릭 시 닫힘.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import FlexSearch from "flexsearch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { getSearchDocs, type SearchDoc } from "@/lib/kb-search-data"

const LIMIT = 8

// flexsearch 0.8.x의 Document 제네릭은 DocumentValue 제약이 매우 엄격(string | number | boolean만).
// SearchDoc의 optional string·string[]가 그대로 만족하기 어려워, 인덱스 인스턴스는 동적 타입으로 둔다.
// 런타임 입력/출력은 SearchDoc 형태로 강제하므로 안전.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocumentIndex = any

function buildIndex(docs: SearchDoc[]): DocumentIndex {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx: any = new (FlexSearch.Document as unknown as new (opts: unknown) => unknown)({
    document: {
      id: "slug",
      index: [
        { field: "title", tokenize: "forward" },
        { field: "subtitle", tokenize: "forward" },
        { field: "body_excerpt", tokenize: "forward" },
        { field: "domains", tokenize: "forward" },
        { field: "disability_types", tokenize: "forward" },
      ],
      store: ["slug", "title", "subtitle", "axis", "body_excerpt", "domains", "disability_types", "href"],
    },
  })
  for (const doc of docs) idx.add(doc)
  return idx
}

interface ResultHit {
  slug: string
  doc: SearchDoc
}

function runQuery(idx: DocumentIndex, q: string): ResultHit[] {
  if (!q.trim()) return []
  const groups = idx.search(q, { limit: LIMIT, enrich: true }) as Array<{
    result: Array<{ id: unknown; doc?: SearchDoc }>
  }>
  const seen = new Map<string, ResultHit>()
  for (const group of groups) {
    for (const hit of group.result) {
      const slug = String(hit.id)
      if (seen.has(slug)) continue
      const doc = hit.doc
      if (doc) seen.set(slug, { slug, doc })
    }
  }
  return Array.from(seen.values()).slice(0, LIMIT)
}

export function SiteSearch() {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  // React 19 react-hooks/refs 정합 — index를 ref가 아닌 state로 보관.
  // useMemo 안에서 ref.current 직접 접근 시 cascading render 위험으로 잡힘.
  // state 전환으로 deps 추적이 자연스럽고 useMemo 재계산이 정확.
  const [index, setIndex] = React.useState<DocumentIndex | null>(null)

  // 클라이언트에서만 인덱스 빌드 (SSR mismatch 회피)
  React.useEffect(() => {
    setIndex(buildIndex(getSearchDocs()))
  }, [])

  const results = React.useMemo<ResultHit[]>(() => {
    if (!index || !query.trim()) return []
    return runQuery(index, query)
  }, [query, index])

  React.useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1)
  }, [results])

  // 외부 클릭 닫기
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const close = React.useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (results.length === 0) return
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (results.length === 0) return
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault()
        const href = results[activeIndex].doc.href
        close()
        setQuery("")
        router.push(href)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      if (query) {
        setQuery("")
      } else {
        close()
        inputRef.current?.blur()
      }
    }
  }

  const listboxId = "site-search-listbox"

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id="search-input"
          type="text"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-label="사이트 검색"
          placeholder="검색..."
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-9 w-44 rounded-md border border-input bg-background pl-9 pr-8 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring sm:w-64"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            aria-label="검색어 지우기"
            onClick={() => {
              setQuery("")
              inputRef.current?.focus()
            }}
            type="button"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="검색 결과"
          className="absolute right-0 top-full z-50 mt-1 max-h-96 w-[min(28rem,90vw)] overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {results.map((hit, i) => (
            <li
              key={hit.slug}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "rounded-sm px-3 py-2 text-sm",
                i === activeIndex && "bg-accent text-accent-foreground",
              )}
              // 마우스 hover로 키보드 activeIndex를 빼앗지 않도록 pointer 타입 가드.
              // 키보드 사용자가 ArrowDown으로 탐색 중일 때 마우스 정지 위치가
              // activeIndex를 덮어쓰는 회귀를 방지.
              onPointerMove={(e) => {
                if (e.pointerType === "mouse") setActiveIndex(i)
              }}
            >
              <Link
                href={hit.doc.href}
                onClick={() => {
                  close()
                  setQuery("")
                }}
                className="block focus:outline-none"
                tabIndex={-1}
              >
                <div className="font-medium">{hit.doc.title}</div>
                {hit.doc.subtitle && (
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {hit.doc.subtitle}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  {hit.doc.domains.slice(0, 3).map((d) => (
                    <span
                      key={d}
                      className="rounded bg-muted px-1.5 py-0.5"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {open && query && results.length === 0 && (
        <div
          role="status"
          className="absolute right-0 top-full z-50 mt-1 w-[min(28rem,90vw)] rounded-md border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg"
        >
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  )
}
