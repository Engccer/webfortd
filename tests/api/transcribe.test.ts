/**
 * Phase 3 M7.1 — /api/transcribe Deepgram 프록시 단위 테스트.
 *
 * 검증:
 *   - audio 누락 시 400 한국어 에러
 *   - 25MB 초과 시 400
 *   - DEEPGRAM_API_KEY 미설정 시 500
 *   - Deepgram 정상 응답 → text/language_code/confidence
 */
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

describe('/api/transcribe (M7.1 Deepgram 프록시)', () => {
  it('audio 누락 시 400 한국어 에러', async () => {
    process.env.DEEPGRAM_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/transcribe/route.ts')
    const formData = new FormData()
    const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
    const res = await POST(req)
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.match(data.error, /오디오 파일이 필요/)
  })

  it('파일 크기 25MB 초과 시 400', async () => {
    process.env.DEEPGRAM_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/transcribe/route.ts')
    const formData = new FormData()
    formData.append('audio', new Blob([new ArrayBuffer(26 * 1024 * 1024)], { type: 'audio/webm' }))
    const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
    const res = await POST(req)
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.match(data.error, /너무 큽니다/)
  })

  it('DEEPGRAM_API_KEY 미설정 시 500', async () => {
    const original = process.env.DEEPGRAM_API_KEY
    delete process.env.DEEPGRAM_API_KEY
    try {
      const { POST } = await import('@/app/api/transcribe/route.ts')
      const formData = new FormData()
      formData.append('audio', new Blob(['x'], { type: 'audio/webm' }))
      const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
      const res = await POST(req)
      assert.equal(res.status, 500)
    } finally {
      if (original) process.env.DEEPGRAM_API_KEY = original
    }
  })

  it('Deepgram 정상 응답 → text/language_code/confidence 반환', async () => {
    process.env.DEEPGRAM_API_KEY = 'test-key'
    const originalFetch = global.fetch
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({
        results: {
          channels: [{
            alternatives: [{ transcript: '특수 마우스에는 어떤 종류가 있나요', confidence: 0.95, words: [] }],
            detected_language: 'ko',
          }],
        },
      }),
      { status: 200 },
    )) as typeof fetch
    try {
      const { POST } = await import('@/app/api/transcribe/route.ts')
      const formData = new FormData()
      formData.append('audio', new Blob(['x'], { type: 'audio/webm' }))
      const req = new Request('http://test/api/transcribe', { method: 'POST', body: formData })
      const res = await POST(req)
      assert.equal(res.status, 200)
      const data = await res.json()
      assert.equal(data.text, '특수 마우스에는 어떤 종류가 있나요')
      assert.equal(data.language_code, 'ko')
      assert.equal(data.confidence, 0.95)
    } finally {
      global.fetch = originalFetch
    }
  })
})
