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
    // Precondition: schema가 적용되어 있어야 RLS를 실제로 테스트 가능
    // (적용 전 PGRST205 'table not found'가 regex /42501|PGRST/에 매치되어 false positive로 통과하는 문제 차단)
    const { error: existsError } = await supabase
      .from('documents')
      .select('id')
      .limit(0)
    assert.equal(
      existsError,
      null,
      `schema 미적용 — supabase db push 먼저. 실제 error: ${existsError?.code} ${existsError?.message}`,
    )

    // Actual RLS test
    const { error } = await supabase.from('documents').insert({
      slug: 'rls-test-' + Date.now(),
      title: 'RLS test',
      type: '기타',
      year: 2026,
      source: { organization: 'test', citation: 'test' },
      axis: 'uncategorized',
    })
    assert.notEqual(
      error,
      null,
      'anon insert가 차단되어야 하는데 성공함 (RLS 게이트 누수)',
    )
    // 42501 = Postgres permission denied (RLS rejection의 정확한 SQLSTATE)
    assert.equal(
      error?.code,
      '42501',
      `예상 42501 (RLS rejection), 실제: ${error?.code} ${error?.message}`,
    )
  })
})
