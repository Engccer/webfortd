#!/usr/bin/env tsx
/**
 * webfortd 콘텐츠 frontmatter 검증 스크립트 — M1
 *
 * 실행:
 *   npm run validate:content                # dry-run (기본)
 *   tsx scripts/validate-frontmatter.ts --fix   # 자동 수정 가능 항목만 수정 (옵션)
 *
 * 종료 코드:
 *   0  — 오류 없음
 *   1  — 1건 이상 오류 발견
 *
 * 검증 범위:
 *   1. zod 스키마 (src/types/kb.ts)
 *   2. 슬러그(파일명 stem)가 kebab-case
 *   3. <axis>(부모 디렉터리)가 CONTENT_AXES 목록에 속함
 *   4. 본문 게이트(2026-08 3층 재생성, DECOMPOSE_V2_DESIGN §3.6): 파서 잔존 태그 / 허용 태그 불균형 /
 *      끊긴 위키링크 / 출처별 제목 중복 / 본문 100자 미만·5만 자 초과 / 4종 주소의 `-p-`·`appendix-` 재발
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { CONTENT_AXES, FrontmatterSchema } from '../src/types/kb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const CONTENT_DIR = process.env.WEBFORTD_CONTENT_DIR ?? path.join(REPO_ROOT, 'content')
// CONTENT_ROOT: content/ の親ディレクトリ。パス表示の基準点。
// WEBFORTD_CONTENT_DIR が設定されている場合は親ディレクトリを使い、
// エラーメッセージ内の filePath が常に "content/..." 形式になるよう保証する。
const CONTENT_ROOT = process.env.WEBFORTD_CONTENT_DIR
  ? path.dirname(process.env.WEBFORTD_CONTENT_DIR)
  : REPO_ROOT

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
// 본문 게이트 상수(decompose-source.ts ALLOWED/FORBIDDEN_HTML_TAGS와 같은 목록)
const FORBIDDEN_TAG_RE = /<\/?(page_header|page_number|page_footer|u|figure|span)\b[^>]*>/i
const BALANCED_TAGS = ['mark', 'sub', 'sup'] as const
const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g
const BODY_MIN_CHARS = 100
const BODY_MAX_CHARS = 50_000
/** 순번 fallback 주소가 다시 생기면 안 되는 출처(4종) 접두 */
const OUTLINE_PREFIX_RE = /^(2023-research|2023-hr|2024-jbu|2024-staff)-/
const LEGACY_SLUG_RE = /-(p|appendix)-\d{3}(-|$)/

interface ValidationError {
  filePath: string
  line: number
  field: string
  message: string
  code: string
}

interface ValidationResult {
  filePath: string
  errors: ValidationError[]
}

// ---------- 파일 수집 ----------
//
// 정본 포맷은 `.md`. `.mdx`는 M1에서 제거됐고 새로 도입 금지.
// 그래도 잘못 들어온 `.mdx`를 명시적으로 보고하기 위해 수집은 하되 검증 단계에서 reject.

function walkMarkdown(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full))
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

// ---------- 단일 파일 검증 ----------

function relativeTo(p: string, root: string): string {
  return path.relative(root, p)
}

/**
 * frontmatter 블록을 raw 텍스트와 시작 라인 번호와 함께 추출 — M5 라인 정밀도 강화.
 * gray-matter 내부 API에 의존하지 않고 두 개의 '---' delimiter를 직접 찾는다.
 *
 * 반환: { raw: frontmatter YAML 본문, startLine: 1-indexed (첫 키가 등장하는 줄) }
 * frontmatter가 없으면 { raw: '', startLine: 1 }.
 *
 * codex-rescue M5 P2: 첫 '---'는 반드시 파일 1행(혹은 BOM 직후)에 있어야 한다.
 * 본문 중간의 '---'(horizontal rule)와 frontmatter delimiter를 혼동하지 않도록 강제.
 * gray-matter 자체도 line 1 delimiter만 frontmatter로 인정한다.
 */
