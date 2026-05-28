import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Footer } from "@/components/layout/Footer"

describe("Footer", () => {
  it("removes the old 브랜드 h2 + 바로가기 sections", () => {
    render(<Footer />)
    // 브랜드 h2 (heading level 2) 부재
    const brandHeading = screen.queryByRole("heading", {
      name: "장애인교원 교육전념 여건 지원",
      level: 2,
    })
    expect(brandHeading).not.toBeInTheDocument()
    // 바로가기 텍스트 부재
    expect(screen.queryByText("바로가기")).not.toBeInTheDocument()
  })

  it("renders 운영 주체 section with email/phone placeholder", () => {
    render(<Footer />)
    expect(screen.getByRole("heading", { name: "운영 주체" })).toBeInTheDocument()
    expect(screen.getByText(/support@/)).toBeInTheDocument()
    expect(screen.getByText(/044-/)).toBeInTheDocument()
  })

  it("renders 관련 사이트 section (currently empty placeholder)", () => {
    render(<Footer />)
    expect(screen.getByRole("heading", { name: "관련 사이트" })).toBeInTheDocument()
  })

  it("renders 정책 section with 3 links to /privacy /terms /sitemap", () => {
    render(<Footer />)
    expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "사이트맵" })).toHaveAttribute("href", "/sitemap")
  })

  it("renders Copyright with current year", () => {
    render(<Footer />)
    const year = new Date().getFullYear()
    expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument()
  })
})
