#!/usr/bin/env tsx
/**
 * webfortd alt_text_complete 라벨링 — M5
 *
 * CI에서 PR diff 안에 `frontmatter.accessibility.alt_text_complete === false`인
 * 콘텐츠 파일이 포함된 경우, 후속 워크플로 스텝이 `reviewed:accessibility` 라벨을
 * 자동 부착할 수 있도록 `/tmp/alt-text-incomplete.flag`에 슬러그 목록을 기록한다.
 *
 * 실행 컨텍스트:
 *   - GitHub Actions `pull_request` 이벤트에서 호출.
 *   - 사전조건: actions/checkout에 fetch-depth: 0 또는 충분한 history.
 *   - 사전조건: npm run sync:content이 먼저 실행되어 kb-index.generated.json 존재.
 *
 * 비-CI 환경에서 GITHUB_EVENT_NAME이 없으면 변경 파일 분석을 생략하고
 * 전체 인덱스에서 incomplete 페이지 수만 보고한다(경고용).
 *
 * 종료 코드:
 *   0  — 항상 0. exit code로 워크플로 실패를 트리거하지 않는다(경고만).
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const INDEX_PATH = path.join(REPO_ROOT, 'src/lib/kb-index.generated.json')
const FLAG_PATH = process.env.ALT_TEXT_FLAG_PATH ?? '/tmp/alt-text-incomplete.flag'

interface IndexDocument {
  slug: string
  filePath: string
  frontmatter: {
    accessibility?: {
      alt_text_complete?: boolean
    }
  }
}

interface KBIndex {
  documents: IndexDocument[]
}

function loadIndex(): KBIndex | null {
  if (!fs.existsSync(INDEX_PATH)) {
    process.stderr.write(
      `[check-alt-text] kb-index.generated.json 없음 — sync:content 먼저 실행하세요\n`,
    )
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')) as KBIndex
  } catch (e) {
    process.stderr.write(`[check-alt-text] 인덱스 파싱 실패: ${(e as Error).message}\n`)
    return null
  }
}

/**
 * git diff에서 변경된 content/*.md 파일 목록 추출.
 * PR 이벤트: origin/<base>...HEAD, push 이벤트: HEAD^...HEAD.
 * CI 외부에서는 빈 배열 반환(전체 인덱스 보고로 fallback).
 */
function getChangedContentFiles(): string[] | null {
  const eventName = process.env.GITHUB_EVENT_NAME
  if (!eventName) return null

  try {
    let diffCmd: string
    if (eventName === 'pull_request') {
      const base = process.env.GITHUB_BASE_REF ?? 'main'
      // origin/<base>가 fetch되어 있어야 함. fetch-depth: 0 권장.
      diffCmd = `git diff --name-only origin/${base}...HEAD`
    } else {
      diffCmd = `git diff --name-only HEAD^ HEAD`
    }
    const output = execSync(diffCmd, { cwd: REPO_ROOT, encoding: 'utf-8' })
    return output
      .trim()
      .split('\n')
      .filter((f) => f.startsWith('content/') && f.endsWith('.md'))
  } catch (e) {
    process.stderr.write(
      `[check-alt-text] git diff 실패 (history 부족?): ${(e as Error).message}\n`,
    )
    return null
  }
}

function main(): void {
  const index = loadIndex()
  if (!index) {
    process.exit(0)
  }

  const changed = getChangedContentFiles()
  let candidates: IndexDocument[]

  if (changed === null) {
    process.stderr.write(
      `[check-alt-text] CI diff 정보 없음 — 전체 인덱스 보고 모드\n`,
    )
    candidates = index.documents
  } else if (changed.length === 0) {
    process.stdout.write(`[check-alt-text] 변경된 .md 없음\n`)
    // flag 파일 비우기(이전 실행 잔여물 제거)
    if (fs.existsSync(FLAG_PATH)) fs.unlinkSync(FLAG_PATH)
    process.exit(0)
  } else {
    const changedSet = new Set(changed)
    candidates = index.documents.filter((d) => changedSet.has(d.filePath))
  }

  const incomplete = candidates.filter(
    (d) => d.frontmatter.accessibility?.alt_text_complete === false,
  )

  if (incomplete.length > 0) {
    const slugs = incomplete.map((d) => d.slug).join('\n')
    fs.writeFileSync(FLAG_PATH, slugs + '\n', 'utf-8')
    process.stdout.write(
      `[check-alt-text] alt_text_complete=false 페이지 ${incomplete.length}건 발견 — ${FLAG_PATH} 기록\n`,
    )
  } else {
    process.stdout.write(`[check-alt-text] alt_text 미완성 페이지 없음\n`)
    if (fs.existsSync(FLAG_PATH)) fs.unlinkSync(FLAG_PATH)
  }

  process.exit(0)
}

main()
