// Phase 4 M3 PR B — Next.js 16 metadata file convention
// 빌드 시 정적 sitemap.xml 생성. D2 (전부 포함).

import type { MetadataRoute } from 'next'
import kbIndex from '@/lib/kb-index.generated.json'
import { LIBRARY_ITEMS } from '@/lib/library-catalog'
import { MEDIA_ITEMS } from '@/lib/media-curation'

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

  type AtomicDoc = { slug: string; axis: string }
  const atomicDocs = (kbIndex as unknown as { documents: AtomicDoc[] }).documents ?? []
  for (const doc of atomicDocs) {
    entries.push({
      url: `${BASE_URL}/${doc.axis}/${doc.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  for (const item of LIBRARY_ITEMS) {
    entries.push({
      url: `${BASE_URL}/library/${item.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    })
  }

  for (const item of MEDIA_ITEMS) {
    entries.push({
      url: `${BASE_URL}/media/${item.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    })
  }

  return entries
}
