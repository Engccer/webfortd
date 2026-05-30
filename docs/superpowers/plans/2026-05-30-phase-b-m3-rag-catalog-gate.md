# Phase B M3 — RAG published-only 기본 + 카탈로그 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RAG 채팅과 카탈로그(/library·/media)가 기본적으로 published 콘텐츠만 노출하고, 관리자가 Draft Mode를 켰을 때만 draft를 포함한다.

**Architecture:** (1) RAG `retrieveChunks`의 `DEFAULT_INCLUDE_DRAFTS`를 `true`→`false`로 바꿔 익명·일반 사용자 기본이 published-only가 되게 한다. (2) `/api/chat` route가 M2의 `getPreviewActive()`(draftMode ∧ isAdmin)를 읽어 admin Draft Mode일 때만 `includeDrafts:true`를 명시 전달. (3) 카탈로그 데이터(`LibraryItem`/`MediaItem`)에 옵셔널 `status?: 'draft' | 'published'` 추가(미표기=published 간주 — 위원장 결정). filter 함수에 `includeUnpublished` 분기. (4) `/library`·`/media` server 페이지가 `getPreviewActive()`로 판정해 published-필터된 배열을 client Grid에 prop 주입. 현 5건은 전부 미표기=published라 노출 동작 불변(빈 사이트 방지) — 게이트 인프라만 깐다.

**Tech Stack:** Next.js 16 App Router(server/client 경계), AI SDK v6 RAG, Supabase match_chunks RPC(0009 화이트리스트), node:test + vitest. M2 자산 재사용: `getPreviewActive` (`src/lib/admin/preview.ts`).

**핵심 불변식:**
- RAG: 익명/일반 사용자 질의는 draft 청크를 절대 인용하지 않는다(`includeDrafts:false`). admin Draft Mode만 draft 포함. 0009 RPC 화이트리스트 + retrieval.ts runtime guard는 그대로(archived/deprecated 영구 차단).
- 카탈로그: 노출 동작은 현 5건 기준 불변(전부 published 간주). 명시적 `status:'draft'`만 비-admin에게 숨김.
- B7 정합: "검수 안 된 콘텐츠 RAG 제외" 실현.

**관련 spec:** `docs/superpowers/specs/2026-05-29-phase-b-preview-mode-publish-design.md` §M3 (결정 B7, 리뷰 포커스 §5 M3, 회귀 가드 §6 M3)

---

## File Structure

**수정:**
- `src/lib/rag/retrieval.ts` — `DEFAULT_INCLUDE_DRAFTS` true→false + 주석 갱신
- `src/app/api/chat/route.ts` — `getPreviewActive()` 읽어 `includeDrafts` 명시 전달 + 주석 갱신
- `src/lib/library-catalog.ts` — `LibraryItem.status?` 추가 + `filterLibraryItems`에 `includeUnpublished` 분기
- `src/lib/media-curation.ts` — `MediaItem.status?` 추가 + `filterMediaItems`에 `includeUnpublished` 분기
- `src/components/library/LibraryGrid.tsx` — `items` prop 수신(초기 상태 주입)
- `src/components/media/MediaGrid.tsx` — `items` prop 수신
- `src/app/(wiki)/library/page.tsx` — server에서 `getPreviewActive()` → published 필터 → Grid prop
- `src/app/(wiki)/media/page.tsx` — 동일
- `tests/rag/retrieval.test.ts` — includeDrafts 기본값 false 검증으로 갱신

**생성:**
- `src/lib/catalog-visibility.ts` — 순수 헬퍼 `isCatalogItemVisible(status, includeUnpublished)` (server-only/next-headers 무의존, 단위 테스트)
- `tests/lib/catalog-visibility.test.ts` — 순수 헬퍼 단위
- `tests/lib/catalog-filter.test.ts` — filterLibraryItems/filterMediaItems의 includeUnpublished 분기 단위

---

## Task 1: 카탈로그 가시성 순수 헬퍼

