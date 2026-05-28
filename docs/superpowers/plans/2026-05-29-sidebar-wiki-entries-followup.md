# 사이드바 위키 진입점 + 콘텐츠/Footer 재구성 구현 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** PR #60 사이드바 리팩터 후속 — 위키 영역 진입점(위키 홈/채팅/자료실/미디어/About) 사이드바 노출 + EntryToggle 라벨 명확화 + 메인 페이지 중복 제거 + Footer 재구성 + 정책 placeholder 페이지 신규.

**Architecture:** `AppSidebar`가 `usePathname()`으로 모드 분기 — `/legacy/*`이면 기존 `SidebarNav`(레거시 트리), 외에는 신규 `WikiEntriesNav`(평면 5 진입). EntryToggle 클릭은 단순 navigate라 모드는 자동 전환. SidebarContext 불변.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind 4, lucide-react, Vitest 3 + RTL 16, Playwright + axe-core.

**Spec:** `docs/superpowers/specs/2026-05-29-sidebar-wiki-entries-followup-design.md` (D1~D10)

---

## 파일 구조

### 신규 (12)
| 경로 | 책임 |
|------|------|
| `src/lib/wiki-entries.ts` | WikiEntry 타입 + 5개 항목 데이터 |
| `src/components/layout/WikiEntriesNav.tsx` | 평면 nav + aria-current |
| `src/app/(wiki)/about/page.tsx` | 사업 소개 placeholder |
| `src/app/(wiki)/privacy/page.tsx` | 개인정보처리방침 placeholder |
| `src/app/(wiki)/terms/page.tsx` | 이용약관 placeholder |
| `src/app/(wiki)/sitemap/page.tsx` | 사이트맵 placeholder |
| `tests/components/WikiEntriesNav.test.tsx` | 컴포넌트 단위 테스트 |
| `tests/components/Footer.test.tsx` | Footer 구조 회귀 가드 |
| `tests/components/wiki-entries-integration.test.tsx` | (wiki)/page.tsx 콘텐츠 회귀 가드 |

### 수정 (8)
| 경로 | 변경 |
|------|------|
| `src/components/layout/AppSidebar.tsx` | usePathname 분기 → WikiEntriesNav OR SidebarNav |
| `src/components/wiki/EntryToggle.tsx` | "이전 버전" → "레거시 사이트" |
| `src/components/layout/Footer.tsx` | rewrite — 운영 주체/관련 사이트/정책 3섹션 + Copyright |
| `src/app/(wiki)/page.tsx` | ChatLibraryMediaEntries import + 사용 제거 |
| `src/components/wiki/RoleEntries.tsx` | "AI 채팅" 단어 검색 후 정리 |
| `src/components/wiki/WikiHero.tsx` | "AI" 단어 검색 후 정리 |
| `src/app/(wiki)/chat/page.tsx` | metadata title "채팅" 확인 |
| `tests/components/AppSidebar.test.tsx` | 모드 분기 테스트 추가 |
| `tests/components/EntryToggle.test.tsx` | 라벨 검증 업데이트 |
| `tests/a11y/sidebar.spec.ts` | 위키 모드 / 레거시 모드 회귀 가드 |

### 보존
- `src/components/layout/SidebarNav.tsx` — 그대로 (레거시 모드에서 재사용)
- `src/components/wiki/ChatLibraryMediaEntries.tsx` — 컴포넌트 자체는 보존 (미래 재사용 여지). `(wiki)/page.tsx`에서 import만 제거.

---

## Task 1: wiki-entries 데이터

**Files:**
- Create: `src/lib/wiki-entries.ts`
- Test: `tests/components/wiki-entries.test.tsx`

- [ ] **Step 1.1 — failing test**

