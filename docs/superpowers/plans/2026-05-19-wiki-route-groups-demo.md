# Wiki Route Groups Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** webfortd 코드베이스에 Route Groups를 도입해 `(gov)` 보수 랜딩과 `(wiki)` 비전 entry를 단일 코드베이스로 병행하고, 위키 entry 페이지와 챗봇 mock UI까지 데모 가능한 상태로 만든다.

**Architecture:**
- Next.js 16 App Router의 **Route Groups** 기능으로 `app/(gov)/`와 `app/(wiki)/` 두 영역 분리. URL에는 영향 없음.
- root `layout.tsx`는 `<html>`/`<body>`/`<ThemeProvider>`/접근성 컴포넌트만 책임. 헤더·푸터는 각 그룹 layout이 책임.
- atomic 페이지 6개 axis(`disability-types`/`policies`/`agreements`/`domains`/`regions`/`uncategorized`)는 그룹 밖에 그대로 둔다. `KbPageLayout`이 `fixed inset-0 z-50` 풀스크린이라 root Header 없어도 무관.
- `(wiki)/wiki/page.tsx` = 검색 prominent + 인기 atomic 페이지 카드 + 챗봇 진입 버튼. `(wiki)/chat/page.tsx` = mock 챗봇 UI(하드코드 응답 사전).

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS 4, lucide-react, `next-themes`. 챗봇은 mock(AI SDK 미사용 — Phase 3에서 도입).

**Scope 외:**
- 실제 인증·DB 연결·RAG 임베딩 (Phase 2~3)
- 소셜 피드 (Phase 4)
- AI Elements 도입 (Phase 3)

---

## 파일 구조 매핑

### 신규 디렉터리/파일

| 경로 | 책임 |
|------|------|
| `src/app/(gov)/` | Route Group — 관공서 보수 랜딩 |
| `src/app/(gov)/layout.tsx` | (gov) 전용 layout — 현재 Header/Footer 사용 |
| `src/app/(wiki)/` | Route Group — 위원장 비전 entry |
| `src/app/(wiki)/layout.tsx` | (wiki) 전용 layout — 미니멀 헤더 + EntryToggle |
| `src/app/(wiki)/wiki/page.tsx` | wiki entry — 검색 prominent + 인기 페이지 + 챗봇 진입 |
| `src/app/(wiki)/chat/page.tsx` | 챗봇 mock UI 페이지 |
| `src/components/wiki/WikiHero.tsx` | 검색 prominent hero (client component) |
| `src/components/wiki/PopularPages.tsx` | 인기 atomic 페이지 카드 grid |
| `src/components/wiki/EntryToggle.tsx` | `(gov)` ↔ `(wiki)` 토글 (양쪽 헤더에 노출) |
| `src/components/chat/ChatMockUI.tsx` | 챗봇 mock UI — useState로 메시지 관리, 하드코드 응답 |
| `src/lib/wiki-popular.ts` | 인기 atomic 페이지 슬러그 사전 (수동 큐레이션) |
| `src/lib/chat-mock-responses.ts` | mock 응답 사전 |

### 이동 (현재 경로 → 새 경로)

| 현재 | 이동 후 |
|------|---------|
| `src/app/page.tsx` | `src/app/(gov)/page.tsx` |
| `src/app/about/` | `src/app/(gov)/about/` |
| `src/app/support/` | `src/app/(gov)/support/` |
| `src/app/resources/` | `src/app/(gov)/resources/` (전체) |
| `src/app/rights/` | `src/app/(gov)/rights/` |
| `src/app/stories/` | `src/app/(gov)/stories/` |
| `src/app/participate/` | `src/app/(gov)/participate/` |

### 수정

| 파일 | 변경 |
|------|------|
| `src/app/layout.tsx` | Header/Footer/SkipLink/FocusManager 제거 → root는 html/body/ThemeProvider만 |
| `src/components/layout/Header.tsx` | `<EntryToggle />` 추가 (검색 좌측) |

### 그대로 유지 (Route Group 밖)

| 경로 | 이유 |
|------|------|
| `src/app/disability-types/[slug]/` | atomic axis |
| `src/app/policies/[slug]/` | atomic axis |
| `src/app/agreements/[slug]/` | atomic axis |
| `src/app/domains/[slug]/` | atomic axis |
| `src/app/regions/[slug]/` | atomic axis |
| `src/app/uncategorized/[slug]/` | atomic axis |
| `src/app/globals.css`, `src/app/favicon.ico` | 정적 자산 |

---

## Task 1: 데모 브랜치 생성

**Files:** —

- [ ] **Step 1: 현재 브랜치 + 깨끗한 상태 확인**

