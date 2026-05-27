import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MEDIA_ITEMS, getMediaItemBySlug, filterMediaItems } from '../../src/lib/media-curation'

const repoRoot = process.cwd()

test('MEDIA_ITEMS — 시드 1건 이상 (최소 baseline)', () => {
  assert.ok(MEDIA_ITEMS.length >= 1)
})

test('MEDIA_ITEMS — 모든 slug unique', () => {
  const slugs = MEDIA_ITEMS.map((i) => i.slug)
  assert.equal(new Set(slugs).size, slugs.length)
})

test('MEDIA_ITEMS — imagePath public/source-images 존재 검증', () => {
  for (const item of MEDIA_ITEMS) {
    const fullPath = join(repoRoot, 'public', item.imagePath.replace(/^\//, ''))
    assert.ok(existsSync(fullPath), `${item.slug}: imagePath 누락 ${item.imagePath}`)
  }
})

test('MEDIA_ITEMS — 모든 alt 50자 이상 (의미 있는 설명 보장)', () => {
  for (const item of MEDIA_ITEMS) {
    assert.ok(item.alt.length >= 50, `${item.slug}: alt 너무 짧음 (${item.alt.length}자)`)
  }
})

test('getMediaItemBySlug — 존재하는 slug 조회', () => {
  const item = getMediaItemBySlug('2024-staff-p-023-seat-assignment-flow')
  assert.ok(item)
})

test('filterMediaItems — axis disability-types 1건 이상', () => {
  const result = filterMediaItems({ axis: 'disability-types' })
  assert.ok(result.length >= 1)
})
