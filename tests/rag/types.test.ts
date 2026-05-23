import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type {
  RetrievedChunk,
  SourceRef,
  RetrieveOptions,
  RetrievalResult,
} from '../../src/lib/rag/types.ts'

describe('rag/types — export shape 회귀', () => {
  test('RetrievedChunk 빈 객체로 instantiation 가능', () => {
    const c: RetrievedChunk = {
      chunkId: 'a',
      documentId: 'b',
      chunkText: '',
      section: null,
      chunkIndex: 0,
      metadata: {},
      similarity: 0,
      documentSlug: 's',
      documentTitle: 't',
      documentAxis: 'policies',
      documentType: 'unknown',
      documentStatus: 'draft',
    }
    assert.equal(c.chunkId, 'a')
  })

  test('SourceRef 빈 객체로 instantiation 가능', () => {
    const r: SourceRef = { slug: 's', title: 't', axis: 'a', type: 'u' }
    assert.equal(r.slug, 's')
  })

  test('RetrieveOptions 모든 필드 optional', () => {
    const o1: RetrieveOptions = {}
    const o2: RetrieveOptions = { topK: 5, minSimilarity: 0.5, includeDrafts: false }
    assert.equal(o1.topK, undefined)
    assert.equal(o2.topK, 5)
  })

  test('RetrievalResult shape', () => {
    const r: RetrievalResult = { chunks: [], sources: [] }
    assert.deepEqual(r, { chunks: [], sources: [] })
  })
})
