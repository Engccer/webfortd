/**
 * Phase 3 M2 — RAG retrieval smoke 테스트 (실 Supabase + Gemini API).
 *
 * 전제:
 *   - 0006 마이그레이션 push 완료 (Task 10)
 *   - 1606+ 청크 임베딩 존재 (M1 이후 Task 1 split로 2766개)
 *   - .env.local 에 SUPABASE_SECRET_KEY + GOOGLE_GENERATIVE_AI_API_KEY
 *
 * 분류: 명시 RUN_SMOKE=1 실행. 일반 `npm test` 에서는 skip되어 실 API 비용·플레이키 차단.
 *
 * 실행: `RUN_SMOKE=1 npm test -- --test-name-pattern="rag/smoke"`
 *
 * 검증:
 *   - retrieveChunks('편의지원 신청', {topK: 5}) → 5건 미만일 수 있으나 ≥1건
 *   - 최상위 청크 similarity >= 0.3 (의미 있는 매칭)
 *   - sources.length <= chunks.length (slug dedup 작동)
 *   - 모든 chunks의 documentAxis 가 6 axes 중 하나
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'
import { retrieveChunks } from '../../src/lib/rag/retrieval.ts'

// .env.local을 명시 RUN 전에 미리 로드 (env 가드 체크에 영향)
loadDotEnvLocalOverrides()

const skipReason =
  process.env.RUN_SMOKE !== '1'
    ? 'RUN_SMOKE=1 미설정 — smoke은 명시 실행 필요 (예: RUN_SMOKE=1 npm test -- --test-name-pattern="rag/smoke")'
    : (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY || !process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      ? 'env 미설정 (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY + GOOGLE_GENERATIVE_AI_API_KEY 필요)'
      : false

describe('rag/smoke — retrieveChunks 실 API', { skip: skipReason }, () => {
  test('편의지원 신청 질의 — top-5 청크 반환 + similarity 합리적', async () => {
    const result = await retrieveChunks('편의지원 신청 절차가 어떻게 되나요', {
      topK: 5,
    })

    assert.ok(result.chunks.length >= 1, '최소 1건 이상 반환되어야 함')
    assert.ok(result.chunks.length <= 5, 'topK=5 cap')

    // 최상위 similarity 합리적 (zero-vector 대비 의미 있는 점수)
    const top = result.chunks[0]
    assert.ok(
      top.similarity >= 0.3,
      `top similarity 너무 낮음: ${top.similarity.toFixed(3)} (질의: 편의지원 신청)`,
    )

    // sources dedup 작동 (slug 중복 없음)
    const slugSet = new Set(result.sources.map((s) => s.slug))
    assert.equal(slugSet.size, result.sources.length, 'slug 중복')
    assert.ok(result.sources.length <= result.chunks.length)

    // documentSlug + documentAxis 형식 검증
    for (const c of result.chunks) {
      assert.ok(c.documentSlug.length > 0, 'documentSlug 비어 있음')
      assert.ok(
        ['policies', 'disability-types', 'agreements', 'domains', 'regions', 'resources'].includes(c.documentAxis),
        `예상 외 axis: ${c.documentAxis}`,
      )
    }
  })

  test('topK=1 — 정확히 1건', async () => {
    const result = await retrieveChunks('장애인교원의 권리', { topK: 1 })
    assert.equal(result.chunks.length, 1, 'topK=1이면 정확히 1건')
    assert.equal(result.sources.length, 1, 'sources도 정확히 1건')
  })

  test('의도적으로 무관한 질의 — minSimilarity 필터링', async () => {
    const result = await retrieveChunks('지구는 둥글다', {
      topK: 5,
      minSimilarity: 0.7,  // 매우 높은 임계
    })
    // 0건이 정상일 수 있고 1~2건도 정상 (cosine similarity는 의미적 거리)
    assert.ok(result.chunks.length <= 5, `topK=5 cap 위반: ${result.chunks.length}`)
    // 모든 반환 청크는 minSimilarity >= 0.7 을 통과해야 함
    for (const c of result.chunks) {
      assert.ok(c.similarity >= 0.7, `minSimilarity 필터 위반: ${c.similarity}`)
    }
  })
})
