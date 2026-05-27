import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

const atomicRoutes = [
  'src/app/(wiki)/disability-types/[slug]/page.tsx',
  'src/app/(wiki)/policies/[slug]/page.tsx',
  'src/app/(wiki)/agreements/[slug]/page.tsx',
  'src/app/(wiki)/domains/[slug]/page.tsx',
  'src/app/(wiki)/regions/[slug]/page.tsx',
  'src/app/(wiki)/uncategorized/[slug]/page.tsx',
  'src/app/(wiki)/resources/law/[slug]/page.tsx',
  'src/app/(wiki)/resources/research/[slug]/page.tsx',
]

const legacyRoutes = [
  'src/app/(gov)/legacy/page.tsx',
  'src/app/(gov)/legacy/about/page.tsx',
  'src/app/(gov)/legacy/resources/page.tsx',
  'src/app/(gov)/legacy/resources/law-guide/page.tsx',
  'src/app/(gov)/legacy/resources/research-guide/page.tsx',
]

const removedRoutes = [
  'src/app/disability-types/[slug]/page.tsx', // (wiki)로 이동
  'src/app/policies/[slug]/page.tsx',
  'src/app/(gov)/page.tsx', // /legacy/page.tsx로 이동
  'src/app/(gov)/about/page.tsx',
  'src/app/(gov)/resources/law/[slug]/page.tsx', // (wiki)로 이동
  'src/app/(wiki)/wiki/page.tsx', // 삭제 (/ root로 승격)
]

test('atomic 라우트 — (wiki) 그룹 안에 위치', () => {
  for (const route of atomicRoutes) {
    assert.ok(existsSync(join(repoRoot, route)), `atomic 라우트 누락: ${route}`)
  }
})

test('legacy 라우트 — (gov)/legacy 안에 위치', () => {
  for (const route of legacyRoutes) {
    assert.ok(existsSync(join(repoRoot, route)), `legacy 라우트 누락: ${route}`)
  }
})

test('이동된 라우트 — 옛 경로에서 사라짐', () => {
  for (const route of removedRoutes) {
    assert.ok(!existsSync(join(repoRoot, route)), `옛 경로가 아직 남아 있음 (M1 mv 누락): ${route}`)
  }
})
