import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getSuggestions } from '@/lib/chat/suggestions'

describe('getSuggestions (M6.5 분기 매트릭스)', () => {
  it('비로그인 + 신규 thread — 기본 3개', () => {
    const result = getSuggestions({ isAuthenticated: false, hasThread: false })
    assert.equal(result.length, 3)
    assert.ok(result.some((s) => s.includes('특수 마우스')))
    assert.ok(result.some((s) => s.includes('편의지원 조례')))
    assert.ok(result.some((s) => s.includes('학교생활기록부')))
  })

  it('로그인 + 신규 thread — 진입 유도 3개', () => {
    const result = getSuggestions({ isAuthenticated: true, hasThread: false })
    assert.equal(result.length, 3)
    // 기본 3개와 달라야 함 (분기 확인)
    assert.notDeepEqual(
      result,
      getSuggestions({ isAuthenticated: false, hasThread: false }),
    )
  })

  it('로그인 + 기존 thread + axis=policies — 정책 인접 추천', () => {
    const result = getSuggestions({
      isAuthenticated: true,
      hasThread: true,
      lastAssistantAxis: 'policies',
    })
    assert.equal(result.length, 3)
    assert.ok(
      result.some((s) => /정책|제도|규정/.test(s)),
      `policies 추천에 정책 키워드 누락: ${JSON.stringify(result)}`,
    )
  })

  it('로그인 + 기존 thread + axis=disability-types — 장애 유형 인접', () => {
    const result = getSuggestions({
      isAuthenticated: true,
      hasThread: true,
      lastAssistantAxis: 'disability-types',
    })
    assert.equal(result.length, 3)
    assert.ok(
      result.some((s) => /장애|유형|진단/.test(s)),
      `disability-types 추천에 장애 키워드 누락: ${JSON.stringify(result)}`,
    )
  })

  it('로그인 + 기존 thread + 알 수 없는 axis — fallback 추천', () => {
    const result = getSuggestions({
      isAuthenticated: true,
      hasThread: true,
      lastAssistantAxis: 'unknown-axis',
    })
    assert.equal(result.length, 3)
    // fallback은 axis-specific 키워드와 매치 안 됨
    assert.ok(result.some((s) => /관련된 다른 정책|적용 사례|문의/.test(s)))
  })
})
