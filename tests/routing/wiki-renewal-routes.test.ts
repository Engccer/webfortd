import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

const wikiRenewalRoutes = [
  'src/app/(wiki)/library/page.tsx',
  'src/app/(wiki)/library/[slug]/page.tsx',
  'src/app/(wiki)/media/page.tsx',
  'src/app/(wiki)/media/[slug]/page.tsx',
]

const wikiRenewalComponents = [
  'src/components/library/LibraryCard.tsx',
  'src/components/library/LibrarySearch.tsx',
  'src/components/library/LibraryGrid.tsx',
  'src/components/media/MediaCard.tsx',
  'src/components/media/MediaDetail.tsx',
  'src/components/media/MediaGrid.tsx',
  'src/components/wiki/RoleEntries.tsx',
  'src/components/wiki/ChatLibraryMediaEntries.tsx',
  'src/components/kb/KbSourceFooter.tsx',
]

const seedLibraries = [
  'src/lib/wiki-role-entries.ts',
  'src/lib/library-catalog.ts',
  'src/lib/media-curation.ts',
  'src/lib/atomic-source-map.ts',
]

test('Phase 4 M2 — 위키 entry 신규 라우트 존재', () => {
  for (const route of wikiRenewalRoutes) {
    assert.ok(existsSync(join(repoRoot, route)), `M2 라우트 누락: ${route}`)
  }
})

test('Phase 4 M2 — 신규 컴포넌트 존재', () => {
  for (const comp of wikiRenewalComponents) {
    assert.ok(existsSync(join(repoRoot, comp)), `M2 컴포넌트 누락: ${comp}`)
  }
})

test('Phase 4 M2 — 시드 데이터 라이브러리 4건 존재', () => {
  for (const lib of seedLibraries) {
    assert.ok(existsSync(join(repoRoot, lib)), `M2 시드 라이브러리 누락: ${lib}`)
  }
})
