// T11 — sidebar a11y 회귀 가드
//
// 검증 범위:
//   1. Axe (/, /legacy, /legacy/support) — expanded·collapsed·mobile 상태
//   2. 햄버거 aria-expanded 토글
//   3. Cmd+B 단축키 사이드바 토글
//   4. ESC 모바일 overlay 닫기
//   5. SkipLink Tab 순서 — 본문 바로가기 → 메뉴 바로가기

import { test, expect } from "@playwright/test"
import { expectNoAxeViolations } from "./axe-helper"
import { SIDEBAR_COOKIE_NAME } from "../../src/lib/sidebar-cookie"

const COOKIE_NAME = SIDEBAR_COOKIE_NAME
const BASE_URL = "http://localhost:3000"

// ─── Axe 검증 ────────────────────────────────────────────────────────────────

test.describe("Axe: /, /legacy, /legacy/support — expanded state", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: COOKIE_NAME, value: "1", url: BASE_URL },
    ])
  })

  test("axe expanded: /", async ({ page }, info) => {
    await expectNoAxeViolations(page, info, "/")
  })

  test("axe expanded: /legacy", async ({ page }, info) => {
    await expectNoAxeViolations(page, info, "/legacy")
  })

  test("axe expanded: /legacy/support", async ({ page }, info) => {
    await expectNoAxeViolations(page, info, "/legacy/support")
  })
})

test.describe("Axe: /, /legacy, /legacy/support — collapsed state", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: COOKIE_NAME, value: "0", url: BASE_URL },
    ])
  })

  test("axe collapsed: /", async ({ page }, info) => {
    await expectNoAxeViolations(page, info, "/")
  })

  test("axe collapsed: /legacy", async ({ page }, info) => {
    await expectNoAxeViolations(page, info, "/legacy")
  })

  test("axe collapsed: /legacy/support", async ({ page }, info) => {
    await expectNoAxeViolations(page, info, "/legacy/support")
  })
})

test.describe("Axe: mobile (768×1024) — overlay closed", () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test("axe mobile: /", async ({ page }, info) => {
    await expectNoAxeViolations(page, info, "/")
  })
})

// ─── 햄버거 aria-expanded 토글 ────────────────────────────────────────────────
//
// 햄버거 버튼 선택: aria-controls="app-sidebar"로 헤더 햄버거만 정확히 지정.
// getByRole + regex는 SidebarNav disclosure 버튼("하위 메뉴 펼치기")도 매칭하므로 사용 금지.

test("hamburger: aria-expanded toggles on click (desktop)", async ({ page }) => {
  await page.goto("/")
  // aria-controls="app-sidebar"로 헤더 햄버거 버튼만 선택
  const trigger = page.locator('[aria-controls="app-sidebar"]')
  await expect(trigger).toBeVisible()

  const initialExpanded = await trigger.getAttribute("aria-expanded")
  await trigger.click()

  // aria-expanded가 토글되어야 함
  const afterExpanded = await trigger.getAttribute("aria-expanded")
  expect(afterExpanded).not.toBe(initialExpanded)
  expect(afterExpanded).toMatch(/^(true|false)$/)
})

test("hamburger: aria-hidden on #app-sidebar flips with hamburger click (desktop)", async ({
  page,
}) => {
  await page.goto("/")
  const sidebar = page.locator("#app-sidebar")
  const trigger = page.locator('[aria-controls="app-sidebar"]')

  const hiddenBefore = await sidebar.getAttribute("aria-hidden")
  await trigger.click()
  const hiddenAfter = await sidebar.getAttribute("aria-hidden")

  expect(hiddenAfter).not.toBe(hiddenBefore)
})

// ─── Cmd+B 단축키 ─────────────────────────────────────────────────────────────

test("Cmd+B: keyboard shortcut toggles sidebar aria-hidden (desktop)", async ({ page }) => {
  await page.goto("/")
  const sidebar = page.locator("#app-sidebar")

  const hiddenBefore = await sidebar.getAttribute("aria-hidden")

  // useKeyboardShortcut checks metaKey || ctrlKey.
  // Playwright chromium on macOS fires metaKey for Meta+b.
  await page.keyboard.press("Meta+b")
  await page.waitForTimeout(50) // 렌더 flush 대기

  const hiddenAfter = await sidebar.getAttribute("aria-hidden")
  expect(hiddenAfter).not.toBe(hiddenBefore)
  expect(hiddenAfter).toMatch(/^(true|false)$/)
})

