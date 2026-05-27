import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOURCE_MAP, getSourceDownload } from '../../src/lib/atomic-source-map'
import { LIBRARY_ITEMS } from '../../src/lib/library-catalog'

test('SOURCE_MAP — 모든 libraryItemSlug가 LIBRARY_ITEMS에 존재', () => {
  for (const entry of SOURCE_MAP) {
    const found = LIBRARY_ITEMS.find((i) => i.slug === entry.libraryItemSlug)
    assert.ok(found, `${entry.origin} → ${entry.libraryItemSlug}: library-catalog에 미존재`)
  }
})

test('getSourceDownload — 매핑된 origin 정상 반환', () => {
  const result = getSourceDownload('2024-jbu-work-support-guide')
  assert.ok(result)
  assert.equal(result?.url, '/library/2024-jbu-work-support-guide.pdf')
  assert.ok(result?.title.includes('중부대'))
})

test('getSourceDownload — undefined origin → undefined', () => {
  assert.equal(getSourceDownload(undefined), undefined)
})

test('getSourceDownload — 미매핑 origin → undefined (graceful)', () => {
  assert.equal(getSourceDownload('not-mapped-origin'), undefined)
})
