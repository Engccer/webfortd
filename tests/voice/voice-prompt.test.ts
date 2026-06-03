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

test('답변 원칙 4·5(무관질문 안내·면책 고지) 보존', () => {
  const p = buildVoiceSystemPrompt()
  assert.match(p, /무관한 질문은 정중히 안내/)
  assert.match(p, /참고용이에요/)
})

test('음성 모드: 마크다운 금지 지시 + 청크 placeholder/섹션 헤더 미포함', () => {
  const p = buildVoiceSystemPrompt()
  assert.match(p, /마크다운/)
  assert.doesNotMatch(p, /\{retrievedChunksFormatted\}/)
  // 청크 주입 섹션 헤더('\n[참고 자료]\n')는 제거됨. 단, 답변 원칙 3번의 인라인
  // "제공된 [참고 자료] 안의"는 영구 원칙이므로 살아 있어야 한다(헤더만 절단).
  assert.doesNotMatch(p, /\n\[참고 자료\]\n/)
  assert.match(p, /제공된 \[참고 자료\] 안의/)
})
