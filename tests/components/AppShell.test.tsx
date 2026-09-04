import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppShell } from "@/components/layout/AppShell"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/contexts/AuthContext"

// 홈은 헤더 검색창을 숨기므로(히어로 옴니박스 단독), 단축키 테스트만 홈 밖 경로로 바꾼다.
let mockPathname = "/"

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}))

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: vi.fn(),
    },
  }),
  getAnonClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: vi.fn(),
    },
  }),
}))

vi.mock("@/lib/kb-search-data", () => ({
  getSearchDocs: () => [],
}))

/**
 * jsdom의 matchMedia stub은 matches=false 반환 → useMediaQuery가 isMobile=true로 판단.
 * AppShell 테스트는 데스크탑(xl ≥ 1280px) 환경을 가정하므로 matches=true mock 필요.
 * (setup.ts 가드: `if (typeof window.matchMedia === 'undefined')` — 이미 정의돼 있으면
 *  setup.ts가 건드리지 않으므로 beforeEach에서 직접 덮어쓴다.)
 */
function mockDesktopMediaQuery() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 1280px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

/**
 * localStorage가 jsdom에서 정상 동작하나 스펙 위반 시 오류 방지용 no-op stub.
 * vi.spyOn(Storage.prototype, ...) 패턴으로 안전하게 처리.
 */
function stubLocalStorage() {
  vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null)
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)
}

beforeEach(() => {
  vi.restoreAllMocks()
  // restoreAllMocks 후 다시 적용 (cleanup은 afterEach setup.ts에서 수행)
  mockDesktopMediaQuery()
  stubLocalStorage()
  // 경로 mock 초기화 — 테스트 본문에서 복구하면 assertion 실패 시 다음 테스트로 샌다.
  mockPathname = "/"
})

function wrap(node: React.ReactNode) {
  return (
    <ThemeProvider attribute="class">
      <AuthProvider>{node}</AuthProvider>
    </ThemeProvider>
  )
}

describe("AppShell", () => {
  it("renders Header + AppSidebar + main + Footer (no visual skip link)", () => {
    render(wrap(<AppShell initialExpanded={true}>page content</AppShell>))
    // 시각적 skip link 제거됨 — '건너뛰기'는 Alt+1/2/3 단축키로 제공(src/lib/accessibility.ts).
    expect(screen.queryByRole("link", { name: "본문 바로가기" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "메뉴 바로가기" })).not.toBeInTheDocument()
    expect(screen.getByRole("banner")).toBeInTheDocument() // <header>
    expect(document.getElementById("app-sidebar")).toBeTruthy()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(screen.getByText("page content")).toBeInTheDocument()
  })

  it("main has id=main-content and tabIndex=-1", () => {
    render(wrap(<AppShell initialExpanded={true}>x</AppShell>))
    const main = screen.getByRole("main")
    expect(main.id).toBe("main-content")
    expect(main).toHaveAttribute("tabindex", "-1")
  })

  it("aria-live region exists with polite + sr-only", () => {
    render(wrap(<AppShell initialExpanded={true}>x</AppShell>))
    const liveRegion = document.querySelector("[role='status'][aria-live='polite']")
    expect(liveRegion).toBeTruthy()
    expect(liveRegion?.className).toContain("sr-only")
  })

  it("Cmd+B keyboard shortcut toggles sidebar (desktop mode)", async () => {
    const user = userEvent.setup()
    render(wrap(<AppShell initialExpanded={true}>x</AppShell>))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("aria-hidden", "false")
    await user.keyboard("{Meta>}b{/Meta}")
    expect(sidebar).toHaveAttribute("aria-hidden", "true")
  })

  it("Cmd+B announces toggle via aria-live (desktop)", async () => {
    const user = userEvent.setup()
    render(wrap(<AppShell initialExpanded={true}>x</AppShell>))
    const liveRegion = document.querySelector("[role='status'][aria-live='polite']")
    await user.keyboard("{Meta>}b{/Meta}")
    expect(liveRegion?.textContent).toMatch(/메뉴를 접었습니다/)
  })

  it("Cmd+K focuses #search-input", async () => {
    // AppShell의 children은 여기서 텍스트뿐이라 홈 히어로 옴니박스가 없다. 단축키
    // 자체를 검증하려면 검색창이 존재하는 경로여야 하므로 홈 밖으로 둔다.
    // 홈에서 같은 단축키가 히어로 옴니박스로 가는지는 tests/a11y/sidebar.spec.ts가
    // 실 브라우저에서 검증한다(Alt+3).
    mockPathname = "/policies/edu-support"
    const user = userEvent.setup()
    render(wrap(<AppShell initialExpanded={true}>x</AppShell>))
    const input = document.getElementById("search-input")
    expect(input).toBeTruthy()
    await user.keyboard("{Meta>}k{/Meta}")
    expect(document.activeElement).toBe(input)
  })

  it("desktop: main is NOT inert (no aria-modal blocking)", () => {
    render(wrap(<AppShell initialExpanded={true}>x</AppShell>))
    const main = screen.getByRole("main")
    // inert이 <main> 자체가 아닌 Header+main+Footer 래퍼 div로 이동했으므로 false.
    expect(main.hasAttribute("inert")).toBe(false)
  })

  // Note: Testing 'content wrapper inert when mobile overlay open' requires viewport simulation
  // — Playwright (T11/T12) covers this end-to-end. The unit test verifies that
  // the inert prop is wired correctly via the AppShellInner contract.
})
