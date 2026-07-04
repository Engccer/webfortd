/**
 * KB axis 공용 메타데이터 — 라벨·둘러보기 카탈로그·목록 정렬.
 *
 * AXIS_LABEL은 기존 KbPageLayout에 사실상 private으로 박혀 있던 라벨을 단일 출처로
 * 승격한 것. 개별 문서 페이지(KbPageLayout) · axis 목록 페이지 · 위키 홈 둘러보기
 * 카드가 모두 이 모듈을 import한다.
 *
 * BROWSABLE_AXES = 위키 홈에서 "카테고리"로 둘러볼 수 있는 본문 axis.
 * resources는 nested 라우트(/resources/law/[slug]), stories·uncategorized는 콘텐츠 0건이라
 * 목록 페이지 대상에서 제외한다.
 */

import type { ContentAxis, DocumentSummary, Frontmatter } from "@/types/kb"
import { adaptFrontmatterToLegacy } from "@/lib/kb-adapter"

export const AXIS_LABEL: Record<ContentAxis, string> = {
  "disability-types": "장애유형별",
  domains: "영역별",
  regions: "지역별",
  policies: "정책·법령",
  agreements: "단체협약",
  faq: "자주 묻는 질문",
  stories: "사례",
  resources: "자료실",
  uncategorized: "미분류",
}

export interface BrowsableAxis {
  axis: ContentAxis
  label: string
  /** 위키 홈 카드 · 목록 페이지 헤더에 노출되는 한 줄 안내. 다정·명료 톤. */
  description: string
}

/**
 * 위키 홈 "주제별 둘러보기" 카드 + axis 목록 페이지(/disability-types 등) 대상.
 * 순서는 사용 빈도·일반 이용자 진입 동선을 고려한 고정 순서.
 */
export const BROWSABLE_AXES: BrowsableAxis[] = [
  {
    axis: "disability-types",
    label: AXIS_LABEL["disability-types"],
    description: "시각·청각·지체 등 장애유형에 따른 편의지원과 보조공학 안내",
  },
  {
    axis: "domains",
    label: AXIS_LABEL.domains,
    description: "수업·평가·행정·연수 등 교육활동 영역별 지원 내용",
  },
  {
    axis: "policies",
    label: AXIS_LABEL.policies,
    description: "장애인교원에 관한 법령·정책·제도 안내",
  },
  {
    axis: "agreements",
    label: AXIS_LABEL.agreements,
    description: "교원노조 단체협약 속 장애인교원 관련 조항",
  },
  {
    axis: "regions",
    label: AXIS_LABEL.regions,
    description: "시·도 교육청별 조례·지침과 지역 지원 현황",
  },
  {
    axis: "faq",
    label: AXIS_LABEL.faq,
    description: "편의지원 신청·인사·권리구제 등 장애인교원이 자주 묻는 질문과 답변",
  },
]

/** axis가 둘러보기(목록 페이지) 대상인지 — 잘못된 axis로 목록 페이지를 만들지 않도록 가드. */
export function isBrowsableAxis(axis: ContentAxis): boolean {
  return BROWSABLE_AXES.some((b) => b.axis === axis)
}

/**
 * 목록 표시용 최소 메타 — 제목·날짜·설명만 추려 목록 컴포넌트에 넘긴다.
 */
export interface AxisDocListItem {
  slug: string
  axis: ContentAxis
  title: string
  description?: string
  /** 표시용 날짜 문자열(date 우선, 없으면 `${year}년`). 없으면 undefined. */
  dateLabel?: string
}

export function toListItem(doc: DocumentSummary): AxisDocListItem {
  const fm = doc.frontmatter as Frontmatter
  const legacy = adaptFrontmatterToLegacy(fm)
  const dateLabel = legacy.date ?? (legacy.year ? `${legacy.year}년` : undefined)
  return {
    slug: doc.slug,
    axis: doc.axis,
    title: legacy.title,
    description: legacy.description,
    dateLabel,
  }
}

/**
 * 목록 정렬 — 제목 가나다순(ko). 시각장애 사용자가 heading/항목을 순회할 때
 * 예측 가능한 순서를 보장한다(날짜는 axis마다 의미가 달라 1차 키로 부적합).
 * 동일 제목이면 slug로 안정 정렬.
 */
export function sortDocsForList(items: AxisDocListItem[]): AxisDocListItem[] {
  return [...items].sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, "ko")
    if (byTitle !== 0) return byTitle
    return a.slug.localeCompare(b.slug)
  })
}

/** 홈 "주제별 둘러보기" 카드 항목 — BrowsableAxis + 집계된 문서 수. */
export interface AxisCardEntry extends BrowsableAxis {
  count: number
}

/**
 * published 문서가 0건인 axis 카드를 숨긴다.
 * draft만 있는 신규 axis(예: 검수 전 faq)가 홈에 "0개" 빈 카드로 노출되는 것을 방지.
 * admin Draft Mode에서는 count가 draft를 포함하므로 검수 중에도 카드가 보인다.
 */
export function visibleAxisCards(entries: AxisCardEntry[]): AxisCardEntry[] {
  return entries.filter((e) => e.count > 0)
}
