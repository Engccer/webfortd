import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateKeyKST, pickDailyDocs, hrefForDoc } from '../../src/lib/wiki-daily'

// ── dateKeyKST ──────────────────────────────────────────────
// 서버(UTC)에서 렌더되더라도 "오늘"은 한국 시간 기준이어야 한다.

test('dateKeyKST — KST 자정 경계: UTC 15:30Z는 다음 날 KST', () => {
  // 2026-06-20T15:30:00Z = 2026-06-21 00:30 KST → 한국에선 이미 21일
  assert.equal(dateKeyKST(new Date('2026-06-20T15:30:00Z')), '2026-06-21')
})

test('dateKeyKST — 같은 KST 날짜는 시각이 달라도 동일 키', () => {
  const a = dateKeyKST(new Date('2026-06-20T00:00:00Z')) // KST 09:00
  const b = dateKeyKST(new Date('2026-06-20T14:59:00Z')) // KST 23:59
  assert.equal(a, '2026-06-20')
  assert.equal(b, '2026-06-20')
})

// ── pickDailyDocs ───────────────────────────────────────────

const SAMPLE = Array.from({ length: 50 }, (_, i) => `doc-${i}`)

test('pickDailyDocs — 같은 날짜 키는 항상 같은 결과 (결정적)', () => {
  const a = pickDailyDocs(SAMPLE, '2026-06-20', 5)
  const b = pickDailyDocs(SAMPLE, '2026-06-20', 5)
  assert.deepEqual(a, b)
})

test('pickDailyDocs — count개를 반환 (항목이 충분할 때)', () => {
  assert.equal(pickDailyDocs(SAMPLE, '2026-06-20', 5).length, 5)
})

test('pickDailyDocs — 반환 항목은 원본의 부분집합이고 중복 없음', () => {
  const picked = pickDailyDocs(SAMPLE, '2026-06-20', 5)
  assert.equal(new Set(picked).size, picked.length)
  for (const p of picked) assert.ok(SAMPLE.includes(p))
})

test('pickDailyDocs — 항목이 count보다 적으면 전부 반환', () => {
  const few = ['a', 'b', 'c']
  const picked = pickDailyDocs(few, '2026-06-20', 5)
  assert.equal(picked.length, 3)
  assert.deepEqual([...picked].sort(), ['a', 'b', 'c'])
})

test('pickDailyDocs — 빈 배열은 빈 배열', () => {
  assert.deepEqual(pickDailyDocs([], '2026-06-20', 5), [])
})

test('pickDailyDocs — 원본 배열을 변형하지 않는다 (non-mutating)', () => {
  const original = [...SAMPLE]
  pickDailyDocs(SAMPLE, '2026-06-20', 5)
  assert.deepEqual(SAMPLE, original)
})

test('pickDailyDocs — 날짜가 바뀌면 선택도 바뀐다 (매일 갱신)', () => {
  // 인접한 며칠을 비교해 적어도 하나는 다른 선택이 나와야 한다.
  const base = pickDailyDocs(SAMPLE, '2026-06-20', 5).join(',')
  const days = ['2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24']
  const anyDifferent = days.some(
    (d) => pickDailyDocs(SAMPLE, d, 5).join(',') !== base,
  )
  assert.ok(anyDifferent, '인접 날짜에서 모두 동일한 선택이 나오면 갱신 효과 없음')
})

// ── hrefForDoc ──────────────────────────────────────────────
// 함수 번들 NFT 폭증(PR #81)을 피하려 retrieval.ts를 import하지 않고
// 경량 헬퍼로 href를 생성한다. content/<axis>/<sub>?/<slug>.md 규칙.

test('hrefForDoc — content/<axis>/<slug>.md → /<axis>/<slug>', () => {
  assert.equal(
    hrefForDoc({ filePath: 'content/policies/foo-2024.md', axis: 'policies', slug: 'foo-2024' }),
    '/policies/foo-2024',
  )
})

test('hrefForDoc — 중첩(content/<axis>/<sub>/<slug>.md) → /<axis>/<sub>/<slug>', () => {
  assert.equal(
    hrefForDoc({
      filePath: 'content/resources/law/hr-guide.md',
      axis: 'resources',
      slug: 'hr-guide',
    }),
    '/resources/law/hr-guide',
  )
})

test('hrefForDoc — filePath가 비정상이면 axis/slug 폴백', () => {
  assert.equal(
    hrefForDoc({ filePath: '', axis: 'domains', slug: 'bar' }),
    '/domains/bar',
  )
})
