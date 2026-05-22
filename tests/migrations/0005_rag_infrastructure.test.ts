/**
 * webfortd Phase 3 M1 — 0005 hnsw 인덱스 마이그레이션 통합 테스트
 *
 * 전제: 0005 마이그레이션이 이미 webfortd-prod에 적용되어 있어야 함.
 * Controller가 Supabase MCP apply_migration 후 실행한다.
 *
 * Supabase JS는 system catalog(pg_indexes) 직접 조회가 불가하므로
 * hnsw 인덱스 존재는 Controller가 MCP execute_sql로 별도 확인.
 * 여기서는 document_chunks 테이블이 쿼리 가능한지 + M1 임베딩 baseline을 검증한다.
 *
 * 환경 트랩 가드 (0001_init_kb_rls.test.ts와 동일 패턴):
 *   loadDotEnvLocalOverrides()를 before 블록 안에서만 호출해
 *   `npm run test` 회귀 실행 시 실 DB hit 차단.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

const skipReason =
  !url || !secretKey
    ? 'env 미설정 (test:integration으로 실행 필요 — NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)'
    : false

describe('0005_rag_infrastructure (hnsw 인덱스 + M1 임베딩 baseline)', { skip: skipReason }, () => {
  let admin: SupabaseClient

  before(() => {
    // shadowing 차단: .env.local 값을 process.env에 강제 override
    loadDotEnvLocalOverrides()
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const s = process.env.SUPABASE_SECRET_KEY!
    admin = createClient(u, s, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  test('0005 — document_chunks 테이블 쿼리 가능 (임베딩 1건 이상)', async () => {
    // hnsw 인덱스가 존재하면 이 쿼리는 정상 반환.
    // Supabase JS로 pg_indexes 직접 조회 불가 — 인덱스 이름 검증은
    // Controller가 MCP execute_sql("SELECT indexname FROM pg_indexes WHERE indexname = 'idx_chunks_embedding_hnsw'")로 수행.
    const { data: sample, error } = await admin
      .from('document_chunks')
      .select('id, document_id, chunk_index')
      .limit(1)
    assert.equal(error, null, error?.message)
    assert.ok(sample && sample.length === 1, 'M1 임베딩 1건 이상 필요 — Task 11 실행 선행')
  })

  test('0005 — document_chunks row count >= 1000 (M1 1606 기준)', async () => {
    const { count, error } = await admin
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
    assert.equal(error, null, error?.message)
    assert.ok((count ?? 0) >= 1000, `청크 수 부족: ${count}건. M1 임베딩 누락?`)
  })

  test('0005 — chunks가 535+ documents 커버 (M1 baseline)', async () => {
    // documents.count는 다른 통합 테스트의 임시 fixture row 때문에
    // 본 test 실행 시점에 535를 초과할 수 있음(병렬 실행 race).
    // 진짜 invariant: chunks가 derive한 distinct document_id 수 >= 535
    //   = content/* 535 docs 모두 임베딩 완료.
    // 페이징 안전 fetch (Supabase JS default 1000 row cap 회피).
    const documentIds = new Set<string>()
    let from = 0
    const PAGE = 1000
    for (;;) {
      const { data, error } = await admin
        .from('document_chunks')
        .select('document_id')
        .range(from, from + PAGE - 1)
      assert.equal(error, null, error?.message)
      if (!data || data.length === 0) break
      for (const r of data) documentIds.add(r.document_id)
      if (data.length < PAGE) break
      from += PAGE
    }

    assert.ok(
      documentIds.size >= 535,
      `chunks가 커버하는 documents 수: ${documentIds.size} (M1 baseline 535 필요)`,
    )
  })
})
