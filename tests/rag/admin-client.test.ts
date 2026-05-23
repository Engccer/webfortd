import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('rag/admin-client', () => {
  test('createRagAdminClient — 환경변수 누락 시 throw', async () => {
    // 격리 위해 env 백업·복원
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const origKey = process.env.SUPABASE_SECRET_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SECRET_KEY

    try {
      const mod = await import('../../src/lib/rag/admin-client.ts')
      assert.throws(
        () => mod.createRagAdminClient(),
        /SUPABASE_URL|SECRET_KEY/,
      )
    } finally {
      if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
      if (origKey) process.env.SUPABASE_SECRET_KEY = origKey
    }
  })

  test('createRagAdminClient — 환경변수 있으면 client 인스턴스 반환', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'fake-key'
    try {
      const { createRagAdminClient } = await import('../../src/lib/rag/admin-client.ts')
      const client = createRagAdminClient()
      assert.ok(client)
      assert.equal(typeof client.from, 'function')
      assert.equal(typeof client.rpc, 'function')
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SECRET_KEY
    }
  })
})
