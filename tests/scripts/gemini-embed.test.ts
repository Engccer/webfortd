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
