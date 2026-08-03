import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentUserEditorStatusWith, editorIdShort } from '../../src/lib/auth/editor.ts'

function mockClient(user: { id: string; email: string } | null, roles: Array<{ role: string }> | null, error: object | null = null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: roles, error }),
        }),
      }),
    }),
  } as never
}

describe('getCurrentUserEditorStatusWith', () => {
  it('editor role이면 canEdit=true', async () => {
    const s = await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, [{ role: 'editor' }]))
    assert.deepEqual(s, { canEdit: true, userId: 'u1', email: 'a@b.c' })
  })
  it('admin role도 canEdit=true', async () => {
    const s = await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, [{ role: 'admin' }]))
    assert.equal(s.canEdit, true)
  })
  it('role 없으면 canEdit=false, 비로그인이면 userId=null', async () => {
    assert.equal((await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, []))).canEdit, false)
    assert.equal((await getCurrentUserEditorStatusWith(mockClient(null, null))).userId, null)
  })
  it('조회 error는 fail-safe로 canEdit=false + user 정보 보존', async () => {
    const s = await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, null, { message: 'x' }))
    assert.deepEqual(s, { canEdit: false, userId: 'u1', email: 'a@b.c' })
  })
})

describe('editorIdShort', () => {
  it('UUID 앞 8자를 반환한다', () => {
    assert.equal(editorIdShort('123e4567-e89b-12d3-a456-426614174000'), '123e4567')
  })
})