// ─── ESC 모바일 overlay 닫기 ─────────────────────────────────────────────────

test.describe("ESC: closes mobile overlay at 768px", () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test("ESC closes open mobile overlay", async ({ page }) => {
    await page.goto("/")
    const sidebar = page.locator("#app-sidebar")

    // 초기 상태: 모바일 overlay 닫힘 (aria-hidden="true")
    await expect(sidebar).toHaveAttribute("aria-hidden", "true")

    // 햄버거 클릭으로 overlay 열기 — aria-controls="app-sidebar"로 헤더 햄버거만 지정
    const hamburger = page.locator('[aria-controls="app-sidebar"]')
    await hamburger.click()
    await expect(sidebar).toHaveAttribute("aria-hidden", "false")

    // ESC로 닫기
    await page.keyboard.press("Escape")
    await expect(sidebar).toHaveAttribute("aria-hidden", "true")
  })
})

// ─── SkipLink Tab 순서 ────────────────────────────────────────────────────────

test("SkipLink: Tab once → 본문 바로가기, Tab twice → 메뉴 바로가기", async ({ page }) => {
  await page.goto("/")

  // Tab #1 — sr-only SkipLink 첫 번째 링크 ("본문 바로가기")
  await page.keyboard.press("Tab")
  const firstText = await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? "",
  )
  expect(firstText).toContain("본문")

  // Tab #2 — sr-only SkipLink 두 번째 링크 ("메뉴 바로가기")
  await page.keyboard.press("Tab")
  const secondText = await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? "",
  )
  expect(secondText).toContain("메뉴")
})

test("SkipLink: Enter on 메뉴 바로가기 moves focus to #app-sidebar", async ({ page }) => {
  await page.goto("/")

  // Tab × 2 to reach 메뉴 바로가기
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")

  const secondText = await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? "",
  )
  expect(secondText).toContain("메뉴")

  // Enter — SkipLink href="#app-sidebar" → sidebar gets focus
  await page.keyboard.press("Enter")
  await page.waitForTimeout(50) // 포커스 이동 완료 대기

  const focusedId = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.id ?? "",
  )
  expect(focusedId).toBe("app-sidebar")
})

// ─── D5 포커스 트랩 (T12 codex-rescue F1) ─────────────────────────────────────
// inert가 <main>에만 걸려 있을 때 Header/Footer로 Tab 탈출 가능하던 문제 회귀 가드.
// 래퍼 div(Header + main + Footer)로 inert 이동 후 완전 차단 검증.

test.describe("D5 focus trap: mobile overlay — Tab stays within sidebar", () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test("mobile overlay open: Tab 12회 연속 all focus stays within #app-sidebar", async ({ page }) => {
    await page.goto("/")
    const sidebar = page.locator("#app-sidebar")

    // 햄버거 클릭으로 overlay 열기
    const hamburger = page.locator('[aria-controls="app-sidebar"]')
    await hamburger.click()
    await expect(sidebar).toHaveAttribute("aria-hidden", "false")

    // T6: AppSidebar는 overlay 열린 후 100ms 뒤 X 닫기 버튼에 자동 포커스.
    // Tab 검증 전에 자동 포커스가 사이드바 안으로 들어왔는지 확인.
    await page.waitForFunction(
      () => {
        const s = document.getElementById("app-sidebar")
        return s?.contains(document.activeElement) ?? false
      },
      { timeout: 1000 },
    )

    // Tab을 12번 눌러 사이드바 내부 포커스 순환 — 모든 포커스가 #app-sidebar 트리 안에 있어야 함
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab")
      const insideSidebar = await page.evaluate(() => {
        const s = document.getElementById("app-sidebar")
        return s?.contains(document.activeElement) ?? false
      })
      expect(insideSidebar, `Tab #${i + 1}: 포커스가 사이드바 밖으로 탈출`).toBe(true)
    }
  })
})