**Files:**
- Create: `src/lib/catalog-visibility.ts`
- Test: `tests/lib/catalog-visibility.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/lib/catalog-visibility.test.ts`:
```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCatalogItemVisible } from '@/lib/catalog-visibility.ts'

describe('isCatalogItemVisible', () => {
  it('status 미표기(undefined) → 항상 노출 (published 간주)', () => {
    assert.equal(isCatalogItemVisible(undefined, false), true)
    assert.equal(isCatalogItemVisible(undefined, true), true)
  })

  it("status 'published' → 항상 노출", () => {
    assert.equal(isCatalogItemVisible('published', false), true)
    assert.equal(isCatalogItemVisible('published', true), true)
  })

  it("status 'draft' + 비-admin(includeUnpublished=false) → 숨김", () => {
    assert.equal(isCatalogItemVisible('draft', false), false)
  })

  it("status 'draft' + admin(includeUnpublished=true) → 노출", () => {
    assert.equal(isCatalogItemVisible('draft', true), true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && node --conditions react-server --import tsx --test 'tests/lib/catalog-visibility.test.ts'`
Expected: FAIL — `Cannot find module '@/lib/catalog-visibility.ts'`

- [ ] **Step 3: 최소 구현**

`src/lib/catalog-visibility.ts`:
```ts
/**
 * Phase B M3 — 카탈로그(/library·/media) 아이템 가시성 순수 판정.
 * server-only/next-headers 의존 없음 → 단위 테스트 가능.
 *
 * 정책(위원장 결정 2026-05-30): status 미표기는 published 간주(기존 seed 공개 유지).
 * 명시적 'draft'만 비-admin에게 숨김. admin Draft Mode(includeUnpublished=true)면 draft도 노출.
 */
export type CatalogStatus = 'draft' | 'published'

export function isCatalogItemVisible(
  status: CatalogStatus | undefined,
  includeUnpublished: boolean,
): boolean {
  if (status !== 'draft') return true // undefined | 'published' → 항상 노출
  return includeUnpublished
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && node --conditions react-server --import tsx --test 'tests/lib/catalog-visibility.test.ts'`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git add src/lib/catalog-visibility.ts tests/lib/catalog-visibility.test.ts
git commit -m "feat(phase-b-m3): 카탈로그 가시성 순수 헬퍼 + 단위 테스트"
```

---

## Task 2: library-catalog status + filter 분기

**Files:**
- Modify: `src/lib/library-catalog.ts`
- Test: `tests/lib/catalog-filter.test.ts` (생성, library+media 공용)

- [ ] **Step 1: 실패하는 테스트 작성 (library 부분)**

`tests/lib/catalog-filter.test.ts`:
```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterLibraryItems, LIBRARY_ITEMS } from '@/lib/library-catalog.ts'
import { filterMediaItems, MEDIA_ITEMS } from '@/lib/media-curation.ts'

describe('filterLibraryItems — includeUnpublished 분기', () => {
  it('기본(includeUnpublished 미지정) → draft 제외, published/미표기 노출', () => {
    const out = filterLibraryItems({})
    // 현 seed 4건 전부 status 미표기 → 전부 노출
    assert.equal(out.length, LIBRARY_ITEMS.length)
  })

  it('includeUnpublished=false → 명시적 draft 제외', () => {
    const out = filterLibraryItems({ includeUnpublished: false })
    assert.ok(out.every((i) => i.status !== 'draft'))
  })

  it('includeUnpublished=true → draft 포함(전체)', () => {
    const out = filterLibraryItems({ includeUnpublished: true })
    assert.equal(out.length, LIBRARY_ITEMS.length)
  })
})

