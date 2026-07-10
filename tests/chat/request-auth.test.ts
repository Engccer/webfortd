/**
 * M3(iOS) — request-auth 헬퍼 단위 테스트.
 *
 * getRequestAuth(getUser 실호출 포함)는 통합 영역이라 제외(기존 관례).
 * getBearerJwt(순수 함수)·createBearerClient(env 미설정 시 throw)만 단위 검증.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getBearerJwt, createBearerClient } from '../../src/lib/supabase/request-auth.ts'

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
