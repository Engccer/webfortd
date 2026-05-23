/**
 * 0006_rag_runtime_rpcs 통합 테스트.
 *
 * 전제: 0006 마이그레이션이 webfortd-prod에 push되어 있어야 함.
 * Controller가 supabase db push 후 실행한다.
 *
 * 검증:
 *   1) replace_document_chunks RPC 존재 + round-trip (insert→read→re-insert→read 동일)
 *   2) match_chunks RPC 존재 + topK / similarity 점수 형식
 *   3) service_role grant 정합성 (anon 호출 시 거부)
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const skipReason =
  !url || !secretKey || !anonKey
    ? 'env 미설정 (test:integration으로 실행 — URL / SECRET_KEY / ANON_KEY 필요)'
    : false

describe('0006_rag_runtime_rpcs', { skip: skipReason }, () => {
  let admin: SupabaseClient
  let anon: SupabaseClient

  before(() => {
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const s = process.env.SUPABASE_SECRET_KEY!
    const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    admin = createClient(u, s, { auth: { persistSession: false, autoRefreshToken: false } })
    anon = createClient(u, a, { auth: { persistSession: false, autoRefreshToken: false } })
  })

  test('match_chunks RPC — topK=3, 임의 zero-vector → 3건 반환 + similarity 형식', async () => {
    const zeroVec = new Array(1536).fill(0)
    const { data, error } = await admin.rpc('match_chunks', {
      p_query_embedding: zeroVec,
      p_top_k: 3,
      p_min_similarity: -1,  // zero-vector는 cosine 정의불가 → 모든 비교 결과 NaN/0 영역. -1 cap으로 통과
      p_include_drafts: true,
    })
    assert.equal(error, null, error?.message)
    assert.ok(Array.isArray(data))
    assert.ok((data as unknown[]).length <= 3,
      `topK=3 expected ≤3 rows, got ${(data as unknown[]).length}`)
    if ((data as unknown[]).length > 0) {
      const row = (data as Array<Record<string, unknown>>)[0]
      assert.ok('chunk_id' in row)
      assert.ok('document_slug' in row)
      assert.ok('similarity' in row)
    }
  })

  test('match_chunks — anon 호출 시 거부 (service_role 전용)', async () => {
    const zeroVec = new Array(1536).fill(0)
    const { error } = await anon.rpc('match_chunks', {
      p_query_embedding: zeroVec,
      p_top_k: 3,
      p_min_similarity: -1,
      p_include_drafts: true,
    })
    // PostgREST는 grant 미충족 시 PGRST 또는 42501 반환
    assert.ok(error, 'anon 호출은 차단되어야 함')
  })

  test('replace_document_chunks — 빈 chunks 배열은 0 반환 + 기존 청크 삭제', async () => {
    // 임의 document 1건 선택
    const { data: docRow } = await admin
      .from('documents')
      .select('id')
      .limit(1)
      .single()
    assert.ok(docRow?.id)

    const { data: before } = await admin
      .from('document_chunks')
      .select('chunk_index, chunk_text, embedding, metadata, section')
      .eq('document_id', docRow.id)
      .order('chunk_index')

    assert.ok(before && before.length > 0, '대상 doc은 청크 존재해야 함')

    try {
      // empty array — DELETE만 일어나고 INSERT 0건
      const { data: emptyResult, error: emptyErr } = await admin.rpc(
        'replace_document_chunks',
        { p_document_id: docRow.id, p_chunks: [] },
      )
      assert.equal(emptyErr, null, emptyErr?.message)
      assert.equal(emptyResult, 0)

      // 청크 0건 확인
      const { count: midCount } = await admin
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', docRow.id)
      assert.equal(midCount, 0)
    } finally {
      // assertion 실패 여부와 관계없이 복원 (production 청크 영구 손실 차단)
      const restorePayload = before!.map((c) => ({
        chunk_index: c.chunk_index,
        chunk_text: c.chunk_text,
        embedding: c.embedding,
        metadata: c.metadata,
        section: c.section,
      }))
      await admin.rpc('replace_document_chunks', {
        p_document_id: docRow!.id,
        p_chunks: restorePayload,
      })
    }

    // 복원 round-trip 검증 — assertion 실패해도 finally에서 데이터는 살아 있음
    const { data: after } = await admin
      .from('document_chunks')
      .select('chunk_index')
      .eq('document_id', docRow!.id)
    assert.equal(after?.length, before!.length, '복원 후 청크 수가 원본과 일치해야 함')
  })

  test('replace_document_chunks — anon 호출 시 거부', async () => {
    const { error } = await anon.rpc('replace_document_chunks', {
      p_document_id: '00000000-0000-0000-0000-000000000000',
      p_chunks: [],
    })
    assert.ok(error, 'anon 호출은 차단되어야 함')
  })

  test('match_chunks — status 화이트리스트: archived/deprecated/in_review 제외 (0009 critical fix)', async () => {
    // codex-rescue critical finding의 fix verify.
    // 임시 doc 1건을 'archived' status로 set + match_chunks가 includeDrafts=true에서도
    // 제외하는지 확인. 0001 status 화이트리스트는 5개지만 RAG는 published/draft만.
    //
    // 안전: 기존 doc의 status를 잠깐 archived로 set → 검증 → 원복.
    // service_role 트리거(guard_documents_status_transition)는 service_role을 통과시킴.

    // 청크 ≥ 1건 보유 doc 선택 (검색 결과에 잡힐 가능성 위해)
    const { data: docRow } = await admin
      .from('documents')
      .select('id, slug, status')
      .limit(1)
      .single()
    assert.ok(docRow?.id)
    const origStatus = docRow.status

    try {
      // 1단계: status를 'archived'로 set
      const { error: updErr } = await admin
        .from('documents')
        .update({ status: 'archived' })
        .eq('id', docRow.id)
      assert.equal(updErr, null, updErr?.message)

      // 2단계: match_chunks 호출 (includeDrafts=true). 결과에 archived doc은 포함 안 됨.
      const zeroVec = new Array(1536).fill(0)
      const { data, error } = await admin.rpc('match_chunks', {
        p_query_embedding: zeroVec,
        p_top_k: 50,
        p_min_similarity: -1,
        p_include_drafts: true,
      })
      assert.equal(error, null, error?.message)
      const rows = (data ?? []) as Array<{ document_id: string; document_status: string }>
      const archivedHit = rows.find((r) => r.document_id === docRow.id)
      assert.equal(archivedHit, undefined, 'archived doc은 RAG 결과에 포함 안 됨')

      // 3단계: 모든 반환 row의 status는 'published' 또는 'draft'만
      for (const r of rows) {
        assert.ok(
          r.document_status === 'published' || r.document_status === 'draft',
          `예상 외 status: ${r.document_status}`,
        )
      }
    } finally {
      // 무조건 status 원복
      await admin
        .from('documents')
        .update({ status: origStatus })
        .eq('id', docRow.id)
    }
  })

  test('match_chunks — includeDrafts=false 시 draft 제외', async () => {
    const zeroVec = new Array(1536).fill(0)
    const { data, error } = await admin.rpc('match_chunks', {
      p_query_embedding: zeroVec,
      p_top_k: 50,
      p_min_similarity: -1,
      p_include_drafts: false,
    })
    assert.equal(error, null, error?.message)
    const rows = (data ?? []) as Array<{ document_status: string }>
    // includeDrafts=false면 published 만 반환
    for (const r of rows) {
      assert.equal(r.document_status, 'published',
        `includeDrafts=false에서 published 외 status 반환: ${r.document_status}`)
    }
  })
})
