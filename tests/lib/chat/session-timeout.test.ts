import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SESSION_TIMEOUT_MS, isStaleThread } from '@/lib/chat/session-timeout'

describe('session-timeout (M6.4)', () => {
  it('SESSION_TIMEOUT_MS = 4시간', () => {
    assert.equal(SESSION_TIMEOUT_MS, 4 * 60 * 60 * 1000)
  })

  it('updatedAt이 5분 전 — stale 아님 (false)', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    assert.equal(isStaleThread(fiveMinAgo), false)
  })

  it('updatedAt이 4시간 1초 전 — stale (true)', () => {
    const justOver = new Date(
      Date.now() - (4 * 60 * 60 * 1000 + 1000),
    ).toISOString()
    assert.equal(isStaleThread(justOver), true)
  })

  it('updatedAt이 3시간 59분 전 — stale 아님 (false)', () => {
    const justUnder = new Date(
      Date.now() - (3 * 60 * 60 * 1000 + 59 * 60 * 1000),
    ).toISOString()
    assert.equal(isStaleThread(justUnder), false)
  })

  it('Date 객체 입력도 지원', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    assert.equal(isStaleThread(oneHourAgo), false)
  })

  it('미래 timestamp (clock skew) — stale 아님 (false)', () => {
    const future = new Date(Date.now() + 60 * 1000).toISOString()
    assert.equal(isStaleThread(future), false)
  })
})
