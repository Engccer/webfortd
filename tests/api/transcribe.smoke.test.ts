/**
 * Phase 3 M7.1 — Deepgram 실 API smoke.
 *
 * 실행: RUN_SMOKE=1 DEEPGRAM_API_KEY=... npm test -- transcribe.smoke
 *
 * - 정상 환경: skip (CI 자동 실행 회피)
 * - 위원장 명시 실행 — Deepgram 응답 형식 정합 검증
 * - fixture(`tests/api/fixtures/sample-ko.webm`) 위원장 직접 녹음 후 배치 필요
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ENABLED = process.env.RUN_SMOKE === '1'

describe('/api/transcribe smoke (RUN_SMOKE=1)', { skip: !ENABLED }, () => {
  it('Deepgram nova-2 실 API → 한국어 transcript', async () => {
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY 미설정 — smoke 실행 불가')
    }
    const fixturePath = path.join(import.meta.dirname, 'fixtures/sample-ko.webm')
    if (!fs.existsSync(fixturePath)) {
      console.log('[smoke] fixture 없음 — tests/api/fixtures/sample-ko.webm 위원장 녹음 후 재실행')
      return
    }
    const audioBuffer = fs.readFileSync(fixturePath)
    const { POST } = await import('@/app/api/transcribe/route.ts')
    const formData = new FormData()
    formData.append('audio', new Blob([audioBuffer], { type: 'audio/webm' }))
    const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
    const res = await POST(req)
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.text.length > 0)
    assert.equal(data.language_code, 'ko')
    // PIPA: transcript 본문 로그 X — 길이·confidence만 (codex-rescue P2 #6)
    // DEBUG_PII=1로만 본문 preview 허용
    if (process.env.DEBUG_PII === '1') {
      console.log('[smoke] transcribed:', data.text, 'confidence:', data.confidence)
    } else {
      console.log('[smoke] transcript ok — length:', data.text.length, 'confidence:', data.confidence)
    }
  })
})
