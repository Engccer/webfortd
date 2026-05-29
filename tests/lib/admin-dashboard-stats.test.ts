/**
 * webfortd Phase A — dashboard-stats 단위 테스트
 *
 * kb-index.generated.json 형식의 fixture를 사용한 순수 함수 테스트.
 * DB 조회는 별도 (페이지 렌더링 시점에 server-side).
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeStatusCounts,
  computeAxisDistribution,
  computeReviewQueue,
} from '../../src/lib/admin/dashboard-stats.ts'

const fixtures = [
  { slug: 'a', axis: 'policies', frontmatter: { status: 'draft', reviewed_by: [] } },
  { slug: 'b', axis: 'policies', frontmatter: { status: 'published', reviewed_by: ['위원장'] } },
  { slug: 'c', axis: 'agreements', frontmatter: { status: 'draft', reviewed_by: [] } },
  { slug: 'd', axis: 'regions', frontmatter: { status: 'archived', reviewed_by: ['admin'] } },
  { slug: 'e', axis: 'policies', frontmatter: { status: 'in_review', reviewed_by: ['reviewer1'] } },
  { slug: 'f', axis: 'domains', frontmatter: { status: 'draft', reviewed_by: ['이미 검토됨'] } },
] as never[]

describe('computeStatusCounts', () => {
  test('counts 5 status keys correctly, 알수없는 status는 무시', () => {
    const counts = computeStatusCounts(fixtures)
    assert.strictEqual(counts.draft, 3)
    assert.strictEqual(counts.published, 1)
    assert.strictEqual(counts.archived, 1)
    assert.strictEqual(counts.in_review, 1)
    assert.strictEqual(counts.deprecated, 0)
  })

  test('빈 입력 → 모두 0', () => {
    const counts = computeStatusCounts([])
    assert.strictEqual(counts.draft, 0)
    assert.strictEqual(counts.published, 0)
    assert.strictEqual(counts.in_review, 0)
    assert.strictEqual(counts.archived, 0)
    assert.strictEqual(counts.deprecated, 0)
  })
})

describe('computeAxisDistribution', () => {
  test('axis별 카운트 그룹화', () => {
    const dist = computeAxisDistribution(fixtures)
    assert.strictEqual(dist.policies, 3)
    assert.strictEqual(dist.agreements, 1)
    assert.strictEqual(dist.regions, 1)
    assert.strictEqual(dist.domains, 1)
  })
})

describe('computeReviewQueue', () => {
  test('reviewed_by 비어있는 draft만 큐에 포함', () => {
    const queue = computeReviewQueue(fixtures)
    // f는 reviewed_by에 값이 있으므로 제외, b/d는 draft 아니므로 제외
    assert.strictEqual(queue.length, 2)
    assert.deepStrictEqual(
      queue.map((d) => d.slug).sort(),
      ['a', 'c'],
    )
  })

  test('큐 항목은 slug/axis/status를 보존', () => {
    const queue = computeReviewQueue(fixtures)
    const a = queue.find((d) => d.slug === 'a')!
    assert.strictEqual(a.axis, 'policies')
    assert.strictEqual(a.status, 'draft')
  })
})
