import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SECRET_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

test('0012 — library bucket 존재 + public 설정', async () => {
  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.storage.getBucket('library')
  assert.ok(!error, `bucket fetch error: ${error?.message}`)
  assert.equal(data?.id, 'library')
  assert.equal(data?.public, true)
})

test('0012 — anon은 INSERT 차단 (RLS)', async () => {
  const anon = createClient(url, anonKey)
  const buffer = Buffer.from('rls-probe')
  const { error } = await anon.storage
    .from('library')
    .upload('rls-probe-blocked.bin', buffer, { upsert: false })
  assert.ok(error, 'anon upload는 차단되어야 함')
  assert.match(
    error?.message ?? '',
    /row-level security|new row violates|policy|unauthorized/i,
    `expected RLS reject, got: ${error?.message}`,
  )
})
