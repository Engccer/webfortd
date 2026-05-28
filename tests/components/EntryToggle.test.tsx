import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { EntryToggle } from "@/components/wiki/EntryToggle"

vi.mock("next/navigation", () => ({ usePathname: () => "/" }))

describe("EntryToggle", () => {
  it("default variant renders inline-flex container", () => {
    const { container } = render(<EntryToggle />)
    const group = container.querySelector("[role='group']")
    expect(group?.className).toContain("inline-flex")
  })

  it("sidebar variant renders w-full flex with flex-1 children", () => {
    const { container } = render(<EntryToggle variant="sidebar" />)
    const group = container.querySelector("[role='group']")
    expect(group?.className).toContain("flex")
    expect(group?.className).toContain("w-full")
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)
    links.forEach((link) => expect(link.className).toContain("flex-1"))
  })

  it("preserves role=group aria-label in both variants", () => {
    const { rerender } = render(<EntryToggle />)
    expect(screen.getByRole("group", { name: "사이트 모드 전환" })).toBeInTheDocument()
    rerender(<EntryToggle variant="sidebar" />)
    expect(screen.getByRole("group", { name: "사이트 모드 전환" })).toBeInTheDocument()
  })

  it("legacy button label is '레거시 사이트' (not '이전 버전')", () => {
    render(<EntryToggle />)
    expect(screen.getByRole("link", { name: /레거시 사이트/ })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /이전 버전/ })).not.toBeInTheDocument()
  })
})
