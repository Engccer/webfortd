# Phase B M2 — 위키 published 게이트 + Preview Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위키 KB 라우트가 `status === 'published'` 문서만 일반 사용자에게 노출하고, 관리자는 Next.js Draft Mode 토글로 모든 status를 미리볼 수 있게 한다.

**Architecture:** (1) 순수 정책 모듈(`preview-policy.ts`)이 "미리보기 활성" / "검수 중 노출" 판정을 담당해 단위 테스트 가능. (2) server-only `preview.ts`가 `draftMode()` + admin status를 읽어 정책에 위임. (3) Route Handler `/api/admin/preview/{enable,disable}`가 admin 확인 후 Draft Mode cookie를 토글(DI 코어 `runPreviewToggle`로 로직 분리). (4) KB 본문 렌더 라우트 3종(KbPageLayout 6 axis + resources law/research)이 게이트를 통과시키되 non-published & 비-미리보기면 `UnderReviewNotice`(200) 반환. (5) `AdminBarView`를 `'use client'`로 전환해 실제 토글 버튼 + aria-live 알림 제공.

**Tech Stack:** Next.js 16 App Router, `draftMode()` (next/headers, async), React 19 client component, Supabase 세션 기반 admin 확인, vitest (component) + node:test (lib/api).

**핵심 불변식 (정적 렌더 보존):** 게이트는 `status !== 'published'`일 때만 `draftMode()`를 읽는다. published 문서(535건)는 `draftMode()`를 호출하지 않으므로 master 대비 렌더 모드가 바뀌지 않는다.

**보안 노트:** 토글은 POST + admin 확인 + Supabase 세션 cookie(SameSite=Lax)로 CSRF 방어. enable/disable는 redirect 없이 JSON 반환(open-redirect 회피). Draft Mode cookie가 새더라도 게이트가 매 렌더에서 `isAdmin`을 재확인(`computePreviewActive = draftEnabled && isAdmin`)하므로 비-admin은 cookie가 있어도 "검수 중"을 본다.

**관련 spec:** `docs/superpowers/specs/2026-05-29-phase-b-preview-mode-publish-design.md` §M2 (결정 B5·B6, 리뷰 포커스 §5 M2, 회귀 가드 §6 M2)

---

## File Structure

**생성:**
- `src/lib/admin/preview-policy.ts` — 순수 판정 함수 2개 (server-only/next-headers 의존 없음 → 단위 테스트)
- `src/lib/admin/preview.ts` — server-only. `draftMode()` + admin 읽어 정책에 위임
- `src/lib/admin/preview-handler.ts` — `runPreviewToggle` DI 코어 (next/headers·server-only 미import → 단위 테스트)
- `src/app/api/admin/preview/enable/route.ts` — POST, Draft Mode enable
- `src/app/api/admin/preview/disable/route.ts` — POST, Draft Mode disable
- `src/components/kb/UnderReviewNotice.tsx` — "검수 중" 200 뷰 (접근성)
- `tests/lib/admin-preview-policy.test.ts` — 정책 단위 (node:test)
- `tests/api/admin-preview-toggle.test.ts` — `runPreviewToggle` 단위 (node:test)
- `tests/components/under-review-notice.test.tsx` — 뷰 (vitest)

**수정:**
- `src/components/admin/AdminBarView.tsx` — `'use client'` + 실제 토글 + aria-live
- `src/components/admin/AdminBar.tsx` — `previewEnabled` prop 전달
- `src/components/kb/KbPageLayout.tsx` — 게이트 삽입
- `src/app/(wiki)/resources/law/[slug]/page.tsx` — 게이트 삽입
- `src/app/(wiki)/resources/research/[slug]/page.tsx` — 게이트 삽입
- `tests/components/admin-bar.test.tsx` — 활성 토글로 재작성 (기존 disabled placeholder 테스트 폐기)

---

## Task 1: 순수 정책 모듈

