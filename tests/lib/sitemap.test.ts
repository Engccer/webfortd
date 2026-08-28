import { test } from 'node:test'
import assert from 'node:assert/strict'
import sitemap from '../../src/app/sitemap'

// 2026-08-29 3층 재생성으로 4종 파생 페이지는 2차 검증 전까지 draft(사이트맵 제외).
// published = 단체협약 49 + resources + 정적 라우트. kb:bootstrap 일괄 공개 후 임계값을 다시 올린다.
test('sitemap — total URL count ≥ 60', async () => {
  const urls = await sitemap()
  assert.ok(urls.length >= 60, `expected ≥60, got ${urls.length}`)
})

test('sitemap — 각 entry는 url + lastModified 필드 보유', async () => {
  const urls = await sitemap()
  for (const u of urls.slice(0, 10)) {
    assert.ok(u.url, 'url 누락')
    assert.ok(u.lastModified, 'lastModified 누락')
    assert.match(u.url, /^https?:\/\//, `절대 URL 아님: ${u.url}`)
  }
})

test('sitemap — 정적 라우트 (wiki entry, library, media) 포함', async () => {
  const urls = await sitemap()
  const set = new Set(urls.map((u) => u.url))
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://webfortd.vercel.app'
  for (const path of ['/', '/chat', '/library', '/media']) {
    assert.ok(set.has(`${baseUrl}${path}`), `누락: ${path}`)
  }
})

test('sitemap — atomic(단체협약 포함) 40건 이상 포함', async () => {
  const urls = await sitemap()
  const atomicCount = urls.filter((u) =>
    /\/(disability-types|policies|agreements|domains|regions|uncategorized)\//.test(u.url),
  ).length
  assert.ok(atomicCount >= 40, `atomic ≥40 기대, ${atomicCount}건`)
})
