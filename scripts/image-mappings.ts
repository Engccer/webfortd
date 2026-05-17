#!/usr/bin/env tsx
/**
 * webfortd 본문 이미지 TODO 마커 → manifest 매핑 헬퍼 — M4-C
 *
 * M3 자동 분해 결과 본문의 `(이미지: ...)` 패턴은 자동 ![](path) 삽입이
 * 페이지 간 manifest 커서 재시작 버그로 데이터 무결성 사고를 일으켜 전부
 * `<!-- TODO: image-link source=... -- 원본: (이미지: ...) -->` 마커로 보존됨.
 *
 * 이 스크립트는 위원장(M4 검수자)이 manifest.json + PDF 페이지 anchor를 보고
 * 1:1 매핑을 결정할 수 있도록 인프라를 제공한다.
 *
 * 서브커맨드:
 *  - report:   docs/image-mapping-status.md 작성 (페이지별 미매칭 TODO 통계).
 *  - template: content/_image-mappings.template.json 작성 (검수자 입력 skeleton).
 *  - apply:    content/_image-mappings.json 읽어서 본문 TODO 마커를 ![alt](path)로 교체.
 *
 * 안전 원칙 (codex-rescue M3 P0 #1·#2 학습):
 *  - 자동 매칭 휴리스틱 금지. apply는 매핑 명세에 있는 항목만 교체.
 *  - 매니페스트 path가 실제 파일 시스템에 존재하지 않으면 apply 거부.
 *  - 매핑 후 본문 검증(TODO 마커 제거됨, 이미지 링크 형식 정합).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const CONTENT_DIR = path.join(REPO_ROOT, 'content')
const MANIFEST_PATH = path.join(REPO_ROOT, 'public/source-images/manifest.json')
const MAPPINGS_PATH = path.join(REPO_ROOT, 'content/_image-mappings.json')
const TEMPLATE_PATH = path.join(REPO_ROOT, 'content/_image-mappings.template.json')
const REPORT_PATH = path.join(REPO_ROOT, 'docs/image-mapping-status.md')

// TODO 마커 정규식 — decompose-source.ts processBodyImages 출력 형식과 정합.
// 예: <!-- TODO: image-link source=2024-support-staff-duty-guide -- 원본: (이미지: 흐름도...) -->
const TODO_MARKER_RE =
  /<!--\s*TODO:\s*image-link\s+source=([\w-]+)\s+--\s*원본:\s*\(이미지:\s*([\s\S]*?)\)\s*-->/g

interface ManifestEntry {
  source: string
  page: number
  figure: number
  path: string
  alt?: string | null
}

interface TodoOccurrence {
  /** content/<axis>/<slug>.md 상대 경로 */
  filePath: string
  /** 파일 내 이 source의 N번째 TODO 마커 (0-base) */
  indexInFile: number
  /** TODO 마커가 명시한 source identifier */
  source: string
  /** 원본 alt 텍스트 */
  alt: string
  /** 매핑 키 (apply에서 사용) — `<slug>#<source>#<indexInFile>` */
  key: string
}

interface MappingEntry {
  /** 매니페스트 path (예: public/source-images/<source>/page-001-fig-01.png) */
  manifest_path: string | null
  /** 검수자가 alt를 수정한 경우 사용. null이면 원본 alt 사용. */
  alt_override?: string | null
  /** 검수자 메모 */
  notes?: string
}

function loadManifest(): ManifestEntry[] {
  if (!fs.existsSync(MANIFEST_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  } catch (e) {
    throw new Error(`manifest.json 파싱 실패: ${(e as Error).message}`)
  }
}

function walkContentMd(): string[] {
  const results: string[] = []
  const stack = [CONTENT_DIR]
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (!fs.existsSync(cur)) continue
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full)
    }
  }
  return results.sort()
}

