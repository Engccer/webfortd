/**
 * webfortd Phase 2 M4 — editor_roles + write RLS + status 전이 트리거 round-trip
 *
 * 검증 사항:
 *   1. anon은 editor_roles에 직접 INSERT 불가 (42501)
 *   2. anon은 documents body update 차단 (editor_roles 멤버 아님 → 0 row affected)
 *   3. service_role은 status draft → published 전이 성공 (트리거 통과)
 *   4. fixture cleanup
 *
 * Lifecycle:
 *   - before: fixture document 1건 생성 (status='draft', slug에 timestamp suffix로 격리)
 *   - 마지막 test에서 cleanup (생성한 row 삭제)
 *
 * 0001_init_kb_rls.test.ts와 동일한 env override 패턴 (shadowing 차단)을 사용.
 * skipReason 모듈 top-level 결정 → before에서 env 재조회 → loadDotEnvLocalOverrides() 호출.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

const skipReason =
  !url || !anonKey || !secretKey
    ? 'env 미설정 (test:integration으로 실행 필요 — NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SECRET_KEY)'
    : false

describe('0002 editor_roles + write RLS + status 트리거', { skip: skipReason }, () => {
  let anon: SupabaseClient
  let admin: SupabaseClient
  let testDocId: string

  before(async () => {
    // shadowing 차단: .env.local 값을 process.env에 강제 override
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const s = process.env.SUPABASE_SECRET_KEY!
    anon = createClient(u, a)
    admin = createClient(u, s, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // fixture document 생성 (status='draft')
    const { data, error } = await admin
      .from('documents')
      .insert({
        slug: `m4-test-${Date.now()}`,
        title: 'M4 RLS test',
        type: '기타',
        year: 2026,
        source: { type: 'test' },
        axis: 'agreements',
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) throw error
    testDocId = data.id
  })

  test('anon은 editor_roles INSERT 차단 (42501)', async () => {
    const { error } = await anon.from('editor_roles').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      role: 'editor',
    })
    assert.ok(error, 'anon insert가 차단되어야 하는데 성공함 (RLS 게이트 누수)')
    assert.equal(
      error?.code,
      '42501',
      `예상 42501 (RLS rejection), 실제: ${error?.code} ${error?.message}`,
    )
  })

  test('anon은 documents UPDATE body 차단', async () => {
    // RLS 정책 미매치는 0 row matched로 표시 (editor_roles 멤버 아님)
    // 명시적 error가 안 나오므로, admin 재조회로 변경이 발생하지 않았음을 확인
    await anon
      .from('documents')
      .update({ title: 'hacked' })
      .eq('id', testDocId)

    const { data, error: readErr } = await admin
      .from('documents')
      .select('title')
      .eq('id', testDocId)
      .single()
    assert.equal(readErr, null)
    assert.notEqual(
      data?.title,
      'hacked',
      'anon update가 실제로 row를 변경했음 (write RLS 누수)',
    )
    assert.equal(data?.title, 'M4 RLS test')
  })

  test('service_role은 status draft → published 전이 성공', async () => {
    const { error } = await admin
      .from('documents')
      .update({ status: 'published' })
      .eq('id', testDocId)
    assert.equal(
      error,
      null,
      `service_role의 status 전이가 트리거에 막힘: ${error?.code} ${error?.message}`,
    )
    const { data } = await admin
      .from('documents')
      .select('status')
      .eq('id', testDocId)
      .single()
    assert.equal(data?.status, 'published')
  })

  test('cleanup: testDoc 삭제', async () => {
    const { error } = await admin
      .from('documents')
      .delete()
      .eq('id', testDocId)
    assert.equal(error, null)
  })
})
