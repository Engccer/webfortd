import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

const atomicRoutes = [
  // 축별 [slug] 라우트 9개는 Vercel Hobby 함수 12개 제한 대응으로 단일 catch-all에 통합
  // (URL 불변). 축 인덱스 페이지는 그대로 개별 라우트.
  'src/app/(wiki)/[...kb]/page.tsx',
  'src/app/(wiki)/disability-types/page.tsx',
  'src/app/(wiki)/policies/page.tsx',
  'src/app/(wiki)/agreements/page.tsx',
  'src/app/(wiki)/domains/page.tsx',
  'src/app/(wiki)/regions/page.tsx',
  'src/app/(wiki)/faq/page.tsx',
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
  // 축별 [slug] 라우트 — [...kb] catch-all로 통합되며 제거 (Hobby 함수 제한 대응)
  'src/app/(wiki)/disability-types/[slug]/page.tsx',
  'src/app/(wiki)/policies/[slug]/page.tsx',
  'src/app/(wiki)/agreements/[slug]/page.tsx',
  'src/app/(wiki)/domains/[slug]/page.tsx',
  'src/app/(wiki)/regions/[slug]/page.tsx',
  'src/app/(wiki)/faq/[slug]/page.tsx',
  'src/app/(wiki)/uncategorized/[slug]/page.tsx',
  'src/app/(wiki)/resources/law/[slug]/page.tsx',
  'src/app/(wiki)/resources/research/[slug]/page.tsx',
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
