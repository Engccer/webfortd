/**
 * webfortd 웹 편집기 권한 모델 — editor_roles RLS 거부 회귀 고정
 *
 * 목적: "editor_roles write는 service_role만 가능(권한 자기부여 차단)"이라는
 * 보안 전제를 실 DB에서 고정한다. 신규 마이그레이션 없음 — 0002(정책 정의)·
 * 0013(role check 확장 + admin seed)이 이미 충족한 상태를 이 테스트가 회귀 방어한다.
 *
 * 검증 사항:
 *   1. anon — editor_roles INSERT 시도 → 42501(RLS 명시 거부)
 *   2. anon — editor_roles UPDATE/DELETE 시도 → error 없이 0행 매칭(아래 참고)
 *   3. service_role — 0013 admin seed row가 존재(SELECT로 확인) + 전체 행 조회 가능
 *      (anon은 SELECT 정책 대상이 'authenticated'뿐이라 0행)
 *
 * 참고(실측): UPDATE/DELETE는 anon/authenticated용 정책 자체가 없어 INSERT처럼
 * 명시적 42501을 던지지 않고 error=null + data=[]로 "0행 매칭" 성공 응답을 준다
 * (command-scoped 차단이라 대상 행의 실존 여부와 무관 — 실측 확인 완료, task-8-report.md 참고).
 *
 * 이 파일은 0002_editor_roles_rls.test.ts의 INSERT 케이스와 일부 겹치지만,
 * editor_roles write RLS 전체(INSERT/UPDATE/DELETE/SELECT + admin seed)를
 * 한곳에서 고정하는 characterization 세트로 의도적으로 구성했다.
 *
 * ⚠ 실데이터 변경 금지: anon insert/update/delete 대상은 모두 존재하지 않는
 * 무작위 UUID만 사용한다(실 admin row를 건드리지 않음). service_role은 SELECT만 수행.
 *
 * 0002_editor_roles_rls.test.ts / 0013-admin-role-and-preview.test.ts와 동일한
 * env override 패턴(loadDotEnvLocalOverrides + skipReason)을 사용.
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

describe('editor_roles RLS 거부 — 권한 자기부여 차단 고정', { skip: skipReason }, () => {
  let anon: SupabaseClient
  let admin: SupabaseClient
  // 실존하지 않는 무작위 UUID — 실 admin row(0013 seed)를 건드리지 않기 위한 타깃
  const fakeUserId = '11111111-2222-3333-4444-555555555555'

  before(() => {
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const s = process.env.SUPABASE_SECRET_KEY!
    anon = createClient(u, a)
    admin = createClient(u, s, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  test('1. anon — editor_roles INSERT 거부 (42501)', async () => {
    const { error } = await anon.from('editor_roles').insert({
      user_id: fakeUserId,
      role: 'editor',
    })
    assert.ok(error, 'anon insert가 차단되어야 하는데 성공함 (권한 자기부여 누수)')
    assert.equal(
      error?.code,
      '42501',
      `예상 42501 (RLS rejection), 실제: ${error?.code} ${error?.message}`,
    )
  })

  test('2. anon — editor_roles UPDATE 거부 (0행 매칭)', async () => {
    const { data, error } = await anon
      .from('editor_roles')
      .update({ role: 'admin' })
      .eq('user_id', fakeUserId)
      .select()
    assert.equal(error, null, `예상 외 error: ${error?.message}`)
    assert.deepStrictEqual(data, [], 'anon update가 행을 변경함 (write RLS 누수)')
  })

  test('3. anon — editor_roles DELETE 거부 (0행 매칭)', async () => {
    const { data, error } = await anon
      .from('editor_roles')
      .delete()
      .eq('user_id', fakeUserId)
      .select()
    assert.equal(error, null, `예상 외 error: ${error?.message}`)
    assert.deepStrictEqual(data, [], 'anon delete가 행을 삭제함 (write RLS 누수)')
  })

  test('4. anon — editor_roles SELECT는 0행 (SELECT 정책이 authenticated 전용)', async () => {
    const { data, error } = await anon.from('editor_roles').select('user_id, role')
    assert.equal(error, null)
    assert.deepStrictEqual(data, [], 'anon이 editor_roles를 read함 — SELECT 정책 회귀')
  })

  test('5. service_role — 0013 admin seed row 존재 + 전체 조회 가능', async () => {
    const { data, error } = await admin
      .from('editor_roles')
      .select('user_id, role')
      .eq('role', 'admin')
    assert.equal(error, null, `service_role SELECT 실패: ${error?.message}`)
    assert.ok(
      (data ?? []).length >= 1,
      '0013 admin seed row(engccer@gmail.com)가 없음 — 시딩 회귀',
    )
  })
})