**Files:**
- Create: `src/lib/admin/preview-policy.ts`
- Test: `tests/lib/admin-preview-policy.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/lib/admin-preview-policy.test.ts`:
```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePreviewActive,
  shouldRenderUnderReview,
} from '@/lib/admin/preview-policy.ts'

describe('preview-policy', () => {
  it('computePreviewActive: draft off → 항상 false', () => {
    assert.equal(computePreviewActive(false, true), false)
    assert.equal(computePreviewActive(false, false), false)
  })

  it('computePreviewActive: draft on + admin → true', () => {
    assert.equal(computePreviewActive(true, true), true)
  })

  it('computePreviewActive: draft on + 비-admin → false (cookie 누수 방어)', () => {
    assert.equal(computePreviewActive(true, false), false)
  })

  it('shouldRenderUnderReview: published는 미리보기와 무관하게 노출', () => {
    assert.equal(shouldRenderUnderReview('published', false), false)
    assert.equal(shouldRenderUnderReview('published', true), false)
  })

  it('shouldRenderUnderReview: non-published & 비-미리보기 → 검수 중', () => {
    for (const s of ['draft', 'in_review', 'archived', 'deprecated']) {
      assert.equal(shouldRenderUnderReview(s, false), true)
    }
  })

  it('shouldRenderUnderReview: non-published & 미리보기 → 본문 노출', () => {
    assert.equal(shouldRenderUnderReview('draft', true), false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && node --conditions react-server --import tsx --test 'tests/lib/admin-preview-policy.test.ts'`
Expected: FAIL — `Cannot find module '@/lib/admin/preview-policy.ts'`

- [ ] **Step 3: 최소 구현**

`src/lib/admin/preview-policy.ts`:
```ts
/**
 * Phase B M2 — Preview Mode 순수 판정.
 * server-only / next-headers 의존 없음 → 단위 테스트 가능.
 */

/**
 * 미리보기 활성 = Draft Mode 켜짐 AND 현재 사용자가 admin.
 * spec B5: Draft Mode cookie가 비-admin에게 새더라도 isAdmin 재확인으로 차단.
 */
export function computePreviewActive(
  draftEnabled: boolean,
  isAdmin: boolean,
): boolean {
  return draftEnabled && isAdmin
}

/**
 * "검수 중" 안내(200)를 렌더할지 여부.
 * published는 항상 공개. non-published는 미리보기 활성 시에만 본문 노출.
 */
export function shouldRenderUnderReview(
  status: string,
  previewActive: boolean,
): boolean {
  return status !== 'published' && !previewActive
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && node --conditions react-server --import tsx --test 'tests/lib/admin-preview-policy.test.ts'`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add src/lib/admin/preview-policy.ts tests/lib/admin-preview-policy.test.ts
git commit -m "feat(phase-b-m2): preview 게이트 순수 정책 모듈 + 단위 테스트"
```

---

## Task 2: Draft Mode 토글 DI 코어

**Files:**
- Create: `src/lib/admin/preview-handler.ts`
- Test: `tests/api/admin-preview-toggle.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/admin-preview-toggle.test.ts`:
```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runPreviewToggle } from '@/lib/admin/preview-handler.ts'
import type { AdminStatus } from '@/lib/auth/admin-types.ts'

const admin: AdminStatus = { isAdmin: true, userId: 'a-1', email: 'a@b.c' }
const nonAdmin: AdminStatus = { isAdmin: false, userId: null, email: null }

function fakeDraft() {
  const calls: string[] = []
  return {
    calls,
    enable: () => { calls.push('enable') },
    disable: () => { calls.push('disable') },
  }
}

