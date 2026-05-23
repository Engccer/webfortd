/**
 * Phase 3 M2 — RAG retrieval API 타입 정의.
 *
 * 이 파일은 server·client 둘 다 import 가능 (값 없음, 타입만).
 * 단, retrieval.ts / embed-query.ts / admin-client.ts 는 server-only.
 */

/** match_chunks RPC 응답의 한 row (camelCase로 변환된 형태) */
export interface RetrievedChunk {
  chunkId: string
  documentId: string
  chunkText: string
  section: string | null
  chunkIndex: number
  metadata: Record<string, unknown>
  similarity: number
  documentSlug: string
  documentTitle: string
  documentAxis: string
  documentType: string
  documentStatus: 'draft' | 'published'
}

/** 인용 카드용 — slug 기준 dedup 후 사용자에게 노출되는 메타 */
export interface SourceRef {
  slug: string
  title: string
  axis: string
  type: string
}

/** retrieveChunks() 호출 옵션 — 모두 optional, 기본값은 retrieval.ts에서 정의 */
export interface RetrieveOptions {
  /** 반환 청크 최대 개수. 기본 5, 최대 50. */
  topK?: number
  /** 유사도 임계 (cosine sim, 0=무관, 1=동일). 기본 0.0 (필터 없음). */
  minSimilarity?: number
  /** draft 문서도 포함 여부. 기본 true (Phase 3는 draft도 검색 가능). */
  includeDrafts?: boolean
}

/** retrieveChunks() 반환 — 청크 본문 + 인용 카드용 dedup된 sources */
export interface RetrievalResult {
  chunks: RetrievedChunk[]
  sources: SourceRef[]
}
