import { test } from 'node:test'
import assert from 'node:assert/strict'
import sitemap from '../../src/app/sitemap'

test('sitemap — total URL count ≥ 540', async () => {
  const urls = await sitemap()
  assert.ok(urls.length >= 540, `expected ≥540, got ${urls.length}`)
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

test('sitemap — atomic 500건 이상 포함', async () => {
  const urls = await sitemap()
  const atomicCount = urls.filter((u) =>
    /\/(disability-types|policies|agreements|domains|regions|uncategorized)\//.test(u.url),
  ).length
  assert.ok(atomicCount >= 500, `atomic ≥500 기대, ${atomicCount}건`)
})