Run: `git status -s && git branch --show-current`
Expected: 빈 출력 (clean) + 현재 브랜치(`phase-1-5b-86-auto-rerun` 또는 `master`).

PR B 진행 중인 브랜치에서 분기하면 안 됨. 반드시 `master`로 이동 후 분기.

- [ ] **Step 2: master 체크아웃 + 최신 동기화**

Run: `git checkout master && git pull origin master`
Expected: `Already up to date.` 또는 fast-forward.

- [ ] **Step 3: 데모 브랜치 생성**

Run: `git checkout -b wiki-route-groups-demo`
Expected: `Switched to a new branch 'wiki-route-groups-demo'`

---

## Task 2: (gov) Route Group 디렉터리 + 기존 페이지 이동

**Files:**
- Create: `src/app/(gov)/` (디렉터리)
- Move: 위 "이동" 테이블의 7개 경로

- [ ] **Step 1: (gov) 디렉터리 생성**

Run: `mkdir -p "src/app/(gov)"`

- [ ] **Step 2: 페이지 이동 (git mv 사용 — 히스토리 보존)**

Run:
```bash
git mv src/app/page.tsx "src/app/(gov)/page.tsx"
git mv src/app/about "src/app/(gov)/about"
git mv src/app/support "src/app/(gov)/support"
git mv src/app/resources "src/app/(gov)/resources"
git mv src/app/rights "src/app/(gov)/rights"
git mv src/app/stories "src/app/(gov)/stories"
git mv src/app/participate "src/app/(gov)/participate"
```

- [ ] **Step 3: 빌드 통과 확인 (URL은 동일해야 함)**

Run: `npm run build 2>&1 | tail -40`
Expected: `✓ Compiled successfully`. 정적 페이지 수가 이전과 동일(564개 근처) — Route Group은 URL에 영향 없으므로.

- [ ] **Step 4: 커밋**

Run:
```bash
git add -A
git commit -m "refactor: introduce (gov) route group for traditional landing pages"
```

---

## Task 3: root layout 슬림화 + (gov) layout 신규

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/(gov)/layout.tsx`

- [ ] **Step 1: (gov) layout 신규 작성**

Create `src/app/(gov)/layout.tsx`:

```tsx
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export default function GovLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: root layout 슬림화**

Modify `src/app/layout.tsx` — `Header`/`Footer`/`SkipLink`/`FocusManager` import와 사용 제거. `<main>` 요소도 제거 (각 그룹 layout이 책임). 다음으로 교체:

```tsx
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "장애인교원 교육전념 여건 지원",
    template: "%s | 장애인교원 교육전념 여건 지원",
  },
  description:
    "장애인교원의 교육활동을 보호하고 교육활동에 전념할 수 있는 여건 및 기반을 마련합니다.",
  keywords: [
    "장애인교원",
    "교육전념",
    "지원제도",
    "편의지원",
    "보조공학기기",
    "근로지원인",
  ],
  authors: [{ name: "장애인교원 교육전념 여건 지원" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "장애인교원 교육전념 여건 지원",
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-contrast="default" data-underline-links="false" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: (gov) layout에 SkipLink/FocusManager 이동**

Modify `src/app/(gov)/layout.tsx`:

```tsx
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { SkipLink } from "@/components/accessibility/SkipLink"
import { FocusManager } from "@/components/accessibility/FocusManager"

export default function GovLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SkipLink />
      <FocusManager />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </>
  )
}
```

- [ ] **Step 4: 빌드 통과 + 시각 확인 (홈 + atomic 1건)**

Run:
```bash
npm run build 2>&1 | tail -20
npm run start &
sleep 4
curl -s http://localhost:3000/ | grep -c "장애인교원" # >0
curl -s http://localhost:3000/disability-types/2024-staff-p-183 | grep -c "특수 마우스" # >0
kill %1
```
Expected: 빌드 성공, 두 grep 모두 양수.

- [ ] **Step 5: 커밋**

Run:
```bash
git add src/app/layout.tsx "src/app/(gov)/layout.tsx"
git commit -m "refactor: move Header/Footer/accessibility to (gov) layout, slim root"
```

---

## Task 4: 인기 페이지 사전 + EntryToggle 컴포넌트

**Files:**
- Create: `src/lib/wiki-popular.ts`
- Create: `src/components/wiki/EntryToggle.tsx`

- [ ] **Step 1: 인기 페이지 사전 작성**

Create `src/lib/wiki-popular.ts`:

```ts
export interface PopularPage {
  slug: string
  href: string
  title: string
  axis: string
  reason: string
}

