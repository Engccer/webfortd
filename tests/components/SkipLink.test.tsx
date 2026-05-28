import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { SkipLink } from "@/components/accessibility/SkipLink"

describe("SkipLink", () => {
  it("renders two skip links — 본문 + 메뉴 — with correct targets", () => {
    render(<SkipLink />)
    const main = screen.getByRole("link", { name: "본문 바로가기" })
    const menu = screen.getByRole("link", { name: "메뉴 바로가기" })
    expect(main).toHaveAttribute("href", "#main-content")
    expect(menu).toHaveAttribute("href", "#app-sidebar")
  })

  it("both links are sr-only by default (hidden until focused)", () => {
    render(<SkipLink />)
    const main = screen.getByRole("link", { name: "본문 바로가기" })
    const menu = screen.getByRole("link", { name: "메뉴 바로가기" })
    expect(main.className).toContain("sr-only")
    expect(menu.className).toContain("sr-only")
  })

  it("links have distinct focus top positions so they don't overlap", () => {
    render(<SkipLink />)
    const main = screen.getByRole("link", { name: "본문 바로가기" })
    const menu = screen.getByRole("link", { name: "메뉴 바로가기" })
    // Main at top-4, menu at top-16 (stacked vertically when both focused)
    expect(main.className).toMatch(/focus:top-4/)
    expect(menu.className).toMatch(/focus:top-16/)
  })
})
