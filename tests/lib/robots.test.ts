import { test } from 'node:test'
import assert from 'node:assert/strict'
import robots from '../../src/app/robots'

test('robots — User-agent: * Allow: /', () => {
  const r = robots()
  const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
  assert.equal(rule.userAgent, '*')
  assert.equal(rule.allow, '/')
})

test('robots — Sitemap 참조 포함', () => {
  const r = robots()
  assert.ok(r.sitemap, 'sitemap 필드 누락')
  const sitemapUrl = Array.isArray(r.sitemap) ? r.sitemap[0] : r.sitemap
  assert.match(sitemapUrl, /sitemap\.xml$/)
})
