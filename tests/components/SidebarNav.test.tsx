import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SidebarNav } from "@/components/layout/SidebarNav"
import type { NavItem } from "@/lib/navigation"

const items: NavItem[] = [
  {
    title: "소개",
    href: "/legacy/about",
    children: [{ title: "목적", href: "/legacy/about/purpose" }],
  },
  { title: "지원", href: "/legacy/support" },
]

describe("SidebarNav", () => {
  it("renders top-level items as links", () => {
    render(<SidebarNav items={items} pathname="/" onNavigate={() => {}} />)
    expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute("href", "/legacy/about")
    expect(screen.getByRole("link", { name: "지원" })).toHaveAttribute("href", "/legacy/support")
  })

  it("renders disclosure button for items with children, collapsed by default", () => {
    render(<SidebarNav items={items} pathname="/" onNavigate={() => {}} />)
    const toggle = screen.getByRole("button", { name: /소개 하위 메뉴 펼치기/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "목적" })).not.toBeInTheDocument()
  })

  it("auto-expands the branch containing current pathname", () => {
    render(<SidebarNav items={items} pathname="/legacy/about/purpose" onNavigate={() => {}} />)
    const toggle = screen.getByRole("button", { name: /소개 하위 메뉴 접기/ })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("link", { name: "목적" })).toBeInTheDocument()
  })

  it("toggles disclosure on button click", async () => {
    const user = userEvent.setup()
    render(<SidebarNav items={items} pathname="/" onNavigate={() => {}} />)
    const toggle = screen.getByRole("button", { name: /소개 하위 메뉴 펼치기/ })
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("link", { name: "목적" })).toBeInTheDocument()
  })

  it("marks active link with aria-current=page", () => {
    render(<SidebarNav items={items} pathname="/legacy/support" onNavigate={() => {}} />)
    expect(screen.getByRole("link", { name: "지원" })).toHaveAttribute("aria-current", "page")
  })

  it("ArrowRight on collapsed parent link expands it", async () => {
    const user = userEvent.setup()
    render(<SidebarNav items={items} pathname="/" onNavigate={() => {}} />)
    const parentLink = screen.getByRole("link", { name: "소개" })
    parentLink.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("link", { name: "목적" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /소개 하위 메뉴 접기/ })).toHaveAttribute("aria-expanded", "true")
  })

  it("ArrowLeft on expanded parent link collapses it", async () => {
    const user = userEvent.setup()
    render(<SidebarNav items={items} pathname="/legacy/about/purpose" onNavigate={() => {}} />)
    const parentLink = screen.getByRole("link", { name: "소개" })
    parentLink.focus()
    await user.keyboard("{ArrowLeft}")
    const toggle = screen.getByRole("button", { name: /소개 하위 메뉴 펼치기/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  it("calls onNavigate when a link is clicked", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<SidebarNav items={items} pathname="/" onNavigate={onNavigate} />)
    await user.click(screen.getByRole("link", { name: "지원" }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it("nav has aria-label", () => {
    render(<SidebarNav items={items} pathname="/" onNavigate={() => {}} />)
    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeInTheDocument()
  })

  it("auto-expanded branch can be collapsed via button then re-expands on navigation", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<SidebarNav items={items} pathname="/legacy/about/purpose" onNavigate={() => {}} />)
    // Auto-expanded
    expect(screen.getByRole("link", { name: "목적" })).toBeInTheDocument()
    // User force-closes the parent
    await user.click(screen.getByRole("button", { name: /소개 하위 메뉴 접기/ }))
    expect(screen.queryByRole("link", { name: "목적" })).not.toBeInTheDocument()
    // Simulate navigation away
    rerender(<SidebarNav items={items} pathname="/legacy/support" onNavigate={() => {}} />)
    expect(screen.queryByRole("link", { name: "목적" })).not.toBeInTheDocument()
    // Navigate back to the descendant — forced-close must be overridden
    rerender(<SidebarNav items={items} pathname="/legacy/about/purpose" onNavigate={() => {}} />)
    expect(screen.getByRole("link", { name: "목적" })).toBeInTheDocument()
  })

  it("renders 3-level nested children when middle is expanded", async () => {
    const user = userEvent.setup()
    const deepItems: NavItem[] = [
      {
        title: "지원제도",
        href: "/legacy/support",
        children: [
          {
            title: "영역별",
            href: "/legacy/support/area",
            children: [{ title: "인사·복무", href: "/legacy/support/area/hr" }],
          },
        ],
      },
    ]
    render(<SidebarNav items={deepItems} pathname="/" onNavigate={() => {}} />)
    await user.click(screen.getByRole("button", { name: /지원제도 하위 메뉴 펼치기/ }))
    await user.click(screen.getByRole("button", { name: /영역별 하위 메뉴 펼치기/ }))
    expect(screen.getByRole("link", { name: "인사·복무" })).toBeInTheDocument()
  })
})
