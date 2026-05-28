import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { ThemeProvider } from "next-themes"

// matchMedia / ResizeObserver stub은 tests/components/setup.ts에서 전역 처리.

function wrap(node: React.ReactNode) {
  return <ThemeProvider attribute="class">{node}</ThemeProvider>
}

describe("AccessibilityToolbar", () => {
  it("uncontrolled mode renders default trigger button", () => {
    render(wrap(<AccessibilityToolbar />))
    expect(screen.getByRole("button", { name: "접근성 설정" })).toBeInTheDocument()
  })

  it("controlled mode + hideTrigger: no default trigger, dialog opens via open prop", () => {
    const onOpenChange = vi.fn()
    render(wrap(<AccessibilityToolbar open={true} onOpenChange={onOpenChange} hideTrigger />))
    expect(screen.queryByRole("button", { name: "접근성 설정" })).not.toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("controlled close calls onOpenChange(false) on Esc", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(wrap(<AccessibilityToolbar open={true} onOpenChange={onOpenChange} hideTrigger />))
    await user.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
