#!/usr/bin/env tsx
/**
 * 대응표(docs/slug-migration-2026-08.csv)로 내부 참조를 일괄 갱신 (설계 §3.5)
 *
 * 실행:
 *   tsx scripts/apply-slug-migration.ts [--csv docs/slug-migration-2026-08.csv] [--dry-run]
 *
 * 대상:
 *   - content/_axis-overrides.json 키
 *   - src/lib/media-curation.ts · wiki-role-entries.ts · wiki-popular.ts 의 슬러그 문자열(+ `/<axis>/<slug>` href의 axis 보정)
 *   - content/faq·resources·agreements 본문의 `[[구슬러그]]` 위키링크
 *   - tests 고정값(AxisDocList·atomic-samples·media-curation)
 * 규칙: 토큰 경계(`[a-z0-9-]` 인접 불가)에서만 치환. 대응표에 없는 구 슬러그가 남으면 목록으로 출력하고 그 자리는 손대지 않는다.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const OLD_SLUG_RE = /\b(2023-research|2023-hr|2024-jbu|2024-staff)-[a-z0-9-]+/g
const AXIS_DIRS = ['disability-types', 'domains', 'regions', 'policies', 'uncategorized']

const TEXT_TARGETS = [
  'src/lib/media-curation.ts',
  'src/lib/wiki-role-entries.ts',
  'src/lib/wiki-popular.ts',
  'tests/components/AxisDocList.test.tsx',
  'tests/a11y/atomic-samples.spec.ts',
  'tests/media/media-curation.test.ts',
]
const WIKILINK_DIRS = ['content/faq', 'content/resources', 'content/agreements']

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
  return rows
}

function walkMd(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walkMd(full))
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full)
  }
  return out
}

function currentAxisOf(slug: string): string | null {
  for (const axis of AXIS_DIRS) {
    if (fs.existsSync(path.join(REPO_ROOT, 'content', axis, `${slug}.md`))) return axis
  }
  return null
}

function main(): void {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const csvIdx = argv.indexOf('--csv')
  const csvPath = path.resolve(REPO_ROOT, csvIdx >= 0 ? argv[csvIdx + 1] : 'docs/slug-migration-2026-08.csv')
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'))
  const header = rows.shift()!
  const col = (name: string) => header.indexOf(name)
  const map = new Map<string, string>()
  for (const r of rows) {
    if (!r[col('old_slug')]) continue
    if (r[col('new_slug')]) map.set(r[col('old_slug')], r[col('new_slug')])
  }
  process.stdout.write(`[apply-slug-migration] 대응 ${map.size}건 로드${dryRun ? ' (DRY RUN)' : ''}\n`)

  const unmatched = new Map<string, Set<string>>()
  const noteUnmatched = (file: string, slug: string) => {
    if (!unmatched.has(slug)) unmatched.set(slug, new Set())
    unmatched.get(slug)!.add(file)
  }
  let filesChanged = 0

  const replaceInText = (file: string, text: string): string => {
    const rel = path.relative(REPO_ROOT, file)
    let out = text.replace(OLD_SLUG_RE, (m) => {
      if (map.has(m)) return map.get(m)!
      // 이미 새 주소이거나 대응표에 없음 — 새 content에 존재하면 새 주소로 간주
      if (currentAxisOf(m)) return m
      noteUnmatched(rel, m)
      return m
    })
    // `/<axis>/<slug>` 경로의 axis를 새 파일 위치로 보정
    out = out.replace(new RegExp(`/(${AXIS_DIRS.join('|')})/((?:2023-research|2023-hr|2024-jbu|2024-staff)-[a-z0-9-]+)`, 'g'), (m, axis: string, slug: string) => {
      const actual = currentAxisOf(slug)
      return actual && actual !== axis ? `/${actual}/${slug}` : m
    })
    return out
  }

  // 1) 텍스트 대상
  const targets = [
    ...TEXT_TARGETS.map((p) => path.join(REPO_ROOT, p)),
    ...WIKILINK_DIRS.flatMap((d) => walkMd(path.join(REPO_ROOT, d))),
  ]
  for (const file of targets) {
    if (!fs.existsSync(file)) continue
    const before = fs.readFileSync(file, 'utf-8')
    const after = replaceInText(file, before)
    if (after !== before) {
      filesChanged++
      process.stdout.write(`  · ${path.relative(REPO_ROOT, file)}\n`)
      if (!dryRun) fs.writeFileSync(file, after, 'utf-8')
    }
  }

  // 2) _axis-overrides.json 키
  const overridesPath = path.join(REPO_ROOT, 'content/_axis-overrides.json')
  if (fs.existsSync(overridesPath)) {
    const raw = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'))
    const next: Record<string, string> = {}
    const conflicts: string[] = []
    for (const [slug, axis] of Object.entries(raw.overrides ?? {}) as Array<[string, string]>) {
      const target = map.get(slug) ?? (currentAxisOf(slug) ? slug : null)
      if (!target) { noteUnmatched('content/_axis-overrides.json', slug); continue }
      if (next[target] && next[target] !== axis) { conflicts.push(`${target}: ${next[target]} vs ${axis} (from ${slug})`); continue }
      next[target] = axis
    }
    const sorted: Record<string, string> = {}
    for (const k of Object.keys(next).sort()) sorted[k] = next[k]
    raw.overrides = sorted
    if (conflicts.length > 0) process.stdout.write(`  ! axis override 충돌(수동 판정 필요, 첫 값 유지):\n    ${conflicts.join('\n    ')}\n`)
    process.stdout.write(`  · content/_axis-overrides.json (${Object.keys(sorted).length}키)\n`)
    if (!dryRun) fs.writeFileSync(overridesPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8')
    filesChanged++
  }

  process.stdout.write(`[apply-slug-migration] 변경 파일 ${filesChanged}개\n`)
  if (unmatched.size > 0) {
    process.stdout.write(`[apply-slug-migration] 대응 없는 구 주소 ${unmatched.size}건(치환 안 함):\n`)
    for (const [slug, files] of unmatched) process.stdout.write(`  · ${slug} ← ${[...files].join(', ')}\n`)
  }
}

main()
