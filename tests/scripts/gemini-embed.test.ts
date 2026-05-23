import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertEmbedEnv } from '../../scripts/lib/gemini-embed.ts'

test('assertEmbedEnv — API key 누락 시 throw', () => {
  const saved = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  assert.throws(() => assertEmbedEnv(), /GOOGLE_GENERATIVE_AI_API_KEY/)
  if (saved) process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved
})

test('assertEmbedEnv — API key 있으면 통과', () => {
  const saved = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'fake-test-key'
  assert.doesNotThrow(() => assertEmbedEnv())
  if (saved) process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved
  else delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
})

test('embedTexts — 0건 input 즉시 빈 배열', async () => {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'fake-test-key'
  const { embedTexts } = await import('../../scripts/lib/gemini-embed.ts')
  const result = await embedTexts([])
  assert.deepEqual(result, [])
})

import { describe } from 'node:test'
import { getEmbedModel, getEmbedDim } from '../../scripts/lib/gemini-embed.ts'

describe('env override (M1 carry #3)', () => {
  test('EMBED_MODEL 미설정 시 기본값 gemini-embedding-2-preview', () => {
    delete process.env.EMBED_MODEL
    assert.equal(getEmbedModel(), 'gemini-embedding-2-preview')
  })

  test('EMBED_MODEL 설정 시 그 값 반환', () => {
    process.env.EMBED_MODEL = 'gemini-embedding-3'
    try {
      assert.equal(getEmbedModel(), 'gemini-embedding-3')
    } finally {
      delete process.env.EMBED_MODEL
    }
  })

  test('EMBED_DIM 미설정 시 1536', () => {
    delete process.env.EMBED_DIM
    assert.equal(getEmbedDim(), 1536)
  })

  test('EMBED_DIM 설정 시 그 값 (number) 반환', () => {
    process.env.EMBED_DIM = '768'
    try {
      assert.equal(getEmbedDim(), 768)
    } finally {
      delete process.env.EMBED_DIM
    }
  })

  test('EMBED_DIM 비숫자 값은 throw', () => {
    process.env.EMBED_DIM = 'abc'
    try {
      assert.throws(() => getEmbedDim(), /EMBED_DIM/)
    } finally {
      delete process.env.EMBED_DIM
    }
  })
})
