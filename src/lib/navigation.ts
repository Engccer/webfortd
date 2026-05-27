export interface NavItem {
  title: string
  href: string
  description?: string
  children?: NavItem[]
}

export const mainNavigation: NavItem[] = [
  {
    title: "플랫폼 소개",
    href: "/legacy/about",
    children: [
      { title: "소개 및 이용안내", href: "/legacy/about/purpose" },
      { title: "연혁 및 협력기관", href: "/legacy/about/partners" },
    ],
  },
  {
    title: "지원제도 안내",
    href: "/legacy/support",
    children: [
      {
        title: "지원영역별",
        href: "/legacy/support/area",
        children: [
          { title: "인사·복무", href: "/legacy/support/area/hr" },
          { title: "지원인력·근로지원인", href: "/legacy/support/area/assistant" },
          { title: "보조공학기기", href: "/legacy/support/area/technology" },
          { title: "시설·환경", href: "/legacy/support/area/facility" },
        ],
      },
      {
        title: "장애유형별",
        href: "/legacy/support/disability",
        children: [
          { title: "시각장애", href: "/legacy/support/disability/visual" },
          { title: "청각장애", href: "/legacy/support/disability/hearing" },
          { title: "지체·뇌병변장애", href: "/legacy/support/disability/physical" },
          { title: "기타 장애유형", href: "/legacy/support/disability/other" },
        ],
      },
      { title: "시도별 제도", href: "/legacy/support/region" },
    ],
  },
  {
    title: "연구·법령·통계",
    href: "/legacy/resources",
    children: [
      { title: "연구자료", href: "/legacy/resources/research-guide" },
      { title: "법령·지침", href: "/legacy/resources/law-guide" },
      { title: "통계", href: "/legacy/resources/statistics" },
      { title: "정책 제안", href: "/legacy/resources/policy" },
    ],
  },
  {
    title: "권리 구제",
    href: "/legacy/rights",
    children: [
      { title: "장애인교원의 권리", href: "/legacy/rights/entitlements" },
      { title: "판례", href: "/legacy/rights/cases" },
      { title: "구제 절차 안내", href: "/legacy/rights/procedure" },
      { title: "상담·신고", href: "/legacy/rights/report" },
    ],
  },
  {
    title: "현장 사례",
    href: "/legacy/stories",
    children: [
      { title: "우수사례", href: "/legacy/stories/best-practices" },
      { title: "인식 개선 콘텐츠", href: "/legacy/stories/awareness" },
      { title: "미디어 소개", href: "/legacy/stories/media" },
    ],
  },
  {
    title: "참여하기",
    href: "/legacy/participate",
    children: [
      { title: "자주 묻는 질문", href: "/legacy/participate/faq" },
      { title: "질문하기", href: "/legacy/participate/ask" },
      { title: "나의 권리 알아보기", href: "/legacy/participate/check" },
    ],
  },
]

export interface UserEntry {
  title: string
  description: string
  href: string
  icon: string
}

export const userEntries: UserEntry[] = [
  {
    title: "나에게 맞는 지원 찾기",
    description: "장애유형별 맞춤 지원제도를 확인하세요",
    href: "/legacy/support/disability",
    icon: "user",
  },
  {
    title: "우리 학교 지원 가이드",
    description: "학교 관리자를 위한 체크리스트와 편의제공 안내",
    href: "/legacy/support/area/hr",
    icon: "school",
  },
  {
    title: "제도 운영 매뉴얼",
    description: "교육청 인사담당자를 위한 실무 지침",
    href: "/legacy/resources/law-guide",
    icon: "file-text",
  },
  {
    title: "현황 통계",
    description: "정책입안자를 위한 통계 데이터",
    href: "/legacy/resources/statistics",
    icon: "bar-chart",
  },
]
