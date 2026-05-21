import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateGuards,
  buildReport,
  formatReport,
  type DocumentRow,
} from '../scripts/publish-content.ts'
import { parseDocumentRow } from '../scripts/lib/parse-document-row.ts'

// 가드 평가 fixture — DocumentRow interface와 정확히 match.
// reviewed_by(string[]|null), source(Record|null), embedded_media(unknown[]|null),
// accessibility(Record|null) 시그니처 준수.
const baseDoc: DocumentRow = {
  id: 'id-1',
  slug: 'slug-1',
  status: 'draft',
  reviewed_by: ['김헌용'],
  source: { type: 'policy', url: 'https://example.com' },
  embedded_media: [],
  accessibility: { alt_text_complete: false },
}

describe('evaluateGuards', () => {
  test('모든 게이트 통과 → passed=true', () => {
    const r = evaluateGuards(baseDoc)
    assert.equal(r.passed, true)
    assert.deepEqual(r.failures, [])
  })

  test('reviewed_by 누락 → failures에 포함', () => {
    const r = evaluateGuards({ ...baseDoc, reviewed_by: [] })
    assert.equal(r.passed, false)
    assert.ok(r.failures.some((f) => f.includes('reviewed_by')))
  })

  test('source 누락 → failures에 포함', () => {
    const r = evaluateGuards({ ...baseDoc, source: null })
    assert.equal(r.passed, false)
    assert.ok(r.failures.some((f) => f.includes('source')))
  })

  test('embedded_media 있고 alt_text_complete=false → failures', () => {
    const r = evaluateGuards({
      ...baseDoc,
      embedded_media: [{ src: '/img.png', alt: 'foo' }],
      accessibility: { alt_text_complete: false },
    })
    assert.equal(r.passed, false)
    assert.ok(r.failures.some((f) => f.includes('alt_text_complete')))
  })

  test('embedded_media 있고 alt_text_complete=true → 통과', () => {
    const r = evaluateGuards({
      ...baseDoc,
      embedded_media: [{ src: '/img.png', alt: 'foo' }],
      accessibility: { alt_text_complete: true },
    })
    assert.equal(r.passed, true)
  })

  test('embedded_media 비어 있으면 alt_text_complete 면제', () => {
    const r = evaluateGuards({
      ...baseDoc,
      embedded_media: [],
      accessibility: { alt_text_complete: false },
    })
    assert.equal(r.passed, true)
  })

  test('복수 게이트 fail → failures 배열 길이 >= 2', () => {
    const r = evaluateGuards({
      ...baseDoc,
      reviewed_by: [],
      source: null,
    })
    assert.equal(r.passed, false)
    assert.ok(r.failures.length >= 2)
  })
})

describe('buildReport', () => {
  test('total = docs.length, passing + blocked = total', () => {
    const docs: DocumentRow[] = [
      {
        id: '1',
        slug: 's1',
        status: 'draft',
        reviewed_by: ['a'],
        source: { x: 1 },
        embedded_media: [],
        accessibility: {},
      },
      {
        id: '2',
        slug: 's2',
        status: 'draft',
        reviewed_by: [],
        source: { x: 1 },
        embedded_media: [],
        accessibility: {},
      },
    ]
    const r = buildReport(docs)
    assert.equal(r.total, 2)
    assert.equal(r.passing.length, 1)
    assert.equal(r.blocked.length, 1)
    assert.equal(r.passing[0].slug, 's1')
    assert.equal(r.blocked[0].slug, 's2')
  })
})

describe('formatReport', () => {
  test('dry-run 메시지 포함', () => {
    const r = {
      total: 1,
      passing: [],
      blocked: [{ id: '1', slug: 's1', failures: ['reviewed_by 누락'] }],
    }
    const out = formatReport(r, false)
    assert.match(out, /dry-run 종료/)
    assert.match(out, /--apply/)
  })

  test('apply 시 전환 메시지 포함', () => {
    const r = { total: 1, passing: [{ id: '1', slug: 's1' }], blocked: [] }
    const out = formatReport(r, true)
    assert.match(out, /1 pages 전환 완료/)
  })

  // C1 fix 회귀 차단 — `kb:publish:dry-run -- --apply` 같은 실수 패턴이
  // production 변경을 일으키지 않도록 Mode 헤더가 보고서 상단에 명시되어야 함.
  // formatReport(report, applied) → applied=false면 DRY-RUN, true면 APPLY.
  test('Mode 헤더가 보고서 상단에 명시 (C1 fix 회귀 차단)', () => {
    const r = { total: 1, passing: [], blocked: [] }
    const outDry = formatReport(r, false)
    const outApply = formatReport(r, true)
    assert.match(outDry, /Mode: DRY-RUN/)
    assert.match(outApply, /Mode: APPLY/)
  })
})

// 0003 hotfix Task C — runtime parser shape 검증.
describe('parseDocumentRow', () => {
  test('정상 shape → 그대로 반환', () => {
    const raw = {
      id: 'i',
      slug: 's',
      status: 'draft',
      reviewed_by: ['a'],
      source: { x: 1 },
      embedded_media: [],
      accessibility: { alt: true },
    }
    const out = parseDocumentRow(raw)
    assert.equal(out.id, 'i')
    assert.deepEqual(out.reviewed_by, ['a'])
  })

  test('null 입력 → TypeError', () => {
    assert.throws(() => parseDocumentRow(null), TypeError)
  })

  test('id missing → TypeError', () => {
    const raw = {
      slug: 's',
      status: 'draft',
      reviewed_by: [],
      source: null,
      embedded_media: null,
      accessibility: null,
    }
    assert.throws(() => parseDocumentRow(raw), /id missing/)
  })

  test('reviewed_by가 string이면 TypeError', () => {
    const raw = {
      id: 'i',
      slug: 's',
      status: 'draft',
      reviewed_by: 'wrong',
      source: null,
      embedded_media: null,
      accessibility: null,
    }
    assert.throws(() => parseDocumentRow(raw), /reviewed_by/)
  })
})
