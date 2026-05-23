import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { embedQuery } from '../../src/lib/rag/embed-query.ts'

describe('rag/embed-query', () => {
  test('빈 문자열 — throw', async () => {
    await assert.rejects(() => embedQuery(''), /empty/)
  })

  test('whitespace-only — throw', async () => {
    await assert.rejects(() => embedQuery('   '), /empty/)
  })

  // 실제 SDK 호출 테스트는 smoke (Task 9) 에서. 본 단위 테스트는 입력 검증만.
})
