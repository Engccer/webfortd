import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateAttachment, MAX_FILE_SIZE, ALLOWED_MIMES } from '@/lib/chat/file-validation'

describe('validateAttachment (M7.2 파일 검증)', () => {
  it('MAX_FILE_SIZE = 10MB (spec §D3)', () => {
    assert.equal(MAX_FILE_SIZE, 10 * 1024 * 1024)
  })

  it('PDF MIME 화이트리스트 통과', () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'a.pdf', { type: 'application/pdf' })
    const result = validateAttachment(file)
    assert.equal(result.ok, true)
  })

  it('HWPX MIME 통과', () => {
    const file = new File(['x'], 'a.hwpx', { type: 'application/vnd.hancom.hwpx' })
    const result = validateAttachment(file)
    assert.equal(result.ok, true)
  })

  it('HWPX 구버전 application/zip도 통과', () => {
    const file = new File(['x'], 'a.hwpx', { type: 'application/zip' })
    const result = validateAttachment(file)
    assert.equal(result.ok, true)
  })

  it('text/plain — 화이트리스트 외 → reject', () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    const result = validateAttachment(file)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.reason, /지원하지 않는 파일/)
  })

  it('10MB 초과 → reject', () => {
    const big = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
    const result = validateAttachment(big)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.reason, /10MB 이하/)
  })

  it('ALLOWED_MIMES 7종 (pdf · hwp 2 · hwpx · png · jpeg · webp)', () => {
    assert.equal(ALLOWED_MIMES.length, 7)
  })
})
