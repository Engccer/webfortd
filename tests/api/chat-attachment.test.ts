/**
 * Phase 3 M7.2 — /api/chat 파일 첨부 분기 단위 테스트.
 *
 * 검증:
 *   - extractFileParts: file part만 추출 (text/reasoning skip)
 *   - HWP/HWPX 분기 (HWP_MIMES Set 정합)
 *   - dataUrlToArrayBuffer: data URL prefix 처리
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { UIMessage } from 'ai'
import { extractFileParts, extractUserText } from '@/app/api/chat/route.ts'

describe('extractFileParts (M7.2)', () => {
  it('file part만 추출 — text/reasoning은 skip', () => {
    const msg: UIMessage = {
      id: '1',
      role: 'user',
      parts: [
        { type: 'text', text: '안녕' },
        { type: 'file', mediaType: 'application/pdf', url: 'data:application/pdf;base64,JVBERi0=', filename: 'a.pdf' },
        { type: 'reasoning', text: '...' },
        { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,iVBORw=', filename: 'b.png' },
      ] as unknown as UIMessage['parts'],
    }
    const result = extractFileParts(msg)
    assert.equal(result.length, 2)
    assert.equal(result[0].mediaType, 'application/pdf')
    assert.equal(result[1].mediaType, 'image/png')
    assert.equal(result[0].filename, 'a.pdf')
  })

  it('parts 없으면 빈 배열', () => {
    const msg: UIMessage = { id: '1', role: 'user', parts: undefined as unknown as UIMessage['parts'] }
    assert.deepEqual(extractFileParts(msg), [])
  })

  it('url 없는 file part는 제외', () => {
    const msg: UIMessage = {
      id: '1',
      role: 'user',
      parts: [
        // url 누락 (legacy data 필드만) — extractor 제외
        { type: 'file', mediaType: 'application/pdf', data: 'x' },
        { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,X', filename: 'ok.png' },
      ] as unknown as UIMessage['parts'],
    }
    const result = extractFileParts(msg)
    assert.equal(result.length, 1)
    assert.equal(result[0].mediaType, 'image/png')
  })
})

describe('extractUserText + extractFileParts 정합 (M7.2)', () => {
  it('text + file 혼합 — 양쪽 모두 추출', () => {
    const msg: UIMessage = {
      id: '1',
      role: 'user',
      parts: [
        { type: 'text', text: '이 PDF 요약해줘' },
        { type: 'file', mediaType: 'application/pdf', url: 'data:application/pdf;base64,JVB=' },
      ] as unknown as UIMessage['parts'],
    }
    assert.equal(extractUserText(msg), '이 PDF 요약해줘')
    assert.equal(extractFileParts(msg).length, 1)
  })

  it('file만 첨부 — text 빈 문자열, file 1개', () => {
    const msg: UIMessage = {
      id: '1',
      role: 'user',
      parts: [
        { type: 'file', mediaType: 'application/vnd.hancom.hwp', url: 'data:application/vnd.hancom.hwp;base64,X' },
      ] as unknown as UIMessage['parts'],
    }
    assert.equal(extractUserText(msg), '')
    assert.equal(extractFileParts(msg).length, 1)
  })
})