describe('runPreviewToggle', () => {
  it('비-admin enable 시도 → 403 + draft 미변경', async () => {
    const draft = fakeDraft()
    const res = await runPreviewToggle(true, { adminStatus: nonAdmin, draft })
    assert.equal(res.status, 403)
    assert.deepEqual(draft.calls, [])
  })

  it('admin enable → 200 + draft.enable 호출', async () => {
    const draft = fakeDraft()
    const res = await runPreviewToggle(true, { adminStatus: admin, draft })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.enabled, true)
    assert.deepEqual(draft.calls, ['enable'])
  })

  it('admin disable → 200 + draft.disable 호출', async () => {
    const draft = fakeDraft()
    const res = await runPreviewToggle(false, { adminStatus: admin, draft })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.enabled, false)
    assert.deepEqual(draft.calls, ['disable'])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && node --conditions react-server --import tsx --test 'tests/api/admin-preview-toggle.test.ts'`
Expected: FAIL — `Cannot find module '@/lib/admin/preview-handler.ts'`

- [ ] **Step 3: 최소 구현**

`src/lib/admin/preview-handler.ts`:
```ts
/**
 * Phase B M2 — Draft Mode 토글 DI 코어.
 * next/headers·server-only 미import → 단위 테스트 가능.
 * route.ts가 실제 draftMode()/admin status를 주입.
 */
import type { AdminStatus } from '@/lib/auth/admin-types'

interface DraftController {
  enable: () => void
  disable: () => void
}

export async function runPreviewToggle(
  enable: boolean,
  deps: { adminStatus: AdminStatus; draft: DraftController },
): Promise<Response> {
  if (!deps.adminStatus.isAdmin) {
    return Response.json({ error: '관리자만 사용할 수 있어요.' }, { status: 403 })
  }
  if (enable) {
    deps.draft.enable()
  } else {
    deps.draft.disable()
  }
  return Response.json({ enabled: enable })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && node --conditions react-server --import tsx --test 'tests/api/admin-preview-toggle.test.ts'`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add src/lib/admin/preview-handler.ts tests/api/admin-preview-toggle.test.ts
git commit -m "feat(phase-b-m2): Draft Mode 토글 DI 코어 + 단위 테스트"
```

---

## Task 3: server-only preview 리더 + Route Handler 2종

**Files:**
- Create: `src/lib/admin/preview.ts`
- Create: `src/app/api/admin/preview/enable/route.ts`
- Create: `src/app/api/admin/preview/disable/route.ts`

> 이 태스크는 server-only + next/headers를 직접 사용하므로 node:test 단위 테스트 대상이 아니다. 로직은 Task 1·2에서 검증됨. 본 태스크는 build(Task 8)와 production smoke(Task 9)로 검증한다.

- [ ] **Step 1: server-only preview 리더 작성**

`src/lib/admin/preview.ts`:
```ts
/**
 * Phase B M2 — server-only Preview Mode 리더.
 * 게이트(KbPageLayout/resources 라우트)와 AdminBar가 사용.
 */
import 'server-only'
import { draftMode } from 'next/headers'
import { getCurrentUserAdminStatus } from '@/lib/auth/admin'
import { computePreviewActive } from './preview-policy'

/**
 * Draft Mode cookie 활성 여부만 반환. AdminBar 토글 상태 표시용.
 */
export async function getDraftModeEnabled(): Promise<boolean> {
  const { isEnabled } = await draftMode()
  return isEnabled
}

/**
 * 미리보기 활성 여부. Draft Mode가 꺼져 있으면 admin 조회 없이 false(빠른 경로).
 * 켜져 있으면 현재 사용자 admin 재확인(B5: cookie 누수 방어).
 *
 * 게이트는 status !== 'published'일 때만 이 함수를 호출 → published 페이지는
 * draftMode()를 읽지 않아 정적 렌더가 보존된다.
 */
export async function getPreviewActive(): Promise<boolean> {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return false
  const { isAdmin } = await getCurrentUserAdminStatus()
  return computePreviewActive(isEnabled, isAdmin)
}
```

- [ ] **Step 2: enable Route Handler 작성**

`src/app/api/admin/preview/enable/route.ts`:
```ts
/**
 * Phase B M2 — 관리자 Draft Mode 켜기.
 * POST 전용. admin 확인 후 __prerender_bypass cookie 설정.
 */
import { draftMode } from 'next/headers'
import { getCurrentUserAdminStatus } from '@/lib/auth/admin'
import { runPreviewToggle } from '@/lib/admin/preview-handler'

export async function POST() {
  const adminStatus = await getCurrentUserAdminStatus()
  const draft = await draftMode()
  return runPreviewToggle(true, { adminStatus, draft })
}
```

- [ ] **Step 3: disable Route Handler 작성**

`src/app/api/admin/preview/disable/route.ts`:
```ts
/**
 * Phase B M2 — 관리자 Draft Mode 끄기.
 * POST 전용. admin 확인 후 __prerender_bypass cookie 제거.
 */
import { draftMode } from 'next/headers'
import { getCurrentUserAdminStatus } from '@/lib/auth/admin'
import { runPreviewToggle } from '@/lib/admin/preview-handler'

export async function POST() {
  const adminStatus = await getCurrentUserAdminStatus()
  const draft = await draftMode()
  return runPreviewToggle(false, { adminStatus, draft })
}
```

- [ ] **Step 4: 타입 확인 (tsc)**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx tsc --noEmit`
Expected: 에러 0 (기존 baseline과 동일)

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add src/lib/admin/preview.ts "src/app/api/admin/preview/enable/route.ts" "src/app/api/admin/preview/disable/route.ts"
git commit -m "feat(phase-b-m2): preview 리더 + enable/disable Route Handler"
```

---

## Task 4: UnderReviewNotice 뷰

**Files:**
- Create: `src/components/kb/UnderReviewNotice.tsx`
- Test: `tests/components/under-review-notice.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/components/under-review-notice.test.tsx`:
```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { UnderReviewNotice } from "@/components/kb/UnderReviewNotice"

describe("UnderReviewNotice", () => {
  it("검수 중 안내 헤딩을 렌더한다", () => {
    render(<UnderReviewNotice backHref="/policies" backLabel="정책·법령 목록" />)
    expect(
      screen.getByRole("heading", { name: /검수 중인 페이지/ }),
    ).toBeDefined()
  })

  it("title이 주어지면 표시한다", () => {
    render(
      <UnderReviewNotice
        title="장애인 교원 편의지원"
        backHref="/policies"
        backLabel="정책·법령 목록"
      />,
    )
    expect(screen.getByText(/장애인 교원 편의지원/)).toBeDefined()
  })

  it("뒤로가기 링크를 backHref로 렌더한다", () => {
    render(<UnderReviewNotice backHref="/policies" backLabel="정책·법령 목록" />)
    const link = screen.getByRole("link", { name: /정책·법령 목록/ })
    expect(link.getAttribute("href")).toBe("/policies")
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx vitest run tests/components/under-review-notice.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: 최소 구현**

`src/components/kb/UnderReviewNotice.tsx`:
```tsx
/**
 * Phase B M2 — non-published 문서를 일반 사용자에게 보여줄 때의 "검수 중" 안내(200).
 * spec B5: 페이지 존재는 알리되 내용은 비공개. 404 아님.
 * KbPageLayout과 동일한 fixed overlay + --admin-bar-h 정합.
 */
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface UnderReviewNoticeProps {
  title?: string
  backHref: string
  backLabel: string
}

export function UnderReviewNotice({
  title,
  backHref,
  backLabel,
}: UnderReviewNoticeProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 overflow-auto bg-background"
      style={{ top: "var(--admin-bar-h, 0px)" }}
    >
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        </div>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-4xl px-4 py-16 sm:px-6"
      >
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-8 text-center"
        >
          <h1 className="mb-3 text-2xl font-bold text-foreground">
            검수 중인 페이지입니다
          </h1>
          {title && (
            <p className="mb-4 text-lg text-muted-foreground">“{title}”</p>
          )}
          <p className="text-muted-foreground">
            이 페이지는 현재 검수 진행 중이라 아직 공개되지 않았어요. 검수가
            끝나면 내용을 보실 수 있습니다.
          </p>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx vitest run tests/components/under-review-notice.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add src/components/kb/UnderReviewNotice.tsx tests/components/under-review-notice.test.tsx
git commit -m "feat(phase-b-m2): UnderReviewNotice 검수 중 안내 뷰 + 테스트"
```

---

## Task 5: AdminBarView 'use client' 활성 토글

**Files:**
- Modify: `src/components/admin/AdminBarView.tsx` (전면 교체)
- Modify: `src/components/admin/AdminBar.tsx`
- Test: `tests/components/admin-bar.test.tsx` (재작성)

- [ ] **Step 1: 실패하는 테스트로 재작성**

`tests/components/admin-bar.test.tsx` (전체 교체):
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const refreshMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { AdminBarView } from "@/components/admin/AdminBarView"

const admin = { isAdmin: true, userId: "admin-1", email: "engccer@gmail.com" }

beforeEach(() => {
  refreshMock.mockClear()
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify({ enabled: true }), { status: 200 }),
  ) as typeof fetch
})

describe("AdminBarView", () => {
  it("isAdmin=false → null", () => {
    const { container } = render(
      <AdminBarView
        status={{ isAdmin: false, userId: null, email: null }}
        previewEnabled={false}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("isAdmin=true → region + 관리자 모드 + 대시보드 링크", () => {
    render(<AdminBarView status={admin} previewEnabled={false} />)
    expect(screen.getByRole("region", { name: /관리자 도구/ })).toBeDefined()
    expect(screen.getByText("관리자 모드")).toBeDefined()
    expect(screen.getByText("engccer@gmail.com")).toBeDefined()
    expect(
      screen.getByRole("link", { name: "대시보드" }).getAttribute("href"),
    ).toBe("/admin/dashboard")
  })

  it("previewEnabled=false → '미리보기 켜기' + aria-pressed=false", () => {
    render(<AdminBarView status={admin} previewEnabled={false} />)
    const btn = screen.getByRole("button", { name: /미리보기 켜기/ })
    expect(btn.getAttribute("aria-pressed")).toBe("false")
  })

  it("previewEnabled=true → '미리보기 끄기' + aria-pressed=true", () => {
    render(<AdminBarView status={admin} previewEnabled={true} />)
    const btn = screen.getByRole("button", { name: /미리보기 끄기/ })
    expect(btn.getAttribute("aria-pressed")).toBe("true")
  })

  it("토글 클릭(off→on) → enable POST + router.refresh + aria-live 알림", async () => {
    const user = userEvent.setup()
    render(<AdminBarView status={admin} previewEnabled={false} />)
    await user.click(screen.getByRole("button", { name: /미리보기 켜기/ }))
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/preview/enable",
      expect.objectContaining({ method: "POST" }),
    )
    expect(refreshMock).toHaveBeenCalled()
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.textContent).toMatch(/켰습니다/)
  })

  it("토글 클릭(on→off) → disable POST", async () => {
    const user = userEvent.setup()
    render(<AdminBarView status={admin} previewEnabled={true} />)
    await user.click(screen.getByRole("button", { name: /미리보기 끄기/ }))
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/preview/disable",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx vitest run tests/components/admin-bar.test.tsx`
Expected: FAIL — `previewEnabled` prop 미존재 + 버튼 라벨 "미리보기 켜기" 미존재 (현재는 "미리보기 OFF" disabled)

- [ ] **Step 3: AdminBarView 전면 교체**

`src/components/admin/AdminBarView.tsx` (전체 교체):
```tsx
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { AdminStatus } from "@/lib/auth/admin-types"

/**
 * Phase B M2 — Preview Toggle 활성화.
 * feedback_rsc_event_handler_gap 교훈: onClick은 client 컴포넌트에서만.
 * 토글 상태(previewEnabled)는 server(draftMode().isEnabled)에서 prop으로 주입.
 * 클릭 → enable/disable POST → router.refresh()로 server 재렌더 → 상태 갱신.
 */
export function AdminBarView({
  status,
  previewEnabled,
}: {
  status: AdminStatus
  previewEnabled: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  if (!status.isAdmin) return null

  async function togglePreview() {
    if (pending) return
    setPending(true)
    const next = !previewEnabled
    try {
      const res = await fetch(
        next ? "/api/admin/preview/enable" : "/api/admin/preview/disable",
        { method: "POST" },
      )
      if (!res.ok) {
        setAnnouncement("미리보기 전환에 실패했어요. 다시 시도해 주세요.")
        return
      }
      setAnnouncement(
        next ? "관리자 미리보기를 켰습니다." : "관리자 미리보기를 껐습니다.",
      )
      router.refresh()
    } catch {
      setAnnouncement("미리보기 전환 중 오류가 발생했어요.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      role="region"
      aria-label="관리자 도구 모음"
      className="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold">관리자 모드</span>
          <span className="text-amber-800">
            {status.email ?? "(이메일 없음)"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="rounded px-3 py-1 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            대시보드
          </Link>
          <button
            type="button"
            onClick={togglePreview}
            disabled={pending}
            aria-pressed={previewEnabled}
            className="rounded border border-amber-300 px-3 py-1 text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:opacity-60"
          >
            {previewEnabled ? "미리보기 끄기" : "미리보기 켜기"}
          </button>
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: AdminBar(server)가 previewEnabled 전달**

`src/components/admin/AdminBar.tsx` (전체 교체):
```tsx
import { getCurrentUserAdminStatus } from "@/lib/auth/admin"
import { getDraftModeEnabled } from "@/lib/admin/preview"
import { AdminBarView } from "./AdminBarView"

/**
 * Server data fetcher (RSC). 일반 사용자는 status.isAdmin=false → AdminBarView가 null 반환.
 * Phase B M2: draftMode().isEnabled를 읽어 토글 상태를 client view에 주입.
 */
export async function AdminBar() {
  const status = await getCurrentUserAdminStatus()
  const previewEnabled = await getDraftModeEnabled()
  return <AdminBarView status={status} previewEnabled={previewEnabled} />
}

export { AdminBarView } from "./AdminBarView"
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx vitest run tests/components/admin-bar.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 6: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add src/components/admin/AdminBarView.tsx src/components/admin/AdminBar.tsx tests/components/admin-bar.test.tsx
git commit -m "feat(phase-b-m2): AdminBarView 'use client' 활성 토글 + aria-live"
```

---

## Task 6: KbPageLayout 게이트 (6 axis 라우트)

**Files:**
- Modify: `src/components/kb/KbPageLayout.tsx`

> `getAxisLabel`/`axisHref` 계산을 게이트 앞으로 이동하고, `serialize`(비용 큰 작업) 이전에 게이트한다.

- [ ] **Step 1: import 추가**

`src/components/kb/KbPageLayout.tsx` 상단 import 블록(line 25–26 `KbSourceFooter`/`StatusBadge` 아래)에 추가:
```tsx
import { UnderReviewNotice } from "./UnderReviewNotice"
import { getPreviewActive } from "@/lib/admin/preview"
import { shouldRenderUnderReview } from "@/lib/admin/preview-policy"
```

- [ ] **Step 2: 게이트 삽입 (axisLabel 계산 이동 + 게이트)**

`KbPageLayout` 함수 본문에서 `const fm = doc.frontmatter` (line 65) 직후에 아래를 삽입하고, 기존 line 88–89의 `const axisLabel`/`const axisHref` 정의는 **삭제**(여기로 이동):
```tsx
  const fm = doc.frontmatter

  // M2 게이트: published만 일반 공개. non-published는 admin Draft Mode에서만 본문 노출.
  // published는 getPreviewActive()를 호출하지 않아 정적 렌더가 보존된다.
  const axisLabel = AXIS_LABEL[axis] ?? axis
  const axisHref = `/${axis}`
  if (fm.status !== 'published') {
    const previewActive = await getPreviewActive()
    if (shouldRenderUnderReview(fm.status, previewActive)) {
      return (
        <UnderReviewNotice
          title={legacy.title}
          backHref={axisHref}
          backLabel={`${axisLabel} 목록`}
        />
      )
    }
  }
```

확인: 기존 line 88–89 (`const axisLabel = AXIS_LABEL[axis] ?? axis` / `const axisHref = \`/${axis}\``)를 제거했는지 — 중복 선언이면 tsc 에러로 잡힌다.

- [ ] **Step 3: 타입/린트 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx tsc --noEmit && npx eslint src/components/kb/KbPageLayout.tsx`
Expected: 에러 0. (만약 `axisLabel`/`axisHref` 중복 선언 에러가 나면 Step 2의 기존 정의 삭제 누락 — 제거할 것.)

- [ ] **Step 4: 컴포넌트 테스트 회귀 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx vitest run`
Expected: 전체 PASS (KbPageLayout은 vitest 직접 테스트 없음 — 회귀 0 확인)

- [ ] **Step 5: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add src/components/kb/KbPageLayout.tsx
git commit -m "feat(phase-b-m2): KbPageLayout published 게이트 (6 axis 라우트)"
```

---

## Task 7: resources law/research 라우트 게이트

**Files:**
- Modify: `src/app/(wiki)/resources/law/[slug]/page.tsx`
- Modify: `src/app/(wiki)/resources/research/[slug]/page.tsx`

- [ ] **Step 1: law 라우트 게이트**

`src/app/(wiki)/resources/law/[slug]/page.tsx`:

import 추가 (line 10 `import Link from "next/link"` 아래):
```tsx
import { UnderReviewNotice } from "@/components/kb/UnderReviewNotice"
import { getPreviewActive } from "@/lib/admin/preview"
import { shouldRenderUnderReview } from "@/lib/admin/preview-policy"
```

`LawDocPage` 함수에서 `const legacy = adaptFrontmatterToLegacy(kbDoc.frontmatter)` (line 43) 직후에 게이트 삽입:
```tsx
  const legacy = adaptFrontmatterToLegacy(kbDoc.frontmatter)

  // M2 게이트: published만 일반 공개.
  if (kbDoc.frontmatter.status !== 'published') {
    const previewActive = await getPreviewActive()
    if (shouldRenderUnderReview(kbDoc.frontmatter.status, previewActive)) {
      return (
        <UnderReviewNotice
          title={legacy.title}
          backHref="/legacy/resources/law-guide"
          backLabel="법령·지침 목록"
        />
      )
    }
  }
```

- [ ] **Step 2: research 라우트 게이트**

`src/app/(wiki)/resources/research/[slug]/page.tsx`:

import 추가 (동일 3줄, line 10 아래):
```tsx
import { UnderReviewNotice } from "@/components/kb/UnderReviewNotice"
import { getPreviewActive } from "@/lib/admin/preview"
import { shouldRenderUnderReview } from "@/lib/admin/preview-policy"
```

`ResearchDocPage` 함수에서 `const legacy = adaptFrontmatterToLegacy(kbDoc.frontmatter)` 직후 게이트:
```tsx
  const legacy = adaptFrontmatterToLegacy(kbDoc.frontmatter)

  // M2 게이트: published만 일반 공개.
  if (kbDoc.frontmatter.status !== 'published') {
    const previewActive = await getPreviewActive()
    if (shouldRenderUnderReview(kbDoc.frontmatter.status, previewActive)) {
      return (
        <UnderReviewNotice
          title={legacy.title}
          backHref="/legacy/resources/research-guide"
          backLabel="연구자료 목록"
        />
      )
    }
  }
```

- [ ] **Step 3: 타입/린트 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npx tsc --noEmit && npx eslint "src/app/(wiki)/resources/law/[slug]/page.tsx" "src/app/(wiki)/resources/research/[slug]/page.tsx"`
Expected: 에러 0

- [ ] **Step 4: 커밋**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add "src/app/(wiki)/resources/law/[slug]/page.tsx" "src/app/(wiki)/resources/research/[slug]/page.tsx"
git commit -m "feat(phase-b-m2): resources law/research 라우트 published 게이트"
```

---

## Task 8: 전체 검증 (lint + 테스트 + build)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: lint 전체**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npm run lint`
Expected: 에러 0 (warning은 master baseline 허용)

- [ ] **Step 2: node 단위 테스트 전체**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npm test`
Expected: 신규 9개(policy 6 + toggle 3) PASS. 기존 실패는 master baseline(decompose-source.test.ts 등) — 신규 회귀 0 확인.

- [ ] **Step 3: 컴포넌트 테스트 전체**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npm run test:components`
Expected: 전체 PASS (admin-bar 6 재작성 + under-review-notice 3 신규 포함).

- [ ] **Step 4: 프로덕션 빌드 + 렌더 모드 회귀 확인**

Run: `cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2 && npm run build 2>&1 | tee /tmp/m2-build.log | tail -40`
Expected:
- 빌드 성공 (validate:content + sync:content + next build).
- `/api/admin/preview/enable`·`/disable`가 라우트 목록에 ƒ(Dynamic)으로 등록.
- axis 라우트(disability-types/[slug] 등)의 렌더 모드가 master 대비 **불변**(published 페이지 정적 보존 확인). build 로그에서 axis 라우트 심볼(○/ƒ/●) 확인.

검증 후: `grep -E "disability-types|/api/admin/preview|resources/law" /tmp/m2-build.log` 로 라우트 등록 확인.

- [ ] **Step 5: 검증 통과 시 push**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git push -u origin phase-b-m2-impl
```

---

## Task 9: codex-rescue 마일스톤 리뷰 (PR 직전)

**Files:** 없음 (리뷰 전용)

> CLAUDE.md "마일스톤 단위 codex-rescue dispatch" 규칙. **foreground/`--wait` 강제**(글로벌 규칙: background detached 워커 고아화 회피). 5분 무진전·동일명령 반복·Turn aborted 감지 시 즉시 TaskStop + 직접 invariant 검수 fallback.

- [ ] **Step 1: codex-rescue dispatch (리뷰 포커스 명시)**

리뷰 포커스 (spec §5 M2):
1. 게이트가 admin Draft Mode를 정확히 bypass하는가 (`computePreviewActive = draftEnabled && isAdmin`).
2. Draft Mode cookie가 일반 사용자에게 새지 않는가 (게이트의 isAdmin 재확인).
3. Preview Toggle client 분리 후 server 상태(previewEnabled) 표시 정합.
4. RSC onClick 재발 방지 (AdminBarView 'use client' 확인).
5. published 페이지가 `draftMode()` 미호출로 정적 보존되는가.
6. enable/disable POST의 CSRF/권한 경계 (비-admin 403).

`codex exec`를 하드 wall-clock 가드(백그라운드 + 폴링 루프, 12분 cap)와 함께 직접 호출하거나, codex-rescue 서브에이전트 프롬프트에 `--wait` 명시.

- [ ] **Step 2: 리뷰 결과 처리**

- 즉시 지엽 패치 금지. 아키텍처 수준 대조 우선 (CLAUDE.md 원칙).
- P0/P1은 수정 후 재검증. P2는 판단.
- fail signal 감지 시 직접 invariant 검수로 전환 (정책 6개 + 게이트 2경로 + 토글 권한 cross-check).

- [ ] **Step 3: 수정사항 커밋 (있으면)**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
git add -A
git commit -m "fix(phase-b-m2): codex-rescue 리뷰 반영 — <항목>"
git push
```

---

## Task 10: PR 생성 + coderabbit (선택) + 머지

**Files:** 없음

- [ ] **Step 1: PR 생성**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-pb-m2
gh pr create --base master --head phase-b-m2-impl --title "feat(phase-b-m2): 위키 published 게이트 + Preview Mode" --body "<요약 + 검증 결과 + 영구 원칙 정합>"
```

- [ ] **Step 2: coderabbit 리뷰 (선택, 보완재)**

`coderabbit review --plain --base-commit master` (인증 완료 — 무료/제한 모드). 라인 스타일·관용구 위주. codex-rescue와 동일 결함 중복 지적 시 codex-rescue 우선.

- [ ] **Step 3: 위원장 production smoke 안내**

머지 후 `webfortd.vercel.app`에서:
1. 매직링크 admin 로그인 → AdminBar에 "미리보기 켜기" 노출.
2. 비-로그인/비-admin으로 non-published 위키 페이지 접근 → "검수 중인 페이지입니다"(200) 확인.
3. admin "미리보기 켜기" → 같은 페이지 재방문 시 본문 노출 + aria-live 알림 확인.
4. "미리보기 끄기" → 다시 "검수 중".
   (현재 535건 전부 published이므로 게이트 검증용 테스트 문서는 위원장이 1건을 draft로 두거나, 신규 draft 추가 후 확인.)

- [ ] **Step 4: admin squash 머지**

```bash
gh pr merge <번호> --squash --admin --delete-branch
```

- [ ] **Step 5: 메모리 갱신**

`MEMORY.md` Quick Reference에 Phase B M2 머지 항목 추가 (PR 번호, squash hash, 검증 요약, codex-rescue 결과).

---

## Self-Review

**Spec coverage (§M2 1–4):**
- ① 위키 라우트 published 게이트 (404 아님, admin 모든 status) → Task 6·7 (KbPageLayout + resources) + B5 "검수 중" 200. ✓
- ② Draft Mode 인프라 `/api/admin/preview/{enable,disable}` (admin만) → Task 3. ✓
- ③ Preview Toggle 활성화 + AdminBarView 'use client' 분리 + server 상태 표시 → Task 5. ✓
- ④ aria-live 알림 → Task 5 (`role="status" aria-live="polite"`). ✓

**결정 잠금:** B5(검수 중 200)→Task 4·6·7. B6('use client' 분리)→Task 5. ✓

**회귀 가드 (§6 M2):** 비-admin draft 접근 시 200 안내 / admin Draft Mode draft 접근 / Preview Toggle 키보드+aria-live → Task 8(build) + Task 10 Step 3(production smoke). 단위로 정책(Task 1)·토글 권한(Task 2)·컴포넌트(Task 5) 커버. ✓

**Placeholder scan:** 모든 코드 step에 실제 코드 포함. TODO/TBD 없음. ✓

**Type consistency:** `computePreviewActive(draftEnabled, isAdmin)` / `shouldRenderUnderReview(status, previewActive)` / `runPreviewToggle(enable, {adminStatus, draft})` / `getPreviewActive()` / `getDraftModeEnabled()` / `UnderReviewNotice({title?, backHref, backLabel})` / `AdminBarView({status, previewEnabled})` — Task 간 시그니처 일치 확인. ✓

**미해결 가정:** axis 라우트의 현재 정적/동적 렌더 모드는 master 빌드에서 확정(레이아웃이 cookies() 사용). Task 8 Step 4에서 master 대비 불변임을 빌드 로그로 검증 — 게이트는 published에서 draftMode() 미호출이라 정적 보존 설계. RAG/카탈로그 게이트는 M3 범위(본 plan 제외).
