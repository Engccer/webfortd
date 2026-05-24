/**
 * webfortd Phase 3 M5 — chat_threads / chat_messages RLS + 0011 RPC 통합 시나리오.
 *
 * 검증 6 시나리오:
 *   1. service_role RPC create_thread_with_messages — 정상 INSERT + thread_id 반환
 *   2. service_role RPC append_messages — user_id 일치 시 INSERT
 *   3. service_role RPC append_messages — user_id 불일치 시 exception (thread 소유권 DB 검증)
 *   4. anon — chat_threads 직접 INSERT 시도 → 42501 RLS 거부
 *   5. anon — chat_messages 직접 INSERT 시도 → 42501 RLS 거부
 *   6. authenticated user A — 본인 thread SELECT OK, userB의 thread 시도 → 빈 결과
 *
 * Lifecycle:
 *   - before: admin.auth.admin.createUser로 fixture 사용자 2명 (password 고정)
 *   - after: thread cleanup (CASCADE로 messages 자동 삭제) + admin.auth.admin.deleteUser
 *
 * 0001/0002_*_rls 패턴 정합 — loadDotEnvLocalOverrides + skipReason.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

const skipReason =
  !url || !anonKey || !secretKey
    ? 'env 미설정 (test:integration으로 실행 필요)'
    : false

describe('0010 chat_history RLS + 0011 RPC', { skip: skipReason }, () => {
  let anon: SupabaseClient
  let admin: SupabaseClient
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  const password = `m5-test-pw-${Date.now()}`
  const cleanupThreadIds: string[] = []

  before(async () => {
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const s = process.env.SUPABASE_SECRET_KEY!
    anon = createClient(u, a)
    admin = createClient(u, s, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ts = Date.now()
    const a1 = await admin.auth.admin.createUser({
      email: `m5-a-${ts}@webfortd.test`,
      email_confirm: true,
      password,
    })
    const b1 = await admin.auth.admin.createUser({
      email: `m5-b-${ts}@webfortd.test`,
      email_confirm: true,
      password,
    })
    if (a1.error || b1.error) {
      throw new Error(`createUser 실패: ${a1.error?.message ?? b1.error?.message}`)
    }
    userA = { id: a1.data.user!.id, email: a1.data.user!.email! }
    userB = { id: b1.data.user!.id, email: b1.data.user!.email! }
  })

  after(async () => {
    for (const id of cleanupThreadIds) {
      await admin.from('chat_threads').delete().eq('id', id)
    }
    if (userA?.id) await admin.auth.admin.deleteUser(userA.id)
    if (userB?.id) await admin.auth.admin.deleteUser(userB.id)
  })

  test('1. service_role create_thread_with_messages — 정상 INSERT + thread_id 반환', async () => {
    const { data, error } = await admin.rpc('create_thread_with_messages', {
      p_user_id: userA.id,
      p_title: '첫 대화',
      p_user_content: '질문 1',
      p_assistant_content: '답변 1',
      p_source_refs: JSON.stringify([
        { slug: 's1', title: 't1', axis: 'policies', type: '안내서', href: '/policies/s1' },
      ]),
      p_token_usage: JSON.stringify({ inputTokens: 10, outputTokens: 20 }),
    })
    assert.equal(error, null, `unexpected error: ${error?.message}`)
    assert.ok(typeof data === 'string', 'thread_id uuid string 반환')
    cleanupThreadIds.push(data as string)

    // 메시지 2개 (service_role select — RLS bypass)
    const { data: msgs } = await admin
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', data)
      .order('created_at', { ascending: true })
    assert.equal(msgs?.length, 2)
    assert.equal(msgs?.[0].role, 'user')
    assert.equal(msgs?.[1].role, 'assistant')
  })

  test('2. service_role append_messages — user_id 일치 시 INSERT', async () => {
    const threadId = cleanupThreadIds[0]
    const { error } = await admin.rpc('append_messages', {
      p_thread_id: threadId,
      p_user_id: userA.id,
      p_user_content: '질문 2',
      p_assistant_content: '답변 2',
      p_source_refs: '[]',
      p_token_usage: null,
    })
    assert.equal(error, null)

    const { data: msgs } = await admin
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
    assert.equal(msgs?.length, 4)  // 2 라운드 = 4 메시지
  })

  test('3. service_role append_messages — user_id 불일치 시 exception', async () => {
    const threadId = cleanupThreadIds[0]
    const { error } = await admin.rpc('append_messages', {
      p_thread_id: threadId,
      p_user_id: userB.id,  // userA의 thread에 userB가 시도
      p_user_content: 'x',
      p_assistant_content: 'y',
      p_source_refs: '[]',
      p_token_usage: null,
    })
    assert.notEqual(error, null, 'exception 기대')
    assert.match(error!.message, /not found or not owned/)
  })

  test('4. anon — chat_threads 직접 INSERT 시도 → 42501 RLS 거부', async () => {
    const { error } = await anon.from('chat_threads').insert({
      user_id: userA.id,
      title: 'anon 시도',
    })
    assert.notEqual(error, null)
    assert.equal(error!.code, '42501')
  })

  test('5. anon — chat_messages 직접 INSERT 시도 → 42501 RLS 거부', async () => {
    const { error } = await anon.from('chat_messages').insert({
      thread_id: cleanupThreadIds[0],
      role: 'user',
      content: 'anon 시도',
    })
    assert.notEqual(error, null)
    assert.equal(error!.code, '42501')
  })

  test('6. authenticated user A/B — 본인 thread만 SELECT (RLS 분리)', async () => {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const clientA = createClient(u, a)
    const signA = await clientA.auth.signInWithPassword({
      email: userA.email,
      password,
    })
    assert.equal(signA.error, null, `userA sign-in 실패: ${signA.error?.message}`)

    const { data: ownThreads } = await clientA
      .from('chat_threads')
      .select('id, title')
      .eq('id', cleanupThreadIds[0])
    assert.equal(ownThreads?.length, 1, 'userA는 본인 thread SELECT OK')

    const clientB = createClient(u, a)
    const signB = await clientB.auth.signInWithPassword({
      email: userB.email,
      password,
    })
    assert.equal(signB.error, null, `userB sign-in 실패: ${signB.error?.message}`)

    const { data: otherThreads } = await clientB
      .from('chat_threads')
      .select('id')
      .eq('id', cleanupThreadIds[0])
    assert.equal(otherThreads?.length, 0, 'userB는 userA thread SELECT 차단')
  })
})
