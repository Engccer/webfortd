import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterLibraryItems, LIBRARY_ITEMS } from '@/lib/library-catalog.ts'
import { filterMediaItems, MEDIA_ITEMS } from '@/lib/media-curation.ts'

describe('filterLibraryItems — includeUnpublished 분기', () => {
  it('기본(includeUnpublished 미지정) → draft 제외, published/미표기 노출', () => {
    const out = filterLibraryItems({})
    assert.equal(out.length, LIBRARY_ITEMS.length)
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
    const out = filterMediaItems({})
    assert.equal(out.length, MEDIA_ITEMS.length)
  })

  it('includeUnpublished=false → 명시적 draft 제외', () => {
    const out = filterMediaItems({ includeUnpublished: false })
    assert.ok(out.every((i) => i.status !== 'draft'))
  })
})
