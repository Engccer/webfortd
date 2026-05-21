/**
 * webfortd Phase 2 M5 — publish 워크플로 통합 테스트
 *
 * Task 3 단위 테스트가 evaluateGuards/buildReport/formatReport 로직을 mock으로
 * 검증한 것을, 실 DB(webfortd-prod)에서 end-to-end round-trip으로 재검증한다.
 *
 * 검증 사항:
 *   1. fixture 4개 생성 (통과 1 + 차단 3 — reviewed_by/alt/복수)
 *   2. evaluateGuards가 passing 1건 + blocked 3건으로 정확 분리
 *   3. service_role로 status='draft' → 'published' 전이 성공 (M4 트리거 우회)
 *   4. 차단된 fixture는 status='draft' 보존 — 가드 로직이 production 데이터에 영향 X
 *
 * fixture slug 격리:
 *   - 4개 fixture가 동일 ms에 생성되어도 `m5-*-${ts}-${i}` 패턴으로 unique 보장
 *   - Task 1 code quality reviewer M-2 carry-over 적용
 *
 * cleanup:
 *   - `after` 블록에서 ids in (...) 일괄 delete (idempotent)
 *   - 8건 Phase 1.5b reviewed_by 페이지와 영향 없음 (`m5-*` slug prefix로 격리)
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'
import { evaluateGuards, type DocumentRow } from '../../scripts/publish-content.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

const skipReason =
  !url || !secretKey
    ? 'env 미설정 (test:integration으로 실행 필요 — NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)'
    : false

describe('0002 publish workflow — 통합', { skip: skipReason }, () => {
  let admin: SupabaseClient
  // 동일 ms 충돌 방지: ts 한 번 계산 + index suffix (Task 1 reviewer M-2 carry-over)
  const ts = Date.now()
  const fixtures = [
    {
      slug: `m5-pass-${ts}-0`,
      reviewed_by: ['김헌용'],
      source: { type: 'test' },
      embedded_media: [],
      accessibility: { alt_text_complete: false },
      // expected: PASS (media 없으면 alt 가드 무관)
    },
    {
      slug: `m5-fail-rb-${ts}-1`,
      reviewed_by: [],
      source: { type: 'test' },
      embedded_media: [],
      accessibility: { alt_text_complete: false },
      // expected: FAIL — reviewed_by 누락
    },
    {
      slug: `m5-fail-alt-${ts}-2`,
      reviewed_by: ['김헌용'],
      source: { type: 'test' },
      embedded_media: [{ src: '/x.png' }],
      accessibility: { alt_text_complete: false },
      // expected: FAIL — alt_text_complete (이미지 alt 미완료)
    },
    {
      slug: `m5-fail-multi-${ts}-3`,
      reviewed_by: [],
      source: {},
      embedded_media: [{ src: '/x.png' }],
      accessibility: { alt_text_complete: false },
      // expected: FAIL — 복수 게이트 실패 (reviewed_by + source + alt)
    },
  ]
  const ids: string[] = []

  before(async () => {
    // shadowing 차단: .env.local 값을 process.env에 강제 override
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const s = process.env.SUPABASE_SECRET_KEY!
    admin = createClient(u, s, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    for (const fx of fixtures) {
      const { data, error } = await admin
        .from('documents')
        .insert({
          slug: fx.slug,
          title: `M5 fixture ${fx.slug}`,
          type: '기타',
          year: 2026,
          source: fx.source,
          embedded_media: fx.embedded_media,
          accessibility: fx.accessibility,
          reviewed_by: fx.reviewed_by,
          axis: 'agreements',
          status: 'draft',
        })
        .select('id')
        .single()
      if (error) throw error
      ids.push(data.id)
    }
  })

  after(async () => {
    // cleanup은 항상 실행 — 테스트 실패해도 stale fixture가 documents에 남으면 안 됨
    if (ids.length > 0) {
      const { error } = await admin
        .from('documents')
        .delete()
        .in('id', ids)
      // cleanup 실패는 stale fixture 잔존 위험이라 명시적 throw
      if (error) {
        throw new Error(
          `M5 fixture cleanup 실패 — stale rows 잔존 가능: ${error.message}`,
        )
      }
    }
  })

  test('fixture 1 통과, fixture 2~4 차단 (가드 평가)', async () => {
    const { data, error } = await admin
      .from('documents')
      .select('id, slug, status, reviewed_by, source, embedded_media, accessibility')
      .in('id', ids)
    assert.equal(error, null, error ? `fixture 조회 실패: ${error.message}` : '')
    assert.ok(data, 'fixture 조회 결과 null')
    const results = (data ?? []).map((d) => ({
      slug: d.slug,
      ...evaluateGuards(d as DocumentRow),
    }))
    const passSlugs = results.filter((r) => r.passed).map((r) => r.slug)
    const failSlugs = results.filter((r) => !r.passed).map((r) => r.slug)
    assert.equal(passSlugs.length, 1, `통과 fixture 1개여야 하는데 ${passSlugs.length}개 (${passSlugs.join(', ')})`)
    assert.equal(failSlugs.length, 3, `차단 fixture 3개여야 하는데 ${failSlugs.length}개`)
    assert.ok(
      passSlugs[0].startsWith('m5-pass-'),
      `통과 fixture는 m5-pass-* 여야 함, 실제: ${passSlugs[0]}`,
    )
  })

  test('service_role로 status draft → published 전환 성공', async () => {
    const passId = ids[0] // m5-pass fixture
    const { error } = await admin
      .from('documents')
      .update({ status: 'published' })
      .eq('id', passId)
    assert.equal(
      error,
      null,
      `service_role status 전이가 M4 트리거에 막힘: ${error?.code} ${error?.message}`,
    )
    const { data } = await admin
      .from('documents')
      .select('status')
      .eq('id', passId)
      .single()
    assert.equal(data?.status, 'published')
  })

  test('차단된 fixture는 status 그대로 draft', async () => {
    // m5-pass(ids[0])는 직전 테스트에서 published로 전환됨. 나머지 3개만 검증.
    const { data, error } = await admin
      .from('documents')
      .select('slug, status')
      .in('id', ids.slice(1))
    assert.equal(error, null, error ? `차단 fixture 조회 실패: ${error.message}` : '')
    assert.ok(data, '차단 fixture 조회 결과 null')
    for (const d of data ?? []) {
      assert.equal(
        d.status,
        'draft',
        `${d.slug}는 가드 차단이라 draft 보존되어야 함, 실제: ${d.status}`,
      )
    }
  })

  // 0003 Task D — batch UPDATE read-back observability:
  // publish-content.ts의 main()이 .update().in(ids) 후 동일 ids로 .select 재조회.
  // 이 테스트는 *.in(ids)로 batch select가 정확한 row 수를 반환*하는지 검증.
  // partial transition 시 stale 감지의 근거가 됨.
  test('batch UPDATE 후 .in(ids) read-back이 모든 ids에 대응 row 반환', async () => {
    const { data, error } = await admin
      .from('documents')
      .select('id, slug, status')
      .in('id', ids)
    assert.equal(error, null, error ? `read-back 실패: ${error.message}` : '')
    assert.ok(data)
    assert.equal(data?.length, ids.length, 'read-back row 수가 fixture id 수와 일치해야 함')
    const transitioned = (data ?? []).filter((d) => d.status === 'published')
    const stale = (data ?? []).filter((d) => d.status !== 'published')
    // 직전 테스트로 ids[0]가 published, 나머지 3개는 draft
    assert.equal(transitioned.length, 1, 'transitioned: ids[0] (m5-pass)만')
    assert.equal(stale.length, 3, 'stale: 가드 차단된 3개 fixture')
  })
})