```tsx
import { describe, it, expect } from "vitest"
import { wikiEntries } from "@/lib/wiki-entries"

describe("wiki-entries", () => {
  it("exports exactly 5 entries", () => {
    expect(wikiEntries).toHaveLength(5)
  })

  it("entries are ordered: 위키 홈 → 채팅 → 자료실 → 미디어 → About", () => {
    expect(wikiEntries.map((e) => e.href)).toEqual([
      "/",
      "/chat",
      "/library",
      "/media",
      "/about",
    ])
  })

  it("titles use plain Korean text — no emoji, no 'AI'", () => {
    for (const e of wikiEntries) {
      expect(e.title).not.toMatch(/AI/i)
      // emoji range guard (basic — covers most emoji)
      expect(e.title).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })

  it("each entry has an icon component", () => {
    for (const e of wikiEntries) {
      expect(typeof e.icon).toBe("function") // lucide-react components are forwardRef objects/functions
    }
  })
})
```

- [ ] **Step 1.2 — fail 확인**: `npm run test:components -- wiki-entries` → FAIL.

- [ ] **Step 1.3 — 구현**

```ts
// src/lib/wiki-entries.ts
import type { LucideIcon } from "lucide-react"
import { Home, MessageSquare, FolderArchive, Image as ImageIcon, Info } from "lucide-react"

export interface WikiEntry {
  href: string
  title: string
  description?: string
  icon: LucideIcon
}

export const wikiEntries: WikiEntry[] = [
  { href: "/", title: "위키 홈", icon: Home, description: "메인 진입점" },
  { href: "/chat", title: "채팅", icon: MessageSquare, description: "정책·법령 자연어 질문" },
  { href: "/library", title: "자료실", icon: FolderArchive, description: "PDF 자료실" },
  { href: "/media", title: "미디어", icon: ImageIcon, description: "카드뉴스·인포그래픽" },
  { href: "/about", title: "About", icon: Info, description: "사이트 소개" },
]
```

- [ ] **Step 1.4 — pass 확인**: 4 passed.

- [ ] **Step 1.5 — commit**

```bash
git add src/lib/wiki-entries.ts tests/components/wiki-entries.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): wiki-entries 데이터 (T1)

위키 진입 5개 항목 (위키 홈/채팅/자료실/미디어/About) + lucide icon.
이모지 금지·"AI" 단어 미사용 invariant 테스트 포함.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: WikiEntriesNav 컴포넌트

**Files:**
- Create: `src/components/layout/WikiEntriesNav.tsx`
- Test: `tests/components/WikiEntriesNav.test.tsx`

- [ ] **Step 2.1 — failing test**

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WikiEntriesNav } from "@/components/layout/WikiEntriesNav"
import { wikiEntries } from "@/lib/wiki-entries"

describe("WikiEntriesNav", () => {
  it("renders nav with aria-label '위키 메뉴'", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={() => {}} />)
    expect(screen.getByRole("navigation", { name: "위키 메뉴" })).toBeInTheDocument()
  })

  it("renders 5 items as links", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={() => {}} />)
    expect(screen.getAllByRole("link")).toHaveLength(5)
  })

  it("marks current page link with aria-current=page", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/chat" onNavigate={() => {}} />)
    const chatLink = screen.getByRole("link", { name: /채팅/ })
    expect(chatLink).toHaveAttribute("aria-current", "page")
  })

  it("only the current link has aria-current=page", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/chat" onNavigate={() => {}} />)
    const allLinks = screen.getAllByRole("link")
    const currentCount = allLinks.filter((l) => l.getAttribute("aria-current") === "page").length
    expect(currentCount).toBe(1)
  })

  it("calls onNavigate when a link is clicked", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={onNavigate} />)
    await user.click(screen.getByRole("link", { name: /자료실/ }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it("icons are aria-hidden (visual only)", () => {
    const { container } = render(
      <WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={() => {}} />,
    )
    const icons = container.querySelectorAll("svg")
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"))
  })
})
```

- [ ] **Step 2.2 — fail 확인**: FAIL.

- [ ] **Step 2.3 — 구현**