function collectTodoOccurrences(files: string[]): TodoOccurrence[] {
  const out: TodoOccurrence[] = []
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8')
    const relPath = path.relative(REPO_ROOT, file)
    const slug = path.basename(file, '.md')
    // body만 검사 (frontmatter는 건너뜀)
    const parsed = matter(raw)
    const body = parsed.content
    // 같은 파일 내 동일 source 인덱스 카운터
    const sourceCounter = new Map<string, number>()
    // exec loop — 마커는 같은 줄에 여럿일 수도 있음
    const re = new RegExp(TODO_MARKER_RE.source, TODO_MARKER_RE.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(body)) !== null) {
      const source = m[1]
      const alt = m[2].trim()
      const idx = sourceCounter.get(source) ?? 0
      sourceCounter.set(source, idx + 1)
      out.push({
        filePath: relPath,
        indexInFile: idx,
        source,
        alt,
        key: `${slug}#${source}#${idx}`,
      })
    }
  }
  return out
}

// ---------- report ----------

function buildReport(occurrences: TodoOccurrence[], manifest: ManifestEntry[]): string {
  const lines: string[] = []
  lines.push('# 본문 이미지 TODO 마커 매핑 현황 — M4-C')
  lines.push('')
  lines.push('자동 생성. `npm run image:report` 또는 `tsx scripts/image-mappings.ts report` 실행 결과.')
  lines.push('')
  lines.push(`- 총 TODO 마커: **${occurrences.length}개**`)
  const filesWithTodo = new Set(occurrences.map((o) => o.filePath))
  lines.push(`- 미매칭 페이지: **${filesWithTodo.size}개**`)
  lines.push(`- 매니페스트 엔트리: **${manifest.length}개** (출처 4개)`)
  lines.push('')
  lines.push('## 출처별 TODO 분포')
  lines.push('')
  const bySource = new Map<string, TodoOccurrence[]>()
  for (const o of occurrences) {
    if (!bySource.has(o.source)) bySource.set(o.source, [])
    bySource.get(o.source)!.push(o)
  }
  const manifestBySource = new Map<string, number>()
  for (const m of manifest) {
    manifestBySource.set(m.source, (manifestBySource.get(m.source) ?? 0) + 1)
  }
  lines.push('| 출처 | TODO 마커 | 매니페스트 이미지 |')
  lines.push('|---|---|---|')
  for (const [source, occs] of [...bySource.entries()].sort()) {
    const manifestCount = manifestBySource.get(source) ?? 0
    lines.push(`| ${source} | ${occs.length} | ${manifestCount} |`)
  }
  lines.push('')
  lines.push('## 매핑 작업 안내')
  lines.push('')
  lines.push('1. `tsx scripts/image-mappings.ts template` 실행해서 `content/_image-mappings.template.json` 생성.')
  lines.push('2. 템플릿을 `content/_image-mappings.json`으로 복사 후 각 항목의 `manifest_path` 채움.')
  lines.push('   - manifest path 예시: `public/source-images/<source>/page-NNN-fig-MM.png`')
  lines.push('   - 같은 페이지에서 본문에 등장한 순서대로 매핑.')
  lines.push('   - alt 수정 필요 시 `alt_override` 채움.')
  lines.push('3. `tsx scripts/image-mappings.ts apply` 실행해서 본문 TODO 마커를 이미지 링크로 교체.')
  lines.push('4. `npm run validate:content && npm run build`로 검증.')
  lines.push('')
  lines.push('## 페이지별 미매칭 마커 (상위 30개)')
  lines.push('')
  const fileGroups = new Map<string, TodoOccurrence[]>()
  for (const o of occurrences) {
    if (!fileGroups.has(o.filePath)) fileGroups.set(o.filePath, [])
    fileGroups.get(o.filePath)!.push(o)
  }
  const fileList = [...fileGroups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 30)
  for (const [file, occs] of fileList) {
    lines.push(`### \`${file}\` (${occs.length}건)`)
    lines.push('')
    for (const o of occs) {
      const altPreview = o.alt.length > 80 ? o.alt.slice(0, 80) + '…' : o.alt
      lines.push(`- key=\`${o.key}\`: ${altPreview}`)
    }
    lines.push('')
  }
  if (fileGroups.size > 30) {
    lines.push(`_나머지 ${fileGroups.size - 30}개 페이지 생략._`)
    lines.push('')
  }
  return lines.join('\n')
}

// ---------- template ----------

