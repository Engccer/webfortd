import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AxisDocList } from "@/components/kb/AxisDocList"
import type { AxisDocListItem } from "@/lib/kb-axis"

const ITEMS: AxisDocListItem[] = [
  {
    slug: "2024-staff-app-2",
    axis: "policies",
    title: "특수 마우스",
    description: "보조공학기기 신청 가이드",
    dateLabel: "2024-03-11",
  },
  {
    slug: "2023-hr-x1-x3",
    axis: "disability-types",
    title: "장애인교원의 이해",
  },
]

describe("AxisDocList", () => {
  it("빈 목록이면 안내 문구를 보여준다", () => {
    render(<AxisDocList items={[]} />)
    expect(screen.getByText("아직 등록된 문서가 없습니다.")).toBeInTheDocument()
  })

  it("각 문서를 /{axis}/{slug} 링크로 렌더한다", () => {
    render(<AxisDocList items={ITEMS} />)
    const link = screen.getByRole("link", { name: "특수 마우스" })
    expect(link).toHaveAttribute("href", "/policies/2024-staff-app-2")
  })

  it("링크의 접근 가능한 이름은 제목만이다 (날짜·설명이 섞이지 않음)", () => {
    render(<AxisDocList items={ITEMS} />)
    // 날짜가 링크 이름에 포함됐다면 정확 매칭이 실패한다.
    expect(
      screen.getByRole("link", { name: "특수 마우스" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /2024-03-11/ }),
    ).not.toBeInTheDocument()
  })

  it("날짜·설명을 본문 텍스트로 노출한다", () => {
    render(<AxisDocList items={ITEMS} />)
    expect(screen.getByText("2024-03-11")).toBeInTheDocument()
    expect(screen.getByText("보조공학기기 신청 가이드")).toBeInTheDocument()
  })

  it("dateLabel·description이 없는 문서도 제목 링크는 렌더한다", () => {
    render(<AxisDocList items={ITEMS} />)
    expect(
      screen.getByRole("link", { name: "장애인교원의 이해" }),
    ).toHaveAttribute("href", "/disability-types/2023-hr-x1-x3")
  })
})
