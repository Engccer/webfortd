export interface MockResponse {
  keywords: string[]
  answer: string
  sources: { href: string; title: string }[]
}

export const MOCK_RESPONSES: MockResponse[] = [
  {
    keywords: ["특수 마우스", "마우스", "보조공학"],
    answer:
      "지체·뇌병변장애 교원을 위한 특수 마우스에는 트랙볼 마우스, 헤드 마우스, 눈 추적 마우스, 풋 마우스가 있습니다. 손의 정밀 조작이 어려운 경우 트랙볼이, 손·발 사용이 어려운 경우 헤드/눈 추적 마우스가 적합합니다.",
    sources: [
      { href: "/disability-types/2024-staff-p-183", title: "특수 마우스" },
    ],
  },
  {
    keywords: ["조례", "편의지원 조례", "시도교육청"],
    answer:
      "2026년 3월 11일 기준, 9개 시도교육청(부산·대전·충남·충북·인천·경기·전남·전북·광주)이 장애인교원 편의지원 조례를 제정·시행하고 있습니다. 김헌용 위원장이 작성한 비교 분석 보고서에서 지원 내용·전문기관 위탁·사립학교 적용 여부를 비교하실 수 있습니다.",
    sources: [
      {
        href: "/resources/law/ordinance-comparison",
        title: "시도교육청 편의지원 조례 비교 분석",
      },
    ],
  },
  {
    keywords: ["학교생활기록부", "학생부", "비교과"],
    answer:
      "시각장애 또는 손 사용이 제한된 교원이 학교생활기록부 비교과 활동을 입력할 때 지원인력이 보조할 수 있습니다. 교원의 구술 내용을 받아 적거나, 화면 낭독·확대를 도울 수 있습니다.",
    sources: [
      {
        href: "/disability-types/2024-staff-p-159",
        title: "비교과 활동 내용 입력 (학교생활기록부)",
      },
    ],
  },
]

export const FALLBACK_RESPONSE = {
  answer:
    "현재 챗봇은 데모 단계로, 미리 준비된 주제(특수 마우스, 편의지원 조례, 학교생활기록부 입력)에 대해서만 답변합니다. 정식 Phase 3 단계에서 535개 페이지 전체에 대한 RAG 검색이 도입됩니다.",
  sources: [] as { href: string; title: string }[],
}

export function matchMockResponse(input: string) {
  const normalized = input.trim().toLowerCase()
  for (const r of MOCK_RESPONSES) {
    if (r.keywords.some((k) => normalized.includes(k.toLowerCase()))) return r
  }
  return FALLBACK_RESPONSE
}
