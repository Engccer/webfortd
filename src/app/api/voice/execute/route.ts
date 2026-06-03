/**
 * Phase 7 M2 — search_policy 도구 실행 프록시.
 * Live 모델의 functionCall(search_policy) → 기존 retrieveChunks RAG 재사용 →
 * 청크 텍스트(절단) + 출처 반환. 새 RAG 로직 0줄.
 * 불변식: 로그인 필수(401), search_policy 외 도구 거부(403),
 *         published-only(admin Draft Mode만 includeDrafts — /api/chat 정합),
 *         PIPA(query 본문 미로그).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { retrieveChunks } from '@/lib/rag/retrieval.ts'
import { getServerClient } from '@/lib/supabase/server'
import { getPreviewActive } from '@/lib/admin/preview'
import {
  SEARCH_POLICY_TOOL_NAME,
  SEARCH_POLICY_TOP_K,
  MAX_CHUNK_CHARS,
} from '@/lib/voice/search-policy'
import type { RetrievalResult } from '@/lib/rag/types'
import type { SearchPolicyResult } from '@/lib/voice/types'

export const runtime = 'nodejs'
export const maxDuration = 30

const ExecuteRequestSchema = z.object({
  name: z.string().min(1),
  args: z.object({ query: z.string().trim().min(1) }),
})

/** 청크 텍스트를 MAX_CHUNK_CHARS로 절단 (TTS 스트림 안정 — dodo payload 절단 교훈). */
export function truncateChunk(text: string): string {
  return text.length > MAX_CHUNK_CHARS ? text.slice(0, MAX_CHUNK_CHARS) + '…' : text
}

/** RetrievalResult → Live functionResponse shape. */
export function buildSearchPolicyResult(retrieval: RetrievalResult): SearchPolicyResult {
  return {
    results: retrieval.chunks.map((c) => ({
      text: truncateChunk(c.chunkText),
      slug: c.documentSlug,
      title: c.documentTitle,
    })),
    sources: retrieval.sources,
  }
}

export async function POST(request: Request) {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = ExecuteRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { name, args } = parsed.data

  if (name !== SEARCH_POLICY_TOOL_NAME) {
    return NextResponse.json(
      { error: `Function "${name}" is not allowed in voice mode` },
      { status: 403 },
    )
  }

  try {
    const includeDrafts = await getPreviewActive()
    const retrieval = await retrieveChunks(args.query, {
      topK: SEARCH_POLICY_TOP_K,
      includeDrafts,
    })
    // PIPA: query 본문 미로그 — 카운트만.
    console.log('[voice/execute] search_policy', {
      chunks: retrieval.chunks.length,
      sources: retrieval.sources.length,
    })
    return NextResponse.json(buildSearchPolicyResult(retrieval))
  } catch (error) {
    console.error('[voice/execute] search_policy 실패:', error)
    return NextResponse.json(
      { error: '자료를 찾는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    )
  }
}
