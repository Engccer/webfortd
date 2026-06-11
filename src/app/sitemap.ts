// Phase 4 M3 PR B — Next.js 16 metadata file convention
// 빌드 시 정적 sitemap.xml 생성. D2 (전부 포함).

import type { MetadataRoute } from 'next'
import kbIndex from '@/lib/kb-index.generated.json'
import { filterLibraryItems } from '@/lib/library-catalog'
import { filterMediaItems } from '@/lib/media-curation'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://webfortd.vercel.app'

const STATIC_ROUTES: {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/chat', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/library', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/media', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/legacy/about', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/support', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/rights', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/stories', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/participate', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/resources', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/resources/policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/resources/statistics', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []

  for (const r of STATIC_ROUTES) {
    entries.push({
      url: `${BASE_URL}${r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })
  }

  // published만 노출 — draft/in_review는 위키 라우트에서 UnderReviewNotice로 게이트되므로
  // sitemap에 실어도 검색엔진에 검수 전 URL만 광고하는 꼴이 된다 (library/media 게이트와 정합).
  type AtomicDoc = { slug: string; axis: string; frontmatter?: { status?: string } }
  const atomicDocs = ((kbIndex as unknown as { documents: AtomicDoc[] }).documents ?? []).filter(
    (doc) => (doc.frontmatter?.status ?? 'draft') === 'published',
  )
  for (const doc of atomicDocs) {
    entries.push({
      url: `${BASE_URL}/${doc.axis}/${doc.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  // M3: published만 sitemap에 노출(draft 비공개). admin 컨텍스트 없는 빌드/공개 경로.
  for (const item of filterLibraryItems({})) {
    entries.push({
      url: `${BASE_URL}/library/${item.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    })
  }

  for (const item of filterMediaItems({})) {
    entries.push({
      url: `${BASE_URL}/media/${item.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    })
  }

  return entries
}