function extractRawFrontmatter(content: string): { raw: string; startLine: number } {
  const lines = content.split(/\r?\n/)
  // BOM 제거 후 첫 줄이 '---'가 아니면 frontmatter 없음.
  const firstLine = (lines[0] ?? '').replace(/^\uFEFF/, '').trim()
  if (firstLine !== '---') return { raw: '', startLine: 1 }
  // 두 번째 '---' delimiter 탐색 (1행 이후).
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end === -1) return { raw: '', startLine: 1 }
  return {
    raw: lines.slice(1, end).join('\n'),
    startLine: 2, // 1-indexed, 첫 '---' 다음 줄
  }
}

/**
 * frontmatter raw 텍스트에서 최상위 키별 라인 번호 매핑 — M5 라인 정밀도 강화.
 *
 * 한계: YAML 멀티라인 값(예: `source:\n  organization: ...`) 안의 nested 키는 부모 키
 *      라인으로 fallback된다. PR 코멘트 정확성을 위해서는 최상위 키 단위로 충분하다.
 *      예: `source.organization` 오류 → `source` 키 라인 번호.
 */
function buildFieldLineMap(rawFrontmatter: string, fmStartLine: number): Map<string, number> {
  const map = new Map<string, number>()
  if (!rawFrontmatter) return map
  const lines = rawFrontmatter.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    // 최상위 키: 줄 시작에서 들여쓰기 없이 `식별자:` 패턴 (주석 또는 빈 줄 제외)
    const match = lines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/)
    if (match) {
      map.set(match[1], fmStartLine + i)
    }
  }
  return map
}

function slugStem(filePath: string): string {
  return path.basename(filePath).replace(/\.(md|mdx)$/, '')
}

function validateSlugAndAxis(
  filePath: string,
  errors: ValidationError[],
): void {
  const rel = relativeTo(filePath, CONTENT_ROOT)
  const parts = rel.split(path.sep)
  // parts: ['content', '<axis>', ...maybe nested..., '<slug>.md']
  if (parts[0] !== 'content') {
    errors.push({
      filePath: rel,
      line: 1,
      field: '(filepath)',
      message: '콘텐츠는 content/ 디렉터리 안에 있어야 합니다',
      code: 'invalid_filepath',
    })
    return
  }
  const axis = parts[1]
  if (!(CONTENT_AXES as readonly string[]).includes(axis)) {
    errors.push({
      filePath: rel,
      line: 1,
      field: '(axis)',
      message: `허용되지 않은 axis 디렉터리: '${axis}'. 허용: ${CONTENT_AXES.join(', ')}`,
      code: 'invalid_axis',
    })
  }
  if (rel.endsWith('.mdx')) {
    errors.push({
      filePath: rel,
      line: 1,
      field: '(extension)',
      message: '확장자는 .md만 허용됩니다 (MDX 사용 금지, CONTENT_CONVENTIONS §2)',
      code: 'invalid_extension',
    })
  }
  const stem = slugStem(filePath)
  if (!SLUG_RE.test(stem)) {
    errors.push({
      filePath: rel,
      line: 1,
      field: '(slug)',
      message: `슬러그는 kebab-case여야 합니다: '${stem}' — 영문 소문자·숫자·하이픈만 허용`,
      code: 'invalid_slug',
    })
  }
}

// ---------- 본문 게이트 ----------

function lineOf(body: string, index: number, fmLines: number): number {
  return fmLines + body.slice(0, index).split('\n').length
}

