#!/usr/bin/env tsx
/**
 * 구 주소 → 새 주소 대응표 생성 (3층 재생성 2026-08, 설계 §3.5)
 *
 * 실행:
 *   tsx scripts/slug-migration.ts --old <재생성 전 content 스냅샷 디렉터리> [--out docs/slug-migration-2026-08.csv]
 *
 * 매칭 순서(출처 source_origin 안에서만):
 *   ① 제목 정규화 일치(번호·쪽수·공백·문장부호 제거, 중복 해소 접두 무시). 새 페이지 본문 안 소제목과의
 *      일치도 인정(v3가 잘게 쪼갠 조각이 새 페이지에 흡수된 N:1). 후보가 여럿이면 본문 포함도로 택1
 *   ② 본문 3-gram 포함도(구 문서 shingle 중 새 문서에 있는 비율, 앞 8,000자, 임계 0.5).
 *      설계 §3.5의 Jaccard는 분해 단위가 달라진 N:1에서 크기 차이 때문에 낮게 나와 포함도로 대체
 *   ③ 미매칭(new_slug 빈칸, 참고용 최고 점수만)
 * 출력 CSV 열: old_slug,new_slug,old_title,new_title,method,score
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { stripOutlineNumber } from './lib/outline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const NEW_CONTENT_DIR = path.join(REPO_ROOT, 'content')
const MIGRATED_ORIGINS = new Set([
  '2023-disability-types-work-support-report',
  '2023-hr-guide',
  '2024-jbu-work-support-guide',
  '2024-support-staff-duty-guide',
])
const CONTAINMENT_MIN = 0.5
const SHINGLE_CHARS = 8000

interface Doc {
  slug: string
  origin: string
  title: string
  titleKey: string
  /** 중복 해소 접두를 뗀 제목 키(새 문서만 의미 있음) */
  titleKeyAlt: string
  /** 본문 안 소제목(`##`~`######`)의 정규화 키 */
  subheadingKeys: Set<string>
  shingles: Set<string>
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(full))
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full)
  }
  return out
}

function normalizeTitle(title: string): string {
  return stripOutlineNumber(title)
    .replace(/\s\(\d+\/\d+\)$/, '')
    .replace(/\s\d{1,3}$/, '')
    .replace(/[\s·ㆍ、,.:;()\[\]<>〈〉「」『』'"“”‘’\-–—_/]/g, '')
    .toLowerCase()
}

/** 「시각장애인교원 지원 방안 가. 교수학습 …」처럼 접두가 붙은 제목에서 첫 번호 표지 이후만 */
function dedupSuffix(title: string): string {
  const m = title.match(/\s((?:[가-힣][.)]|\(\d{1,2}\)|\d{1,2}[.)]|[①-⑳㉠-㉭]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\.)\s*.+)$/)
  return m ? m[1] : title
}

function cleanBody(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n## 관련 페이지[\s\S]*$/, '')
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/[\s|*#>_`~-]/g, '')
}

function shingles(text: string): Set<string> {
  const t = text.slice(0, SHINGLE_CHARS)
  const set = new Set<string>()
  for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3))
  return set
}

/** 구 문서(a)의 shingle 중 새 문서(b)에 들어 있는 비율 */
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const s of a) if (b.has(s)) inter++
  return inter / a.size
}