```tsx
// src/components/layout/WikiEntriesNav.tsx
"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { WikiEntry } from "@/lib/wiki-entries"

export interface WikiEntriesNavProps {
  items: WikiEntry[]
  pathname: string
  onNavigate: () => void
}

export function WikiEntriesNav({ items, pathname, onNavigate }: WikiEntriesNavProps) {
  return (
    <nav aria-label="위키 메뉴">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 min-h-11 px-3 py-2.5 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2.4 — pass 확인**: 6 passed.

- [ ] **Step 2.5 — commit**

```bash
git add src/components/layout/WikiEntriesNav.tsx tests/components/WikiEntriesNav.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): WikiEntriesNav — 평면 5개 진입 (T2)

nav + ul + li 평면 구조. aria-current=page on active. min-h-11 터치 타깃.
lucide 아이콘 aria-hidden 처리 (시각 보조 only).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: AppSidebar 모드 분기

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `tests/components/AppSidebar.test.tsx`

- [ ] **Step 3.1 — failing test (`tests/components/AppSidebar.test.tsx`에 추가)**

```tsx
// 기존 wrap 함수에 pathname prop 추가 (vi.mock 부분)
// 그리고 다음 테스트 추가:

it("wiki mode (non-legacy path): renders WikiEntriesNav with 위키 메뉴 label", () => {
  // vi.mock 변경: usePathname → "/"
  render(wrap(<AppSidebar />))
  expect(screen.getByRole("navigation", { name: "위키 메뉴" })).toBeInTheDocument()
  // legacy nav (주 메뉴 label) absent
  expect(screen.queryByRole("navigation", { name: "주 메뉴" })).not.toBeInTheDocument()
})

it("legacy mode (/legacy/*): renders SidebarNav with 주 메뉴 label", () => {
  // vi.mock 변경: usePathname → "/legacy/support"
  // mock 패턴은 vi.doMock 또는 vi.hoisted 사용
  // (구현 단계에서 적절한 패턴 선택)
})
```

**참고**: `vi.mock`은 모듈 단위 hoist되므로 한 test 파일 안에서 pathname을 동적으로 바꾸기 어려움. 해결:
- (a) 두 별도 test 파일로 분리 (`AppSidebar.wiki.test.tsx` + `AppSidebar.legacy.test.tsx`)
- (b) `vi.hoisted` + 가변 객체로 path 동적 변경
- (c) `usePathname` mock 함수를 `vi.fn()` 형태로 두고 `mockReturnValue` 재호출

**구현자 권장**: (c) 패턴.

```tsx
// 최상단
const mockedPathname = vi.hoisted(() => vi.fn(() => "/"))
vi.mock("next/navigation", () => ({
  usePathname: mockedPathname,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}))
// 각 test 안:
mockedPathname.mockReturnValue("/legacy/support")
```

- [ ] **Step 3.2 — fail 확인**: 신규 두 test FAIL.

- [ ] **Step 3.3 — AppSidebar 구현 수정**

`AppSidebar.tsx` import 추가:
```tsx
import { wikiEntries } from "@/lib/wiki-entries"
import { WikiEntriesNav } from "./WikiEntriesNav"
```

모드 분기 추가:
```tsx
const isLegacyMode = pathname === "/legacy" || pathname.startsWith("/legacy/")

// 기존 SidebarNav 부분을 다음으로 교체:
<div className="p-3">
  {isLegacyMode ? (
    <SidebarNav items={mainNavigation} pathname={pathname} onNavigate={handleNavigate} />
  ) : (
    <WikiEntriesNav items={wikiEntries} pathname={pathname} onNavigate={handleNavigate} />
  )}
</div>
```

- [ ] **Step 3.4 — pass 확인**: 2 신규 + 기존 AppSidebar 12 = 14 pass.

- [ ] **Step 3.5 — commit**

