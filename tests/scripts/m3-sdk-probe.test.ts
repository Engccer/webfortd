import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamText, gateway } from 'ai'
import { google } from '@ai-sdk/google'

// RUN_PROBE=1 환경에서만 실행 (실 API 호출, ~$0.0001 비용)
test('m3 sdk probe — AI SDK v6 exports + google/gemini-3.5-flash 검증', {
  skip: process.env.RUN_PROBE !== '1',
}, async () => {
  // 1. streamText export 확인
  assert.ok(typeof streamText === 'function', 'streamText export 없음')
  console.log('✓ streamText export 확인')

  // 2. gateway export 확인
  assert.ok(typeof gateway === 'function', 'gateway export 없음')
  console.log('✓ gateway export 확인')

  // 3. google provider export 확인
  assert.ok(typeof google === 'function', 'google provider export 없음')
  console.log('✓ google provider export 확인')

  // 4. 실 API 호출 — google/gemini-3.5-flash 모델 ID 검증
  console.log('google/gemini-3.5-flash 호출 중...')
  const model = google('gemini-3.5-flash')
  const result = streamText({
    model,
    messages: [{ role: 'user', content: 'say hello in one word' }],
    maxTokens: 5,
  })

  let fullText = ''
  for await (const chunk of result.textStream) {
    fullText += chunk
  }

  assert.ok(fullText.length > 0, '모델 응답이 비어 있음')
  console.log(`✓ google/gemini-3.5-flash 응답: "${fullText}"`)

  console.log('=== M3 SDK Probe SUCCESS — 모든 export 확인 + 모델 ID 검증 완료 ===')
})
