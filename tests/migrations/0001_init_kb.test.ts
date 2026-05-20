import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// env가 없으면 통합 테스트 전체를 skip (npm run test 회귀 보호).
// npm run test:integration은 --env-file=.env.local로 강제 로드하므로 정상 실행됨.
const skipReason = !url || !anonKey
  ? 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정 — `npm run test:integration` 사용 필요'
  : false

describe('0001_init_kb migration', { skip: skipReason }, () => {
  let supabase: SupabaseClient

  before(() => {
    // skip이 활성화되면 before도 실행되지 않지만, 안전망으로 한 번 더 확인.
    supabase = createClient(url!, anonKey!)
  })

  test('documents 테이블이 존재하고 anon select 가능 (published 0건)', async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, slug, status')
      .limit(1)
    assert.equal(error, null, error ? `select 실패: ${error.message}` : '')
    assert.deepEqual(data, [])
  })

  test('document_chunks 테이블이 존재하고 anon select 가능', async () => {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id')
      .limit(1)
    assert.equal(error, null)
    assert.deepEqual(data, [])
  })

  test('wiki_backlinks 테이블이 존재하고 anon select 가능', async () => {
    const { data, error } = await supabase
      .from('wiki_backlinks')
      .select('id')
      .limit(1)
    assert.equal(error, null)
    assert.deepEqual(data, [])
  })

  test('taxonomy_terms 테이블이 존재하고 anon select 가능 (RLS true)', async () => {
    const { data, error } = await supabase
      .from('taxonomy_terms')
      .select('id')
      .limit(1)
    assert.equal(error, null)
    assert.deepEqual(data, [])
  })

  test('RLS: anon은 draft documents를 직접 insert 불가', async () => {
    const { error } = await supabase.from('documents').insert({
      slug: 'rls-test-' + Date.now(),
      title: 'RLS test',
      type: '기타',
      year: 2026,
      source: { organization: 'test', citation: 'test' },
      axis: 'uncategorized',
    })
    assert.notEqual(error, null, 'anon insert가 차단되어야 하는데 성공함 (RLS 게이트 누수)')
    // 42501 = permission denied, PGRST = PostgREST RLS rejection
    assert.match(
      error?.code ?? '',
      /42501|PGRST/,
      `예상 error code 42501 또는 PGRST*, 실제: ${error?.code}`,
    )
  })
})
