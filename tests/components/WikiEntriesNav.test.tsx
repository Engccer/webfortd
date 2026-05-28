import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WikiEntriesNav } from "@/components/layout/WikiEntriesNav"
import { wikiEntries } from "@/lib/wiki-entries"

describe("WikiEntriesNav", () => {
  it("renders nav with aria-label '위키 메뉴'", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={() => {}} />)
    expect(screen.getByRole("navigation", { name: "위키 메뉴" })).toBeInTheDocument()
  })

  it("renders 5 items as links", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={() => {}} />)
    expect(screen.getAllByRole("link")).toHaveLength(5)
  })

  it("marks current page link with aria-current=page", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/chat" onNavigate={() => {}} />)
    const chatLink = screen.getByRole("link", { name: /채팅/ })
    expect(chatLink).toHaveAttribute("aria-current", "page")
  })

  it("only the current link has aria-current=page", () => {
    render(<WikiEntriesNav items={wikiEntries} pathname="/chat" onNavigate={() => {}} />)
    const allLinks = screen.getAllByRole("link")
    const currentCount = allLinks.filter((l) => l.getAttribute("aria-current") === "page").length
    expect(currentCount).toBe(1)
  })

  it("calls onNavigate when a link is clicked", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={onNavigate} />)
    await user.click(screen.getByRole("link", { name: /자료실/ }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it("icons are aria-hidden (visual only)", () => {
    const { container } = render(
      <WikiEntriesNav items={wikiEntries} pathname="/" onNavigate={() => {}} />,
    )
    const icons = container.querySelectorAll("svg")
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"))
  })
})
