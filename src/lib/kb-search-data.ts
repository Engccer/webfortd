/**
 * 검색 인덱스용 데이터 어댑터 — M2
 *
 * kb-index.generated.json의 documents 배열에서 검색 인덱스에 필요한 필드만
 * 추출한 SearchDoc 배열을 빌드한다. Client component에서 직접 import해 사용.
 *
 * 라우팅 href 매핑은 옵션 C 라우팅(M2): content/<axis>/<subsection>?/<slug>.md
 * 구조에 따라 /<axis>/<subsection>/<slug> 또는 /<axis>/<slug>.
 */

import kbIndex from '@/lib/kb-index.generated.json'

export interface SearchDoc {
  slug: string
  title: string
  subtitle?: string
  axis: string
  body_excerpt: string
  domains: string[]
  disability_types: string[]
  href: string
}

interface RawDoc {
  slug: string
  axis: string
  filePath: string
  body_excerpt: string
  frontmatter: {
    title: string
    subtitle?: string
    description?: string
    domains?: string[]
    disability_types?: string[]
  }
}

function hrefForFilePath(filePath: string, slug: string, axis: string): string {
  const parts = filePath.split('/')
  // content/<axis>/<subsection>/<slug>.md  → 4 parts
  // content/<axis>/<slug>.md               → 3 parts
  if (parts.length === 4) {
    return `/${parts[1]}/${parts[2]}/${slug}`
  }
  if (parts.length === 3) {
    return `/${parts[1]}/${slug}`
  }
  return `/${axis}/${slug}`
}

export function getSearchDocs(): SearchDoc[] {
  const raw = (kbIndex as unknown as { documents: RawDoc[] }).documents
  return raw.map((d) => ({
    slug: d.slug,
    title: d.frontmatter.title,
    subtitle: d.frontmatter.subtitle ?? d.frontmatter.description,
    axis: d.axis,
    body_excerpt: d.body_excerpt,
    domains: d.frontmatter.domains ?? [],
    disability_types: d.frontmatter.disability_types ?? [],
    href: hrefForFilePath(d.filePath, d.slug, d.axis),
  }))
}