```bash
git add src/components/layout/AppSidebar.tsx tests/components/AppSidebar.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): AppSidebar pathname 자동 모드 분기 (T3)

/legacy/* → SidebarNav(레거시 6개 트리), 외 → WikiEntriesNav(위키 5개).
EntryToggle 클릭이 navigate를 일으키면 자동 전환. SidebarContext 불변.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: EntryToggle 라벨

**Files:**
- Modify: `src/components/wiki/EntryToggle.tsx`
- Modify: `tests/components/EntryToggle.test.tsx`

- [ ] **Step 4.1 — failing test 추가**

```tsx
it("legacy button label is '레거시 사이트' (not '이전 버전')", () => {
  render(<EntryToggle />)
  expect(screen.getByRole("link", { name: /레거시 사이트/ })).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: /이전 버전/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 4.2 — fail 확인**: FAIL (현재는 "이전 버전").

- [ ] **Step 4.3 — `EntryToggle.tsx` 라벨 변경**

```tsx
// 기존 "이전 버전" → "레거시 사이트"
<Archive className={iconSize} aria-hidden="true" />
레거시 사이트
```

- [ ] **Step 4.4 — pass 확인**: 모든 EntryToggle 테스트 + 신규 1 = 4 pass.

- [ ] **Step 4.5 — commit**

```bash
git add src/components/wiki/EntryToggle.tsx tests/components/EntryToggle.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): EntryToggle '이전 버전' → '레거시 사이트' (T4)

별도 사이트로 이동한다는 사실을 명시. '이전 버전'은 의미 모호.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `(wiki)/page.tsx` ChatLibraryMediaEntries 제거

**Files:**
- Modify: `src/app/(wiki)/page.tsx`
- Create: `tests/components/wiki-entries-integration.test.tsx`

- [ ] **Step 5.1 — failing 구조 가드 test (fs 기반)**

```tsx
import { describe, it, expect } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(__dirname, "../../src")

describe("(wiki)/page.tsx — content sections", () => {
  it("imports WikiHero, RoleEntries, PopularPages but NOT ChatLibraryMediaEntries", () => {
    const content = fs.readFileSync(path.join(ROOT, "app/(wiki)/page.tsx"), "utf8")
    expect(content).toMatch(/WikiHero/)
    expect(content).toMatch(/RoleEntries/)
    expect(content).toMatch(/PopularPages/)
    expect(content).not.toMatch(/ChatLibraryMediaEntries/)
  })
})
```

- [ ] **Step 5.2 — fail 확인**: FAIL.

- [ ] **Step 5.3 — `(wiki)/page.tsx` 수정**

`ChatLibraryMediaEntries` import 라인 + 사용 라인 제거. 나머지 그대로.

- [ ] **Step 5.4 — pass 확인**: 1 passed.

- [ ] **Step 5.5 — commit**

```bash
git add 'src/app/(wiki)/page.tsx' tests/components/wiki-entries-integration.test.tsx
git commit -m "$(cat <<'EOF'
refactor(wiki): (wiki)/page.tsx — ChatLibraryMediaEntries 제거 (T5)

사이드바 위키 진입 5개와 중복. 메인 콘텐츠는 WikiHero + RoleEntries +
PopularPages만. 컴포넌트 자체는 보존(미래 재사용 여지).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Footer 재구성

**Files:**
- Modify: `src/components/layout/Footer.tsx`
- Create: `tests/components/Footer.test.tsx`

- [ ] **Step 6.1 — failing test**

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Footer } from "@/components/layout/Footer"

describe("Footer", () => {
  it("removes the old 브랜드/바로가기 sections", () => {
    render(<Footer />)
    // 브랜드 섹션의 h2 "장애인교원 교육전념 여건 지원"는 footer 안에 없어야 함
    // (Copyright 1줄은 텍스트로 있을 수 있지만 h2는 없어야 함)
    const heading = screen.queryByRole("heading", { name: "장애인교원 교육전념 여건 지원", level: 2 })
    expect(heading).not.toBeInTheDocument()
    expect(screen.queryByText("바로가기")).not.toBeInTheDocument()
  })

  it("renders 운영 주체 section with email/phone placeholder", () => {
    render(<Footer />)
    expect(screen.getByRole("heading", { name: "운영 주체" })).toBeInTheDocument()
    expect(screen.getByText(/support@/)).toBeInTheDocument()
    expect(screen.getByText(/044-/)).toBeInTheDocument()
  })

  it("renders 관련 사이트 section (currently empty placeholder)", () => {
    render(<Footer />)
    expect(screen.getByRole("heading", { name: "관련 사이트" })).toBeInTheDocument()
  })

  it("renders 정책 section with 3 links to /privacy /terms /sitemap", () => {
    render(<Footer />)
    expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "사이트맵" })).toHaveAttribute("href", "/sitemap")
  })

  it("renders Copyright with current year", () => {
    render(<Footer />)
    const year = new Date().getFullYear()
    expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument()
  })
})
```

- [ ] **Step 6.2 — fail 확인**: FAIL.

- [ ] **Step 6.3 — `Footer.tsx` rewrite**

```tsx
import Link from "next/link"

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* 운영 주체 */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              운영 주체
            </h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>주소: 본 정보는 추후 갱신됩니다</p>
              <p>이메일: support@example.go.kr</p>
              <p>전화: 044-XXX-XXXX</p>
            </div>
          </section>

          {/* 관련 사이트 */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              관련 사이트
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              관련 사이트 안내는 준비 중입니다.
            </p>
          </section>

          {/* 정책 */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              정책
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/sitemap"
                  className="text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                >
                  사이트맵
                </Link>
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © {year} 장애인교원 교육전념 여건 지원
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 6.4 — pass 확인**: 5 passed.

- [ ] **Step 6.5 — commit**

```bash
git add src/components/layout/Footer.tsx tests/components/Footer.test.tsx
git commit -m "$(cat <<'EOF'
refactor(footer): Footer 재구성 — 운영 주체/관련 사이트/정책 + Copyright (T6)

브랜드 섹션과 '바로가기'(레거시 메뉴 노출) 제거. 일반 웹사이트 하단 패턴.
정책 링크 3개(/privacy /terms /sitemap)는 후속 task에서 placeholder 페이지 생성.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 신규 placeholder 페이지 4개

**Files (모두 새 파일):**
- `src/app/(wiki)/about/page.tsx`
- `src/app/(wiki)/privacy/page.tsx`
- `src/app/(wiki)/terms/page.tsx`
- `src/app/(wiki)/sitemap/page.tsx`

- [ ] **Step 7.1 — `(wiki)/about/page.tsx` 신규 작성**

spec §6.1의 코드 그대로 적용.

- [ ] **Step 7.2 — `(wiki)/privacy/page.tsx` 신규 작성**

spec §6.2 패턴. metadata title "개인정보처리방침".

- [ ] **Step 7.3 — `(wiki)/terms/page.tsx` 신규 작성**

같은 패턴. title "이용약관".

- [ ] **Step 7.4 — `(wiki)/sitemap/page.tsx` 신규 작성**

같은 패턴. title "사이트맵".

- [ ] **Step 7.5 — 빌드 검증**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
npm run build 2>&1 | tail -10
```

580 정적 페이지 → ~584 (about+privacy+terms+sitemap +4).

- [ ] **Step 7.6 — commit**

```bash
git add 'src/app/(wiki)/about/page.tsx' 'src/app/(wiki)/privacy/page.tsx' 'src/app/(wiki)/terms/page.tsx' 'src/app/(wiki)/sitemap/page.tsx'
git commit -m "$(cat <<'EOF'
feat(pages): about + privacy + terms + sitemap placeholder (T7)

(wiki) 그룹 안에 4개 신규 페이지. AppShell + 사이드바 자동 적용
(pathname /legacy/* 아니므로 WikiEntriesNav 노출). 본문은 모두
placeholder — Phase 5에서 정련.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: "AI 채팅" → "채팅" 일괄 정리

**Files (grep 후 결정):**

- [ ] **Step 8.1 — 검색**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
grep -rni "AI 채팅\|AI 챗봇\|챗봇" src/ tests/ docs/ --include="*.tsx" --include="*.ts" --include="*.md" 2>/dev/null | head -50
```

발견된 항목 정리. 예상 위치:
- `src/components/wiki/ChatLibraryMediaEntries.tsx` (이미 제거됐지만 컴포넌트 자체는 보존이라 잔존 — 내부 ENTRIES `title: "AI 채팅"` 정리)
- `src/lib/wiki-role-entries.ts` (역할별 추천 라벨)
- `src/components/wiki/WikiHero.tsx` (CTA에 "채팅으로 질문" — OK이지만 다른 곳 점검)
- `(wiki)/chat/page.tsx` metadata
- spec/plan 자체 안 단어 (변경 안 함 — 문서)

- [ ] **Step 8.2 — 발견된 각 위치 "AI" 제거 + "채팅"으로 통일**

코드 안 표시 라벨만 수정. variable names (e.g., `chat-ui`)는 그대로.

- [ ] **Step 8.3 — 검증**

```bash
grep -rn "AI 채팅\|AI 챗봇\|챗봇" src/ tests/ --include="*.tsx" --include="*.ts" 2>/dev/null
```

빈 결과 (코드 영역).

- [ ] **Step 8.4 — 테스트 회귀 확인**

```bash
npm run test:components
```

회귀 0건.

- [ ] **Step 8.5 — commit**

```bash
git add -u
git commit -m "$(cat <<'EOF'
refactor(copy): 'AI 채팅' → '채팅' 통일 (T8)

위원장 톤 가이드 (다정·명료) 정합 — AI 색채 줄이고 친근 표현.
변경 영역: 표시 라벨만, 변수명/식별자는 보존.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 글로벌 CLAUDE.md 이모지 금지 원칙

**Files:**
- Modify: `~/.claude/CLAUDE.md`

- [ ] **Step 9.1 — 기존 CLAUDE.md 읽기**

```bash
head -100 ~/.claude/CLAUDE.md
```

기존 섹션 구조 확인 후 새 섹션을 적절한 위치에 삽입.

- [ ] **Step 9.2 — 새 섹션 추가**

spec §7의 마크다운 그대로. "행동 규칙: 작성 문서의 기본 언어는 한국어" 섹션 근처에 둠 (UI 관련 행동 규칙으로 묶음).

- [ ] **Step 9.3 — 검증**

```bash
grep -A 3 "이모지" ~/.claude/CLAUDE.md
```

새 섹션 정상 노출.

- [ ] **Step 9.4 — 글로벌 메모리는 .gitignore가 아닌 별도 위치라 commit 불요**

`~/.claude/CLAUDE.md`는 worktree 안이 아닌 사용자 홈 디렉터리. 본 PR에 포함 안 됨. 사용자 환경 글로벌 변경만 수행.

---

## Task 10: Playwright a11y 회귀 가드 확장

**Files:**
- Modify: `tests/a11y/sidebar.spec.ts`

- [ ] **Step 10.1 — 신규 test 추가**

```ts
test("위키 모드(/) → 사이드바에 위키 진입 5개", async ({ page }) => {
  await page.goto("/")
  const wikiNav = page.getByRole("navigation", { name: "위키 메뉴" })
  await expect(wikiNav).toBeVisible({ visible: true })
  const links = await wikiNav.getByRole("link").all()
  expect(links).toHaveLength(5)
})

test("레거시 모드(/legacy) → 사이드바에 주 메뉴 트리", async ({ page }) => {
  await page.goto("/legacy")
  const legacyNav = page.getByRole("navigation", { name: "주 메뉴" })
  await expect(legacyNav).toBeVisible({ visible: true })
})

test("EntryToggle 클릭으로 모드 전환 — 위키 → 레거시", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: /레거시 사이트/ }).click()
  await expect(page).toHaveURL(/\/legacy/)
  await expect(page.getByRole("navigation", { name: "주 메뉴" })).toBeVisible()
})