function validateBody(rel: string, body: string, errors: ValidationError[]): void {
  const fmLines = 0
  const stem = slugStem(rel)
  if (OUTLINE_PREFIX_RE.test(stem) && LEGACY_SLUG_RE.test(stem)) {
    errors.push({ filePath: rel, line: 1, field: '(slug)', message: `4종 출처 주소에 순번 fallback(-p-NNN·-appendix-NNN)이 다시 생겼습니다: '${stem}' — decompose-source.ts 번호 파서 점검`, code: 'legacy_slug' })
  }
  const bodyWithoutComments = body.replace(/<!--[\s\S]*?-->/g, '')
  const forbidden = bodyWithoutComments.match(FORBIDDEN_TAG_RE)
  if (forbidden) {
    errors.push({ filePath: rel, line: lineOf(body, body.indexOf(forbidden[0]), fmLines), field: '(body)', message: `파서 잔존 태그 '${forbidden[0]}' — 2층 정본에서 제거 후 재생성`, code: 'forbidden_html_tag' })
  }
  for (const tag of BALANCED_TAGS) {
    const opens = (bodyWithoutComments.match(new RegExp(`<${tag}>`, 'g')) ?? []).length
    const closes = (bodyWithoutComments.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
    if (opens !== closes) {
      errors.push({ filePath: rel, line: 1, field: '(body)', message: `<${tag}> 여닫이 불일치(열림 ${opens}, 닫힘 ${closes}) — 렌더 시 MDX 컴파일 실패`, code: 'unbalanced_html_tag' })
    }
  }
  // 본문 길이는 관련 페이지 블록·마커·위키링크 표기를 뺀 실질 글자 수(공백 제외)로 판정.
  const effective = bodyWithoutComments
    .replace(/\n## 관련 페이지[\s\S]*$/, '')
    .replace(/^\s*#\s+[^\n]*\n/, '')
    .replace(/\s+/g, '')
  if (OUTLINE_PREFIX_RE.test(stem) && effective.length < BODY_MIN_CHARS) {
    errors.push({ filePath: rel, line: 1, field: '(body)', message: `본문이 ${effective.length}자(공백 제외)로 ${BODY_MIN_CHARS}자 미만 — 빈 조각은 형제에 병합돼야 합니다`, code: 'body_too_short' })
  }
  if (body.length > BODY_MAX_CHARS) {
    errors.push({ filePath: rel, line: 1, field: '(body)', message: `본문 ${body.length}자로 ${BODY_MAX_CHARS}자 초과 — 표 경계 분할(-ptN) 대상`, code: 'body_too_long' })
  }
}

/** 위키링크 대상이 실제 슬러그인지(끊긴 링크 → 오류). sync-content는 기록만 하므로 여기서 막는다. */
function detectBrokenWikilinks(files: string[]): ValidationError[] {
  const slugs = new Set(files.map(slugStem))
  const errors: ValidationError[] = []
  for (const file of files) {
    const rel = relativeTo(file, CONTENT_ROOT)
    let body: string
    try { body = matter(fs.readFileSync(file, 'utf-8')).content } catch { continue }
    const masked = body.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))
    let m: RegExpExecArray | null
    WIKILINK_RE.lastIndex = 0
    while ((m = WIKILINK_RE.exec(masked)) !== null) {
      const target = m[1].trim()
      if (!slugs.has(target)) {
        errors.push({ filePath: rel, line: lineOf(masked, m.index, 0), field: '(wikilink)', message: `끊긴 위키링크 [[${target}]] — 대상 슬러그가 없습니다`, code: 'broken_wikilink' })
      }
    }
  }
  return errors
}

/** 같은 출처(source_origin) 안의 title 중복 → 오류(분해 스크립트의 제목 유일성 규칙 위반). */
function detectDuplicateTitles(files: string[]): ValidationError[] {
  const byKey = new Map<string, string[]>()
  for (const file of files) {
    let data: Record<string, unknown>
    try { data = matter(fs.readFileSync(file, 'utf-8')).data } catch { continue }
    const origin = String(data.source_origin ?? '')
    const title = String(data.title ?? '')
    if (!origin || origin === 'pre-phase-1' || !title) continue
    const key = `${origin}\u0000${title}`
    const arr = byKey.get(key) ?? []
    arr.push(relativeTo(file, CONTENT_ROOT))
    byKey.set(key, arr)
  }
  const errors: ValidationError[] = []
  for (const [key, paths] of byKey) {
    if (paths.length < 2) continue
    const title = key.split('\u0000')[1]
    for (const p of paths) {
      errors.push({ filePath: p, line: 1, field: 'title', message: `같은 출처 안에서 제목 '${title}'이(가) ${paths.length}개 파일에 중복: ${paths.join(', ')}`, code: 'duplicate_title' })
    }
  }
  return errors
}

// 전역 슬러그 중복 검사 (CONTENT_CONVENTIONS §2 충돌 방지 규칙).
// slug 충돌은 위키링크 외래키 무결성을 깨뜨림.
function detectSlugCollisions(files: string[]): ValidationError[] {
  const errors: ValidationError[] = []
  const bySlug = new Map<string, string[]>()
  for (const file of files) {
    const stem = slugStem(file)
    const rel = relativeTo(file, CONTENT_ROOT)
    if (!bySlug.has(stem)) bySlug.set(stem, [])
    bySlug.get(stem)!.push(rel)
  }
  for (const [stem, paths] of bySlug) {
    if (paths.length > 1) {
      for (const p of paths) {
        errors.push({
          filePath: p,
          line: 1,
          field: '(slug)',
          message: `슬러그 '${stem}'이(가) ${paths.length}개 파일에서 중복: ${paths.join(', ')}`,
          code: 'duplicate_slug',
        })
      }
    }
  }
  return errors
}

function validateFile(filePath: string): ValidationResult {
  const rel = relativeTo(filePath, CONTENT_ROOT)
  const errors: ValidationError[] = []

  let fileContent: string
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    errors.push({
      filePath: rel,
      line: 0,
      field: '(io)',
      message: `파일 읽기 실패: ${(e as Error).message}`,
      code: 'io_error',
    })
    return { filePath: rel, errors }
  }

  // M5 라인 정밀도: 필드별 정확한 라인 번호 추출. 매핑 실패 시 frontmatter 시작 라인으로 fallback.
  const { raw: rawFrontmatter, startLine } = extractRawFrontmatter(fileContent)
  const fieldLineMap = buildFieldLineMap(rawFrontmatter, startLine)

  let parsed: { data: Record<string, unknown>; content: string }
  try {
    parsed = matter(fileContent)
  } catch (e) {
    errors.push({
      filePath: rel,
      line: 1,
      field: '(yaml)',
      message: `frontmatter YAML 파싱 실패: ${(e as Error).message}`,
      code: 'yaml_parse_error',
    })
    return { filePath: rel, errors }
  }

  validateSlugAndAxis(filePath, errors)
  validateBody(rel, parsed.content, errors)

  const result = FrontmatterSchema.safeParse(parsed.data)
  if (!result.success) {
    for (const issue of result.error.issues) {
      // path가 비어있으면 frontmatter 시작 라인, 비어있지 않으면 최상위 키의 라인 번호.
      const topKey = issue.path.length > 0 ? String(issue.path[0]) : ''
      const line = topKey && fieldLineMap.has(topKey)
        ? fieldLineMap.get(topKey)!
        : startLine
      errors.push({
        filePath: rel,
        line,
        field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
        message: issue.message,
        code: issue.code,
      })
    }
  }

  return { filePath: rel, errors }
}

