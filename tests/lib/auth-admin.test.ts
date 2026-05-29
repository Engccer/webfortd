/**
 * webfortd Phase A — getCurrentUserAdminStatus 단위 테스트
 *
 * Dependency injection 버전(getCurrentUserAdminStatusWith)으로 mock client 주입.
 * Production 헬퍼(getCurrentUserAdminStatus)는 server-only import라 단위 테스트 직접 호출 불가.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentUserAdminStatusWith } from '../../src/lib/auth/admin.ts'

interface RoleRow {
  role: string
}

interface StubOpts {
  user?: { id: string; email?: string | null } | null
  roles?: RoleRow[]
  rolesError?: { message: string } | null
}

function makeClientStub(opts: StubOpts) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.user ?? null },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: opts.roles ?? [],
            error: opts.rolesError ?? null,
          }),
        }),
      }),
    }),
  }
}

describe('getCurrentUserAdminStatusWith', () => {
  test('unauthenticated user → isAdmin=false, userId=null, email=null', async () => {
    const client = makeClientStub({ user: null })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.deepStrictEqual(status, {
      isAdmin: false,
      userId: null,
      email: null,
    })
  })

  test('authenticated user without admin role → isAdmin=false, userId set', async () => {
    const client = makeClientStub({
      user: { id: 'user-1', email: 'plain@example.com' },
      roles: [],
    })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.strictEqual(status.isAdmin, false)
    assert.strictEqual(status.userId, 'user-1')
    assert.strictEqual(status.email, 'plain@example.com')
  })

  test('authenticated user with admin role → isAdmin=true', async () => {
    const client = makeClientStub({
      user: { id: 'admin-1', email: 'admin@example.com' },
      roles: [{ role: 'admin' }],
    })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.strictEqual(status.isAdmin, true)
    assert.strictEqual(status.userId, 'admin-1')
    assert.strictEqual(status.email, 'admin@example.com')
  })

  test('roles query error → isAdmin=false (fail-safe)', async () => {
    const client = makeClientStub({
      user: { id: 'user-2', email: null },
      rolesError: { message: 'RLS denied' },
    })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.strictEqual(status.isAdmin, false)
    assert.strictEqual(status.userId, 'user-2')
    assert.strictEqual(status.email, null)
  })
})
