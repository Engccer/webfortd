/**
 * Phase 3 M7.2 — Upstage Document Parse 단위 테스트.
 *
 * server-only 모듈이라 mock fetch 사용.
 *
 * 검증:
 *   - API 키 미설정 시 한국어 에러 throw
 *   - 정상 응답 → markdown 본문 반환
 *   - 빈 markdown → 한국어 에러 throw
 *   - 5xx → 한국어 에러 throw
 */

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

describe('parseHwpToMarkdown (M7.2 Upstage Document Parse)', () => {
  it('API 키 미설정 시 throw', async () => {
    const original = process.env.UPSTAGE_API_KEY
    delete process.env.UPSTAGE_API_KEY
    try {
      const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse.ts')
      await assert.rejects(
        parseHwpToMarkdown(new ArrayBuffer(0), 'application/vnd.hancom.hwp'),
        /UPSTAGE_API_KEY 미설정/,
      )
    } finally {
      if (original) process.env.UPSTAGE_API_KEY = original
    }
  })

  it('정상 응답 → markdown 본문 반환', async () => {
    process.env.UPSTAGE_API_KEY = 'test-key'
    const originalFetch = global.fetch
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({ content: { markdown: '# 정책 문서\n\n본문 내용' } }),
      { status: 200 },
    )) as typeof fetch
    try {
      const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse.ts')
      const md = await parseHwpToMarkdown(new ArrayBuffer(10), 'application/vnd.hancom.hwp')
      assert.match(md, /정책 문서/)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('빈 markdown → 한국어 에러 throw', async () => {
    process.env.UPSTAGE_API_KEY = 'test-key'
    const originalFetch = global.fetch
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({ content: { markdown: '' } }),
      { status: 200 },
    )) as typeof fetch
    try {
      const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse.ts')
      await assert.rejects(
        parseHwpToMarkdown(new ArrayBuffer(10), 'application/vnd.hancom.hwp'),
        /추출된 텍스트가 없/,
      )
    } finally {
      global.fetch = originalFetch
    }
  })

  it('Upstage 5xx → 한국어 에러 throw', async () => {
    process.env.UPSTAGE_API_KEY = 'test-key'
    const originalFetch = global.fetch
    global.fetch = mock.fn(async () => new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500 },
    )) as typeof fetch
    try {
      const { parseHwpToMarkdown } = await import('@/lib/chat/upstage-parse.ts')
      await assert.rejects(
        parseHwpToMarkdown(new ArrayBuffer(10), 'application/vnd.hancom.hwp'),
        /파싱 중 오류/,
      )
    } finally {
      global.fetch = originalFetch
    }
  })
})
