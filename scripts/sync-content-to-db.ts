/**
 * webfortd Phase 2 M2 — 빌드 인덱스 → Supabase 동기화 스크립트
 *
 * scripts/sync-content.ts가 생성한 kb-index.generated.json + 마크다운 정본을 입력으로
 * 받아 documents/wiki_backlinks 테이블을 idempotent 동기화한다.
 *
 * 본 파일은 *Task 2 범위*만 포함한다:
 *   - transformDocumentRow (frontmatter → row 객체)
 *   - loadBody (frontmatter 분리 후 본문 로딩)
 *   - extractWikiLinks / extractEmbeddedMedia (module-private 헬퍼)
 *
 * 후속 Task에서 upsert / backlinks sync / CLI main이 추가된다.
 */

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { KBDocumentSummary } from '@/lib/kb'

const REPO_ROOT = process.cwd()

/**
 * Supabase `documents` 테이블 row 객체 형태.
 *
 * D2: frontmatter의 `references`는 SQL reserved word라 컬럼명 `references_data`로 rename.
 * D1: `status`는 sync 시점에 모두 'draft' 강제 (M5 검수 자동화에서 published 전환).
 */
export interface DocumentRow {
  slug: string
  title: string
  subtitle: string | null
  type: string
  disability_types: string[]
  domains: string[]
  regions: string[]
  year: number
  effective_date: string | null
  source: Record<string, unknown>
  references_data: unknown[]
  status: 'draft' | 'in_review' | 'published' | 'archived' | 'deprecated'
  authors: string[]
  reviewed_by: string[]
  reviewer_notes: string | null
  accessibility: Record<string, unknown>
  content_md: string
  source_path: string
  wiki_links: string[]
  embedded_media: unknown[]
  parent_headings: string[]
  source_origin: string | null
  axis: string
}

/**
 * frontmatter + 본문을 documents 테이블 row 객체로 변환한다.
 *
 * - D1: status는 입력 frontmatter 값을 무시하고 'draft'로 강제.
 * - D2: `references` → `references_data` 컬럼명 rename. row 객체에 `references` 키 *없음*.
 */
export function transformDocumentRow(
  doc: KBDocumentSummary,
  contentMd: string,
): DocumentRow {
  const fm = doc.frontmatter
  return {
    slug: doc.slug,
    title: fm.title,
    subtitle: fm.subtitle ?? null,
    type: fm.type,
    disability_types: fm.disability_types ?? [],
    domains: fm.domains ?? [],
    regions: fm.regions ?? [],
    year: fm.year,
    effective_date: fm.effective_date ?? null,
    source: fm.source as Record<string, unknown>,
    references_data: (fm.references ?? []) as unknown[],
    status: 'draft', // D1
    authors: fm.authors ?? [],
    reviewed_by: fm.reviewed_by ?? [],
    reviewer_notes: fm.reviewer_notes ?? null,
    accessibility: fm.accessibility as Record<string, unknown>,
    content_md: contentMd,
    source_path: doc.filePath,
    wiki_links: extractWikiLinks(contentMd),
    embedded_media: extractEmbeddedMedia(contentMd),
    parent_headings: fm.parent_headings ?? [],
    source_origin: fm.source_origin ?? null,
    axis: doc.axis,
  }
}

// ---------- module-private 헬퍼 ----------

const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

function extractWikiLinks(markdown: string): string[] {
  const slugs = new Set<string>()
  for (const m of markdown.matchAll(WIKI_LINK_RE)) {
    slugs.add(m[1].trim())
  }
  return [...slugs]
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g

function extractEmbeddedMedia(markdown: string): unknown[] {
  const media: unknown[] = []
  for (const m of markdown.matchAll(IMAGE_RE)) {
    media.push({ alt: m[1], url: m[2], caption: m[3] ?? null })
  }
  return media
}

// ---------- 본문 로딩 ----------

/**
 * 마크다운 정본 파일에서 frontmatter를 제외한 본문 영역을 로딩한다.
 * filePath는 저장소 루트 기준 상대 경로(예: `content/agreements/test.md`).
 */
export function loadBody(filePath: string): string {
  const full = path.join(REPO_ROOT, filePath)
  const raw = fs.readFileSync(full, 'utf8')
  const { content } = matter(raw)
  return content
}

// (upsert / backlinks / main CLI는 Task 3·4·5에서 추가)
