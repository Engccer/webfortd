import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIVE_MODEL, getLiveAuthClient } from '../../src/lib/gemini-live.ts'

test('LIVE_MODEL은 native audio live 모델', () => {
  assert.equal(LIVE_MODEL, 'gemini-3.1-flash-live-preview')
})

test('getLiveAuthClient: 키 없으면 throw', () => {
  const prev = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  assert.throws(() => getLiveAuthClient(), /GOOGLE_GENERATIVE_AI_API_KEY/)
  if (prev !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prev
})

test('getLiveAuthClient: 키 있으면 GoogleGenAI 인스턴스', () => {
  const prev = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'
  const client = getLiveAuthClient()
  assert.ok(client)
  assert.ok(typeof client.authTokens?.create === 'function')
  if (prev !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prev
  else delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
})
