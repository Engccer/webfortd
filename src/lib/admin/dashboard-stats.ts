/**
 * Admin Dashboard 통계 헬퍼 — kb-index.generated.json (마크다운 정본 파생)을
 * 입력으로 받아 순수 함수로 집계. DB 조회는 호출자(RSC)에서 별도.
 *
 * server-only를 의도적으로 import하지 않음 — 단위 테스트가 직접 호출 가능하도록.
 * (계산 함수일 뿐이라 client 안전성 영향 없음. RSC에서만 호출됨.)
 */

const STATUSES = [
  'draft',
  'in_review',
  'published',
  'archived',
  'deprecated',
] as const
type StatusKey = (typeof STATUSES)[number]

export type StatusCounts = Record<StatusKey, number>

// 입력은 KBDocumentSummary지만 fixture/테스트 편의를 위해 구조적 타입으로 선언.
interface DocLike {
  slug: string
  axis: string
  frontmatter: {
    status?: string
    reviewed_by?: string[]
    title?: string
  }
}

export function computeStatusCounts(docs: DocLike[]): StatusCounts {
  const counts: StatusCounts = {
    draft: 0,
    in_review: 0,
    published: 0,
    archived: 0,
    deprecated: 0,
  }
  for (const d of docs) {
    const status = d.frontmatter.status as StatusKey | undefined
    if (status && status in counts) counts[status]++
  }
  return counts
}

export function computeAxisDistribution(
  docs: DocLike[],
): Record<string, number> {
  const dist: Record<string, number> = {}
  for (const d of docs) {
    dist[d.axis] = (dist[d.axis] ?? 0) + 1
  }
  return dist
}

export interface ReviewQueueItem {
  slug: string
  title?: string
  axis: string
  status: string
}

/**
 * 검수 대기 큐 — status='draft'이면서 reviewed_by가 비어있는 페이지.
 * Phase B의 bootstrap publish 대상 추적용.
 */
export function computeReviewQueue(docs: DocLike[]): ReviewQueueItem[] {
  return docs
    .filter((d) => {
      const reviewed = d.frontmatter.reviewed_by ?? []
      return reviewed.length === 0 && d.frontmatter.status === 'draft'
    })
    .map((d) => ({
      slug: d.slug,
      title: d.frontmatter.title,
      axis: d.axis,
      status: d.frontmatter.status ?? 'draft',
    }))
}
