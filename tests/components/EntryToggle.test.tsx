import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { EntryToggle } from "@/components/wiki/EntryToggle"

vi.mock("next/navigation", () => ({ usePathname: () => "/" }))

describe("EntryToggle", () => {
  it("default variant renders inline-flex container", () => {
    const { container } = render(<EntryToggle />)
    const root = container.firstElementChild
    expect(root?.className).toContain("inline-flex")
  })

  it("sidebar variant renders w-full flex with flex-1 children", () => {
    const { container } = render(<EntryToggle variant="sidebar" />)
    const root = container.firstElementChild
    expect(root?.className).toContain("flex")
    expect(root?.className).toContain("w-full")
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)
    links.forEach((link) => expect(link.className).toContain("flex-1"))
  })

  it("renders two mode links without a group role (미니멀 접근성)", () => {
    // role=group + aria-label은 제거 — 두 Link 텍스트가 의미를 전달하고 aria-current가
    // 현재 모드를 표시하므로 group 래핑은 불필요한 ARIA였다.
    const { container, rerender } = render(<EntryToggle />)
    expect(container.querySelector("[role='group']")).toBeNull()
    expect(screen.getAllByRole("link")).toHaveLength(2)
    rerender(<EntryToggle variant="sidebar" />)
    expect(container.querySelector("[role='group']")).toBeNull()
  })

  it("legacy button label is '레거시 사이트' (not '이전 버전')", () => {
    render(<EntryToggle />)
    expect(screen.getByRole("link", { name: /레거시 사이트/ })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /이전 버전/ })).not.toBeInTheDocument()
  })
})
