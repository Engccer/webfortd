import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVoiceSystemPrompt } from '../../src/lib/voice/voice-prompt.ts'

test('정체성·톤 영구 원칙 보존', () => {
  const p = buildVoiceSystemPrompt()
  assert.match(p, /대한민국 장애인교원 관련 제도와 정책을 안내/)
  assert.match(p, /다정하고 명료한 말투/)
})

test('search_policy 도구 사용 지시 포함', () => {
  assert.match(buildVoiceSystemPrompt(), /search_policy/)
})

test('음성 모드: 마크다운 금지 지시 + 청크 placeholder 미포함', () => {
  const p = buildVoiceSystemPrompt()
  assert.match(p, /마크다운/)
  assert.doesNotMatch(p, /\{retrievedChunksFormatted\}/)
  assert.doesNotMatch(p, /\[참고 자료\]/)
})
