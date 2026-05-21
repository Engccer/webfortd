/**
 * webfortd Phase 2 M2 — RLS 통합 테스트 fixture 확장 (M1 carry-over 3)
 *
 * M2 sync 적용 후 운영 DB 상태(documents 535 draft + wiki_backlinks ~1000건)를
 * 전제로 admin/anon round-trip을 검증한다. `tests/migrations/0001_init_kb.test.ts`
 * (5건 smoke)와 별도 파일로, 총 5 + 7 = 12건이 `npm run test:integration`에서 실행.
 *
 * 환경 트랩 가드 (Task 5 발견):
 *   `~/.zshrc:64`에 다른 프로젝트의 SUPABASE_SECRET_KEY가 export되어 있으면
 *   `node --env-file=.env.local`은 *기존 env를 덮어쓰지 않으므로* stale 키가 사용된다.
 *   이 가드를 `before` 블록에서 `loadDotEnvLocalOverrides()`로 차단한다.
 *
 *   주의 1: `loadDotEnvLocalOverrides`를 *모듈 top-level에서* 호출하면 `npm run test`
 *   (env-file 없이 실행되는 회귀 테스트)에서도 .env.local을 자동 로딩해서 통합 테스트가
 *   실 DB에 hit한다. 그래서 `before` 블록 안으로 한정해 envFile 없으면 자연스레 skip.
 *
 *   주의 2: skipReason은 모듈 top-level에서 결정되어 before보다 먼저 평가된다.
 *   shadowing 케이스(zshrc에 stale 키 *존재*)에서는 skipReason=false → before 실행 →
 *   override 적용 → 정확한 키로 client 구성. env가 *완전 부재*인 케이스(npm run test)
 *   에서는 skipReason 활성 → before 미실행 → loadDotEnvLocalOverrides 미호출.
 *
 *   주의 3: before 안에서 process.env를 *재조회*해야 한다. 모듈 top의 const 캡처는
 *   override 이전 값이므로 stale.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

// false vs '' 주의: node:test의 skip 옵션은 falsy 값으로 false를 기대.
// 0001_init_kb.test.ts와 동일한 패턴(`: false`)을 사용한다.
const skipReason =
  !url || !anonKey || !secretKey
    ? 'env 미설정 (test:integration으로 실행 필요 — NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SECRET_KEY)'
    : false

describe('0001_init_kb RLS fixture (M2 sync 후)', { skip: skipReason }, () => {
  let anon: SupabaseClient
  let admin: SupabaseClient

  before(() => {
    // shadowing 차단: .env.local 값을 process.env에 강제 override (Task 5 발견 트랩).
    // skip 옵션이 false인 경우에만 실행되므로 `npm run test` 회귀에는 영향 없음.
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const s = process.env.SUPABASE_SECRET_KEY!
    anon = createClient(u, a)
    admin = createClient(u, s, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  test('precondition: documents에 draft rows 535건 (admin)', async () => {
    const { count, error } = await admin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')
    assert.equal(error, null)
    assert.ok(count !== null && count >= 500, `draft count 너무 적음: ${count}`)
  })

  test('anon은 draft documents를 read할 수 없음', async () => {
    const { data, error } = await anon
      .from('documents')
      .select('id, slug, status')
      .eq('status', 'draft')
      .limit(5)
    assert.equal(error, null) // RLS는 row 필터, 에러는 안 남
    assert.deepEqual(data, []) // 모두 차단되어 빈 배열
  })

  test('admin이 한 페이지를 published로 전환 + anon에게 노출 + 원복', async () => {
    // 첫 draft 페이지 1건 선택
    const { data: sample } = await admin
      .from('documents')
      .select('id, slug')
      .eq('status', 'draft')
      .limit(1)
      .single()
    assert.ok(sample)

    // published 전환
    const { error: e1 } = await admin
      .from('documents')
      .update({ status: 'published' })
      .eq('id', sample.id)
    assert.equal(e1, null)

    try {
      // anon에서 노출 확인
      const { data: anonRead } = await anon
        .from('documents')
        .select('id, slug, status')
        .eq('id', sample.id)
        .single()
      assert.equal(anonRead?.status, 'published')
      assert.equal(anonRead?.slug, sample.slug)
    } finally {
      // 원복 (테스트 격리) — 예외 발생 시에도 finally 보장
      await admin
        .from('documents')
        .update({ status: 'draft' })
        .eq('id', sample.id)
    }
  })

  test('anon은 wiki_backlinks를 source 기준으로 차단 (draft 부모)', async () => {
    const { data } = await anon
      .from('wiki_backlinks')
      .select('id')
      .limit(5)
    assert.deepEqual(data, [])
  })

  test('published 페이지의 backlinks는 anon이 read 가능 (D6 — target_slug 노출 invariant)', async () => {
    // reviewer I-1: backlinks 보유한 source를 *명시적*으로 선택 (silent return 차단)
    // 임의 첫 row 방식은 그 row가 backlinks 0건이면 D6 검증이 silently skip됨
    const { data: candidates } = await admin
      .from('wiki_backlinks')
      .select('source_doc_id')
      .limit(50)
    const sourceDocId = candidates?.[0]?.source_doc_id
    assert.ok(
      sourceDocId,
      'wiki_backlinks fixture가 비어있어 D6 invariant 검증 불가 — M2 sync 누락 의심',
    )

    const { data: sourceDoc } = await admin
      .from('documents')
      .select('id, slug')
      .eq('id', sourceDocId)
      .eq('status', 'draft')
      .single()
    assert.ok(sourceDoc, `source_doc_id ${sourceDocId}가 documents 테이블 또는 draft 상태에 없음`)

    // published 전환
    await admin
      .from('documents')
      .update({ status: 'published' })
      .eq('id', sourceDoc.id)
    try {
      // anon이 backlinks read 가능
      const { data: anonBlinks } = await anon
        .from('wiki_backlinks')
        .select('id, target_slug')
        .eq('source_doc_id', sourceDoc.id)
      assert.ok((anonBlinks?.length ?? 0) > 0)
      // D6: target_slug가 draft 문서를 가리키더라도 노출 OK (slug는 git public)
    } finally {
      // 원복 — 예외 발생 시에도 finally 보장
      await admin
        .from('documents')
        .update({ status: 'draft' })
        .eq('id', sourceDoc.id)
    }
  })

  test('anon은 wiki_backlinks insert 불가 (RLS)', async () => {
    const { error } = await anon
      .from('wiki_backlinks')
      .insert({
        source_doc_id: '00000000-0000-0000-0000-000000000000',
        target_slug: 'fake',
      })
    assert.notEqual(error, null)
    assert.equal(error?.code, '42501')
  })

  test('anon은 documents status를 update 불가', async () => {
    const { data: sample } = await admin
      .from('documents')
      .select('id')
      .limit(1)
      .single()
    assert.ok(sample)
    const { error, count } = await anon
      .from('documents')
      .update({ status: 'published' })
      .eq('id', sample.id)
      .select('*', { count: 'exact', head: true })

    // RLS는 row visibility 필터라 update affected 0 + error null이거나 explicit error.
    // Supabase는 RLS로 invisible한 row를 update할 때 count를 0 또는 null로 반환할 수 있음
    // (PostgREST의 Prefer: count=exact 동작에서 빈 결과셋이 null로 직렬화되는 케이스).
    // 두 값 모두 "anon이 row를 변경하지 못함"의 시맨틱이라 RLS 차단으로 인정.
    if (error === null) {
      assert.ok(
        count === 0 || count === null,
        `anon update가 row 변경 안 함 (RLS row visibility), count=${count}`,
      )

      // 추가 검증: admin이 즉시 다시 읽어서 status가 여전히 'draft'인지 확인
      // (RLS 누수로 실제 변경이 발생했다면 이 단계에서 published로 잡힘)
      const { data: postCheck } = await admin
        .from('documents')
        .select('status')
        .eq('id', sample.id)
        .single()
      assert.equal(
        postCheck?.status,
        'draft',
        'anon update가 실제로 row를 변경했음 (RLS 누수)',
      )
    } else {
      assert.match(error.code ?? '', /42501|PGRST/)
    }
  })
})