export const POPULAR_PAGES: PopularPage[] = [
  {
    slug: "ordinance-comparison",
    href: "/resources/law/ordinance-comparison",
    title: "시도교육청 편의지원 조례 비교 분석",
    axis: "정책·법령",
    reason: "9개 시도 조례 비교 (2026-03-11 최신본)",
  },
  {
    slug: "2024-staff-p-183",
    href: "/disability-types/2024-staff-p-183",
    title: "특수 마우스",
    axis: "장애유형별",
    reason: "지체·뇌병변장애 교원 보조공학기기",
  },
  {
    slug: "2024-staff-p-159",
    href: "/disability-types/2024-staff-p-159",
    title: "비교과 활동 내용 입력 (학교생활기록부)",
    axis: "장애유형별",
    reason: "학생부 입력 보조 지원",
  },
  {
    slug: "2024-jbu-p-062",
    href: "/policies/2024-jbu-p-062",
    title: "정서적 학대",
    axis: "정책·법령",
    reason: "교권 보호 관련 정책",
  },
]
```

- [ ] **Step 2: EntryToggle 컴포넌트 작성**

Create `src/components/wiki/EntryToggle.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, BookOpenText } from "lucide-react"
import { cn } from "@/lib/utils"

export function EntryToggle() {
  const pathname = usePathname()
  const onWiki = pathname.startsWith("/wiki") || pathname.startsWith("/chat")

  return (
    <div
      role="group"
      aria-label="사이트 모드 전환"
      className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs"
    >
      <Link
        href="/"
        aria-current={!onWiki ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          !onWiki
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Building2 className="h-3 w-3" aria-hidden="true" />
        기관용
      </Link>
      <Link
        href="/wiki"
        aria-current={onWiki ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          onWiki
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <BookOpenText className="h-3 w-3" aria-hidden="true" />
        위키·챗봇
        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
          베타
        </span>
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: (gov) Header에 EntryToggle 노출**

Modify `src/components/layout/Header.tsx`. `<SiteSearch />` 컴포넌트 바로 앞에 `<EntryToggle />` 삽입:

```tsx
// 상단 import 추가
import { EntryToggle } from "@/components/wiki/EntryToggle"

// 113번 줄 근처 SiteSearch 앞에 추가
<div className="flex items-center gap-2">
  <EntryToggle />
  <SiteSearch />
  {/* Mobile Menu (기존) ... */}
</div>
```

- [ ] **Step 4: 빌드 통과 확인**

Run: `npm run build 2>&1 | tail -10`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: 커밋**

Run:
```bash
git add src/lib/wiki-popular.ts "src/components/wiki/EntryToggle.tsx" src/components/layout/Header.tsx
git commit -m "feat: add EntryToggle + popular pages dictionary"
```

---

## Task 5: (wiki) Route Group + layout

**Files:**
- Create: `src/app/(wiki)/layout.tsx`

- [ ] **Step 1: (wiki) 디렉터리 생성**

Run: `mkdir -p "src/app/(wiki)/wiki" "src/app/(wiki)/chat"`

- [ ] **Step 2: (wiki) layout 작성**

Create `src/app/(wiki)/layout.tsx`:

```tsx
import Link from "next/link"
import { BookOpenText, MessageCircle } from "lucide-react"
import { SkipLink } from "@/components/accessibility/SkipLink"
import { FocusManager } from "@/components/accessibility/FocusManager"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { EntryToggle } from "@/components/wiki/EntryToggle"
import { SiteSearch } from "@/components/search/SiteSearch"

export default function WikiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SkipLink />
      <FocusManager />
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Link
                href="/wiki"
                className="flex items-center gap-2 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <BookOpenText className="h-5 w-5 text-primary" aria-hidden="true" />
                <span>장교조 위키</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  베타
                </span>
              </Link>
              <nav aria-label="위키 메뉴" className="hidden md:block">
                <ul className="flex items-center gap-1 text-sm">
                  <li>
                    <Link
                      href="/wiki"
                      className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      위키
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/chat"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      챗봇
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <EntryToggle />
              <SiteSearch />
              <AccessibilityToolbar />
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border bg-muted/30 py-6 text-center text-xs text-muted-foreground">
          <p>장교조 위키는 베타 단계입니다 · 정식 운영 콘텐츠는{" "}
            <Link href="/" className="underline hover:text-foreground">
              기관용 사이트
            </Link>
            에서 확인하세요.
          </p>
        </footer>
      </div>
    </>
  )
}
```

- [ ] **Step 3: 커밋**

Run:
```bash
git add "src/app/(wiki)/layout.tsx"
git commit -m "feat: add (wiki) route group layout with minimal header"
```

---

## Task 6: WikiHero + PopularPages + wiki/page.tsx

**Files:**
- Create: `src/components/wiki/WikiHero.tsx`
- Create: `src/components/wiki/PopularPages.tsx`
- Create: `src/app/(wiki)/wiki/page.tsx`

- [ ] **Step 1: WikiHero 작성**

Create `src/components/wiki/WikiHero.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { Search, ArrowRight } from "lucide-react"
import Link from "next/link"

export function WikiHero() {
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    function focus() {
      const search = document.querySelector<HTMLButtonElement>(
        '[aria-haspopup="dialog"][aria-label*="검색"], [aria-label*="사이트 검색"]'
      )
      search?.click()
    }
    const node = buttonRef.current
    node?.addEventListener("click", focus)
    return () => node?.removeEventListener("click", focus)
  }, [])

  return (
    <section className="bg-gradient-to-b from-primary/5 to-background py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          장애인교원에 관한
          <br className="hidden sm:inline" />
          <span className="text-primary"> 모든 정보를 한 번에</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          535개의 정책·법령·사례·보조공학 페이지가 위키로 연결되어 있습니다.
          단어 하나로 답을 찾거나, 챗봇에게 자연어로 질문하세요.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-input bg-background px-5 text-base text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:min-w-[320px]"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left">검색어를 입력하세요…</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs sm:inline">
              /
            </kbd>
          </button>
          <Link
            href="/chat"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            챗봇에 질문
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: PopularPages 작성**

Create `src/components/wiki/PopularPages.tsx`:

```tsx
import Link from "next/link"
import { POPULAR_PAGES } from "@/lib/wiki-popular"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

export function PopularPages() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
          자주 찾는 문서
        </h2>
        <p className="text-xs text-muted-foreground">큐레이션 · 베타</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {POPULAR_PAGES.map((page) => (
          <Link
            key={page.slug}
            href={page.href}
            className="group focus:outline-none"
          >
            <Card className="h-full transition-colors hover:border-primary hover:bg-primary/5 focus-within:border-primary">
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  {page.axis}
                </Badge>
                <CardTitle className="mt-2 flex items-start justify-between gap-2 text-base">
                  <span>{page.title}</span>
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{page.reason}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: wiki/page.tsx 작성**

Create `src/app/(wiki)/wiki/page.tsx`:

```tsx
import type { Metadata } from "next"
import { WikiHero } from "@/components/wiki/WikiHero"
import { PopularPages } from "@/components/wiki/PopularPages"

export const metadata: Metadata = {
  title: "위키",
  description:
    "장애인교원에 관한 535개 정책·법령·사례·보조공학 페이지를 위키 형태로 검색하고 챗봇에 질문하세요.",
}

export default function WikiHomePage() {
  return (
    <>
      <WikiHero />
      <PopularPages />
      <section className="mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-muted-foreground sm:px-6">
        <p>
          이곳은 정보 발견을 빠르게 만드는 베타 entry입니다.
          기관용 정식 메뉴는 우측 상단{" "}
          <span className="font-medium text-foreground">기관용</span> 토글로
          이동하세요.
        </p>
      </section>
    </>
  )
}
```

- [ ] **Step 4: 빌드 + URL 확인**

Run:
```bash
npm run build 2>&1 | tail -10
npm run start &
sleep 4
curl -s http://localhost:3000/wiki | grep -c "장교조 위키\|장애인교원에 관한"
kill %1
```
Expected: 빌드 성공, grep 결과 양수.

- [ ] **Step 5: 커밋**

Run:
```bash
git add "src/components/wiki/WikiHero.tsx" "src/components/wiki/PopularPages.tsx" "src/app/(wiki)/wiki/page.tsx"
git commit -m "feat: add (wiki) entry page with hero + popular pages"
```

---

## Task 7: 챗봇 mock UI

**Files:**
- Create: `src/lib/chat-mock-responses.ts`
- Create: `src/components/chat/ChatMockUI.tsx`
- Create: `src/app/(wiki)/chat/page.tsx`

- [ ] **Step 1: mock 응답 사전 작성**

Create `src/lib/chat-mock-responses.ts`:

```ts
export interface MockResponse {
  keywords: string[]
  answer: string
  sources: { href: string; title: string }[]
}

export const MOCK_RESPONSES: MockResponse[] = [
  {
    keywords: ["특수 마우스", "마우스", "보조공학"],
    answer:
      "지체·뇌병변장애 교원을 위한 특수 마우스에는 트랙볼 마우스, 헤드 마우스, 눈 추적 마우스, 풋 마우스가 있습니다. 손의 정밀 조작이 어려운 경우 트랙볼이, 손·발 사용이 어려운 경우 헤드/눈 추적 마우스가 적합합니다.",
    sources: [
      { href: "/disability-types/2024-staff-p-183", title: "특수 마우스" },
    ],
  },
  {
    keywords: ["조례", "편의지원 조례", "시도교육청"],
    answer:
      "2026년 3월 11일 기준, 9개 시도교육청(부산·대전·충남·충북·인천·경기·전남·전북·광주)이 장애인교원 편의지원 조례를 제정·시행하고 있습니다. 김헌용 위원장이 작성한 비교 분석 보고서에서 지원 내용·전문기관 위탁·사립학교 적용 여부를 비교하실 수 있습니다.",
    sources: [
      {
        href: "/resources/law/ordinance-comparison",
        title: "시도교육청 편의지원 조례 비교 분석",
      },
    ],
  },
  {
    keywords: ["학교생활기록부", "학생부", "비교과"],
    answer:
      "시각장애 또는 손 사용이 제한된 교원이 학교생활기록부 비교과 활동을 입력할 때 지원인력이 보조할 수 있습니다. 교원의 구술 내용을 받아 적거나, 화면 낭독·확대를 도울 수 있습니다.",
    sources: [
      {
        href: "/disability-types/2024-staff-p-159",
        title: "비교과 활동 내용 입력 (학교생활기록부)",
      },
    ],
  },
]

export const FALLBACK_RESPONSE = {
  answer:
    "현재 챗봇은 데모 단계로, 미리 준비된 주제(특수 마우스, 편의지원 조례, 학교생활기록부 입력)에 대해서만 답변합니다. 정식 Phase 3 단계에서 535개 페이지 전체에 대한 RAG 검색이 도입됩니다.",
  sources: [] as { href: string; title: string }[],
}

export function matchMockResponse(input: string) {
  const normalized = input.trim().toLowerCase()
  for (const r of MOCK_RESPONSES) {
    if (r.keywords.some((k) => normalized.includes(k.toLowerCase()))) return r
  }
  return FALLBACK_RESPONSE
}
```

- [ ] **Step 2: ChatMockUI 작성**

Create `src/components/chat/ChatMockUI.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Send, Sparkles, User } from "lucide-react"
import { matchMockResponse } from "@/lib/chat-mock-responses"

interface Message {
  id: number
  role: "user" | "bot"
  content: string
  sources?: { href: string; title: string }[]
}

const SUGGESTIONS = [
  "특수 마우스에는 어떤 종류가 있나요?",
  "편의지원 조례를 제정한 시도교육청은 어디인가요?",
  "학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?",
]

export function ChatMockUI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const counter = useRef(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const userMsg: Message = { id: ++counter.current, role: "user", content: trimmed }
    const matched = matchMockResponse(trimmed)
    const botMsg: Message = {
      id: ++counter.current,
      role: "bot",
      content: matched.answer,
      sources: matched.sources,
    }
    setMessages((prev) => [...prev, userMsg, botMsg])
    setInput("")
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 sm:px-6">
      <div
        ref={listRef}
        aria-live="polite"
        aria-label="대화 내역"
        className="flex-1 overflow-y-auto py-6"
      >
        {messages.length === 0 ? (
          <div className="mx-auto mt-8 max-w-2xl text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              무엇이든 물어보세요
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              데모 단계 — 아래 추천 질문을 클릭하거나 직접 입력해 주세요.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-3">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                  aria-hidden="true"
                >
                  {m.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                    {m.content}
                  </p>
                  {m.sources && m.sources.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                      {m.sources.map((s) => (
                        <li key={s.href}>
                          <Link
                            href={s.href}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            📄 {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border py-4">
        <label htmlFor="chat-input" className="sr-only">
          질문 입력
        </label>
        <div className="flex items-center gap-2">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문을 입력하세요…"
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="off"
          />
          <button
            type="submit"
            aria-label="전송"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          데모 단계 — 미리 준비된 주제 외에는 안내 메시지가 나옵니다.
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: chat/page.tsx 작성**

Create `src/app/(wiki)/chat/page.tsx`:

```tsx
import type { Metadata } from "next"
import { ChatMockUI } from "@/components/chat/ChatMockUI"

export const metadata: Metadata = {
  title: "챗봇 (데모)",
  description:
    "장애인교원 정보에 자연어로 질문하세요. 현재 데모 단계로 미리 준비된 주제에 답변합니다.",
}

export default function ChatPage() {
  return <ChatMockUI />
}
```

- [ ] **Step 4: 빌드 + URL 확인**

Run:
```bash
npm run build 2>&1 | tail -10
npm run start &
sleep 4
curl -s http://localhost:3000/chat | grep -c "무엇이든 물어보세요\|챗봇"
kill %1
```
Expected: 빌드 성공, grep 양수.

- [ ] **Step 5: 커밋**

Run:
```bash
git add src/lib/chat-mock-responses.ts "src/components/chat/ChatMockUI.tsx" "src/app/(wiki)/chat/page.tsx"
git commit -m "feat: add chat mock UI with hardcoded responses for demo"
```

---

## Task 8: 단위 테스트 — mock 응답 매칭

**Files:**
- Create: `tests/chat-mock-responses.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/chat-mock-responses.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  matchMockResponse,
  MOCK_RESPONSES,
  FALLBACK_RESPONSE,
} from "@/lib/chat-mock-responses"

describe("matchMockResponse", () => {
  it("returns FALLBACK_RESPONSE for empty input", () => {
    expect(matchMockResponse("").answer).toBe(FALLBACK_RESPONSE.answer)
  })

  it("matches 특수 마우스 keyword to mouse response with source", () => {
    const r = matchMockResponse("특수 마우스에는 어떤 종류가 있나요?")
    expect(r.answer).toContain("트랙볼")
    expect(r.sources).toEqual([
      { href: "/disability-types/2024-staff-p-183", title: "특수 마우스" },
    ])
  })

  it("matches 조례 keyword to ordinance response", () => {
    const r = matchMockResponse("편의지원 조례 시도교육청")
    expect(r.answer).toContain("9개 시도교육청")
    expect(r.sources[0].href).toBe("/resources/law/ordinance-comparison")
  })

  it("returns FALLBACK_RESPONSE for unknown topic", () => {
    const r = matchMockResponse("점심 메뉴 추천")
    expect(r.answer).toBe(FALLBACK_RESPONSE.answer)
    expect(r.sources).toHaveLength(0)
  })

  it("each MOCK_RESPONSES entry has at least one keyword and one source", () => {
    for (const m of MOCK_RESPONSES) {
      expect(m.keywords.length).toBeGreaterThan(0)
      expect(m.sources.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/chat-mock-responses.test.ts`
Expected: 모듈은 이미 존재하므로 *통과*. (테스트가 *작동을 검증*하는 안전망 역할.) 만일 실패하면 `src/lib/chat-mock-responses.ts` 구현 점검.

- [ ] **Step 3: 전체 테스트 통과 확인**

Run: `npx vitest run`
Expected: 기존 73 + 신규 5 = 78개 테스트 모두 PASS.

- [ ] **Step 4: 커밋**

Run:
```bash
git add tests/chat-mock-responses.test.ts
git commit -m "test: add mock response matching tests"
```

---

## Task 9: Visual QA + 최종 빌드

**Files:** —

- [ ] **Step 1: 로컬 dev 서버 기동**

Run: `npm run dev`
브라우저로 다음 6개 URL 확인:

1. `http://localhost:3000/` — (gov) 홈, EntryToggle 우상단 표시
2. `http://localhost:3000/wiki` — WikiHero + PopularPages 4건
3. `http://localhost:3000/chat` — 빈 상태에서 추천 질문 3개 표시
4. `http://localhost:3000/chat` 입력창에 "특수 마우스" → 응답에 트랙볼 텍스트 + 출처 카드
5. `http://localhost:3000/disability-types/2024-staff-p-183` — atomic 페이지 정상 (root layout 슬림화 후에도 KbPageLayout fullscreen overlay 작동)
6. `http://localhost:3000/resources/law/ordinance-comparison` — (gov) 안으로 이동된 resources/law/[slug] 정상

각 URL 확인 후 다음 표 채우기 (또는 코멘트로 추적):

| URL | 빌드 OK | 화면 OK | 키보드 OK | 비고 |
|-----|---------|---------|-----------|------|

- [ ] **Step 2: dev 서버 종료**

`Ctrl+C` 또는 backgrounded process kill.

- [ ] **Step 3: 마지막 빌드 + 테스트**

Run: `npm run build && npx vitest run`
Expected: 빌드 성공 + 78개 테스트 PASS.

- [ ] **Step 4: 브랜치 푸시 (리뷰 준비)**

Run: `git push -u origin wiki-route-groups-demo`
Expected: 원격 브랜치 생성. PR은 다음 Task의 codex 리뷰 통과 후에 작성.

---

## Task 10: Codex rescue 리뷰 (마일스톤 게이트)

> **글로벌 CLAUDE.md 정책**: 마일스톤급 작업은 PR 작성 직전 `codex:codex-rescue` dispatch 필수. 본 작업은 *Route Groups 도입 + root layout 책임 재분배 + 신규 (wiki) entry + mock 챗봇*으로 여러 계층 cross-cutting → 마일스톤급.

**Files:** —

- [ ] **Step 1: codex:codex-rescue subagent dispatch**

리뷰 포커스 명시:

```
1. Route Groups 구조 정합성 — `(gov)`/`(wiki)` 분리가 Next.js 16 App Router의 권장 패턴에 맞는가.
   특히 root layout 슬림화 후 `<html>`/`<body>`/`<ThemeProvider>`만 남는 구조가
   atomic 페이지 6개 axis 라우트의 SSR·hydration·메타데이터 흐름을 깨지 않는가.
2. Layout 책임 경계 — root vs (gov) vs (wiki)의 SkipLink/FocusManager/AccessibilityToolbar
   중복·누락 없는가. 키보드 사용자가 그룹 사이 이동 시 focus 흐름 일관성 유지되는가.
3. EntryToggle 분기 로직 — `pathname.startsWith("/wiki") || pathname.startsWith("/chat")`이
   `/wiki/`로 시작하는 가상 atomic 페이지 또는 미래 라우트 충돌 가능성 없는가.
   `aria-current` 적용 정합성.
4. KbPageLayout (fixed inset-0 z-50)과 root layout 슬림화의 정합 — atomic 페이지에서
   기존에 root Header가 가려졌던 동작이 정확히 같은 결과를 내는가. 모바일 viewport
   회귀 가능성.
5. ChatMockUI 보안·접근성 — 사용자 입력이 React text node로만 렌더링되는지(XSS 차단),
   `aria-live="polite"` 영역이 새 메시지 도착 시 스크린리더가 읽을지, 키보드만으로
   추천 질문 → 입력 → 전송 흐름 완전 동작하는지.
6. mock 응답 사전의 도메인 invariant — `MOCK_RESPONSES`의 모든 sources 슬러그가
   실제 빌드된 정적 라우트에 존재하는가 (build artifacts 또는 `src/lib/kb-index.generated.json`
   교차 확인). 존재하지 않으면 회의 시연 중 404.

리뷰 포커스 밖: 변수명 등 라인 스타일·관용구 (coderabbit이 담당). RAG·인증·피드 미구현(Phase 2~3).
```

Dispatch 방법: 사용자가 Task 실행 환경에서 `codex:codex-rescue` 서브에이전트를 직접 호출하거나, Claude Code 안에서 `Agent` 도구로 `subagent_type: "codex:codex-rescue"`로 dispatch. 입력은 위 6개 포커스 항목 + 변경된 파일 목록 + 본 plan 경로 (`docs/superpowers/plans/2026-05-19-wiki-route-groups-demo.md`).

- [ ] **Step 2: 리뷰 결과 분류**

받은 지적을 다음 3개 카테고리로 분류:

- **A. 아키텍처 수준** — 구조·계약·invariant gap. 즉시 패치 금지, 먼저 아키텍처 수준 대조 후 결정.
- **B. 도메인 규칙** — atomic 페이지 슬러그 검증, 라우트 충돌, 접근성 invariant. 즉시 수정.
- **C. 스타일·관용구** — coderabbit에 위임.

- [ ] **Step 3: A·B 카테고리 수정 적용**

> **글로벌 정책 재확인**: 같은 변경 영역에 같은 종류 패치가 2라운드 이상 반복되면 즉시 멈추고 계층 선택을 재검토. 추가 패치 금지.

수정 후 Run: `npm run build && npx vitest run`
Expected: 빌드 + 테스트 그린.

- [ ] **Step 4: 수정 커밋 (있는 경우)**

Run:
```bash
git add -A
git commit -m "fix: address codex rescue findings (architecture/domain)"
git push
```

지적 사항이 없으면 이 step skip.

- [ ] **Step 5: 리뷰 결과 요약 기록**

본 plan 파일 끝 "변경 이력" 섹션에 다음 형식으로 한 줄 추가:

```
- 2026-05-19 codex-rescue 통과 (지적 N건: A=X, B=Y, C=Z). 적용 N-Z건, coderabbit 위임 Z건.
```

---

## Task 11: CodeRabbit 리뷰 (옵션) + PR 작성

**Files:** —

- [ ] **Step 1: CodeRabbit 리뷰 실행 (옵션)**

> codex-rescue에서 C 카테고리(스타일·관용구) 지적이 있었거나, 시간 여유가 있으면 진행. 없으면 skip해도 무방.

Skill: `/coderabbit:code-review` 실행 또는 `coderabbit:code-reviewer` 서브에이전트 dispatch.

- [ ] **Step 2: CodeRabbit 지적 적용**

> **글로벌 정책**: codex-rescue와 coderabbit이 같은 결함을 동시에 지적하면 우선순위는 codex-rescue(아키텍처 판단). coderabbit이 동일 결함에 대안적 패치를 제시하면 머지 전에 사용자에게 두 안을 함께 제시.

라인 스타일·관용구·표면 보안 위주로 적용. 도메인 invariant·아키텍처 판단은 coderabbit 의견을 *원문 그대로* 따르지 말고, 위원장과 협의.

수정 후 Run: `npm run build && npx vitest run`
Expected: 빌드 + 테스트 그린.

- [ ] **Step 3: 수정 커밋 + push (있는 경우)**

Run:
```bash
git add -A
git commit -m "style: apply coderabbit suggestions"
git push
```

- [ ] **Step 4: PR 작성**

Run:
```bash
gh pr create --base master --title "feat: introduce (gov)/(wiki) Route Groups + chat mock demo" --body "$(cat <<'EOF'
## Summary
- `app/(gov)/` Route Group으로 기존 관공서 랜딩을 분리하고, `app/(wiki)/`에 위원장 비전 entry(검색 prominent + 인기 페이지 + 챗봇)를 신규 추가
- root `layout.tsx` 슬림화 — Header/Footer/접근성 컴포넌트를 각 그룹 layout으로 이동
- 챗봇 mock UI(`(wiki)/chat`) — 하드코드 응답 사전, 3개 추천 질문, 출처 카드 인용
- atomic 페이지 6개 axis는 그룹 밖에 유지 (양쪽 그룹이 공유)

## Architecture
- Next.js 16 Route Groups (`(gov)` / `(wiki)`) — URL 영향 없음
- 챗봇은 mock 단계 (AI SDK·RAG는 Phase 3에서 도입)
- EntryToggle로 양쪽 헤더에서 entry 전환 가능

## Reviews
- codex-rescue 통과 (Task 10) — 리뷰 포커스: Route Groups 정합성, layout 책임 경계, EntryToggle 분기, KbPageLayout 정합, ChatMockUI 보안·접근성, mock 응답 슬러그 검증
- coderabbit 통과 (Task 11, 옵션) — 라인 스타일·관용구

## 관련 문서
- `docs/DIRECTION_2026.md` §1 (Route Groups 결정 근거)
- `docs/superpowers/plans/2026-05-19-wiki-route-groups-demo.md` (본 PR plan)
- 사업 측면: 자문 디렉터리 `2026/260519_개발방향결정_*.md`

## Test plan
- [ ] `/` 정상 (기존 (gov) 홈)
- [ ] `/wiki` Hero + Popular cards 정상
- [ ] `/chat` 빈 상태 추천 3건, 입력 시 응답 + 출처
- [ ] `/disability-types/2024-staff-p-183` atomic 페이지 정상
- [ ] `/resources/law/ordinance-comparison` (gov) 이전 정상
- [ ] `npm run build` 통과
- [ ] `npx vitest run` 통과 (78개)
- [ ] codex-rescue 리뷰 통과
EOF
)"
```

- [ ] **Step 5: 결과 보고**

PR URL을 위원장에게 전달.

---

## Self-Review (작성자용 점검)

1. **Spec 커버리지** — `docs/DIRECTION_2026.md` §1(Route Groups), §8(오늘 회의 데모 (b) 범위)에 매핑됨. §3(인증)·§4(RAG 챗봇)·§5(소셜 피드)·§6(Feature flag)는 본 plan 범위 밖(Phase 2~4) — 의도된 누락.
2. **placeholder 점검** — "TBD"/"적절한 에러 처리" 없음. 모든 코드 step에 전체 코드 포함. mock 응답 사전·EntryToggle·WikiHero·PopularPages·ChatMockUI·layout 전체 복붙 가능.
3. **타입 일관성** — `MockResponse`/`PopularPage` 인터페이스, `MOCK_RESPONSES`/`POPULAR_PAGES` 상수, `matchMockResponse` 함수명 task 7·8 사이 일치 확인됨. EntryToggle의 `pathname.startsWith("/wiki") || pathname.startsWith("/chat")` 분기와 layout의 `Link href="/wiki"`/`href="/chat"` 라우트 일치 확인됨.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-wiki-route-groups-demo.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Fresh subagent per task + two-stage review.
2. **Inline Execution** — Execute tasks in this session with batch checkpoints.

Which approach?
