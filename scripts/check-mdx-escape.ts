#!/usr/bin/env tsx
/**
 * webfortd MDX escape 정합성 검사 — M5
 *
 * KbPageLayout.tsx가 렌더 시점에 다음을 변환한다:
 *   - `<!--...-->` → 제거
 *   - `<` → `&lt;`
 *   - `{` → `&#123;`
 *   - `}` → `&#125;`
 *
 * 콘텐츠 본문에 의도된 HTML/JSX가 거의 없으므로 안전하지만, 향후 검수자가 표 안에
 * `<br>` 또는 JSX-스러운 표현을 직접 작성할 가능성이 있다. 이 스크립트는 PR diff에서
 * 변경된 .md 파일을 스캔해 escape 대상 패턴이 본문에 있으면 경고로 기록한다.
 *
 * 정책: warning-only(exit 0). 향후 escape 동작이 명세되면 gate로 승격 가능.
 *
 * 출력: `/tmp/mdx-escape-issues.json` — 빈 배열이면 OK.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const ISSUES_PATH = process.env.MDX_ESCAPE_ISSUES_PATH ?? '/tmp/mdx-escape-issues.json'

interface EscapeIssue {
  file: string
  line: number
  pattern: 'html-tag' | 'jsx-expression' | 'html-comment'
  snippet: string
}

// KbPageLayout이 보존하는 의도된 HTML 패턴 — false positive 최소화.
// `<!-- TODO: image-link ... -->`는 M3/M4 산출물이라 명시 허용.
const ALLOWED_PATTERNS = [
  /<!--\s*TODO:\s*image-link/, // M3/M4 이미지 매핑 마커(렌더 시 제거되도록 의도됨)
]

function isAllowed(line: string): boolean {
  return ALLOWED_PATTERNS.some((re) => re.test(line))
}

function getChangedContentFiles(): string[] | null {
  const eventName = process.env.GITHUB_EVENT_NAME
  if (!eventName) return null

  try {
    // coderabbit P1 #3: execFileSync로 shell 해석 회피 (defense-in-depth).
    let diffArgs: string[]
    if (eventName === 'pull_request') {
      const base = process.env.GITHUB_BASE_REF ?? 'main'
      diffArgs = ['diff', '--name-only', `origin/${base}...HEAD`]
    } else {
      diffArgs = ['diff', '--name-only', 'HEAD^', 'HEAD']
    }
    const output = execFileSync('git', diffArgs, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    return output
      .trim()
      .split('\n')
      .filter((f) => f.startsWith('content/') && f.endsWith('.md'))
  } catch (e) {
    process.stderr.write(
      `[check-mdx-escape] git diff 실패: ${(e as Error).message}\n`,
    )
    return null
  }
}

function scanFile(absPath: string, relPath: string): EscapeIssue[] {
  const content = fs.readFileSync(absPath, 'utf-8')
  const { content: body } = matter(content)
  const lines = body.split('\n')
  const issues: EscapeIssue[] = []

  // 본문의 시작 라인 = frontmatter 끝 다음 줄. 본문 라인 인덱스 그대로 1-indexed 사용.
  // 단 PR 코멘트에 노출되는 라인은 본문 기준이므로 사용자가 frontmatter 라인 수를 더해야
  // 정확한 파일 라인을 얻을 수 있다. 메시지에 본문 기준임을 명시.

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isAllowed(line)) continue

    if (/<[a-zA-Z]/.test(line)) {
      issues.push({
        file: relPath,
        line: i + 1,
        pattern: 'html-tag',
        snippet: line.slice(0, 120),
      })
    } else if (/<!--[\s\S]*?-->/.test(line)) {
      issues.push({
        file: relPath,
        line: i + 1,
        pattern: 'html-comment',
        snippet: line.slice(0, 120),
      })
    }
    // JSX 표현식: `{...}` 패턴. 단 markdown link/image의 `]({url})`은 위치 다름.
    // 보수적으로 `{문자열}` 형태만 잡되, 단순 `{` 단독은 무시.
    if (/\{[a-zA-Z_$][^}\n]*\}/.test(line)) {
      issues.push({
        file: relPath,
        line: i + 1,
        pattern: 'jsx-expression',
        snippet: line.slice(0, 120),
      })
    }
  }
  return issues
}

function main(): void {
  const changed = getChangedContentFiles()
  if (changed === null) {
    process.stdout.write(`[check-mdx-escape] CI diff 없음 — 검사 생략\n`)
    fs.writeFileSync(ISSUES_PATH, '[]', 'utf-8')
    process.exit(0)
  }
  if (changed.length === 0) {
    process.stdout.write(`[check-mdx-escape] 변경된 .md 없음\n`)
    fs.writeFileSync(ISSUES_PATH, '[]', 'utf-8')
    process.exit(0)
  }

  const allIssues: EscapeIssue[] = []
  for (const rel of changed) {
    const abs = path.join(REPO_ROOT, rel)
    if (!fs.existsSync(abs)) continue // PR이 파일을 삭제했을 수 있음
    allIssues.push(...scanFile(abs, rel))
  }

  fs.writeFileSync(ISSUES_PATH, JSON.stringify(allIssues, null, 2), 'utf-8')

  if (allIssues.length > 0) {
    process.stdout.write(
      `[check-mdx-escape] 경고: escape 대상 패턴 ${allIssues.length}건 (warning-only) — ${ISSUES_PATH}\n`,
    )
  } else {
    process.stdout.write(`[check-mdx-escape] escape 대상 패턴 없음\n`)
  }
  process.exit(0)
}

main()
