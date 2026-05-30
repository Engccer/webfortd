import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterLibraryItems, LIBRARY_ITEMS } from '@/lib/library-catalog.ts'
import { filterMediaItems, MEDIA_ITEMS } from '@/lib/media-curation.ts'
import { isCatalogItemVisible } from '@/lib/catalog-visibility.ts'

describe('filterLibraryItems — includeUnpublished 분기', () => {
  it('기본(includeUnpublished 미지정) → draft 제외, published/미표기 노출', () => {
    // 현 seed에 draft 0건 → 전부 노출. draftCount 차감으로 게이트 추가 시에도 정합.
    const draftCount = LIBRARY_ITEMS.filter((i) => i.status === 'draft').length
    const out = filterLibraryItems({})
    assert.equal(out.length, LIBRARY_ITEMS.length - draftCount)
    assert.ok(out.every((i) => i.status !== 'draft'))
  })

  it('includeUnpublished=false → 명시적 draft 제외', () => {
    const out = filterLibraryItems({ includeUnpublished: false })
    assert.ok(out.every((i) => i.status !== 'draft'))
  })

  it('includeUnpublished=true → draft 포함(전체)', () => {
    const out = filterLibraryItems({ includeUnpublished: true })
    assert.equal(out.length, LIBRARY_ITEMS.length)
  })
})

describe('filterMediaItems — includeUnpublished 분기', () => {
  it('기본 → draft 제외, 미표기 노출', () => {
    const draftCount = MEDIA_ITEMS.filter((i) => i.status === 'draft').length
    const out = filterMediaItems({})
    assert.equal(out.length, MEDIA_ITEMS.length - draftCount)
    assert.ok(out.every((i) => i.status !== 'draft'))
  })

  it('includeUnpublished=false → 명시적 draft 제외', () => {
    const out = filterMediaItems({ includeUnpublished: false })
    assert.ok(out.every((i) => i.status !== 'draft'))
  })
})

// coderabbit P2: 현 production seed에 draft fixture가 없어 filter 테스트가 draft 제외
// 분기를 vacuously 통과한다. filter는 모듈 전역 배열을 닫으므로(테스트가 draft 항목을
// 주입 불가), 게이트 핵심 로직 isCatalogItemVisible을 draft 입력으로 직접 강검증해
// "게이트가 no-op이 아님"을 보장한다. filter 결과의 draft 제외는 위 length 단언과 합쳐
// 회귀를 막는다.
describe('isCatalogItemVisible — draft 제외 분기 직접 검증 (게이트 no-op 방지)', () => {
  it("status 'draft' + 비-admin → 숨김(false)", () => {
    assert.equal(isCatalogItemVisible('draft', false), false)
  })

  it("status 'draft' + admin → 노출(true)", () => {
    assert.equal(isCatalogItemVisible('draft', true), true)
  })

  it('draft 항목이 주입되면 filter가 실제로 제외함 (로직 시뮬레이션)', () => {
    // filterX는 전역 배열을 닫으므로 fixture 주입 불가 → filter의 술어와 동일한
    // isCatalogItemVisible 게이트를 draft 샘플 배열에 적용해 제외 동작을 증명.
    const sample = [
      { slug: 'pub', status: undefined },
      { slug: 'explicit-pub', status: 'published' as const },
      { slug: 'draft-1', status: 'draft' as const },
    ]
    const visibleForAnon = sample.filter((i) => isCatalogItemVisible(i.status, false))
    assert.deepEqual(visibleForAnon.map((i) => i.slug), ['pub', 'explicit-pub'])
    const visibleForAdmin = sample.filter((i) => isCatalogItemVisible(i.status, true))
    assert.deepEqual(visibleForAdmin.map((i) => i.slug), ['pub', 'explicit-pub', 'draft-1'])
  })
})
