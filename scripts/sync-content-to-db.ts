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
import type { SupabaseClient } from '@supabase/supabase-js'
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

// ---------- documents batch upsert ----------

export interface UpsertOptions {
  batchSize?: number
  onProgress?: (done: number, total: number) => void
}

export async function upsertDocuments(
  client: SupabaseClient,
  rows: DocumentRow[],
  opts: UpsertOptions = {},
): Promise<{ totalUpserted: number }> {
  const batchSize = opts.batchSize ?? 50
  let done = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    const { error } = await client
      .from('documents')
      .upsert(chunk, { onConflict: 'slug' })
    if (error) {
      throw new Error(
        `documents upsert 실패 (batch ${i / batchSize + 1}, slugs ${chunk.map((r) => r.slug).slice(0, 3).join(', ')}...): ${error.message}`,
      )
    }
    done += chunk.length
    opts.onProgress?.(done, rows.length)
  }
  return { totalUpserted: done }
}

// ---------- wiki_backlinks sync (delete + insert per source) ----------

/**
 * `wiki_backlinks` 테이블 row 객체 형태.
 *
 * D3: `line`은 sync 시점에 채우지 않는다 (`scripts/sync-content.ts`가 valid
 * backlink push 시 line을 omit). 항상 `null` insert. DB 컬럼은 future-reserved.
 */
export interface WikiBacklinkInsert {
  source_doc_id: string
  target_slug: string
  anchor: string | null
  link_text: string | null
  line: number | null
}

export interface SyncBacklinksResult {
  totalInserted: number
  skippedSources: string[]
}

/**
 * 페이지별 wiki_backlinks를 idempotent 동기화한다.
 *
 * D5: source_doc_id별 *기존 row 일괄 삭제 → 신규 insert*. upsert composite key가
 * 없어 unique constraint 활용 불가. "이 페이지의 backlinks를 현재 인덱스 기준
 * 으로 재구성"이라는 의미를 명시.
 *
 * D3: 모든 row의 `line`은 null.
 *
 * 입력 `bySource`는 *source perspective* (Record<sourceSlug, links[]>).
 * kb-index.generated.json의 `wiki_backlinks`는 target perspective이므로 caller
 * 는 `invertBacklinksToSourcePerspective`로 변환해서 넘겨야 한다.
 */
export async function syncWikiBacklinks(
  client: SupabaseClient,
  bySource: Record<
    string,
    { from: string; anchor?: string; link_text?: string }[]
  >,
  slugToId: Record<string, string>,
): Promise<SyncBacklinksResult> {
  // 1. source_doc_ids 매핑 + 미존재 source 수집
  const sourceIds: string[] = []
  const inserts: WikiBacklinkInsert[] = []
  const skipped: string[] = []

  for (const [sourceSlug, links] of Object.entries(bySource)) {
    const sourceId = slugToId[sourceSlug]
    if (!sourceId) {
      skipped.push(sourceSlug)
      continue
    }
    sourceIds.push(sourceId)
    for (const link of links) {
      inserts.push({
        source_doc_id: sourceId,
        target_slug: link.from,
        anchor: link.anchor ?? null,
        link_text: link.link_text ?? null,
        line: null, // D3
      })
    }
  }

  // 2. 기존 row 일괄 삭제 (D5)
  if (sourceIds.length > 0) {
    const { error: delError } = await client
      .from('wiki_backlinks')
      .delete()
      .in('source_doc_id', sourceIds)
    if (delError) {
      throw new Error(`wiki_backlinks delete 실패: ${delError.message}`)
    }
  }

  // 3. 신규 insert (batch 500)
  if (inserts.length > 0) {
    const batchSize = 500
    for (let i = 0; i < inserts.length; i += batchSize) {
      const chunk = inserts.slice(i, i + batchSize)
      const { error } = await client.from('wiki_backlinks').insert(chunk)
      if (error) {
        throw new Error(`wiki_backlinks insert 실패: ${error.message}`)
      }
    }
  }

  return { totalInserted: inserts.length, skippedSources: skipped }
}

/**
 * kb-index의 `wiki_backlinks` (target perspective) → source perspective 변환.
 *
 * 입력: `{ 'target-slug': [{ from: 'source-slug', anchor?, link_text? }] }`
 * 출력: `{ 'source-slug': [{ from: 'target-slug' }] }`
 *
 * 출력의 `from` 필드는 *target slug*를 가리킨다 (DB 컬럼이 `target_slug`라 호환).
 *
 * **anchor/link_text는 의도적으로 drop**: target perspective에서 `anchor`는
 * *target 내부 섹션*을 가리키는 값인데, source perspective로 뒤집으면 source가
 * 보는 "어느 target을 가리키는가"만 남고 target 내부 위치 정보는 다른 의미가
 * 된다. wiki_backlinks 테이블의 anchor 컬럼은 sync 시점에 *source 본문에서
 * 추출한 anchor* 가 들어가야 정합이라 인덱스의 target-anchor를 그대로 넣지
 * 않는다. (kb-index 자체가 valid backlink push 시 anchor를 frontmatter
 * heading 기반으로만 채워 정밀도가 떨어짐.) 결과적으로 anchor/link_text는
 * 인덱스 invert 단계에서 drop하고 모두 null로 insert (D3와 동일 결).
 */
export function invertBacklinksToSourcePerspective(
  byTarget: Record<
    string,
    { from: string; anchor?: string; link_text?: string }[]
  >,
): Record<string, { from: string }[]> {
  const bySource: Record<string, { from: string }[]> = {}
  for (const [targetSlug, links] of Object.entries(byTarget)) {
    for (const link of links) {
      const sourceSlug = link.from
      if (!bySource[sourceSlug]) bySource[sourceSlug] = []
      bySource[sourceSlug].push({ from: targetSlug }) // source perspective: from = target slug
    }
  }
  return bySource
}

// (main CLI는 Task 5에서 추가)