test("Footer 정책 링크 3개 200 응답", async ({ page }) => {
  for (const path of ["/privacy", "/terms", "/sitemap", "/about"]) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
  }
})
```

- [ ] **Step 10.2 — Playwright 실행**

```bash
npm run test:a11y -- sidebar.spec.ts
```

14 + 4 = 18 passed 기대.

- [ ] **Step 10.3 — baseline 갱신 (필요 시)**

신규 페이지(`/about`, `/privacy`, `/terms`, `/sitemap`)는 axe 검증에서 baseline이 없음. critical 0건 + serious baseline 없으면 PASS. critical 발생 시 STOP.

- [ ] **Step 10.4 — commit**

```bash
git add tests/a11y/sidebar.spec.ts
git commit -m "$(cat <<'EOF'
test(sidebar): 위키/레거시 모드 분기 + 신규 페이지 회귀 가드 (T10)

pathname 자동 분기 검증 + EntryToggle 모드 전환 + 신규 4 페이지 200.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 최종 검증 + PR + 머지 + production 검증

- [ ] **Step 11.1 — 전체 검증**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
npm run lint
npm run test:components
npm test
npm run build
npm run test:a11y
```

전 단계 PASS.

- [ ] **Step 11.2 — push + PR 생성**

```bash
git push -u origin feature/sidebar-wiki-entries-cleanup
gh pr create --title "feat(ui): 사이드바 위키 진입점 + Footer 재구성 + 정책 페이지 (#60 후속)" --body "..." 
```

PR body는 spec D1~D10 요약 + Test plan + 영향 파일 19개.

- [ ] **Step 11.3 — axe + validate workflow PASS 대기**

Vercel KHUDT는 결제 락 known issue — engccer Hobby로 production deploy.

- [ ] **Step 11.4 — squash merge**

```bash
gh pr merge <pr#> --squash --admin
```

- [ ] **Step 11.5 — production URL polling**

```bash
until curl -s https://webfortd.vercel.app/ | grep -q "위키 메뉴"; do sleep 20; done
```

- [ ] **Step 11.6 — Chrome MCP 검증**

위키 모드 / 레거시 모드 / EntryToggle / Footer 정책 링크 / /about 페이지 진입.

---

## Self-Review

### Spec 커버리지
| Spec ID | 매핑 |
|---------|------|
| D1 (위키 진입 5개) | T1, T2 |
| D2 (pathname 모드 분기) | T3 |
| D3 (EntryToggle "레거시 사이트") | T4 |
| D4 (메인 ChatLibraryMediaEntries 제거) | T5 |
| D5 (Footer 재구성) | T6 |
| D6 (정책 placeholder 3개) | T7 |
| D7 (About 페이지) | T7 |
| D8 ("AI 채팅" 통일) | T8 |
| D9 (이모지 금지 글로벌) | T9 |
| D10 (Footer 운영주체 placeholder) | T6 (코드 안 placeholder 텍스트) |

### Placeholder scan
- 모든 코드 step에 실제 코드 박힘.
- "Phase 5 정련"은 콘텐츠 placeholder이지 plan placeholder가 아님 (의도된 deferred).

### 타입 정합성
- `WikiEntry { href, title, description?, icon: LucideIcon }` — T1에서 정의, T2/T3에서 동일 사용.
- `WikiEntriesNavProps { items, pathname, onNavigate }` — T2 정의, T3에서 동일 호출.
- 모든 신규 페이지가 Next 16 default async function 패턴.

---

## 실행 방식

이전 PR #60 패턴과 동일 — **Subagent-Driven Development**. task별 fresh implementer + spec/quality reviewer + 위원장 검토. 11 task × 5 step ≈ 55 step, 추가로 reviewer 사이클.
