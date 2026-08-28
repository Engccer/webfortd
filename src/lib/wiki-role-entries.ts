/**
 * 위키 entry 역할별 진입점 5장 시드 데이터.
 *
 * 위원장 영구 원칙(앱 정체성 §사용자 다층) 정합 — 장애인교원·관리자·교육청·정책입안자·학부모 다층.
 * D6 협업 영역 placeholder — 위원장-허유진 교수 협업 결과는 M2 머지 후 별도 PR로 교체.
 */

export type Role = "teacher" | "manager" | "office" | "policy" | "parent"

export interface RoleRecommendation {
  slug: string
  axis:
    | "disability-types"
    | "policies"
    | "agreements"
    | "domains"
    | "regions"
    | "resources/law"
    | "resources/research"
    | "uncategorized"
  title: string
  reason: string
}

export interface RoleEntry {
  role: Role
  title: string
  description: string
  icon: "user" | "school" | "building" | "scale" | "heart"
  recommended: RoleRecommendation[]
}

export const ROLE_ENTRIES: RoleEntry[] = [
  {
    role: "teacher",
    title: "장애인교원",
    description: "수업·업무에 필요한 편의지원과 보조공학 안내",
    icon: "user",
    recommended: [
      {
        slug: "2024-staff-app-2",
        axis: "disability-types",
        title: "보조기기의 종류별 사용법 및 관리법",
        reason: "보조공학기기 신청 가이드",
      },
      {
        slug: "2024-staff-5-4-5",
        axis: "disability-types",
        title: "청각장애인교원 비교과 활동 내용 입력 (학교생활기록부)",
        reason: "학생부 입력 보조 지원",
      },
    ],
  },
  {
    role: "manager",
    title: "학교 관리자",
    description: "장애인교원 채용·근무 환경 조성 안내",
    icon: "school",
    recommended: [
      {
        slug: "2024-jbu-4-2-2-1",
        axis: "policies",
        title: "장애인 학대 유형",
        reason: "교권 보호 정책",
      },
    ],
  },
  {
    role: "office",
    title: "교육청 인사담당자",
    description: "정책·법령·운영 매뉴얼 모음",
    icon: "building",
    recommended: [
      {
        slug: "ordinance-comparison",
        axis: "resources/law",
        title: "시도교육청 편의지원 조례 비교",
        reason: "9개 시도 조례 비교 분석 (2026-03-11)",
      },
    ],
  },
  {
    role: "policy",
    title: "정책 입안자",
    description: "통계·연구·해외 사례",
    icon: "scale",
    recommended: [],
  },
  {
    role: "parent",
    title: "장애학생 부모",
    description: "장애인교원과의 소통, 자녀 교육에 대한 안내",
    icon: "heart",
    recommended: [],
  },
]
