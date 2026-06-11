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

    // a11y 패치(2026-06-11): 정적 배지의 role="status"(live region) 오용 제거 —
    // 시각 라벨은 aria-hidden, 스크린리더에는 sr-only 전체 설명 제공.
    it(`status='${status}' has no live role + sr-only description contains the label`, () => {
      const { container } = render(<StatusBadge status={status} />)
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
      const srOnly = container.querySelector(".sr-only")
      expect(srOnly?.textContent).toContain(label)
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
