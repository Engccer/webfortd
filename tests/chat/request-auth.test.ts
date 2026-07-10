/**
 * M3(iOS) — request-auth 헬퍼 단위 테스트.
 *
 * getRequestAuth(getUser 실호출 포함)는 통합 영역이라 제외(기존 관례).
 * getBearerJwt(순수 함수)·createBearerClient(env 미설정 시 throw)·UUID_RE만 단위 검증.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getBearerJwt, createBearerClient } from '../../src/lib/supabase/request-auth.ts'
import { UUID_RE } from '../../src/app/api/chat/threads/[id]/route.ts'

describe('getBearerJwt', () => {
  test('정상 Bearer 헤더 → 토큰 추출', () => {
    const request = new Request('https://example.com', {
      headers: { authorization: 'Bearer abc123' },
    })
    assert.strictEqual(getBearerJwt(request), 'abc123')
  })

  test('Authorization 헤더 없음 → null', () => {
    const request = new Request('https://example.com')
    assert.strictEqual(getBearerJwt(request), null)
  })

  test('Bearer 스킴 아님 → null', () => {
    const request = new Request('https://example.com', {
      headers: { authorization: 'Basic abc123' },
    })
    assert.strictEqual(getBearerJwt(request), null)
  })

  test('빈 토큰(Bearer 뒤 공백만) → null', () => {
    const request = new Request('https://example.com', {
      headers: { authorization: 'Bearer    ' },
    })
    assert.strictEqual(getBearerJwt(request), null)
  })

  test('소문자 bearer 스킴(RFC 7235) → 토큰 추출', () => {
    const request = new Request('https://example.com', {
      headers: { authorization: 'bearer token123' },
    })
    assert.strictEqual(getBearerJwt(request), 'token123')
  })

  test('대문자 BEARER 스킴 → 토큰 추출', () => {
    const request = new Request('https://example.com', {
      headers: { authorization: 'BEARER token456' },
    })
    assert.strictEqual(getBearerJwt(request), 'token456')
  })

  test('혼합 대소문자 BeArEr → 토큰 추출', () => {
    const request = new Request('https://example.com', {
      headers: { authorization: 'BeArEr mixed789' },
    })
    assert.strictEqual(getBearerJwt(request), 'mixed789')
  })
})

describe('createBearerClient', () => {
  test('Supabase env 미설정 → throw', () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    try {
      assert.throws(() => createBearerClient('dummy-jwt'), /Supabase env 미설정/)
    } finally {
      if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
      if (prevKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey
    }
  })
})

describe('UUID_RE', () => {
  test('정상 UUID(8-4-4-4-12) → 일치', () => {
    assert.ok(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000'))
  })

  test('소문자 UUID → 일치', () => {
    assert.ok(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000'))
  })

  test('대문자 UUID → 일치(대소문자 무관)', () => {
    assert.ok(UUID_RE.test('550E8400-E29B-41D4-A716-446655440000'))
  })

  test('하이픈 없는 36자 hex → 불일치', () => {
    assert.ok(!UUID_RE.test('550e8400e29b41d4a716446655440000'))
  })

  test('잘못된 하이픈 위치 → 불일치', () => {
    assert.ok(!UUID_RE.test('550e8400-e29b-41d4a716-446655440000'))
  })

  test('35자(짧음) → 불일치', () => {
    assert.ok(!UUID_RE.test('550e8400-e29b-41d4-a716-44665544000'))
  })

  test('37자(김) → 불일치', () => {
    assert.ok(!UUID_RE.test('550e8400-e29b-41d4-a716-4466554400000'))
  })

  test('비-hex 문자 포함 → 불일치', () => {
    assert.ok(!UUID_RE.test('550e8400-e29b-41d4-a716-44665544000g'))
  })
})
