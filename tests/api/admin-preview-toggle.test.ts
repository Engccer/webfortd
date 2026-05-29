import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runPreviewToggle, isSameOriginRequest } from '@/lib/admin/preview-handler.ts'
import type { AdminStatus } from '@/lib/auth/admin-types.ts'

const admin: AdminStatus = { isAdmin: true, userId: 'a-1', email: 'a@b.c' }
const nonAdmin: AdminStatus = { isAdmin: false, userId: null, email: null }

function fakeDraft() {
  const calls: string[] = []
  return {
    calls,
    enable: () => { calls.push('enable') },
    disable: () => { calls.push('disable') },
  }
}

describe('runPreviewToggle', () => {
  it('비-admin enable 시도 → 403 + draft 미변경', async () => {
    const draft = fakeDraft()
    const res = await runPreviewToggle(true, { adminStatus: nonAdmin, draft })
    assert.equal(res.status, 403)
    assert.deepEqual(draft.calls, [])
  })

  it('admin enable → 200 + draft.enable 호출', async () => {
    const draft = fakeDraft()
    const res = await runPreviewToggle(true, { adminStatus: admin, draft })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.enabled, true)
    assert.deepEqual(draft.calls, ['enable'])
  })

  it('admin disable → 200 + draft.disable 호출', async () => {
    const draft = fakeDraft()
    const res = await runPreviewToggle(false, { adminStatus: admin, draft })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.enabled, false)
    assert.deepEqual(draft.calls, ['disable'])
  })
})

describe('isSameOriginRequest (CSRF 방어)', () => {
  it('same-origin → true', () => {
    assert.equal(isSameOriginRequest('same-origin'), true)
  })

  it('cross-site → false', () => {
    assert.equal(isSameOriginRequest('cross-site'), false)
  })

  it('same-site → false (서브도메인 공격 방어)', () => {
    assert.equal(isSameOriginRequest('same-site'), false)
  })

  it('헤더 부재(null) → false', () => {
    assert.equal(isSameOriginRequest(null), false)
  })
})