function loadDocs(dir: string): Doc[] {
  const docs: Doc[] = []
  for (const file of walk(dir)) {
    const raw = fs.readFileSync(file, 'utf-8')
    let parsed: matter.GrayMatterFile<string>
    try { parsed = matter(raw) } catch { continue }
    const origin = String(parsed.data.source_origin ?? '')
    if (!MIGRATED_ORIGINS.has(origin)) continue
    const title = String(parsed.data.title ?? '')
    docs.push({
      slug: path.basename(file, '.md'),
      origin,
      title,
      titleKey: normalizeTitle(title),
      titleKeyAlt: normalizeTitle(dedupSuffix(title)),
      subheadingKeys: new Set(
        [...parsed.content.matchAll(/^#{2,6}\s+(.+?)\s*$/gm)].map((m) => normalizeTitle(m[1])),
      ),
      shingles: shingles(cleanBody(parsed.content)),
    })
  }
  return docs.sort((a, b) => a.slug.localeCompare(b.slug))
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function main(): void {
  const argv = process.argv.slice(2)
  const oldIdx = argv.indexOf('--old')
  if (oldIdx < 0 || !argv[oldIdx + 1]) {
    process.stderr.write('사용법: tsx scripts/slug-migration.ts --old <구 content 디렉터리> [--out <csv>]\n')
    process.exit(1)
  }
  const oldDir = path.resolve(argv[oldIdx + 1])
  const outIdx = argv.indexOf('--out')
  const outPath = path.resolve(REPO_ROOT, outIdx >= 0 ? argv[outIdx + 1] : 'docs/slug-migration-2026-08.csv')

  const oldDocs = loadDocs(oldDir)
  const newDocs = loadDocs(NEW_CONTENT_DIR)
  process.stdout.write(`[slug-migration] 구 ${oldDocs.length}건 / 신 ${newDocs.length}건\n`)

  const rows: Array<{ old: Doc; nu: Doc | null; method: string; score: number }> = []
  const claimed = new Set<string>()
  const stats = { title: 0, jaccard: 0, unmatched: 0 }

  for (const old of oldDocs) {
    const pool = newDocs.filter((n) => n.origin === old.origin)
    // ① 제목 일치
    const titleHits = pool.filter((n) => n.titleKey === old.titleKey || n.titleKeyAlt === old.titleKey)
    const subHits = titleHits.length === 0 && old.titleKey.length >= 2
      ? pool.filter((n) => n.subheadingKeys.has(old.titleKey))
      : []
    const hits = titleHits.length > 0 ? titleHits : subHits
    if (hits.length >= 1) {
      let best = hits[0]
      let bestScore = containment(old.shingles, best.shingles)
      for (const cand of hits.slice(1)) {
        const sc = containment(old.shingles, cand.shingles)
        if (sc > bestScore) { best = cand; bestScore = sc }
      }
      const base = titleHits.length > 0 ? 'title' : 'subheading'
      rows.push({ old, nu: best, method: hits.length > 1 ? `${base}+containment` : base, score: bestScore })
      claimed.add(best.slug)
      stats.title++
      continue
    }
    // ② 본문 유사도
    let best: Doc | null = null
    let bestScore = 0
    for (const cand of pool) {
      const sc = containment(old.shingles, cand.shingles)
      if (sc > bestScore) { best = cand; bestScore = sc }
    }
    if (best && bestScore >= CONTAINMENT_MIN) {
      rows.push({ old, nu: best, method: 'containment', score: bestScore })
      claimed.add(best.slug)
      stats.jaccard++
    } else {
      rows.push({ old, nu: best, method: 'unmatched', score: bestScore })
      stats.unmatched++
    }
  }

  const lines = ['old_slug,new_slug,old_title,new_title,method,score']
  for (const r of rows) {
    lines.push([
      r.old.slug,
      r.method === 'unmatched' ? '' : r.nu?.slug ?? '',
      r.old.title,
      r.method === 'unmatched' ? '' : r.nu?.title ?? '',
      r.method,
      r.score.toFixed(3),
    ].map(csvCell).join(','))
  }
  fs.writeFileSync(outPath, '﻿' + lines.join('\n') + '\n', 'utf-8')

  const newOnly = newDocs.filter((n) => !claimed.has(n.slug))
  process.stdout.write(
    `[slug-migration] 제목·소제목 일치 ${stats.title} / 본문 포함도 ${stats.jaccard} / 미매칭 ${stats.unmatched} → ${path.relative(REPO_ROOT, outPath)}\n` +
    `[slug-migration] 구 문서가 가리키지 않는 새 문서 ${newOnly.length}건(개요·분할·병합으로 생긴 페이지 포함)\n`,
  )
  if (stats.unmatched > 0) {
    process.stdout.write('[slug-migration] 미매칭(참고 최고 점수):\n')
    for (const r of rows.filter((x) => x.method === 'unmatched')) {
      process.stdout.write(`  · ${r.old.slug} 「${r.old.title.slice(0, 40)}」 → ${r.nu?.slug ?? '-'} (${r.score.toFixed(2)})\n`)
    }
  }
}

main()
