"use client"

/**
 * 사이트 검색 (flexsearch + combobox aria 패턴) — M2
 *
 * - id="search-input"을 실제 <input>에 부여 → Alt+3 단축키가 정확히 포커스 이동.
 * - 한국어 토큰화: tokenize="forward" — 전방 부분 문자열 인덱싱.
 * - 키보드 내비게이션: ↑↓ Enter Escape + aria-activedescendant.
 * - 결과는 Popover 형태(자체 div). 외부 클릭 시 닫힘.
 * - 검색 데이터(kb-index.generated.json ≈1.2MB)는 정적 import 대신
 *   첫 포커스/입력 시점에 dynamic import — 초기 클라이언트 번들에서 분리.
 * - 결과 건수는 상시 mount된 sr-only role="status" 영역으로 알림 (WCAG 4.1.3).
 *
 * variant:
 * - "header"(기본): 헤더 우측 소형 검색창. id="search-input"(Alt+3 타깃) + aria-label.
 * - "hero": 위키 홈 상단 대형 검색창. 헤더와 동시에 존재하므로 id/listbox를 분리하고
 *   접근명은 aria-label 대신 연결된 <label>로 준다(시맨틱 우선 — 위원장 지시).
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import FlexSearch from "flexsearch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import type { SearchDoc } from "@/lib/kb-search-data"

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

export function SiteSearch({
  variant = "header",
}: {
  variant?: "header" | "hero"
} = {}) {
  const isHero = variant === "hero"
  const inputId = isHero ? "hero-search-input" : "search-input"
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  // sr-only 상태 영역에 출력할 알림 (검색 결과 건수 · 준비 중 안내)
  const [announcement, setAnnouncement] = React.useState("")
  // React 19 react-hooks/refs 정합 — index를 ref가 아닌 state로 보관.
  // useMemo 안에서 ref.current 직접 접근 시 cascading render 위험으로 잡힘.
  // state 전환으로 deps 추적이 자연스럽고 useMemo 재계산이 정확.
  const [index, setIndex] = React.useState<DocumentIndex | null>(null)
  const [indexLoading, setIndexLoading] = React.useState(false)
  const loadStartedRef = React.useRef(false)

  // 검색 데이터 지연 로드 — 첫 포커스/입력 시점에만 1.2MB 인덱스 청크를 받아온다.
  const ensureIndex = React.useCallback(async () => {
    if (loadStartedRef.current) return
    loadStartedRef.current = true
    setIndexLoading(true)
    try {
      const { getSearchDocs } = await import("@/lib/kb-search-data")
      setIndex(buildIndex(getSearchDocs()))
    } catch {
      // 로드 실패 시 다음 포커스에서 재시도할 수 있게 가드 해제
      loadStartedRef.current = false
    } finally {
      setIndexLoading(false)
    }
  }, [])

  const results = React.useMemo<ResultHit[]>(() => {
    if (!index || !query.trim()) return []
    return runQuery(index, query)
  }, [query, index])

  React.useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1)
  }, [results])

  // 결과 변경 알림 — 입력 직후가 아닌 디바운스된 시점에 1회만 출력.
  React.useEffect(() => {
    if (!query.trim()) {
      setAnnouncement("")
      return
    }
    if (!index) {
      if (indexLoading) setAnnouncement("검색 준비 중…")
      return
    }
    const t = setTimeout(() => {
      setAnnouncement(
        results.length > 0 ? `검색 결과 ${results.length}건` : "검색 결과가 없습니다.",
      )
    }, 400)
    return () => clearTimeout(t)
  }, [query, index, indexLoading, results])

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

  const listboxId = isHero ? "hero-search-listbox" : "site-search-listbox"

  return (
    <div ref={containerRef} className={cn("relative", isHero && "w-full")}>
      {/* hero에서는 시각 텍스트 없는 큰 검색창이라 연결된 <label>로 접근명을 준다.
          (aria-label 대신 시맨틱 <label> — 위원장 지시) */}
      {isHero && (
        <label htmlFor={inputId} className="sr-only">
          장애인교원 위키 검색
        </label>
      )}
      <div className="flex items-center gap-2">
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            isHero ? "left-4 h-5 w-5" : "left-3 h-4 w-4",
          )}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={inputId}
          // hero는 시맨틱 검색 입력(type="search"). 헤더는 커스텀 X 버튼과의
          // 중복(브라우저 기본 clear 버튼)을 피하려 기존 type="text" 유지.
          type={isHero ? "search" : "text"}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-label={isHero ? undefined : "사이트 검색"}
          placeholder={isHero ? "장애인교원에 관해 검색해 보세요" : "검색..."}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            void ensureIndex()
          }}
          onFocus={() => {
            setOpen(true)
            void ensureIndex()
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "rounded-md border border-input bg-background shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring",
            isHero
              ? "h-14 w-full pl-12 pr-12 text-base sm:text-lg [&::-webkit-search-cancel-button]:appearance-none"
              : "h-9 w-44 pl-9 pr-11 text-sm sm:w-64",
          )}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2"
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

      {/* 상시 mount sr-only 상태 영역 — 결과 건수·빈 결과·준비 중 알림 (WCAG 4.1.3).
          role="status"는 aria-live="polite"를 암시하므로 명시 속성은 생략. */}
      <div role="status" className="sr-only">
        {announcement}
      </div>

      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="검색 결과"
          className={cn(
            "absolute top-full z-50 mt-1 max-h-96 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg",
            isHero ? "inset-x-0 w-full" : "right-0 w-[min(28rem,90vw)]",
          )}
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
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
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

      {open && query && !index && indexLoading && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 rounded-md border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg",
            isHero ? "inset-x-0 w-full" : "right-0 w-[min(28rem,90vw)]",
          )}
        >
          검색 준비 중…
        </div>
      )}

      {open && query && index && results.length === 0 && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 rounded-md border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg",
            isHero ? "inset-x-0 w-full" : "right-0 w-[min(28rem,90vw)]",
          )}
        >
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  )
}
