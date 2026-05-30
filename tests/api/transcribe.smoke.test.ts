/**
 * Phase 3 M7.1 — Deepgram 실 API smoke.
 *
 * 실행: RUN_SMOKE=1 DEEPGRAM_API_KEY=... npm test -- transcribe.smoke
 *
 * - 정상 환경: skip (CI 자동 실행 회피)
 * - 위원장 명시 실행 — Deepgram 응답 형식 정합 검증
 * - fixture는 TTS로 생성된 한국어 음성:
 *     tests/api/fixtures/sample-ko.webm  (webm/opus = 데스크톱 Chrome MediaRecorder)
 *     tests/api/fixtures/sample-ko.m4a   (aac/mp4  = iOS Safari MediaRecorder)
 *
 * 회귀 가드 (2026-05-30): 과거 이 테스트는 fixture가 없으면 조용히 return해
 *   "어차피 통과"였고, 그 사이 model이 nova-2-conversationalai(영어 전용)로
 *   바뀌어 language=ko와 충돌(400)하는 버그가 production까지 살아남았다.
 *   이제 fixture missing은 throw, 그리고 iOS(m4a)·데스크톱(webm) 양 포맷이
 *   실제로 200 + 한국어 transcript를 받는지 단언한다. Korean 미지원 model로
 *   회귀하면 두 케이스 모두 즉시 실패한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ENABLED = process.env.RUN_SMOKE === '1'

async function transcribe(fixtureName: string, contentType: string) {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY 미설정 — smoke 실행 불가')
  }
  const fixturePath = path.join(import.meta.dirname, 'fixtures', fixtureName)
  // fixture missing은 통과가 아니라 실패 — "조용한 return"이 버그를 숨겼던 원인
  assert.ok(
    fs.existsSync(fixturePath),
    `fixture 없음: ${fixturePath} (TTS로 재생성 필요)`,
  )
  const audioBuffer = fs.readFileSync(fixturePath)
  const { POST } = await import('@/app/api/transcribe/route.ts')
  const formData = new FormData()
  formData.append('audio', new Blob([new Uint8Array(audioBuffer)], { type: contentType }))
  const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
  const res = await POST(req)
  return res
}

describe('/api/transcribe smoke (RUN_SMOKE=1)', { skip: !ENABLED }, () => {
  it('데스크톱 webm/opus → 200 + 한국어 transcript', async () => {
    const res = await transcribe('sample-ko.webm', 'audio/webm')
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.text.length > 0)
    assert.equal(data.language_code, 'ko')
    logResult(data)
  })

  it('iOS Safari m4a/aac → 200 + 한국어 transcript (production 회귀 가드)', async () => {
    const res = await transcribe('sample-ko.m4a', 'audio/mp4')
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.text.length > 0)
    assert.equal(data.language_code, 'ko')
    logResult(data)
  })
})

function logResult(data: { text: string; confidence: number }) {
  // PIPA: transcript 본문 로그 X — 길이·confidence만 (codex-rescue P2 #6)
  // DEBUG_PII=1로만 본문 preview 허용
  if (process.env.DEBUG_PII === '1') {
    console.log('[smoke] transcribed:', data.text, 'confidence:', data.confidence)
  } else {
    console.log('[smoke] transcript ok — length:', data.text.length, 'confidence:', data.confidence)
  }
}
