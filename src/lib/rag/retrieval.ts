import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { embedQuery as defaultEmbedQuery } from './embed-query.ts'
import { getAdminClient } from '../supabase/admin.ts'
import type {
  RetrievedChunk,
  SourceRef,
  RetrieveOptions,
  RetrievalResult,
} from './types.ts'

/**
 * match_chunks RPC 응답 한 row의 원시 shape (snake_case from PostgREST).
 */
interface MatchChunksRow {
  chunk_id: string
  document_id: string
  chunk_text: string
  section: string | null
  chunk_index: number
  metadata: Record<string, unknown> | null
  document_slug: string
  document_title: string
  document_axis: string
  document_type: string
  document_status: string
  similarity: number
}

/**
 * Dependency injection — 테스트에서 embedQuery/createClient를 mock 하기 위함.
 * Production code는 retrieveChunks() 호출 (default deps 자동 주입).
 */
export interface RetrievalDeps {
  embedQuery: (text: string) => Promise<number[]>
  createClient: () => SupabaseClient
}

const DEFAULT_TOP_K = 5
const DEFAULT_MIN_SIMILARITY = 0.0
const DEFAULT_INCLUDE_DRAFTS = true
const MAX_TOP_K = 50  // 0006 match_chunks 의 raise exception 과 정합

/**
 * Phase 3 M2 — 사용자 질의 → 임베딩 → pgvector kNN → 출처 메타 보강.
 *
 * default deps 자동 주입. 테스트는 retrieveChunksWith() 직접 호출.
 *
 * NOTE: getAdminClient (src/lib/supabase/admin.ts)를 default createClient로 사용.
 *   plan 초안은 `createRagAdminClient`였으나 Task 6에서 기존 getAdminClient와 중복
 *   확인되어 통합. singleton 캐싱은 connection pool 측면에서 이득.
 */
export async function retrieveChunks(
  queryText: string,
  opts: RetrieveOptions = {},
): Promise<RetrievalResult> {
  return retrieveChunksWith(queryText, opts, {
    embedQuery: defaultEmbedQuery,
    createClient: getAdminClient,
  })
}

export async function retrieveChunksWith(
  queryText: string,
  opts: RetrieveOptions,
  deps: RetrievalDeps,
): Promise<RetrievalResult> {
  if (!queryText || queryText.trim().length === 0) {
    throw new Error('retrieveChunks: queryText is empty')
  }

  const topK = opts.topK ?? DEFAULT_TOP_K
  const minSimilarity = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY
  const includeDrafts = opts.includeDrafts ?? DEFAULT_INCLUDE_DRAFTS

  if (topK < 1 || topK > MAX_TOP_K) {
    throw new Error(`retrieveChunks: topK must be 1..${MAX_TOP_K}, got ${topK}`)
  }

  const queryEmbedding = await deps.embedQuery(queryText)

  const supabase = deps.createClient()
  const { data, error } = await supabase.rpc('match_chunks', {
    p_query_embedding: queryEmbedding,
    p_top_k: topK,
    p_min_similarity: minSimilarity,
    p_include_drafts: includeDrafts,
  })
  if (error) {
    throw new Error(`match_chunks RPC 실패: ${error.message ?? String(error)}`)
  }

  const rows = (data ?? []) as MatchChunksRow[]
  const chunks: RetrievedChunk[] = rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    chunkText: r.chunk_text,
    section: r.section,
    chunkIndex: r.chunk_index,
    metadata: r.metadata ?? {},
    similarity: r.similarity,
    documentSlug: r.document_slug,
    documentTitle: r.document_title,
    documentAxis: r.document_axis,
    documentType: r.document_type,
    documentStatus: (r.document_status as 'draft' | 'published'),
  }))

  // slug 기반 dedup — 같은 doc의 청크가 top-k에 여러 개 들어와도 인용 카드 1개
  const seen = new Set<string>()
  const sources: SourceRef[] = []
  for (const c of chunks) {
    if (seen.has(c.documentSlug)) continue
    seen.add(c.documentSlug)
    sources.push({
      slug: c.documentSlug,
      title: c.documentTitle,
      axis: c.documentAxis,
      type: c.documentType,
    })
  }

  return { chunks, sources }
}
