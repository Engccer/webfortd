// publish-content.ts가 main()에서 documents 테이블에서 select하는 컬럼 부분의 row 시그니처.
// Supabase JS select 결과(unknown[])를 평가하기 전에 shape 검증. 미래 sync 회귀로
// 데이터 형태가 어긋나면 evaluateGuards 도달 전 TypeError로 즉시 fail-fast.

export interface DocumentRow {
  id: string
  slug: string
  status: string
  reviewed_by: string[] | null
  source: Record<string, unknown> | null
  embedded_media: unknown[] | null
  accessibility: Record<string, unknown> | null
}

export function parseDocumentRow(raw: unknown): DocumentRow {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError(`DocumentRow expected object, got ${typeof raw}`)
  }
  const r = raw as Record<string, unknown>

  if (typeof r.id !== 'string') throw new TypeError('DocumentRow.id missing/non-string')
  if (typeof r.slug !== 'string') throw new TypeError('DocumentRow.slug missing/non-string')
  if (typeof r.status !== 'string') throw new TypeError('DocumentRow.status missing/non-string')

  if (r.reviewed_by !== null && !Array.isArray(r.reviewed_by)) {
    throw new TypeError('DocumentRow.reviewed_by must be string[] | null')
  }
  if (r.embedded_media !== null && !Array.isArray(r.embedded_media)) {
    throw new TypeError('DocumentRow.embedded_media must be unknown[] | null')
  }
  if (
    r.source !== null &&
    (typeof r.source !== 'object' || Array.isArray(r.source))
  ) {
    throw new TypeError('DocumentRow.source must be Record | null')
  }
  if (
    r.accessibility !== null &&
    (typeof r.accessibility !== 'object' || Array.isArray(r.accessibility))
  ) {
    throw new TypeError('DocumentRow.accessibility must be Record | null')
  }

  // r은 모든 guard를 통과했으므로 DocumentRow shape 보장 — TS hint대로 unknown 경유 cast.
  return r as unknown as DocumentRow
}