// ---------- 출력 ----------

// CI 파싱 친화적 단일 라인 포맷:
//   <relativePath>:<line>: <code>: [<field>] <message>
// 라인 번호 정밀화(필드 단위)는 M5에서 도입 — buildFieldLineMap이 최상위 키 단위로 정확한 라인 제공.
function formatErrors(results: ValidationResult[]): string {
  const lines: string[] = []
  const filesWithErrors = results.filter((r) => r.errors.length > 0)
  const totalErrors = filesWithErrors.reduce((sum, r) => sum + r.errors.length, 0)

  lines.push('')
  lines.push(
    `오류: ${filesWithErrors.length}개 파일에서 ${totalErrors}건의 문제가 발견되었습니다.`,
  )
  lines.push('')

  for (const result of filesWithErrors) {
    for (const err of result.errors) {
      lines.push(
        `${result.filePath}:${err.line}: ${err.code}: [${err.field}] ${err.message}`,
      )
    }
  }
  lines.push('')

  return lines.join('\n')
}

// ---------- 엔트리 ----------

// codex-rescue M4 P1 #3 — axis override↔실제 파일 경로 정합 검사.
// 검수자가 `_axis-overrides.json`만 수정하고 `decompose --reset`을 안 돌리면
// build 체인(validate → sync → next build)이 stale axis를 통과시킨다.
// validate 단계에서 각 override slug가 지정 axis 디렉터리에 실제 존재하는지 확인.
function detectStaleAxisOverrides(): ValidationError[] {
  const overridesPath = path.join(REPO_ROOT, 'content/_axis-overrides.json')
  if (!fs.existsSync(overridesPath)) return []
  let parsed: { overrides?: Record<string, string> }
  try {
    parsed = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'))
  } catch (e) {
    return [{
      filePath: 'content/_axis-overrides.json',
      line: 1,
      field: '(json)',
      message: `JSON 파싱 실패: ${(e as Error).message}`,
      code: 'invalid_overrides_json',
    }]
  }
  const overrides = parsed.overrides ?? {}
  const errors: ValidationError[] = []
  for (const [slug, axis] of Object.entries(overrides)) {
    const expected = path.join(CONTENT_DIR, axis, `${slug}.md`)
    if (!fs.existsSync(expected)) {
      // 다른 axis에 있는지 확인 — 정보성 메시지로
      let actualAxis: string | null = null
      for (const a of CONTENT_AXES) {
        if (fs.existsSync(path.join(CONTENT_DIR, a, `${slug}.md`))) {
          actualAxis = a
          break
        }
      }
      errors.push({
        filePath: 'content/_axis-overrides.json',
        line: 1,
        field: slug,
        message: actualAxis
          ? `override='${axis}'이지만 실제 위치는 'content/${actualAxis}/${slug}.md' — decompose --reset 필요`
          : `slug '${slug}' override='${axis}'에 매칭되는 파일이 어디에도 없음 — 오타이거나 source 변경으로 slug 사라짐`,
        code: 'stale_axis_override',
      })
    }
  }
  return errors
}

