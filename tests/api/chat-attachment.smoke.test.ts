/**
 * Phase 3 M7.2 — 파일 첨부 실 API smoke.
 *
 * 실행: RUN_SMOKE=1 UPSTAGE_API_KEY=... npm test -- chat-attachment.smoke
 *
 * - 정상 환경: skip
 * - 위원장 명시 실행 — Upstage Document Parse + Gemini multimodal 정합 검증
 * - fixture(`tests/api/fixtures/sample.{pdf,hwpx}`) 위원장 직접 배치 필요
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { parseHwpToMarkdown } from '@/lib/chat/upstage-parse.ts'

const ENABLED = process.env.RUN_SMOKE === '1'

describe('chat-attachment smoke (RUN_SMOKE=1)', { skip: !ENABLED }, () => {
  it('Upstage Document Parse 실 API → 한국어 markdown', async () => {
    if (!process.env.UPSTAGE_API_KEY) {
      throw new Error('UPSTAGE_API_KEY 미설정 — smoke 실행 불가')
    }
    const fixturePath = path.join(import.meta.dirname, 'fixtures/sample.hwpx')
    if (!fs.existsSync(fixturePath)) {
      console.log('[smoke] fixture 없음 — tests/api/fixtures/sample.hwpx 위원장 배치 후 재실행')
      return
    }
    const buffer = fs.readFileSync(fixturePath)
    const md = await parseHwpToMarkdown(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
      'application/vnd.hancom.hwpx',
    )
    assert.ok(md.length > 0)
    // PIPA: 본문 preview 로그 X — 길이만 (codex-rescue P2 #6)
    if (process.env.DEBUG_PII === '1') {
      console.log('[smoke] upstage markdown length:', md.length)
      console.log('[smoke] first 200 chars:', md.slice(0, 200))
    } else {
      console.log('[smoke] upstage parse ok — markdown length:', md.length)
    }
  })
})
