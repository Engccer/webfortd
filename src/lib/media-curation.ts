/**
 * 미디어 자료실(/media) 노출 자산.
 *
 * Phase 1.5b _image-mappings.json에서 manifest_path != null인 *검증된 항목*만 시드.
 * D6 협업 영역 placeholder — 위원장-허유진 교수 협업 결과 추가 자산은 M2 머지 후
 * 별도 PR.
 */

import type { CatalogStatus } from './catalog-visibility'
import { isCatalogItemVisible } from './catalog-visibility'

export interface MediaItem {
  slug: string
  imagePath: string
  alt: string
  caption: string
  sourceDocSlug: string
  sourceDocTitle: string
  sourceAxis:
    | "disability-types"
    | "policies"
    | "agreements"
    | "domains"
    | "regions"
    | "resources/law"
    | "resources/research"
    | "uncategorized"
  /** M3: 미표기 = published 간주. 명시적 'draft'만 비-admin에게 숨김. */
  status?: CatalogStatus
}

export const MEDIA_ITEMS: MediaItem[] = [
  {
    slug: "2024-staff-p-023-seat-assignment-flow",
    imagePath: "/source-images/2024-support-staff-duty-guide/page-025-render.png",
    alt: "학생 좌석 배치 지원 절차를 시각장애인교원과 지원인력 간의 상호작용으로 보여주는 순서도입니다. 시각장애인교원이 좌석 배치 및 모둠 구성 지원을 요청하면, 지원인력이 그 내용을 확인하고 요청에 따라 좌석 배치와 모둠 구성을 수행합니다. 이후 지원인력이 완성된 현황을 설명하고 시각장애인교원이 요청 내용과의 일치 여부를 확인하는 4단계 과정으로 구성됩니다.",
    caption: "학생 좌석 배치 지원 절차 (4단계)",
    sourceDocSlug: "2024-staff-3-1-3",
    sourceDocTitle: "학생 좌석 배치 지원",
    sourceAxis: "disability-types",
  },
]

export function getMediaItemBySlug(slug: string): MediaItem | undefined {
  return MEDIA_ITEMS.find((item) => item.slug === slug)
}

export function filterMediaItems(opts: {
  axis?: MediaItem["sourceAxis"]
  query?: string
  includeUnpublished?: boolean
}): MediaItem[] {
  const { axis, query, includeUnpublished = false } = opts
  const q = query?.trim().toLowerCase() ?? ""
  return MEDIA_ITEMS.filter((item) => {
    if (!isCatalogItemVisible(item.status, includeUnpublished)) return false
    if (axis && item.sourceAxis !== axis) return false
    if (q) {
      const hay = `${item.caption} ${item.alt} ${item.sourceDocTitle}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