function main(): void {
  const files = walkMarkdown(CONTENT_DIR)
  const results = files.map(validateFile)

  // 전역 슬러그 중복: 파일 단위 결과에 합쳐 보고
  const collisionErrors = detectSlugCollisions(files)
  if (collisionErrors.length > 0) {
    const byFile = new Map<string, ValidationError[]>()
    for (const err of collisionErrors) {
      if (!byFile.has(err.filePath)) byFile.set(err.filePath, [])
      byFile.get(err.filePath)!.push(err)
    }
    for (const result of results) {
      const extra = byFile.get(result.filePath)
      if (extra) result.errors.push(...extra)
    }
  }

  // 본문 게이트(전역): 끊긴 위키링크·출처별 제목 중복 — 파일 단위 결과에 합쳐 보고.
  for (const err of [...detectBrokenWikilinks(files), ...detectDuplicateTitles(files)]) {
    const target = results.find((r) => r.filePath === err.filePath)
    if (target) target.errors.push(err)
    else results.push({ filePath: err.filePath, errors: [err] })
  }

  // codex-rescue M4 P1 #3 — axis override 정합성. 파일 단위 결과에 합쳐 보고.
  const staleOverrideErrors = detectStaleAxisOverrides()
  if (staleOverrideErrors.length > 0) {
    // _axis-overrides.json은 walkMarkdown에 잡히지 않으므로 별도 results 항목으로 추가
    results.push({
      filePath: 'content/_axis-overrides.json',
      errors: staleOverrideErrors,
    })
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

  if (totalErrors === 0) {
    console.log(`✓ 콘텐츠 검증 완료 — ${files.length}개 파일, 오류 없음`)
    process.exit(0)
  }

  process.stderr.write(formatErrors(results))
  process.exit(1)
}

main()
