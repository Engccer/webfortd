import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SidebarProvider } from "@/contexts/SidebarContext"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/contexts/AuthContext"

const mockedPathname = vi.hoisted(() => vi.fn(() => "/"))
vi.mock("next/navigation", () => ({
  usePathname: mockedPathname,
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

function wrap(
  node: React.ReactNode,
  opts?: { isMobile?: boolean; isExpanded?: boolean; isMobileOpen?: boolean },
) {
  return (
    <ThemeProvider attribute="class">
      <AuthProvider>
        <SidebarProvider
          initialExpanded={opts?.isExpanded ?? true}
          initialIsMobile={opts?.isMobile ?? false}
          initialMobileOpen={opts?.isMobileOpen ?? false}
        >
          {node}
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

/** AppSidebar는 onOpenAccessibility prop이 필수이므로 no-op stub을 기본 제공 */
function makeAppSidebar(onOpenAccessibility = () => {}) {
  return <AppSidebar onOpenAccessibility={onOpenAccessibility} />
}

beforeEach(() => {
  mockedPathname.mockReturnValue("/")
})

describe("AppSidebar", () => {
  it("desktop expanded: aria-hidden=false, accessible by name 주 메뉴", () => {
    render(wrap(makeAppSidebar()))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toBeTruthy()
    expect(sidebar).toHaveAttribute("aria-label", "주 메뉴")
    expect(sidebar).toHaveAttribute("aria-hidden", "false")
  })

  it("desktop collapsed: aria-hidden=true", () => {
    render(wrap(makeAppSidebar(), { isExpanded: false }))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("aria-hidden", "true")
  })

  it("mobile closed: backdrop + sidebar both present, sidebar aria-hidden=true", () => {
    render(wrap(makeAppSidebar(), { isMobile: true }))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("aria-hidden", "true")
    // role=dialog when mobile (regardless of open state — the element exists)
    expect(sidebar).toHaveAttribute("role", "dialog")
  })

  it("desktop mode: sidebar has role=complementary (NOT dialog)", () => {
    render(wrap(makeAppSidebar()))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("role", "complementary")
  })

  it("renders EntryToggle with sidebar variant", () => {
    render(wrap(makeAppSidebar()))
    const group = screen.getByRole("group", { name: "사이트 모드 전환" })
    expect(group.className).toContain("w-full")
  })

  it("renders 접근성 설정 trigger button", () => {
    render(wrap(makeAppSidebar()))
    expect(screen.getByRole("button", { name: "접근성 설정 열기" })).toBeInTheDocument()
  })

  it("접근성 설정 버튼 클릭 시 onOpenAccessibility 콜백 호출", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(wrap(makeAppSidebar(onOpen)))
    await user.click(screen.getByRole("button", { name: "접근성 설정 열기" }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it("mobile renders close X button labeled 메뉴 닫기", () => {
    render(wrap(makeAppSidebar(), { isMobile: true }))
    // 사이드바가 닫힌 상태이므로 aria-hidden=true — hidden:true로 DOM에서 직접 확인
    expect(screen.getByRole("button", { name: "메뉴 닫기", hidden: true })).toBeInTheDocument()
  })

  it("desktop does NOT render close X button (only mobile has it)", () => {
    render(wrap(makeAppSidebar()))
    expect(screen.queryByRole("button", { name: "메뉴 닫기", hidden: true })).not.toBeInTheDocument()
  })

  it("renders SidebarNav with the project's mainNavigation", () => {
    // mainNavigation은 레거시 모드(/legacy/*)에서만 렌더링된다
    mockedPathname.mockReturnValue("/legacy/support")
    render(wrap(makeAppSidebar()))
    // Confirm a known mainNavigation item is rendered
    expect(screen.getByRole("link", { name: "플랫폼 소개" })).toBeInTheDocument()
  })

  it("mobile open: aria-hidden=false, role=dialog, aria-modal=true", () => {
    render(wrap(makeAppSidebar(), { isMobile: true, isMobileOpen: true }))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("aria-hidden", "false")
    expect(sidebar).toHaveAttribute("role", "dialog")
    expect(sidebar).toHaveAttribute("aria-modal", "true")
  })

  it("mobile open: backdrop visible (opacity-100)", () => {
    const { container } = render(wrap(makeAppSidebar(), { isMobile: true, isMobileOpen: true }))
    const backdrop = container.querySelector(".bg-black\\/50")
    expect(backdrop?.className).toContain("opacity-100")
  })

  it("mobile open: close button is reachable without hidden flag", () => {
    render(wrap(makeAppSidebar(), { isMobile: true, isMobileOpen: true }))
    expect(screen.getByRole("button", { name: "메뉴 닫기" })).toBeInTheDocument()
  })

  it("wiki mode (pathname='/') renders WikiEntriesNav with 위키 메뉴 label", () => {
    mockedPathname.mockReturnValue("/")
    render(wrap(makeAppSidebar()))
    expect(screen.getByRole("navigation", { name: "위키 메뉴" })).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "주 메뉴" })).not.toBeInTheDocument()
  })

  it("legacy mode (pathname='/legacy/support') renders SidebarNav with 주 메뉴 label", () => {
    mockedPathname.mockReturnValue("/legacy/support")
    render(wrap(makeAppSidebar()))
    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "위키 메뉴" })).not.toBeInTheDocument()
  })

  it("legacy mode for exact '/legacy' path renders SidebarNav", () => {
    mockedPathname.mockReturnValue("/legacy")
    render(wrap(makeAppSidebar()))
    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeInTheDocument()
  })
})
