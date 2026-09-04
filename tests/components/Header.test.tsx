import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Header } from "@/components/layout/Header"
import { SidebarProvider } from "@/contexts/SidebarContext"
import { ThemeProvider } from "next-themes"

// 경로는 테스트마다 바뀐다 — 헤더 검색창이 홈에서만 숨는 계약을 양쪽에서 검증한다.
let mockPathname = "/"

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}))

vi.mock("@/lib/kb-search-data", () => ({
  getSearchDocs: () => [],
}))

function wrap(node: React.ReactNode, opts?: { isMobile?: boolean; isExpanded?: boolean; isMobileOpen?: boolean }) {
  return (
    <ThemeProvider attribute="class">
      <SidebarProvider
        initialExpanded={opts?.isExpanded ?? true}
        initialIsMobile={opts?.isMobile ?? false}
        initialMobileOpen={opts?.isMobileOpen ?? false}
      >
        {node}
      </SidebarProvider>
    </ThemeProvider>
  )
}

describe("Header", () => {
  beforeEach(() => {
    mockPathname = "/"
  })

  it("renders hamburger toggle with aria-controls and aria-expanded", () => {
    render(wrap(<Header />))
    const btn = screen.getByRole("button", { name: /메뉴 접기|메뉴 펼치기/ })
    expect(btn).toHaveAttribute("aria-controls", "app-sidebar")
    expect(btn).toHaveAttribute("aria-expanded", "true") // desktop default expanded
  })

  it("hamburger label reflects collapsed state", () => {
    render(wrap(<Header />, { isExpanded: false }))
    expect(screen.getByRole("button", { name: "메뉴 펼치기" })).toBeInTheDocument()
  })

  it("hamburger label reflects expanded state", () => {
    render(wrap(<Header />, { isExpanded: true }))
    expect(screen.getByRole("button", { name: "메뉴 접기" })).toBeInTheDocument()
  })

  it("mobile mode: hamburger reflects isMobileOpen, not isExpanded", () => {
    render(wrap(<Header />, { isMobile: true, isExpanded: true, isMobileOpen: false }))
    expect(screen.getByRole("button", { name: "메뉴 펼치기" })).toHaveAttribute("aria-expanded", "false")
  })

  it("renders logo link to /", () => {
    render(wrap(<Header />))
    const logo = screen.getByRole("link", { name: /장애인교원/ })
    expect(logo).toHaveAttribute("href", "/")
  })

  it("does NOT render top gray strip with old subtitle", () => {
    render(wrap(<Header />))
    expect(screen.queryByText("장애인교원의 교육활동을 지원합니다")).not.toBeInTheDocument()
  })

  it("does NOT render any desktop NavigationMenu items (e.g., 플랫폼 소개 dropdown)", () => {
    render(wrap(<Header />))
    // 플랫폼 소개 is a top-level mainNavigation parent; should be in SidebarNav now, not Header
    expect(screen.queryByRole("button", { name: "플랫폼 소개" })).not.toBeInTheDocument()
  })

  it("desktop click toggles aria-expanded via SidebarContext", async () => {
    const user = userEvent.setup()
    render(wrap(<Header />, { isExpanded: false }))
    const btn = screen.getByRole("button", { name: "메뉴 펼치기" })
    expect(btn).toHaveAttribute("aria-expanded", "false")
    await user.click(btn)
    expect(screen.getByRole("button", { name: "메뉴 접기" })).toHaveAttribute("aria-expanded", "true")
  })

  it("홈에서는 검색창을 렌더하지 않는다 (히어로 옴니박스가 단독 검색 표면)", () => {
    mockPathname = "/"
    render(wrap(<Header />))
    expect(document.getElementById("search-input")).toBeNull()
  })

  it("홈 밖에서는 검색창을 렌더한다 (그 화면의 유일한 검색 표면)", () => {
    mockPathname = "/policies/edu-support"
    render(wrap(<Header />))
    expect(document.getElementById("search-input")).toBeTruthy()
  })
})
