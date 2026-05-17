#!/usr/bin/env tsx
/**
 * webfortd 콘텐츠 빌드 파이프라인 — M2
 *
 * 입력: content/**\/*.md (.mdx는 명시적 거부 — validate-frontmatter.ts와 정합)
 * 출력: src/lib/kb-index.generated.json (gitignored)
 *
 * 실행:
 *   npm run sync:content
 *   tsx scripts/sync-content.ts
 *
 * 핵심 결정:
 *  - Idempotency: 같은 입력 → 같은 출력 바이트. generated_at은 환경변수 SYNC_TIMESTAMP가
 *    있을 때만 주입되고 없으면 null로 결정적.
 *  - 정렬: documents는 filePath asc, slug_index/wiki_backlinks는 key asc, 배열 내부는
 *    삽입 순서가 결정적이도록 source filePath order 기반.
 *  - 위키링크 추출: 정규식 + 코드블록(```...```) / 인라인 코드(`...`) 마스킹.
 *  - 본문은 JSON에 포함하지 않고 본문 첫 500자(`body_excerpt`)만 검색 인덱스용으로 포함.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import matter from 'gray-matter'
import {
  CONTENT_AXES,
  FrontmatterSchema,
  type ContentAxis,
  type Frontmatter,
} from '../src/types/kb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const CONTENT_DIR = process.env.WEBFORTD_CONTENT_DIR ?? path.join(REPO_ROOT, 'content')
// CONTENT_ROOT: content/ の親ディレクトリ。パス表示・ハッシュ計算の基準点。
// WEBFORTD_CONTENT_DIR が設定されている場合は親ディレクトリを使い、
// 生成 JSON 内の filePath が常に "content/..." 形式になるよう保証する。
const CONTENT_ROOT = process.env.WEBFORTD_CONTENT_DIR
  ? path.dirname(process.env.WEBFORTD_CONTENT_DIR)
  : REPO_ROOT
const OUTPUT_PATH = process.env.WEBFORTD_OUTPUT_PATH ?? path.join(REPO_ROOT, 'src/lib/kb-index.generated.json')

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const BODY_EXCERPT_LEN = 500

// codex-rescue M6 P1: anchor와 alias 의미 분리. 이전 정규식은 `#anchor`를 비캡처로 버리고
// `|alias`만 group 2에 두면서 코드가 그것을 `anchor`로 저장하던 의미 충돌을 해소.
//   group 1: target slug
//   group 2: anchor (`#section`) — 새로 캡처
//   group 3: link_text (`|표시명`) — 이전 group 2였던 자리
const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g
const FENCED_CODE_RE = /```[\s\S]*?```/g
const INLINE_CODE_RE = /`[^`\n]*`/g
// indent 코드블록 — M3에서 도입. 4-space 또는 tab 시작 연속 라인.
// 그룹1: 직전 줄바꿈(또는 문서 시작), 그룹2: 코드 본체.
const INDENT_CODE_RE = /(^|\n)((?:[ ]{4}|\t)[^\n]*(?:\n(?:[ ]{4}|\t)[^\n]*)*)/g

// ---------- 타입 ----------

// codex-rescue M6 P1: anchor와 link_text(alias)를 별개 필드로 분리.
// Phase 2 Supabase `wiki_backlinks` 테이블의 `link_text` 컬럼과 직접 대응.
interface Backlink {
  from: string
  anchor?: string
  link_text?: string
}

interface WikilinkMatch {
  target: string
  anchor?: string
  link_text?: string
  line: number
}

interface SyncDocumentEntry {
  slug: string
  axis: ContentAxis
  filePath: string
  frontmatter: Frontmatter
  body_excerpt: string
}

interface KBIndex {
  generated_at: string | null
  content_hash: string
  source_count: number
  documents: SyncDocumentEntry[]
  wiki_backlinks: Record<string, Backlink[]>
  broken_wikilinks: Array<{ source: string; target: string; line: number }>
  slug_index: Record<string, string>
  wikilink_adjacency: Record<string, string[]>
}

interface ProblemReport {
  filePath: string
  message: string
}

// ---------- 파일 수집 ----------

function walkMarkdown(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name)) // 결정성
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full))
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function relativeTo(p: string, root: string): string {
  return path.relative(root, p).split(path.sep).join('/')
}

function slugStem(filePath: string): string {
  return path.basename(filePath).replace(/\.(md|mdx)$/, '')
}

// ---------- 코드 마스킹 ----------
//
// 마크다운 본문에서 코드블록을 빈 문자열로 치환해 위키링크 추출 정규식 노이즈를 막는다.
// 원본 본문은 보존하고 마스킹된 사본에만 정규식을 돌린다.
//
// 이 마스킹은 위키링크 추출 전용. 라인 번호를 정확히 유지하려면 같은 길이의 공백으로
// 치환해야 한다. \n은 보존, 그 외 문자는 ' '로.
function maskCodeBlocks(body: string): string {
  const masker = (m: string) => m.replace(/[^\n]/g, ' ')
  let masked = body.replace(FENCED_CODE_RE, masker).replace(INLINE_CODE_RE, masker)
  // indent 코드블록: nested list 마스킹을 막기 위해 list marker가 있으면 취소.
  // (codex-rescue P1 #5: CommonMark indent code vs nested list 모호성 회피)
  masked = masked.replace(INDENT_CODE_RE, (full: string, leading: string, code: string) => {
    if (/^\s*[-*+]\s|^\s*\d+\.\s/m.test(code)) return full
    return leading + code.replace(/[^\n]/g, ' ')
  })
  return masked
}

// ---------- 위키링크 추출 ----------

function extractWikilinks(body: string): WikilinkMatch[] {
  const masked = maskCodeBlocks(body)
  const results: WikilinkMatch[] = []
  let match: RegExpExecArray | null
  WIKILINK_RE.lastIndex = 0
  while ((match = WIKILINK_RE.exec(masked)) !== null) {
    const target = match[1].trim()
    const anchor = match[2]?.trim()
    const link_text = match[3]?.trim()
    const line = masked.slice(0, match.index).split('\n').length
    results.push({ target, anchor, link_text, line })
  }
  return results
}

// ---------- 본문 발췌 ----------
//
// 본문 첫 N자. frontmatter 제외. 마크다운 헤딩 prefix `#`는 그대로 둔다 (검색
// 인덱스가 어차피 정규화하므로). 줄바꿈을 공백으로 압축해 토큰화 친화.
function makeBodyExcerpt(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim()
  if (normalized.length <= BODY_EXCERPT_LEN) return normalized
  // 한국어 음절 경계 보존 — surrogate pair·결합 자모 분리 회피.
  // Intl.Segmenter는 Node 18+ 기본 지원. grapheme 단위로 N개 자른 뒤 join.
  const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' })
  const segments: string[] = []
  let i = 0
  for (const s of segmenter.segment(normalized)) {
    if (i >= BODY_EXCERPT_LEN) break
    segments.push(s.segment)
    i++
  }
  return segments.join('')
}

// ---------- 단일 파일 처리 ----------

function processFile(
  filePath: string,
  problems: ProblemReport[],
): {
  entry: SyncDocumentEntry | null
  wikilinks: WikilinkMatch[]
} {
  const rel = relativeTo(filePath, CONTENT_ROOT)

  if (rel.endsWith('.mdx')) {
    problems.push({
      filePath: rel,
      message: '.mdx는 정본 포맷이 아닙니다 — sync 대상에서 제외합니다',
    })
    return { entry: null, wikilinks: [] }
  }

  let fileContent: string
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    problems.push({ filePath: rel, message: `파일 읽기 실패: ${(e as Error).message}` })
    return { entry: null, wikilinks: [] }
  }

  let parsed: { data: Record<string, unknown>; content: string }
  try {
    parsed = matter(fileContent)
  } catch (e) {
    problems.push({
      filePath: rel,
      message: `frontmatter YAML 파싱 실패: ${(e as Error).message}`,
    })
    return { entry: null, wikilinks: [] }
  }

  const parts = rel.split('/')
  if (parts[0] !== 'content') {
    problems.push({ filePath: rel, message: 'content/ 디렉터리 외부 파일' })
    return { entry: null, wikilinks: [] }
  }
  const axisCandidate = parts[1]
  if (!(CONTENT_AXES as readonly string[]).includes(axisCandidate)) {
    problems.push({
      filePath: rel,
      message: `허용되지 않은 axis: '${axisCandidate}'`,
    })
    return { entry: null, wikilinks: [] }
  }
  const axis = axisCandidate as ContentAxis

  const stem = slugStem(filePath)
  if (!SLUG_RE.test(stem)) {
    problems.push({ filePath: rel, message: `슬러그 비정상: '${stem}'` })
    return { entry: null, wikilinks: [] }
  }

  const fmResult = FrontmatterSchema.safeParse(parsed.data)
  if (!fmResult.success) {
    problems.push({
      filePath: rel,
      message: `frontmatter 검증 실패 — validate:content 실행 필요`,
    })
    return { entry: null, wikilinks: [] }
  }

  const wikilinks = extractWikilinks(parsed.content)
  const entry: SyncDocumentEntry = {
    slug: stem,
    axis,
    filePath: rel,
    frontmatter: fmResult.data,
    body_excerpt: makeBodyExcerpt(parsed.content),
  }

  return { entry, wikilinks }
}

// ---------- 인덱스 빌드 ----------

function buildIndex(): { index: KBIndex; hasProblems: boolean } {
  const files = walkMarkdown(CONTENT_DIR)
  const problems: ProblemReport[] = []

  // 1차 패스: 엔트리 + 위키링크 raw
  const entries: SyncDocumentEntry[] = []
  const wikilinksBySource = new Map<string, WikilinkMatch[]>()

  for (const filePath of files) {
    const { entry, wikilinks } = processFile(filePath, problems)
    if (entry) {
      entries.push(entry)
      wikilinksBySource.set(entry.slug, wikilinks)
    }
  }

  // 결정성: filePath asc 정렬
  entries.sort((a, b) => a.filePath.localeCompare(b.filePath))

  // 슬러그 유일성 가드 — slug_index가 마지막 entry로 조용히 덮어쓰는 회귀를 차단.
  // validate-frontmatter가 이미 같은 검사를 하나, sync 직접 실행 경로(개발자가 validate를
  // 빼먹은 경우)도 안전망으로 막는다.
  const slugCounts = new Map<string, string[]>()
  for (const entry of entries) {
    const arr = slugCounts.get(entry.slug) ?? []
    arr.push(entry.filePath)
    slugCounts.set(entry.slug, arr)
  }
  for (const [slug, paths] of slugCounts) {
    if (paths.length > 1) {
      problems.push({
        filePath: paths[0],
        message: `슬러그 '${slug}' 중복 — ${paths.length}개 파일: ${paths.join(', ')}`,
      })
    }
  }

  const slugSet = new Set(entries.map((e) => e.slug))

  // 2차 패스: 백링크 / broken 분리
  const wikiBacklinks: Record<string, Backlink[]> = {}
  const brokenWikilinks: Array<{ source: string; target: string; line: number }> = []
  const wikilinkAdjacency: Record<string, string[]> = {}

  // 결정적 순회 (slug asc)
  const sortedSlugs = [...wikilinksBySource.keys()].sort()
  for (const source of sortedSlugs) {
    const links = wikilinksBySource.get(source)!
    const adjacency: string[] = []
    for (const link of links) {
      if (slugSet.has(link.target)) {
        if (!wikiBacklinks[link.target]) wikiBacklinks[link.target] = []
        wikiBacklinks[link.target].push({
          from: source,
          ...(link.anchor ? { anchor: link.anchor } : {}),
          ...(link.link_text ? { link_text: link.link_text } : {}),
        })
        adjacency.push(link.target)
      } else {
        brokenWikilinks.push({
          source,
          target: link.target,
          line: link.line,
        })
      }
    }
    // 중복 제거 (한 문서가 같은 대상 여러 번 링크해도 그래프 키는 한 번)
    wikilinkAdjacency[source] = [...new Set(adjacency)].sort()
  }

  // slug_index — 결정적 키 순서
  const slugIndex: Record<string, string> = {}
  for (const entry of entries.slice().sort((a, b) => a.slug.localeCompare(b.slug))) {
    slugIndex[entry.slug] = entry.filePath
  }

  // wiki_backlinks 키 정렬
  const sortedBacklinks: Record<string, Backlink[]> = {}
  for (const key of Object.keys(wikiBacklinks).sort()) {
    sortedBacklinks[key] = wikiBacklinks[key]
  }

  // broken_wikilinks 정렬 — M3 600+ 문서 투입 후 출력 결정성 보장.
  brokenWikilinks.sort(
    (a, b) =>
      a.source.localeCompare(b.source)
      || a.target.localeCompare(b.target)
      || a.line - b.line,
  )

  // content_hash: 모든 파일의 frontmatter+본문 SHA256 결합 — idempotency 검증용
  const hasher = crypto.createHash('sha256')
  for (const entry of entries) {
    const full = fs.readFileSync(path.join(CONTENT_ROOT, entry.filePath), 'utf-8')
    hasher.update(entry.filePath)
    hasher.update('\0')
    hasher.update(full)
    hasher.update('\0')
  }
  const contentHash = hasher.digest('hex')

  const generatedAt = process.env.SYNC_TIMESTAMP ?? null

  // 문제 보고는 stderr로 출력 (성공/실패 분리)
  if (problems.length > 0) {
    process.stderr.write('\n[sync-content] 처리 중 발견한 문제:\n')
    for (const p of problems) {
      process.stderr.write(`  ${p.filePath}: ${p.message}\n`)
    }
    process.stderr.write('\n')
  }

  return {
    index: {
      generated_at: generatedAt,
      content_hash: contentHash,
      source_count: entries.length,
      documents: entries,
      wiki_backlinks: sortedBacklinks,
      broken_wikilinks: brokenWikilinks,
      slug_index: slugIndex,
      wikilink_adjacency: wikilinkAdjacency,
    },
    hasProblems: problems.length > 0,
  }
}

// ---------- 엔트리 ----------

function main(): void {
  const { index, hasProblems } = buildIndex()
  const json = JSON.stringify(index, null, 2) + '\n'
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, json, 'utf-8')

  const rel = relativeTo(OUTPUT_PATH, REPO_ROOT)
  process.stdout.write(
    `[sync-content] ${index.source_count}개 문서 → ${rel} (hash ${index.content_hash.slice(0, 12)})\n`,
  )
  if (index.broken_wikilinks.length > 0) {
    process.stdout.write(
      `[sync-content] 끊긴 위키링크 ${index.broken_wikilinks.length}건 — kb-index.generated.json 참조\n`,
    )
  }

  // 정본 오류는 빌드 차단 invariant — validate를 빼먹은 경로도 안전망으로 막는다.
  if (hasProblems) {
    process.exit(1)
  }
}

main()
