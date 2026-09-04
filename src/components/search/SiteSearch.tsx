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
 * 두 변형은 더 이상 같은 화면에 공존하지 않는다(홈은 hero 단독, 그 밖은 header 단독 —
 * Header가 홈에서 검색창을 숨긴다). 그래서 id·listbox id를 갈라 둘 이유가 없어져
 * 하나로 합쳤다: Alt+3·Cmd+K 타깃 id="search-input"이 어느 화면에서든 그 화면의
 * 검색창을 정확히 가리킨다. ⚠ 두 변형을 한 화면에 다시 세우면 id가 중복되므로,
 * 그때는 id 분리와 단축키 타깃 결정을 함께 되살려야 한다.
 *
 * variant:
 * - "header"(기본): 헤더 우측 소형 검색창. aria-label로 접근명을 준다.
 * - "hero": 위키 홈 상단 대형 검색창(옴니박스). 접근명은 aria-label 대신 연결된
 *   <label>로 준다(시맨틱 우선 — 위원장 지시).
 *   hero에만 음성 받아쓰기 버튼(iOS 위키 탭 검색과 동일 계약, 2026-07-18) — 전사
 *   완료가 곧 쿼리 대체 + 라이브 검색 실행이라 별도 제출 동작이 없고, 결과 건수는
 *   기존 role="status" 영역이 발화한다. 헤더 소형 검색창(h-9)은 44px 터치 타깃이
 *   부적합해 제외.
 *
 * onAsk (옴니박스 듀얼 액션, 2026-09-04 — gildongmu SearchBar 계약 이식):
 *   주면 [AI에게 질문] 버튼과 Cmd/Ctrl+Enter가 활성된다. gildongmu와 달리 [검색]
 *   제출 버튼은 두지 않는다 — 이 검색은 타이핑 즉시 결과가 펼쳐지는 라이브 검색이라
 *   제출할 대상이 없다(검색 결과 페이지 부재). 이동·전송은 호출부 책임이고 여기서는
 *   현재 입력값만 넘긴다. 입력이 비어도 호출한다(빈 채팅 열기).
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import FlexSearch from "flexsearch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { VoiceRecordButton } from "@/components/chat/VoiceRecordButton"
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
  onAsk,
}: {
  variant?: "header" | "hero"
  /** 옴니박스 듀얼 액션 — 현재 입력값을 받아 AI 채팅으로 넘긴다(호출부가 이동 담당). */
  onAsk?: (query: string) => void
} = {}) {
  const isHero = variant === "hero"
  const inputId = "search-input"
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
  // 음성 받아쓰기 오류 (hero 전용) — ChatUI voiceError와 동형의 role=alert 단일 채널
  const [voiceError, setVoiceError] = React.useState<string | null>(null)

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

  // 받아쓰기 완료 = 검색 실행 (iOS 위키 탭 검색과 동일 계약): 쿼리를 전사 텍스트로
  // 대체하고 결과 팝오버를 연다. 라이브 검색이라 setQuery만으로 결과가 즉시 계산되고,
  // 건수는 기존 status 영역이 발화한다. 포커스는 입력창으로 이동 — combobox의
  // aria-activedescendant·화살표 탐색은 입력창 포커스가 전제라, 마이크 버튼에 남기면
  // 결과를 키보드로 만질 경로가 끊긴다(리뷰 P1).
  const handleVoiceTranscribed = React.useCallback(
    (text: string) => {
      setVoiceError(null)
      setQuery(text)
      setOpen(true)
      void ensureIndex()
      inputRef.current?.focus()
    },
    [ensureIndex],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 듀얼 액션 키보드 계약(gildongmu와 동일): Cmd+Enter(윈도우 Ctrl+Enter)=AI 질문.
    // 맨 Enter는 아래에서 검색 결과 이동을 유지한다 — 질문이 검색으로 새지 않게
    // 여기서 먼저 가로채고 return 한다. onAsk 없으면(헤더 검색창) 수식키도 무동작.
    if (onAsk && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onAsk(query)
      return
    }
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
    <div ref={containerRef} className={cn("relative", isHero && "w-full")}>
      {/* hero에서는 시각 텍스트 없는 큰 검색창이라 연결된 <label>로 접근명을 준다.
          (aria-label 대신 시맨틱 <label> — 위원장 지시) */}
      {isHero && (
        <label htmlFor={inputId} className="sr-only">
          장애인교원 위키 검색
        </label>
      )}
      {/* flex-wrap + 입력창 최소폭: 좁은 화면에서는 [AI에게 질문]이 다음 줄로 내려가
          세 컨트롤이 한 줄에 끼여 44px 터치 타깃을 잃는 일이 없다. 데스크탑은 한 줄. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* hero: 아이콘·입력창·지우기를 별도 relative 묶음으로 감싸 우측에 음성 버튼
            자리를 만든다. header: display:contents로 기존 DOM 기여를 그대로 유지
            (absolute 아이콘·지우기는 종전처럼 바깥 relative 컨테이너에 앵커). */}
        <div className={isHero ? "relative min-w-48 flex-1" : "contents"}>
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
        {isHero && (
          <VoiceRecordButton
            // 전사 성공 통지는 받아쓴 원문(버튼 내장, 헌장 §6) — 건수는 기존 role=status가 후속 발화
            idleLabel="음성으로 검색"
            onTranscribed={handleVoiceTranscribed}
            onError={(message) => setVoiceError(message)}
          />
        )}
        {/* 탭 순서 [검색어][지우기][음성][AI에게 질문] — 입력 직후에 두 액션이 이어져
            스크린리더로 훑을 때 "검색은 결과가 바로, 질문은 이 버튼" 구조가 드러난다. */}
        {onAsk && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onAsk(query)}
            // basis-full: 줄바꿈되는 좁은 화면에서 폭을 채워 터치 타깃을 넓힌다.
            // sm 이상은 basis-auto로 돌아가 입력창·음성과 한 줄에 선다.
            className="min-h-11 basis-full px-4 text-base sm:basis-auto"
          >
            AI에게 질문
          </Button>
        )}
      </div>

      {/* 음성 오류 — ChatUI와 동형: 시각 표시 + role=alert 단일 채널, 닫기로 해제 */}
      {isHero && voiceError && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span className="flex-1">{voiceError}</span>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            aria-label="음성 오류 닫기"
            className="text-xs underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring"
          >
            닫기
          </button>
        </div>
      )}

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
            "absolute top-full z-50 mt-1 max-h-96 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg ease-out animate-in fade-in-0 slide-in-from-top-2",
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
