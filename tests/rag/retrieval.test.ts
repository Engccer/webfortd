import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

/**
 * retrieveChunks 단위 테스트.
 *
 * 실 SDK·Supabase 호출은 smoke (Task 9). 본 테스트는 mock으로 다음 검증:
 *   - match_chunks RPC 호출 시 인자 shape
 *   - 응답 row → RetrievedChunk 변환 정합성
 *   - sources slug dedup (같은 doc의 청크 여러 개 → 인용 카드 1개)
 *   - topK / minSimilarity / includeDrafts 기본값
 *   - 의존성 주입 (retrieveChunksWith)
 */
import {
  retrieveChunksWith,
  type RetrievalDeps,
} from '../../src/lib/rag/retrieval.ts'

const FAKE_ROWS = [
  {
    chunk_id: 'c1', document_id: 'd1', chunk_text: 'text1', section: '## 섹션 A',
    chunk_index: 0, metadata: { slug: 'slug-a' }, similarity: 0.85,
    document_slug: 'slug-a', document_title: '제목 A', document_axis: 'policies',
    document_type: '안내서', document_status: 'published',
  },
  {
    chunk_id: 'c2', document_id: 'd1', chunk_text: 'text2', section: '## 섹션 B',
    chunk_index: 1, metadata: { slug: 'slug-a' }, similarity: 0.80,
    document_slug: 'slug-a', document_title: '제목 A', document_axis: 'policies',
    document_type: '안내서', document_status: 'published',
  },
  {
    chunk_id: 'c3', document_id: 'd2', chunk_text: 'text3', section: '## 섹션 C',
    chunk_index: 0, metadata: { slug: 'slug-b' }, similarity: 0.75,
    document_slug: 'slug-b', document_title: '제목 B', document_axis: 'disability-types',
    document_type: '안내서', document_status: 'draft',
  },
]

function buildMockDeps(opts: {
  expectArgs?: (args: Record<string, unknown>) => void
  rows?: typeof FAKE_ROWS
} = {}): RetrievalDeps {
  return {
    embedQuery: async (_text: string) => new Array(1536).fill(0.1),
    createClient: () => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        assert.equal(name, 'match_chunks')
        opts.expectArgs?.(args)
        return { data: opts.rows ?? FAKE_ROWS, error: null }
      },
    }) as unknown as ReturnType<RetrievalDeps['createClient']>,
  }
}

describe('rag/retrieval', () => {
  test('기본값 — topK=5, minSimilarity=0, includeDrafts=true', async () => {
    let captured: Record<string, unknown> = {}
    const deps = buildMockDeps({
      expectArgs: (args) => { captured = args },
    })
    await retrieveChunksWith('테스트 질의', {}, deps)
    assert.equal(captured.p_top_k, 5)
    assert.equal(captured.p_min_similarity, 0)
    assert.equal(captured.p_include_drafts, true)
    assert.ok(Array.isArray(captured.p_query_embedding))
    assert.equal((captured.p_query_embedding as number[]).length, 1536)
  })

  test('opts.topK 전달', async () => {
    let captured: Record<string, unknown> = {}
    const deps = buildMockDeps({
      expectArgs: (args) => { captured = args },
    })
    await retrieveChunksWith('q', { topK: 10 }, deps)
    assert.equal(captured.p_top_k, 10)
  })

  test('camelCase 변환 정합성', async () => {
    const result = await retrieveChunksWith('q', {}, buildMockDeps())
    assert.equal(result.chunks.length, 3)
    assert.equal(result.chunks[0].chunkId, 'c1')
    assert.equal(result.chunks[0].documentSlug, 'slug-a')
    assert.equal(result.chunks[0].similarity, 0.85)
    assert.equal(result.chunks[2].documentStatus, 'draft')
  })

  test('sources — slug dedup (slug-a 청크 2개 → 인용 카드 1개)', async () => {
    const result = await retrieveChunksWith('q', {}, buildMockDeps())
    assert.equal(result.sources.length, 2)  // slug-a, slug-b
    assert.equal(result.sources[0].slug, 'slug-a')
    assert.equal(result.sources[0].title, '제목 A')
    assert.equal(result.sources[1].slug, 'slug-b')
  })

  test('빈 질의 — embedQuery 호출 전 throw', async () => {
    await assert.rejects(
      () => retrieveChunksWith('   ', {}, buildMockDeps()),
      /empty/,
    )
  })

  test('RPC 에러 — Error throw + 메시지 보존', async () => {
    const deps: RetrievalDeps = {
      embedQuery: async () => new Array(1536).fill(0),
      createClient: () => ({
        rpc: async () => ({ data: null, error: { message: 'foo', code: 'PGRST' } }),
      }) as unknown as ReturnType<RetrievalDeps['createClient']>,
    }
    await assert.rejects(
      () => retrieveChunksWith('q', {}, deps),
      /match_chunks/,
    )
  })

  test('빈 결과 — 빈 배열 두 개', async () => {
    const deps = buildMockDeps({ rows: [] })
    const result = await retrieveChunksWith('q', {}, deps)
    assert.deepEqual(result, { chunks: [], sources: [] })
  })

  test('runtime guard: 예상 외 documentStatus 시 throw (0009 화이트리스트 우회 차단)', async () => {
    // codex-rescue critical fix — match_chunks가 'in_review'/'archived'/'deprecated'
    // 같은 비화이트리스트 status를 반환하면 즉시 throw (silent lie 차단).
    const badRows = [
      {
        chunk_id: 'cx', document_id: 'dx', chunk_text: 't', section: null,
        chunk_index: 0, metadata: {}, similarity: 0.5,
        document_slug: 'slug-x', document_title: 'X', document_axis: 'policies',
        document_type: '안내서', document_status: 'archived',
      },
    ]
    const deps = buildMockDeps({ rows: badRows as never })
    await assert.rejects(
      () => retrieveChunksWith('q', {}, deps),
      /unexpected document_status.*archived/,
    )
  })
})
