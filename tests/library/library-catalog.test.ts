import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIBRARY_ITEMS, getLibraryItemBySlug, filterLibraryItems } from '../../src/lib/library-catalog'

test('LIBRARY_ITEMS — 시드 4건 (data/source-pdf/ 정합)', () => {
  assert.equal(LIBRARY_ITEMS.length, 4)
})

test('LIBRARY_ITEMS — 모든 slug unique', () => {
  const slugs = LIBRARY_ITEMS.map((i) => i.slug)
  assert.equal(new Set(slugs).size, slugs.length)
})

test('LIBRARY_ITEMS — 모든 downloadUrl이 Supabase Storage public URL', () => {
  const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/library/`
  for (const item of LIBRARY_ITEMS) {
    assert.ok(
      item.downloadUrl.startsWith(expectedPrefix),
      `${item.slug}: downloadUrl prefix 위반 (expected ${expectedPrefix}, got ${item.downloadUrl})`,
    )
    assert.ok(
      item.downloadUrl.endsWith('.pdf'),
      `${item.slug}: .pdf 확장자 누락`,
    )
  }
})

test('getLibraryItemBySlug — 존재하는 slug 조회 성공', () => {
  const item = getLibraryItemBySlug('2023-hr-guide')
  assert.ok(item)
  assert.equal(item?.year, 2023)
})

test('getLibraryItemBySlug — 존재하지 않는 slug undefined 반환', () => {
  assert.equal(getLibraryItemBySlug('not-exists'), undefined)
})

test('filterLibraryItems — category guide만 2건', () => {
  const result = filterLibraryItems({ category: 'guide' })
  assert.equal(result.length, 2)
  assert.ok(result.every((i) => i.category === 'guide'))
})

test('filterLibraryItems — query "인사관리" 부분 매칭', () => {
  const result = filterLibraryItems({ query: '인사관리' })
  assert.equal(result.length, 1)
  assert.equal(result[0].slug, '2023-hr-guide')
})
