import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusBadge } from "@/components/kb/StatusBadge"

describe("StatusBadge", () => {
  const cases: Array<[string, string]> = [
    ["draft", "초안"],
    ["in_review", "검수중"],
    ["published", "게시됨"],
    ["archived", "보관됨"],
    ["deprecated", "폐기됨"],
  ]

  for (const [status, label] of cases) {
    it(`status='${status}' renders label '${label}'`, () => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeDefined()
    })

    it(`status='${status}' is a status role with aria-label containing the label`, () => {
      render(<StatusBadge status={status} />)
      const badge = screen.getByRole("status")
      expect(badge.getAttribute("aria-label")).toContain(label)
    })
  }

  it("unknown status → fallback '알수없음'", () => {
    render(<StatusBadge status={"foo-unknown"} />)
    expect(screen.getByText("알수없음")).toBeDefined()
  })

  it("renders span element (not div) for inline composition", () => {
    const { container } = render(<StatusBadge status="published" />)
    expect(container.firstElementChild?.tagName).toBe("SPAN")
  })
})
