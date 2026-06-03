import { test } from 'node:test'
import assert from 'node:assert/strict'
import { truncateChunk, buildSearchPolicyResult } from '../../src/app/api/voice/execute/route.ts'
import type { RetrievalResult } from '../../src/lib/rag/types.ts'

test('truncateChunk: MAX_CHUNK_CHARS 초과분 절단 + ellipsis', () => {
  const long = 'a'.repeat(600)
  const out = truncateChunk(long)
  assert.ok(out.length <= 501) // 500 + ellipsis
  assert.match(out, /…$/)
})

test('truncateChunk: 짧은 텍스트는 그대로', () => {
  assert.equal(truncateChunk('짧음'), '짧음')
})

test('buildSearchPolicyResult: chunk text 절단 + sources 통과', () => {
  const retrieval: RetrievalResult = {
    chunks: [
      { chunkId: 'c1', documentId: 'd1', chunkText: 'x'.repeat(600), section: null,
        chunkIndex: 0, metadata: {}, similarity: 0.5, documentSlug: 'slug-a',
        documentTitle: '제목 A', documentAxis: 'policies', documentType: 'guide',
        documentStatus: 'published' },
    ],
    sources: [{ slug: 'slug-a', title: '제목 A', axis: 'policies', type: 'guide', href: '/policies/slug-a' }],
  }
  const out = buildSearchPolicyResult(retrieval)
  assert.equal(out.results.length, 1)
  assert.equal(out.results[0].slug, 'slug-a')
  assert.match(out.results[0].text, /…$/)
  assert.equal(out.sources[0].href, '/policies/slug-a')
})
