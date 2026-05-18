export interface PopularPage {
  slug: string
  href: string
  title: string
  axis: string
  reason: string
}

export const POPULAR_PAGES: PopularPage[] = [
  {
    slug: "ordinance-comparison",
    href: "/resources/law/ordinance-comparison",
    title: "시도교육청 편의지원 조례 비교 분석",
    axis: "정책·법령",
    reason: "9개 시도 조례 비교 (2026-03-11 최신본)",
  },
  {
    slug: "2024-staff-p-183",
    href: "/disability-types/2024-staff-p-183",
    title: "특수 마우스",
    axis: "장애유형별",
    reason: "지체·뇌병변장애 교원 보조공학기기",
  },
  {
    slug: "2024-staff-p-159",
    href: "/disability-types/2024-staff-p-159",
    title: "비교과 활동 내용 입력 (학교생활기록부)",
    axis: "장애유형별",
    reason: "학생부 입력 보조 지원",
  },
  {
    slug: "2024-jbu-p-062",
    href: "/policies/2024-jbu-p-062",
    title: "정서적 학대",
    axis: "정책·법령",
    reason: "교권 보호 관련 정책",
  },
]