function buildTemplate(occurrences: TodoOccurrence[]): string {
  const template: Record<string, MappingEntry & { _alt_original: string; _file: string }> = {}
  for (const o of occurrences) {
    template[o.key] = {
      _alt_original: o.alt,
      _file: o.filePath,
      manifest_path: null,
      alt_override: null,
    }
  }
  const header = {
    _comment:
      'M4-C 매핑 템플릿. 각 key의 manifest_path를 채워서 _image-mappings.json으로 복사 후 apply 실행.',
    _format: {
      manifest_path: 'public/source-images/<source>/page-NNN-fig-MM.png (필수)',
      alt_override: '검수자가 alt 수정 필요 시 채움. null이면 _alt_original 사용.',
      notes: '메모 (옵션)',
    },
    mappings: template,
  }
  return JSON.stringify(header, null, 2) + '\n'
}

// ---------- apply ----------

interface ApplyResult {
  filesModified: number
  markersReplaced: number
  errors: string[]
  unmatchedMappings: string[]
}

function applyMappings(occurrences: TodoOccurrence[], manifest: ManifestEntry[]): ApplyResult {
  const result: ApplyResult = {
    filesModified: 0,
    markersReplaced: 0,
    errors: [],
    unmatchedMappings: [],
  }

  if (!fs.existsSync(MAPPINGS_PATH)) {
    result.errors.push(
      `${MAPPINGS_PATH} 가 없습니다. template 서브커맨드로 skeleton 생성 후 채워서 복사하세요.`,
    )
    return result
  }

  let parsed: { mappings?: Record<string, MappingEntry> }
  try {
    parsed = JSON.parse(fs.readFileSync(MAPPINGS_PATH, 'utf-8'))
  } catch (e) {
    result.errors.push(`_image-mappings.json 파싱 실패: ${(e as Error).message}`)
    return result
  }

  const mappings = parsed.mappings ?? {}
  // manifest path 정합성 검사: 매니페스트에 있고 파일이 실제 존재해야 함.
  // path → ManifestEntry lookup으로 source 교차 검증 (codex-rescue P0).
  const manifestByPath = new Map<string, ManifestEntry>()
  for (const m of manifest) manifestByPath.set(m.path, m)

  // 매핑 키별 occurrence 찾기
  const byKey = new Map<string, TodoOccurrence>()
  for (const o of occurrences) byKey.set(o.key, o)

  // 매핑 명세에 있지만 occurrence가 없는 키는 unmatched
  for (const key of Object.keys(mappings)) {
    if (!byKey.has(key)) result.unmatchedMappings.push(key)
  }

  // 파일별로 그룹화해서 한 번에 처리
  const fileGroups = new Map<string, Array<{ occ: TodoOccurrence; mapping: MappingEntry }>>()
  for (const [key, mapping] of Object.entries(mappings)) {
    if (!mapping.manifest_path) continue // 미채움 항목 skip
    const occ = byKey.get(key)
    if (!occ) continue
    const manifestEntry = manifestByPath.get(mapping.manifest_path)
    if (!manifestEntry) {
      result.errors.push(
        `${key}: manifest_path '${mapping.manifest_path}'가 manifest.json에 없음`,
      )
      continue
    }
    // codex-rescue M4 P0: source 교차 검증.
    // TODO 마커의 source와 manifest entry의 source가 일치해야 함.
    // 검수자가 실수로 다른 출처의 이미지를 매핑하면 M3 데이터 무결성 사고 재발.
    if (manifestEntry.source !== occ.source) {
      result.errors.push(
        `${key}: source 불일치 — TODO=${occ.source}, manifest=${manifestEntry.source} (다른 출처 이미지 삽입 차단)`,
      )
      continue
    }
    const absImgPath = path.join(REPO_ROOT, mapping.manifest_path)
    if (!fs.existsSync(absImgPath)) {
      result.errors.push(`${key}: 이미지 파일이 디스크에 없음 — ${absImgPath}`)
      continue
    }
    if (!fileGroups.has(occ.filePath)) fileGroups.set(occ.filePath, [])
    fileGroups.get(occ.filePath)!.push({ occ, mapping })
  }

  if (result.errors.length > 0) return result // 한 건이라도 실패하면 dry stop

  for (const [filePath, entries] of fileGroups.entries()) {
    const abs = path.join(REPO_ROOT, filePath)
    const raw = fs.readFileSync(abs, 'utf-8')
    // codex-rescue M4 P1 #4: matter.stringify는 frontmatter를 재직렬화해
    // decompose 산출물의 flow array(`["전체"]`)을 block list로 바꾸는 등 diff 노이즈.
    // → frontmatter raw block(`---\n...\n---\n`)을 byte-preserve하고 body만 교체.
    const fmMatch = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/)
    let fmBlock: string
    let body: string
    if (fmMatch) {
      fmBlock = fmMatch[1]
      body = fmMatch[2]
    } else {
      // frontmatter 없는 파일(이론상 분해 산출물 아님) — 전체를 body 취급.
      fmBlock = ''
      body = raw
    }
    // 같은 source의 N번째 TODO 마커 찾기 — 순서 기반 교체
    const sourceCounter = new Map<string, number>()
    const newBody = body.replace(TODO_MARKER_RE, (match, source: string, alt: string) => {
      const idx = sourceCounter.get(source) ?? 0
      sourceCounter.set(source, idx + 1)
      const target = entries.find((e) => e.occ.source === source && e.occ.indexInFile === idx)
      if (!target) return match // 매핑 안 된 마커는 그대로 보존
      const manifestPath = target.mapping.manifest_path
      if (!manifestPath) return match
      const finalAlt = target.mapping.alt_override ?? alt
      // 마크다운 이미지 링크는 /public 기준 절대 경로로 변환 (Next.js 정적 파일)
      const publicPath = '/' + manifestPath.replace(/^public\//, '')
      result.markersReplaced += 1
      return `![${finalAlt}](${publicPath})`
    })
    const newRaw = fmBlock + newBody
    if (newRaw !== raw) {
      fs.writeFileSync(abs, newRaw, 'utf-8')
      result.filesModified += 1
    }
  }

  return result
}

