import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

/**
 * getAdminClient() 회귀 가드.
 *
 * Phase 3 M2 Task 6에서 추가됨. 기존 src/lib/supabase/admin.ts는
 * RAG retrieval (Task 7/8) + Phase 2 publish-content.ts 둘 다에서 사용되는
 * service_role Supabase client. env missing 분기와 singleton 동작 회귀 차단.
 *
 * 주의: getAdminClient는 module-level singleton (`let _adminClient`)을 캐싱한다.
 * tsx loader는 `import('...?t=...')` query param에 관계없이 같은 module instance를
 * 반환하므로 (PROBE 검증), env-missing 분기는 `_adminClient === null` 상태가 보장된
 * "최초 호출 시점"에 한정해서만 의미가 있다. 따라서 모든 env-missing 시나리오를
 * 단일 테스트 안에서 *최초 import 이전에* 검증하고, 그 다음에 성공 + singleton을
 * 별도 테스트로 확인한다. 테스트는 파일 내 선언 순서대로 실행된다 (node:test 기본).
 */
describe('getAdminClient', () => {
  test('env missing 분기 (URL only / KEY only / both) — 모두 동일한 에러로 throw', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const origKey = process.env.SUPABASE_SECRET_KEY

    try {
      // _adminClient 캐싱 전에 모든 env-missing 분기를 검증한다.
      // 모듈은 한 번만 import — singleton이 아직 null인 상태에서 시도해야 throw가 발생.
      const mod = await import('../src/lib/supabase/admin.ts')

      // Case 1: 둘 다 missing
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SECRET_KEY
      assert.throws(
        () => mod.getAdminClient(),
        /NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY/,
        'both missing → throw',
      )

      // Case 2: URL만 missing
      process.env.SUPABASE_SECRET_KEY = 'fake-key'
      assert.throws(
        () => mod.getAdminClient(),
        /NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY/,
        'URL only missing → throw',
      )

      // Case 3: KEY만 missing
      delete process.env.SUPABASE_SECRET_KEY
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
      assert.throws(
        () => mod.getAdminClient(),
        /NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY/,
        'KEY only missing → throw',
      )
    } finally {
      if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL
      if (origKey !== undefined) process.env.SUPABASE_SECRET_KEY = origKey
      else delete process.env.SUPABASE_SECRET_KEY
    }
  })

  test('env 있으면 client 반환 + 두 번 호출 시 동일 인스턴스 (singleton)', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const origKey = process.env.SUPABASE_SECRET_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'fake-key'

    try {
      const mod = await import('../src/lib/supabase/admin.ts')
      const a = mod.getAdminClient()
      const b = mod.getAdminClient()
      assert.ok(a, 'getAdminClient 반환 truthy')
      assert.equal(typeof a.from, 'function', 'SupabaseClient.from 메서드 존재')
      assert.equal(typeof a.rpc, 'function', 'SupabaseClient.rpc 메서드 존재 (RAG match_chunks RPC 호출 대비)')
      assert.strictEqual(a, b, 'singleton — 두 번째 호출이 첫 호출과 같은 인스턴스')
    } finally {
      if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL
      if (origKey !== undefined) process.env.SUPABASE_SECRET_KEY = origKey
      else delete process.env.SUPABASE_SECRET_KEY
    }
  })
})
