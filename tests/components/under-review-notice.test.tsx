import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { UnderReviewNotice } from "@/components/kb/UnderReviewNotice"

describe("UnderReviewNotice", () => {
  it("검수 중 안내 헤딩을 렌더한다", () => {
    render(<UnderReviewNotice backHref="/policies" backLabel="정책·법령 목록" />)
    expect(
      screen.getByRole("heading", { name: /검수 중인 페이지/ }),
    ).toBeDefined()
  })

  it("title이 주어지면 표시한다", () => {
    render(
      <UnderReviewNotice
        title="장애인 교원 편의지원"
        backHref="/policies"
        backLabel="정책·법령 목록"
      />,
    )
    expect(screen.getByText(/장애인 교원 편의지원/)).toBeDefined()
  })

  it("뒤로가기 링크를 backHref로 렌더한다", () => {
    render(<UnderReviewNotice backHref="/policies" backLabel="정책·법령 목록" />)
    const link = screen.getByRole("link", { name: /정책·법령 목록/ })
    expect(link.getAttribute("href")).toBe("/policies")
  })

  it("메인으로 돌아가는 홈 링크를 렌더한다", () => {
    render(<UnderReviewNotice backHref="/policies" backLabel="정책·법령 목록" />)
    const home = screen.getByRole("link", { name: /홈/ })
    expect(home.getAttribute("href")).toBe("/")
  })
})
