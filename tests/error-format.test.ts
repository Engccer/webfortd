import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { formatSupabaseError } from '../scripts/lib/error-format.ts'

describe('formatSupabaseError', () => {
  beforeEach(() => {
    delete process.env.DEBUG
  })
  afterEach(() => {
    delete process.env.DEBUG
  })

  test('알려진 code (42501) → 한국어 description, message 비노출 (production 기본)', () => {
    const out = formatSupabaseError({
      code: '42501',
      message: 'new row violates row-level security policy',
      details: 'row data leak risk',
      hint: 'check RLS',
    })
    assert.match(out, /\[42501\]/)
    assert.match(out, /RLS 정책 거부/)
    assert.doesNotMatch(out, /new row violates/)
    assert.doesNotMatch(out, /row data leak/)
    assert.doesNotMatch(out, /check RLS/)
  })

  test('알려지지 않은 code → "(code XYZ)" 형식', () => {
    const out = formatSupabaseError({ code: 'XYZ', message: 'oops' })
    assert.match(out, /\[XYZ\]/)
    assert.match(out, /\(code XYZ\)/)
    assert.doesNotMatch(out, /oops/)
  })

  test('DEBUG=1 환경변수 → message/details/hint 모두 노출', () => {
    process.env.DEBUG = '1'
    const out = formatSupabaseError({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'Key (slug)=(foo) already exists.',
      hint: 'use upsert',
    })
    assert.match(out, /duplicate key/)
    assert.match(out, /slug.*foo/)
    assert.match(out, /upsert/)
  })

  test('DEBUG=true 도 동일하게 활성화', () => {
    process.env.DEBUG = 'true'
    const out = formatSupabaseError({ code: 'P0001', message: 'trigger raised' })
    assert.match(out, /trigger raised/)
  })

  test('code 누락 → "unknown" 노출', () => {
    const out = formatSupabaseError({ message: 'no code' })
    assert.match(out, /\[unknown\]/)
    assert.doesNotMatch(out, /no code/)
  })
})
