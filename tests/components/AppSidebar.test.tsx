import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SidebarProvider } from "@/contexts/SidebarContext"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/contexts/AuthContext"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

describe("AppSidebar", () => {
  it("desktop expanded: aria-hidden=false, accessible by name 주 메뉴", () => {
    render(wrap(<AppSidebar />))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toBeTruthy()
    expect(sidebar).toHaveAttribute("aria-label", "주 메뉴")
    expect(sidebar).toHaveAttribute("aria-hidden", "false")
  })

  it("desktop collapsed: aria-hidden=true", () => {
    render(wrap(<AppSidebar />, { isExpanded: false }))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("aria-hidden", "true")
  })

  it("mobile closed: backdrop + sidebar both present, sidebar aria-hidden=true", () => {
    render(wrap(<AppSidebar />, { isMobile: true }))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("aria-hidden", "true")
    // role=dialog when mobile (regardless of open state — the element exists)
    expect(sidebar).toHaveAttribute("role", "dialog")
  })

  it("desktop mode: sidebar has role=complementary (NOT dialog)", () => {
    render(wrap(<AppSidebar />))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("role", "complementary")
  })

  it("renders EntryToggle with sidebar variant", () => {
    render(wrap(<AppSidebar />))
    const group = screen.getByRole("group", { name: "사이트 모드 전환" })
    expect(group.className).toContain("w-full")
  })

  it("renders 접근성 설정 trigger button", () => {
    render(wrap(<AppSidebar />))
    expect(screen.getByRole("button", { name: "접근성 설정 열기" })).toBeInTheDocument()
  })

  it("mobile renders close X button labeled 메뉴 닫기", () => {
    render(wrap(<AppSidebar />, { isMobile: true }))
    // 사이드바가 닫힌 상태이므로 aria-hidden=true — hidden:true로 DOM에서 직접 확인
    expect(screen.getByRole("button", { name: "메뉴 닫기", hidden: true })).toBeInTheDocument()
  })

  it("desktop does NOT render close X button (only mobile has it)", () => {
    render(wrap(<AppSidebar />))
    expect(screen.queryByRole("button", { name: "메뉴 닫기", hidden: true })).not.toBeInTheDocument()
  })

  it("renders SidebarNav with the project's mainNavigation", () => {
    render(wrap(<AppSidebar />))
    // Confirm a known mainNavigation item is rendered
    expect(screen.getByRole("link", { name: "플랫폼 소개" })).toBeInTheDocument()
  })

  it("mobile open: aria-hidden=false, role=dialog, aria-modal=true", () => {
    render(wrap(<AppSidebar />, { isMobile: true, isMobileOpen: true }))
    const sidebar = document.getElementById("app-sidebar")
    expect(sidebar).toHaveAttribute("aria-hidden", "false")
    expect(sidebar).toHaveAttribute("role", "dialog")
    expect(sidebar).toHaveAttribute("aria-modal", "true")
  })

  it("mobile open: backdrop visible (opacity-100)", () => {
    const { container } = render(wrap(<AppSidebar />, { isMobile: true, isMobileOpen: true }))
    const backdrop = container.querySelector(".bg-black\\/50")
    expect(backdrop?.className).toContain("opacity-100")
  })

  it("mobile open: close button is reachable without hidden flag", () => {
    render(wrap(<AppSidebar />, { isMobile: true, isMobileOpen: true }))
    expect(screen.getByRole("button", { name: "메뉴 닫기" })).toBeInTheDocument()
  })
})