describe('filterMediaItems — includeUnpublished 분기', () => {
  it('기본 → draft 제외, 미표기 노출', () => {
    const out = filterMediaItems({})
    assert.equal(out.length, MEDIA_ITEMS.length)
  })

  it('includeUnpublished=false → 명시적 draft 제외', () => {
    const out = filterMediaItems({ includeUnpublished: false })
    assert.ok(out.every((i) => i.status !== 'draft'))
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && node --conditions react-server --import tsx --test 'tests/lib/catalog-filter.test.ts'`
Expected: FAIL — `includeUnpublished`·`status` 미존재 타입 에러 또는 런타임 실패

- [ ] **Step 3: library-catalog.ts 수정**

`src/lib/library-catalog.ts`의 `LibraryItem` interface에 status 추가 (line 24 `relatedAtomicPrefix?: string` 위에):
```ts
  relatedAtomicAxis?: string
  relatedAtomicPrefix?: string
  /** M3: 미표기 = published 간주. 명시적 'draft'만 비-admin에게 숨김. */
  status?: import('./catalog-visibility').CatalogStatus
```

(주의: import 문을 파일 상단에 추가하는 대신 inline `import('./catalog-visibility')` type-only import를 써서 런타임 import 0. 또는 상단에 `import type { CatalogStatus } from './catalog-visibility'` 추가하고 `status?: CatalogStatus`로. 후자를 택한다 — 가독성 우선. 따라서 상단 import 블록에 추가:)

`src/lib/library-catalog.ts` line 10 `const STORAGE_BASE` 위에:
```ts
import type { CatalogStatus } from './catalog-visibility'
import { isCatalogItemVisible } from './catalog-visibility'
```

그리고 interface는:
```ts
  relatedAtomicAxis?: string
  relatedAtomicPrefix?: string
  /** M3: 미표기 = published 간주. 명시적 'draft'만 비-admin에게 숨김. */
  status?: CatalogStatus
```

`filterLibraryItems` 시그니처·본문 교체:
```ts
export function filterLibraryItems(opts: {
  category?: LibraryCategory
  query?: string
  includeUnpublished?: boolean
}): LibraryItem[] {
  const { category, query, includeUnpublished = false } = opts
  const q = query?.trim().toLowerCase() ?? ""
  return LIBRARY_ITEMS.filter((item) => {
    if (!isCatalogItemVisible(item.status, includeUnpublished)) return false
    if (category && item.category !== category) return false
    if (q) {
      const hay = `${item.title} ${item.organization} ${item.summary}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
```

- [ ] **Step 4: media-curation.ts 동일 수정**

`src/lib/media-curation.ts` 상단(line 8 `export interface MediaItem` 위)에:
```ts
import type { CatalogStatus } from './catalog-visibility'
import { isCatalogItemVisible } from './catalog-visibility'
```

`MediaItem` interface에 status 추가 (`sourceAxis` 블록 다음, line 25 `}` 위):
```ts
  /** M3: 미표기 = published 간주. 명시적 'draft'만 비-admin에게 숨김. */
  status?: CatalogStatus
```

`filterMediaItems` 교체:
```ts
export function filterMediaItems(opts: {
  axis?: MediaItem["sourceAxis"]
  query?: string
  includeUnpublished?: boolean
}): MediaItem[] {
  const { axis, query, includeUnpublished = false } = opts
  const q = query?.trim().toLowerCase() ?? ""
  return MEDIA_ITEMS.filter((item) => {
    if (!isCatalogItemVisible(item.status, includeUnpublished)) return false
    if (axis && item.sourceAxis !== axis) return false
    if (q) {
      const hay = `${item.caption} ${item.alt} ${item.sourceDocTitle}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && node --conditions react-server --import tsx --test 'tests/lib/catalog-filter.test.ts'`
Expected: PASS (5 tests)

- [ ] **Step 6: tsc + 커밋**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npx tsc --noEmit 2>&1 | grep -iE "library-catalog|media-curation|catalog-visibility" || echo "no catalog tsc errors"`
Expected: no catalog tsc errors

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git add src/lib/library-catalog.ts src/lib/media-curation.ts tests/lib/catalog-filter.test.ts
git commit -m "feat(phase-b-m3): 카탈로그 status 필드 + filter includeUnpublished 분기"
```

---

## Task 3: 카탈로그 Grid items prop 주입

**Files:**
- Modify: `src/components/library/LibraryGrid.tsx`
- Modify: `src/components/media/MediaGrid.tsx`

> Grid를 `items` prop 수신형으로 바꿔 server 페이지가 published-필터된 배열을 주입. client 검색 필터는 그 주입된 배열 위에서 동작(admin이면 draft 포함된 배열, 아니면 published-only 배열). client에서 다시 filterX를 호출할 때도 동일 `includeUnpublished`를 적용해야 검색 중 draft 누설이 없다.

- [ ] **Step 1: LibraryGrid items prop 수신**

`src/components/library/LibraryGrid.tsx` 전체 교체:
```tsx
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
```

- [ ] **Step 2: MediaGrid items prop 수신**

`src/components/media/MediaGrid.tsx` 전체 교체:
```tsx
"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { filterMediaItems, type MediaItem } from "@/lib/media-curation"
import { MediaCard } from "./MediaCard"

/**
 * M3: items는 server 페이지가 published 게이트를 적용해 주입.
 * includeUnpublished는 admin Draft Mode 여부 — client 검색 재필터 시에도 동일 정책 유지.
 */
export function MediaGrid({
  items,
  includeUnpublished,
}: {
  items: MediaItem[]
  includeUnpublished: boolean
}) {
  const [filtered, setFiltered] = useState(items)
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
            setFiltered(filterMediaItems({ query: e.target.value, includeUnpublished }))
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
```

- [ ] **Step 3: tsc 확인 (페이지가 prop 미전달이라 일시 에러 — Task 4에서 해소)**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npx tsc --noEmit 2>&1 | grep -iE "LibraryGrid|MediaGrid|library/page|media/page" | head`
Expected: `library/page.tsx`·`media/page.tsx`에서 "items prop 누락" 에러 (Task 4에서 페이지 수정으로 해소). Grid 자체 에러는 없어야.

- [ ] **Step 4: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git add src/components/library/LibraryGrid.tsx src/components/media/MediaGrid.tsx
git commit -m "feat(phase-b-m3): 카탈로그 Grid items prop 수신형 전환 (server 게이트 주입 준비)"
```

---

## Task 4: 카탈로그 server 페이지 게이트

**Files:**
- Modify: `src/app/(wiki)/library/page.tsx`
- Modify: `src/app/(wiki)/media/page.tsx`

> server 페이지에서 `getPreviewActive()`(M2, admin∧draftMode)로 `includeUnpublished` 판정 → published 필터된 배열을 Grid에 주입.

- [ ] **Step 1: library/page.tsx 게이트**

`src/app/(wiki)/library/page.tsx` 전체 교체:
```tsx
import type { Metadata } from "next"
import { LibraryGrid } from "@/components/library/LibraryGrid"
import { filterLibraryItems } from "@/lib/library-catalog"
import { getPreviewActive } from "@/lib/admin/preview"

export const metadata: Metadata = {
  title: "자료실",
  description: "장애인교원 정책·법령·안내서 원본 PDF·HWPX 자료실. 4건 시작.",
}

export default async function LibraryPage() {
  const includeUnpublished = await getPreviewActive()
  const items = filterLibraryItems({ includeUnpublished })
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">자료실</h1>
        <p className="mt-2 text-muted-foreground">
          정책 보고서·안내서·매뉴얼·단체협약 등 원본 자료를 다운로드할 수 있습니다.
        </p>
      </header>
      <LibraryGrid items={items} includeUnpublished={includeUnpublished} />
    </section>
  )
}
```

- [ ] **Step 2: media/page.tsx 게이트**

먼저 현재 내용 확인: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && cat "src/app/(wiki)/media/page.tsx"`

그 구조에 맞춰, `MediaGrid`를 렌더하는 부분을 다음 패턴으로 수정한다 (default export를 async로, getPreviewActive 판정 후 items 주입):
```tsx
import { filterMediaItems } from "@/lib/media-curation"
import { getPreviewActive } from "@/lib/admin/preview"
// ... 기존 MediaGrid import 유지

export default async function MediaPage() {
  const includeUnpublished = await getPreviewActive()
  const items = filterMediaItems({ includeUnpublished })
  return (
    // ... 기존 헤더 JSX 유지 ...
    <MediaGrid items={items} includeUnpublished={includeUnpublished} />
    // ...
  )
}
```
기존 헤더/섹션 마크업은 보존하고 default export를 async 함수로 바꾸고 `<MediaGrid />` 호출에 `items`·`includeUnpublished` prop만 추가하는 것이 핵심. (기존이 `export default function MediaPage()` 동기 형태이고 `<MediaGrid />`를 prop 없이 렌더하고 있으니, async 전환 + 두 줄 판정 + prop 2개 추가.)

- [ ] **Step 3: tsc 전체 확인 (prop 에러 해소)**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npx tsc --noEmit 2>&1 | grep -iE "LibraryGrid|MediaGrid|library/page|media/page" || echo "no catalog page tsc errors"`
Expected: no catalog page tsc errors

- [ ] **Step 4: eslint**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npx eslint "src/app/(wiki)/library/page.tsx" "src/app/(wiki)/media/page.tsx" src/components/library/LibraryGrid.tsx src/components/media/MediaGrid.tsx`
Expected: clean

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git add "src/app/(wiki)/library/page.tsx" "src/app/(wiki)/media/page.tsx"
git commit -m "feat(phase-b-m3): 카탈로그 server 페이지 published 게이트 (getPreviewActive 주입)"
```

---

## Task 5: RAG published-only 기본 전환

**Files:**
- Modify: `src/lib/rag/retrieval.ts`
- Test: `tests/rag/retrieval.test.ts`

- [ ] **Step 1: 기존 테스트의 기본값 기대 확인 + 갱신**

`tests/rag/retrieval.test.ts`에서 `includeDrafts` 기본값을 검증하는 테스트를 찾는다:
Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && grep -n "includeDrafts\|p_include_drafts\|기본값" tests/rag/retrieval.test.ts`

기본값 `true`를 기대하는 단언이 있으면 `false`로 갱신. (예: `assert.equal(capturedArgs.p_include_drafts, true)` → `false`.) 해당 테스트 케이스 설명도 "기본 published-only"로 수정. 명시적으로 `includeDrafts:true`를 넘기는 테스트가 있으면 그대로 두되 결과가 draft 포함임을 확인.

- [ ] **Step 2: 테스트 실패 확인 (현재 default=true라 false 기대가 깨짐)**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && node --conditions react-server --import tsx --test 'tests/rag/retrieval.test.ts' 2>&1 | grep -E "ℹ tests|ℹ pass|ℹ fail"`
Expected: 갱신한 기본값 테스트가 FAIL (현 코드 default true)

- [ ] **Step 3: retrieval.ts 기본값 전환**

`src/lib/rag/retrieval.ts` line 42-43 교체:
```ts
// Phase B M3 정책 전환(B7): 기본 published-only. draft 포함은 호출자(route)가
// admin Draft Mode일 때만 includeDrafts:true 명시 전달. "검수 안 된 콘텐츠 RAG 제외" 실현.
const DEFAULT_INCLUDE_DRAFTS = false
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && node --conditions react-server --import tsx --test 'tests/rag/retrieval.test.ts' 2>&1 | grep -E "ℹ tests|ℹ pass|ℹ fail"`
Expected: PASS (all)

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git add src/lib/rag/retrieval.ts tests/rag/retrieval.test.ts
git commit -m "feat(phase-b-m3): RAG 기본 published-only (DEFAULT_INCLUDE_DRAFTS false, B7)"
```

---

## Task 6: /api/chat admin Draft Mode 분기

**Files:**
- Modify: `src/app/api/chat/route.ts`

> route가 `getPreviewActive()`(admin∧draftMode)를 읽어 admin Draft Mode일 때만 `includeDrafts:true` 전달. 일반/익명은 retrieval 기본(false)이라 published-only.

- [ ] **Step 1: import 추가**

`src/app/api/chat/route.ts` line 30 `import { ALLOWED_MIMES, MAX_FILE_SIZE } from '@/lib/chat/file-validation.ts'` 아래에:
```ts
import { getPreviewActive } from '@/lib/admin/preview'
```

- [ ] **Step 2: retrieveChunks 호출에 includeDrafts 전달**

`src/app/api/chat/route.ts`의 line 162-170 영역(현재 `let retrieval` ~ `retrieveChunks(retrievalQuery, { topK: RETRIEVAL_TOP_K })`)을 교체:
```ts
  // M3(B7): RAG 기본 published-only. admin Draft Mode일 때만 draft 포함.
  // getPreviewActive() = draftMode().isEnabled ∧ 현재 사용자 isAdmin (M2 cookie 누수 방어 재사용).
  // 익명·일반 사용자는 includeDrafts 생략 → retrieval 기본값 false → 검수 안 된 draft 인용 차단.
  const includeDrafts = await getPreviewActive()
  let retrieval
  try {
    retrieval = await retrieveChunks(retrievalQuery, {
      topK: RETRIEVAL_TOP_K,
      includeDrafts,
    })
  } catch (err) {
```
(기존 try 블록 내부 catch 이하는 그대로 유지. 위는 `let retrieval` 선언부터 `retrieveChunks(...)` 호출까지만 교체하고, 기존 D4 주석 5줄은 삭제.)

- [ ] **Step 3: tsc + eslint**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npx tsc --noEmit 2>&1 | grep -iE "chat/route" || echo "no chat/route tsc errors"`
Expected: no chat/route tsc errors

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npx eslint "src/app/api/chat/route.ts"`
Expected: clean

- [ ] **Step 4: route-handler 테스트 회귀 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && node --conditions react-server --import tsx --test 'tests/rag/route-handler.test.ts' 2>&1 | grep -E "ℹ tests|ℹ pass|ℹ fail"`
Expected: PASS (또는 master baseline과 동일 — getPreviewActive가 server-only draftMode를 읽으므로 node:test에서 mock 불가 시 해당 테스트가 route 전체를 import하지 않는지 확인. import 시 실패하면 그 테스트는 원래 route 전체를 로드하지 않는 구조여야 함 — 실패 시 DONE_WITH_CONCERNS로 보고).

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git add "src/app/api/chat/route.ts"
git commit -m "feat(phase-b-m3): /api/chat admin Draft Mode만 draft 포함 (getPreviewActive 분기)"
```

---

## Task 7: 전체 검증 (lint + 테스트 + build)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: lint 전체**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npm run lint`
Expected: 0 errors (warning은 master baseline 허용)

- [ ] **Step 2: node 단위 테스트 전체**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npm test 2>&1 | grep -E "ℹ tests|ℹ pass|ℹ fail"`
Expected: 신규(catalog-visibility 4 + catalog-filter 5 + retrieval 갱신) PASS. 기존 실패는 master baseline(decompose-source/sitemap/embed-content drift) — 신규 회귀 0.

- [ ] **Step 3: 컴포넌트 테스트**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npx vitest run 2>&1 | grep -E "Test Files|Tests "`
Expected: 전체 PASS (Grid prop 변경이 기존 컴포넌트 테스트 깨지 않는지 — LibraryGrid/MediaGrid 직접 테스트 있으면 prop 추가 필요. 있으면 함께 갱신하고 DONE_WITH_CONCERNS로 보고).

- [ ] **Step 4: 프로덕션 빌드**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3 && npm run build > /tmp/m3-build.log 2>&1; echo "BUILD_EXIT=$?"`
Expected: BUILD_EXIT=0. /library·/media 라우트 정상 빌드(이제 async server page라 ƒ 가능 — getPreviewActive가 draftMode 읽으므로 dynamic 전환은 정상).

검증: `grep -E "BUILD_EXIT|/library|/media" /tmp/m3-build.log`

- [ ] **Step 5: push**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git push -u origin phase-b-m3-impl
```

---

## Task 8: codex-rescue 마일스톤 리뷰 (PR 직전)

**Files:** 없음 (리뷰 전용)

> CLAUDE.md 규칙. **foreground 강제** — main session에서 `codex exec --cd <worktree> --skip-git-repo-check "<프롬프트>"`를 백그라운드(harness 추적) + wall-clock 가드(13분)로 호출. doctor 1회 선확인. gpt-5.5 medium 기본(필요 시 `-c model_reasoning_effort=high`).

리뷰 포커스 (spec §5 M3):
1. RAG 기본 정책 변경(published-only)이 익명/일반 사용자에게 draft 인용을 실제로 차단하는가.
2. admin Draft Mode만 draft 포함 — getPreviewActive의 admin∧draftMode 조건이 route에 정확히 적용됐는가.
3. 카탈로그 게이트: status 미표기=published 간주 정책이 일관되는가, client 검색 재필터 시 draft 누설 없는가(includeUnpublished가 client에도 전달).
4. 0009 RPC 화이트리스트 + retrieval runtime guard가 그대로 보존(archived/deprecated 영구 차단)되는가.
5. server/client 경계: getPreviewActive(server-only)가 client 컴포넌트로 새지 않는가.

- [ ] **Step 1: dispatch + 결과 처리**

P0/P1은 아키텍처 대조 후 수정·재검증. fail signal(5분 무진전·동일명령 반복·Turn aborted) 시 즉시 직접 invariant 검수 fallback(불변식 5개 + 게이트 cross-check). 즉시 지엽 패치 금지.

- [ ] **Step 2: 수정 커밋 (있으면)**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m3
git add -A && git commit -m "fix(phase-b-m3): codex-rescue 리뷰 반영 — <항목>" && git push
```

---

## Task 9: PR + coderabbit + 머지

**Files:** 없음

- [ ] **Step 1: PR 생성** (gh pr create --base master --head phase-b-m3-impl, 본문에 요약+검증+리뷰결과)

- [ ] **Step 2: coderabbit 보완 리뷰** — `coderabbit review --plain --base master` (백그라운드, **완료 대기 후 머지** — M2 교훈). Critical/Warning만 처리, codex와 중복 시 codex 우선, info skip.

- [ ] **Step 3: 위원장 production smoke 안내**:
  1. 익명으로 /chat 질의 → draft 페이지 인용 안 됨 확인(현재 published 8건만 인용).
  2. admin 매직링크 + 미리보기 켜기 → /chat 질의 시 draft 포함 인용 확인.
  3. /library·/media는 현 5건 전부 노출(미표기=published) 유지 확인.

- [ ] **Step 4: 머지 전 stat 검증** — `git log --stat master..HEAD`로 의도한 파일만 바뀌었는지 확인(M2 교훈). 그 후 `gh pr merge <N> --squash --admin --delete-branch`.

- [ ] **Step 5: worktree 정리 + 메모리 갱신** — `git worktree remove`, MEMORY.md에 트랙 C 머지 항목 추가.

---

## Self-Review

**Spec coverage (§M3 1–2):**
- ① RAG admin 분기 (DEFAULT_INCLUDE_DRAFTS true→false + admin Draft Mode만 draft) → Task 5 + Task 6. ✓
- ② 카탈로그 게이트 (published seed만, admin Draft Mode면 draft 포함) → Task 1·2·3·4. ✓

**결정 잠금:** B7(RAG 기본 published-only, admin Draft Mode만 draft) → Task 5·6. 위원장 결정(카탈로그 status 미표기=published) → Task 1. ✓

**회귀 가드 (§6 M3):** 익명 RAG 질의 draft 인용 안 함 → Task 5(기본값)+6(분기). admin Draft Mode RAG draft 포함 → Task 6. 카탈로그 published 필터 → Task 2·3·4. 단위로 catalog-visibility(Task 1)·catalog-filter(Task 2)·retrieval 기본값(Task 5) 커버. ✓

**Placeholder scan:** 모든 코드 step에 실제 코드. media/page.tsx만 "현재 구조 확인 후 패턴 적용"으로 서술(파일이 단순해 실제 교체 코드 제시했고 헤더 보존 지시 명확). ✓

**Type consistency:** `isCatalogItemVisible(status, includeUnpublished)` / `CatalogStatus` / `filterLibraryItems({category?, query?, includeUnpublished?})` / `filterMediaItems({axis?, query?, includeUnpublished?})` / `LibraryGrid({items, includeUnpublished})` / `MediaGrid({items, includeUnpublished})` / `getPreviewActive()` (M2 기존) / `retrieveChunks(q, {topK, includeDrafts})` — Task 간 일치. ✓

**미해결 가정:** route-handler.test.ts·LibraryGrid/MediaGrid 컴포넌트 테스트가 변경에 영향받으면 해당 Task에서 함께 갱신(Step에 명시). master baseline drift 테스트(decompose-source/sitemap/embed-content)는 M3 범위 밖 — Task 7에서 "신규 회귀 0"만 확인하고 carry(트랙 D 또는 별도). getPreviewActive는 M2에서 검증된 자산이라 재구현 없음.
