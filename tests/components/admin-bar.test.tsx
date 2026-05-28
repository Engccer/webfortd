import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AdminBarView } from "@/components/admin/AdminBarView"

describe("AdminBarView", () => {
  it("isAdmin=false → renders nothing", () => {
    const { container } = render(
      <AdminBarView status={{ isAdmin: false, userId: null, email: null }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("isAdmin=false (authenticated non-admin) → still renders nothing", () => {
    const { container } = render(
      <AdminBarView
        status={{ isAdmin: false, userId: "u-1", email: "plain@example.com" }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("isAdmin=true → renders region with admin label + dashboard link", () => {
    render(
      <AdminBarView
        status={{
          isAdmin: true,
          userId: "admin-1",
          email: "engccer@gmail.com",
        }}
      />,
    )
    expect(screen.getByRole("region", { name: /관리자 도구/ })).toBeDefined()
    expect(screen.getByText("관리자 모드")).toBeDefined()
    expect(screen.getByText("engccer@gmail.com")).toBeDefined()
    const dashboardLink = screen.getByRole("link", { name: "대시보드" })
    expect(dashboardLink.getAttribute("href")).toBe("/admin/dashboard")
  })

  it("isAdmin=true with null email → renders placeholder", () => {
    render(
      <AdminBarView
        status={{ isAdmin: true, userId: "admin-1", email: null }}
      />,
    )
    expect(screen.getByText(/이메일 없음/)).toBeDefined()
  })

  it("preview toggle is disabled with Phase B tooltip", () => {
    render(
      <AdminBarView
        status={{
          isAdmin: true,
          userId: "admin-1",
          email: "engccer@gmail.com",
        }}
      />,
    )
    const toggle = screen.getByRole("button", { name: /미리보기/ })
    expect(toggle.hasAttribute("disabled")).toBe(true)
    expect(toggle.getAttribute("title")).toMatch(/Phase B/)
  })
})
