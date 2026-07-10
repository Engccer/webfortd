/**
 * M3(iOS): request-auth 헬퍼 단위 테스트.
 *
 * getRequestAuth(getUser 실호출 포함)는 통합 영역이라 제외(기존 관례).
 * getBearerJwt(순수 함수)·createBearerClient(env 미설정 시 throw)·UUID_RE만 단위 검증.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getBearerJwt, createBearerClient } from '../../src/lib/supabase/request-auth.ts'
import { UUID_RE, normalizeSourceRefs } from '../../src/app/api/chat/threads/[id]/route.ts'

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

// Finding(critical) 재발 방지: RPC 인자에 JSON.stringify를 실수로 다시 넣으면 jsonb 컬럼에
// "이스케이프된 문자열"이 저장되는 이중 인코딩이 재발한다. 이 3케이스(배열/문자열/null)가
// [id] 라우트의 방어적 정규화가 세 형태 모두를 배열로 통일함을 고정한다.
describe('normalizeSourceRefs', () => {
  test('정상 배열 → 그대로 반환', () => {
    const refs = [{ slug: 'a', title: 'A' }]
    assert.deepStrictEqual(normalizeSourceRefs(refs), refs)
  })

  test('빈 배열 → 그대로 반환', () => {
    assert.deepStrictEqual(normalizeSourceRefs([]), [])
  })

  test('이중 인코딩된 배열 JSON 문자열 → 파싱해 배열로 복원', () => {
    const refs = [{ slug: 'a', title: 'A' }]
    assert.deepStrictEqual(normalizeSourceRefs(JSON.stringify(refs)), refs)
  })

  test('파싱 불가능한 문자열 → 빈 배열로 폴백', () => {
    assert.deepStrictEqual(normalizeSourceRefs('not json'), [])
  })

  test('JSON이지만 배열이 아닌 문자열(객체) → 빈 배열로 폴백', () => {
    assert.deepStrictEqual(normalizeSourceRefs(JSON.stringify({ slug: 'a' })), [])
  })

  test('null → 빈 배열로 폴백', () => {
    assert.deepStrictEqual(normalizeSourceRefs(null), [])
  })

  test('undefined → 빈 배열로 폴백', () => {
    assert.deepStrictEqual(normalizeSourceRefs(undefined), [])
  })
})
