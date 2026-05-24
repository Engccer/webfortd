import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatRetrievedChunks,
  buildSystemPrompt,
  clampHistory,
} from '../../src/lib/rag/prompt-builder.ts'
import type { RetrievedChunk } from '../../src/lib/rag/types.ts'
import type { UIMessage } from 'ai'

const FIXTURE_CHUNKS: RetrievedChunk[] = [
  {
    chunkId: 'c1',
    documentId: 'd1',
    chunkText: '이것은 첫 번째 청크 내용입니다.',
    section: '## 섹션 A',
    chunkIndex: 0,
    metadata: {},
    similarity: 0.85,
    documentSlug: 'disability-support-guide',
    documentTitle: '장애인 지원 제도 안내',
    documentAxis: 'policies',
    documentType: '안내서',
    documentStatus: 'published',
  },
  {
    chunkId: 'c2',
    documentId: 'd2',
    chunkText: '이것은 두 번째 청크 내용입니다.',
    section: '## 섹션 B',
    chunkIndex: 0,
    metadata: {},
    similarity: 0.75,
    documentSlug: 'education-support',
    documentTitle: '교육 지원 제도',
    documentAxis: 'domains',
    documentType: '안내서',
    documentStatus: 'published',
  },
]

describe('rag/prompt-builder', () => {
  test('formatRetrievedChunks — 청크 출력에 slug·title·axis·chunk_text 모두 포함', () => {
    const result = formatRetrievedChunks(FIXTURE_CHUNKS)
    assert.ok(result.includes('disability-support-guide'))
    assert.ok(result.includes('장애인 지원 제도 안내'))
    assert.ok(result.includes('policies'))
    assert.ok(result.includes('이것은 첫 번째 청크 내용입니다.'))
    assert.ok(result.includes('education-support'))
    assert.ok(result.includes('교육 지원 제도'))
    assert.ok(result.includes('domains'))
    assert.ok(result.includes('이것은 두 번째 청크 내용입니다.'))
  })

  test('formatRetrievedChunks — 빈 배열일 때 fallback 메시지 반환', () => {
    const result = formatRetrievedChunks([])
    assert.ok(result.includes('관련 자료를 찾지 못했어요'))
  })

  test('buildSystemPrompt — {retrievedChunksFormatted} placeholder 치환', () => {
    const result = buildSystemPrompt(FIXTURE_CHUNKS)
    assert.ok(!result.includes('{retrievedChunksFormatted}'))
    assert.ok(result.includes('disability-support-guide'))
    assert.ok(result.includes('이것은 첫 번째 청크 내용입니다.'))
  })

  test('buildSystemPrompt — 정체성 키워드("장애인교원 관련 제도와 정책") 포함 회귀 가드', () => {
    const result = buildSystemPrompt(FIXTURE_CHUNKS)
    assert.ok(result.includes('장애인교원 관련 제도와 정책'))
  })

  test('buildSystemPrompt — 면책 안내 키워드("참고용이에요") 포함 회귀 가드', () => {
    const result = buildSystemPrompt(FIXTURE_CHUNKS)
    assert.ok(result.includes('참고용이에요'))
  })

  test('clampHistory — 12 messages 입력 시 11개 슬라이스 (5턴 + 1 user)', () => {
    // 12 messages: 6쌍 (user/assistant 반복) + 마지막이 user
    const messages: UIMessage[] = [
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'Q1' }] },
      { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'A1' }] },
      { id: '3', role: 'user', parts: [{ type: 'text', text: 'Q2' }] },
      { id: '4', role: 'assistant', parts: [{ type: 'text', text: 'A2' }] },
      { id: '5', role: 'user', parts: [{ type: 'text', text: 'Q3' }] },
      { id: '6', role: 'assistant', parts: [{ type: 'text', text: 'A3' }] },
      { id: '7', role: 'user', parts: [{ type: 'text', text: 'Q4' }] },
      { id: '8', role: 'assistant', parts: [{ type: 'text', text: 'A4' }] },
      { id: '9', role: 'user', parts: [{ type: 'text', text: 'Q5' }] },
      { id: '10', role: 'assistant', parts: [{ type: 'text', text: 'A5' }] },
      { id: '11', role: 'user', parts: [{ type: 'text', text: 'Q6' }] },
      { id: '12', role: 'assistant', parts: [{ type: 'text', text: 'A6' }] },
      { id: '13', role: 'user', parts: [{ type: 'text', text: 'Q7' }] },
    ]

    const result = clampHistory(messages, 5)
    assert.equal(result.length, 11)
    // 마지막 5턴(10개) + 마지막 user(1개) = 11개
    // 즉, messages[2..12] = 11개 (인덱스 2부터 13까지)
    assert.equal(result[0].id, '3')
    assert.equal(result[result.length - 1].id, '13')
  })

  test('clampHistory — 3 messages 입력 시 3 그대로 (user/assistant/user)', () => {
    const messages: UIMessage[] = [
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'Q1' }] },
      { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'A1' }] },
      { id: '3', role: 'user', parts: [{ type: 'text', text: 'Q2' }] },
    ]

    const result = clampHistory(messages, 5)
    assert.equal(result.length, 3)
    assert.equal(result[0].id, '1')
    assert.equal(result[2].id, '3')
  })

  test('clampHistory — 마지막이 assistant이면 throw', () => {
    const messages: UIMessage[] = [
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'Q1' }] },
      { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'A1' }] },
    ]

    assert.throws(() => clampHistory(messages, 5), /last message must be user role/)
  })

  test('clampHistory — user 메시지가 없으면 throw', () => {
    const messages: UIMessage[] = []

    assert.throws(() => clampHistory(messages, 5), /no user message found/)
  })
})