// ---------- CLI ----------

async function main(): Promise<void> {
  const sub = process.argv[2] ?? 'report'
  const files = walkContentMd()
  const occurrences = collectTodoOccurrences(files)
  const manifest = loadManifest()

  if (sub === 'report') {
    const md = buildReport(occurrences, manifest)
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
    fs.writeFileSync(REPORT_PATH, md, 'utf-8')
    process.stdout.write(
      `[image-mappings] report → ${REPORT_PATH} (TODO ${occurrences.length}건, 미매칭 페이지 ${new Set(occurrences.map((o) => o.filePath)).size}개)\n`,
    )
    return
  }

  if (sub === 'template') {
    const json = buildTemplate(occurrences)
    fs.writeFileSync(TEMPLATE_PATH, json, 'utf-8')
    process.stdout.write(
      `[image-mappings] template → ${TEMPLATE_PATH} (${occurrences.length}개 항목)\n`,
    )
    return
  }

  if (sub === 'apply') {
    const r = applyMappings(occurrences, manifest)
    process.stdout.write(`[image-mappings] apply 결과:\n`)
    process.stdout.write(`  - 수정 파일: ${r.filesModified}\n`)
    process.stdout.write(`  - 교체 마커: ${r.markersReplaced}\n`)
    if (r.unmatchedMappings.length > 0) {
      process.stdout.write(`  - 매핑 명세에 있으나 본문에 없는 key: ${r.unmatchedMappings.length}\n`)
      for (const k of r.unmatchedMappings.slice(0, 5)) {
        process.stdout.write(`    · ${k}\n`)
      }
    }
    if (r.errors.length > 0) {
      process.stderr.write(`  - 오류: ${r.errors.length}건 (apply 중단)\n`)
      for (const e of r.errors.slice(0, 10)) {
        process.stderr.write(`    · ${e}\n`)
      }
      process.exit(1)
    }
    return
  }

  process.stderr.write(`사용법: tsx scripts/image-mappings.ts [report|template|apply]\n`)
  process.exit(2)
}

main().catch((err) => {
  process.stderr.write(`[image-mappings] 예외: ${(err as Error).message}\n`)
  process.exit(1)
})
