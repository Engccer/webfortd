/**
 * webfortd 콘텐츠 로더 (KB Loader) — M2
 *
 * sync-content.ts가 생성한 src/lib/kb-index.generated.json을 정적 import해서
 * Next.js 16 App Router의 Server Component에 콘텐츠 메타데이터를 공급한다.
 *
 * 본문(content)은 JSON에 없으므로 호출 시점에 파일에서 직접 로딩한다.
 *
 * 기존 src/lib/mdx.ts는 M2 단계에서 즉시 제거하지 않는다 — 목록 페이지가 여전히
 * getAllDocs를 사용하므로. 라우팅 [slug] 페이지만 신 로더로 전환한다.
 */

import fs from 'node:fs'
import path from 'node:path'
import { cache } from 'react'
import matter from 'gray-matter'
import type { ContentAxis, DocumentSummary, Frontmatter } from '@/types/kb'
import kbIndex from '@/lib/kb-index.generated.json'

// ---------- 타입 ----------

export interface Heading {
  level: number
  text: string
  id: string
}

export interface Backlink {
  from: string
  /** `#section` anchor — 같은 페이지 내 헤딩 또는 anchor target */
  anchor?: string
  /** `|표시명` alias — 위키링크 본문에 노출되는 사용자 정의 표시 텍스트 */
  link_text?: string
}

export interface KBDocumentSummary extends DocumentSummary {
  /** 검색 인덱스에 노출되는 본문 첫 500자 — sync-content가 채움 */
  body_excerpt: string
}

export interface DocumentFull extends KBDocumentSummary {
  content: string
  headings: Heading[]
  backlinks: Backlink[]
}

interface KBIndexShape {
  generated_at: string | null
  content_hash: string
  source_count: number
  documents: KBDocumentSummary[]
  wiki_backlinks: Record<string, Backlink[]>
  broken_wikilinks: Array<{ source: string; target: string; line: number }>
  slug_index: Record<string, string>
  wikilink_adjacency: Record<string, string[]>
}

// JSON import는 unknown 타입 — KBIndexShape로 좁힌다.
const INDEX = kbIndex as unknown as KBIndexShape

// ---------- 내부 헬퍼 ----------

const REPO_ROOT = process.cwd()

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
}

function extractHeadings(content: string): Heading[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: Heading[] = []
  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      id: slugify(match[2].trim()),
    })
  }
  return headings
}

// ---------- 조회 API ----------

export function getAllSlugs(): string[] {
  return Object.keys(INDEX.slug_index)
}

/**
 * 특정 subsection(예: 'research', 'law')에 속한 슬러그만 반환.
 * M2 단계의 임시 shim — 옵션 C 라우팅 호환. axis-only 전환 시 제거 예정.
 *
 * 위치 기반 매칭: filePath 형식이 `content/<axis>/<subsection>/<stem>.md`(4 parts)인
 * 문서에서 parts[2] === subsection인 경우만 인정. `.includes()` 부분 매칭은 false-positive
 * 위험(예: 다른 axis에 `research-based-...` 같은 디렉터리가 생기면 부적절 매치).
 *
 * @deprecated M3 라우팅 재구성 후 getDocsByFilter({ axis }) + slug 매핑으로 교체.
 */
export function getSlugsBySubsection(subsection: string): string[] {
  const out: string[] = []
  for (const [slug, filePath] of Object.entries(INDEX.slug_index)) {
    const parts = filePath.split('/')
    // content/<axis>/<subsection>/<stem>.md  → parts.length === 4
    if (parts.length === 4 && parts[2] === subsection) {
      out.push(slug)
    }
  }
  return out
}

export function getBacklinks(slug: string): Backlink[] {
  return INDEX.wiki_backlinks[slug] ?? []
}

export function getWikilinkAdjacency(): Record<string, string[]> {
  return INDEX.wikilink_adjacency
}

export interface FilterParams {
  axis?: ContentAxis
  disability_types?: string[]
  domains?: string[]
  regions?: string[]
  year?: number
  type?: string
  status?: string
}

function matchesFilter(doc: KBDocumentSummary, f: FilterParams): boolean {
  const fm = doc.frontmatter as Frontmatter
  if (f.axis && doc.axis !== f.axis) return false
  if (f.year !== undefined && fm.year !== f.year) return false
  if (f.type && fm.type !== f.type) return false
  if (f.status && fm.status !== f.status) return false
  if (f.disability_types?.length) {
    const hit = f.disability_types.some((t) => fm.disability_types.includes(t as never))
    if (!hit) return false
  }
  if (f.domains?.length) {
    const hit = f.domains.some((d) => fm.domains.includes(d as never))
    if (!hit) return false
  }
  if (f.regions?.length) {
    const hit = f.regions.some((r) => fm.regions.includes(r as never))
    if (!hit) return false
  }
  return true
}

export const getDocsByFilter = cache(
  async (filter: FilterParams = {}): Promise<KBDocumentSummary[]> => {
    return INDEX.documents.filter((d) => matchesFilter(d, filter))
  },
)

/**
 * slug 하나로 문서 전체 로딩 (메타 + 본문 + 헤딩 + 백링크).
 */
export const getKBDocBySlug = cache(
  async (slug: string): Promise<DocumentFull | null> => {
    const filePath = INDEX.slug_index[slug]
    if (!filePath) return null

    const absPath = path.join(REPO_ROOT, filePath)
    if (!fs.existsSync(absPath)) return null

    const summary = INDEX.documents.find((d) => d.slug === slug)
    if (!summary) return null

    const fileContent = fs.readFileSync(absPath, 'utf-8')
    const { content } = matter(fileContent)
    const headings = extractHeadings(content)
    const backlinks = getBacklinks(slug)

    return {
      ...summary,
      content,
      headings,
      backlinks,
    }
  },
)

/**
 * 라우팅 호환 어댑터 — 기존 mdx.ts의 (section, subsection, slug) 시그니처를
 * slug 단일로 변환. M2 단계에서 라우팅 코드 diff를 최소화하기 위함.
 * section/subsection은 무시하고 slug로만 조회한다.
 */
export const getKBDocBySlugCompat = cache(
  async (
    _section: string,
    _subsection: string,
    slug: string,
  ): Promise<DocumentFull | null> => {
    return getKBDocBySlug(slug)
  },
)

/**
 * generateStaticParams 보조. 특정 subsection 슬러그만 반환하여 라우팅의
 * 정적 경로를 그대로 유지한다.
 */
export function getStaticParamsForSubsection(subsection: string): Array<{ slug: string }> {
  return getSlugsBySubsection(subsection).map((slug) => ({ slug }))
}

/**
 * axis-only 라우팅용 슬러그 조회 — M3에서 도입.
 * filePath가 `content/<axis>/<slug>.md` 형태(3 parts)인 문서만 반환.
 * resources 같은 nested 구조(4 parts)는 의도적으로 제외 — 기존 라우트가 처리.
 */
export function getSlugsByAxis(axis: ContentAxis): string[] {
  const out: string[] = []
  for (const [slug, filePath] of Object.entries(INDEX.slug_index)) {
    const parts = filePath.split('/')
    if (parts.length === 3 && parts[1] === axis) {
      out.push(slug)
    }
  }
  return out
}

export function getStaticParamsForAxis(axis: ContentAxis): Array<{ slug: string }> {
  return getSlugsByAxis(axis).map((slug) => ({ slug }))
}
