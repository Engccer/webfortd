import { test } from 'node:test'
import assert from 'node:assert/strict'
import nextConfig from '../../next.config'

const redirectsExpected = [
  { source: '/wiki', destination: '/', permanent: true },
  { source: '/about', destination: '/legacy/about', permanent: true },
  { source: '/about/:path*', destination: '/legacy/about/:path*', permanent: true },
  { source: '/support', destination: '/legacy/support', permanent: true },
  { source: '/support/:path*', destination: '/legacy/support/:path*', permanent: true },
  { source: '/rights', destination: '/legacy/rights', permanent: true },
  { source: '/rights/:path*', destination: '/legacy/rights/:path*', permanent: true },
  { source: '/stories', destination: '/legacy/stories', permanent: true },
  { source: '/stories/:path*', destination: '/legacy/stories/:path*', permanent: true },
  { source: '/participate', destination: '/legacy/participate', permanent: true },
  { source: '/participate/:path*', destination: '/legacy/participate/:path*', permanent: true },
  { source: '/resources', destination: '/legacy/resources', permanent: true },
  { source: '/resources/policy', destination: '/legacy/resources/policy', permanent: true },
  { source: '/resources/policy/:path*', destination: '/legacy/resources/policy/:path*', permanent: true },
  { source: '/resources/statistics', destination: '/legacy/resources/statistics', permanent: true },
  { source: '/resources/statistics/:path*', destination: '/legacy/resources/statistics/:path*', permanent: true },
]

test('next.config redirects() — 모든 호환성 redirect 등록', async () => {
  assert.ok(typeof nextConfig.redirects === 'function', 'redirects()는 함수여야 한다')
  const redirects = await nextConfig.redirects!()
  for (const expected of redirectsExpected) {
    const found = redirects.find((r) => r.source === expected.source)
    assert.ok(found, `redirect 누락: ${expected.source}`)
    assert.equal(found.destination, expected.destination, `destination 불일치: ${expected.source}`)
    assert.equal(found.permanent, expected.permanent, `permanent 불일치: ${expected.source}`)
  }
})

test('next.config redirects() — atomic /resources/{law,research}/[slug]는 redirect 등록 안 함 (URL 보존)', async () => {
  const redirects = await nextConfig.redirects!()
  const lawSlugRedirect = redirects.find((r) => r.source === '/resources/law/:path*')
  const researchSlugRedirect = redirects.find((r) => r.source === '/resources/research/:path*')
  assert.equal(lawSlugRedirect, undefined, 'atomic /resources/law/[slug]에 redirect 등록되면 안 됨 — URL 보존')
  assert.equal(researchSlugRedirect, undefined, 'atomic /resources/research/[slug]에 redirect 등록되면 안 됨 — URL 보존')
})
