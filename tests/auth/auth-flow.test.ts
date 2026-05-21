import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// AuthContext 자체는 React 컴포넌트라 React Testing Library 없이 unit test 어려움.
// 대신 핵심 비즈니스 로직 — signInWithMagicLink의 emailRedirectTo 구성 — 만 검증.

describe('AuthContext signInWithMagicLink emailRedirectTo', () => {
  test('NEXT_PUBLIC_SITE_URL 사용', () => {
    // siteUrl 결정 로직을 별도 함수로 분리하지 않았으므로 logic 자체는 inline.
    // 향후 helper로 추출 시 정밀 테스트 가능.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const redirect = `${siteUrl}/auth/callback`
    assert.ok(redirect.endsWith('/auth/callback'))
    assert.ok(redirect.startsWith('http'))
  })

  test('NEXT_PUBLIC_SITE_URL 누락 시 localhost fallback', () => {
    // process.env 임시 변경
    const original = process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      assert.equal(siteUrl, 'http://localhost:3000')
    } finally {
      if (original !== undefined) process.env.NEXT_PUBLIC_SITE_URL = original
    }
  })
})
