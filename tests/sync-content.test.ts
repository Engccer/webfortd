/**
 * sync-content.ts 회귀 테스트
 *
 * 테스트 A: idempotency (두 번 실행 → 동일 바이트)
 *           generated_at: SYNC_TIMESTAMP 없으면 null, 있으면 그 값
 *
 * 테스트 B: 위키링크 추출 엣지 케이스
 *   - 일반 [[slug]]
 *   - alias [[slug|표시명]]
 *   - 코드블록 안 [[X]] 무시
 *   - 인라인 코드 안 `[[X]]` 무시
 *   - 존재하지 않는 slug → broken_wikilinks
 *   - 중복 위키링크 → adjacency에 1번만, backlinks에 횟수만큼
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import os from 'node:os'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx')
const SYNC_SCRIPT = path.join(REPO_ROOT, 'scripts/sync-content.ts')

// 유효한 frontmatter 템플릿 (FrontmatterSchema 통과)
function validFrontmatter(title: string): string {
  return `---
title: "${title}"
type: "안내서"
disability_types: ["전체"]
domains: ["인사관리"]
regions: ["전국"]
year: 2023
status: "published"
reviewed_by: ["test-reviewer"]
reviewed_at: "2026-01-01"
source:
  organization: "테스트기관"
  citation: "테스트기관(2023). ${title}."
source_origin: "test"
---

`
}

// 임시 콘텐츠 디렉터리를 생성하고 파일들을 세팅하는 헬퍼
function createTempContentDir(
  files: Record<string, string>, // "content/axis/slug.md" → 파일 내용
): { tmpRoot: string; contentDir: string; outputPath: string } {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'webfortd-test-'))
  const contentDir = path.join(tmpRoot, 'content')
  const outputPath = path.join(tmpRoot, 'kb-index.json')

  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(tmpRoot, relPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf-8')
  }

  return { tmpRoot, contentDir, outputPath }
}

// sync-content.ts를 실행하고 결과 JSON을 반환
function runSync(
  contentDir: string,
  outputPath: string,
  env: Record<string, string> = {},
): unknown {
  execFileSync(TSX_BIN, [SYNC_SCRIPT], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      WEBFORTD_CONTENT_DIR: contentDir,
      WEBFORTD_OUTPUT_PATH: outputPath,
      ...env,
    },
    stdio: 'pipe',
  })
  return JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
}

// ============================================================
// A. Idempotency
// ============================================================

describe('A. sync-content idempotency', () => {
  let tmpRoot = ''
  let contentDir = ''
  let outputPath = ''

  before(() => {
    ;({ tmpRoot, contentDir, outputPath } = createTempContentDir({
      'content/resources/research/doc-alpha.md':
        validFrontmatter('문서 알파') + '## 내용\n본문 내용입니다.\n',
      'content/resources/law/doc-beta.md':
        validFrontmatter('문서 베타') + '본문.\n',
    }))
  })

  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('두 번 실행 결과 바이트가 동일해야 한다', () => {
    const first = fs.readFileSync(
      (runSync(contentDir, outputPath), outputPath),
    )
    runSync(contentDir, outputPath)
    const second = fs.readFileSync(outputPath)

    assert.equal(
      first.toString('utf-8'),
      second.toString('utf-8'),
      '두 번째 실행 결과가 첫 번째와 달라 idempotency 위반',
    )
  })

  it('SYNC_TIMESTAMP 없으면 generated_at이 null이어야 한다', () => {
    const result = runSync(contentDir, outputPath) as { generated_at: unknown }
    assert.equal(result.generated_at, null)
  })

  it('SYNC_TIMESTAMP 세팅 시 generated_at에 그 값이 들어가야 한다', () => {
    const ts = '2026-01-01T00:00:00Z'
    const result = runSync(contentDir, outputPath, { SYNC_TIMESTAMP: ts }) as {
      generated_at: unknown
    }
    assert.equal(result.generated_at, ts)
  })

  it('content_hash는 두 번 실행 사이에 동일해야 한다', () => {
    const r1 = runSync(contentDir, outputPath) as { content_hash: string }
    const r2 = runSync(contentDir, outputPath) as { content_hash: string }
    assert.equal(r1.content_hash, r2.content_hash)
  })

  it('source_count가 파일 수와 일치해야 한다', () => {
    const result = runSync(contentDir, outputPath) as { source_count: number }
    assert.equal(result.source_count, 2)
  })
})

// ============================================================
// B. 위키링크 추출 엣지 케이스
// ============================================================

describe('B. 위키링크 추출 엣지 케이스', () => {
  let tmpRoot = ''
  let contentDir = ''
  let outputPath = ''

  // 위키링크 테스트를 위해 여러 문서가 필요
  before(() => {
    ;({ tmpRoot, contentDir, outputPath } = createTempContentDir({
      // 소스 문서: 다양한 위키링크 패턴 포함
      'content/resources/research/source-doc.md':
        validFrontmatter('소스 문서') +
        [
          '일반 링크: [[target-doc]]',
          'alias 링크: [[target-doc|표시명]]',
          'anchor 링크: [[target-doc#보조공학]]',
          'anchor + alias: [[target-doc#권리구제|구제 가이드]]',
          '코드블록 안은 무시:',
          '```',
          '[[ignored-in-fence]]',
          '```',
          '인라인 코드 안도 무시: `[[ignored-inline]]`',
          '존재하지 않는 링크: [[nonexistent-slug]]',
          '중복 링크 첫 번째: [[target-doc]]',
          '중복 링크 두 번째: [[target-doc]]',
        ].join('\n') + '\n',

      // 대상 문서 (링크 받는 쪽)
      'content/resources/research/target-doc.md':
        validFrontmatter('대상 문서') + '본문.\n',
    }))
    runSync(contentDir, outputPath)
  })

  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  function loadIndex(): {
    wiki_backlinks: Record<string, Array<{ from: string; anchor?: string; link_text?: string }>>
    broken_wikilinks: Array<{ source: string; target: string; line: number }>
    wikilink_adjacency: Record<string, string[]>
  } {
    return JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
  }

  it('일반 [[slug]] — target-doc의 backlinks에 source-doc이 포함되어야 한다', () => {
    const { wiki_backlinks } = loadIndex()
    const backlinks = wiki_backlinks['target-doc'] ?? []
    const fromSlugs = backlinks.map((b) => b.from)
    assert.ok(
      fromSlugs.includes('source-doc'),
      `wiki_backlinks['target-doc'] 에 source-doc이 없음: ${JSON.stringify(fromSlugs)}`,
    )
  })

  // codex-rescue M6 P1: anchor와 link_text가 별개 의미로 분리됨.
  it('alias [[slug|표시명]] — link_text 필드로 저장, anchor와 분리', () => {
    const { wiki_backlinks } = loadIndex()
    const backlinks = wiki_backlinks['target-doc'] ?? []
    const withLinkText = backlinks.filter((b) => b.link_text === '표시명')
    assert.ok(
      withLinkText.length > 0,
      `link_text='표시명'인 backlink가 없음: ${JSON.stringify(backlinks)}`,
    )
    // anchor 필드는 link_text와 별개 — alias 단독 링크에는 anchor 없어야 함.
    const aliasOnly = withLinkText.find((b) => !b.anchor)
    assert.ok(
      aliasOnly !== undefined,
      `alias-only backlink는 anchor 없어야 함: ${JSON.stringify(withLinkText)}`,
    )
  })

  it('anchor [[slug#section]] — anchor 필드만 채움, link_text는 비움', () => {
    const { wiki_backlinks } = loadIndex()
    const backlinks = wiki_backlinks['target-doc'] ?? []
    const anchorOnly = backlinks.find(
      (b) => b.anchor === '보조공학' && !b.link_text,
    )
    assert.ok(
      anchorOnly !== undefined,
      `anchor='보조공학' + link_text 없음 backlink가 없음: ${JSON.stringify(backlinks)}`,
    )
  })

  it('anchor + alias [[slug#section|text]] — 두 필드 모두 채움', () => {
    const { wiki_backlinks } = loadIndex()
    const backlinks = wiki_backlinks['target-doc'] ?? []
    const both = backlinks.find(
      (b) => b.anchor === '권리구제' && b.link_text === '구제 가이드',
    )
    assert.ok(
      both !== undefined,
      `anchor + link_text 양쪽 채움 backlink가 없음: ${JSON.stringify(backlinks)}`,
    )
  })

  it('코드블록 안 [[ignored-in-fence]] — backlinks나 broken_wikilinks에 나타나면 안 된다', () => {
    const { wiki_backlinks, broken_wikilinks } = loadIndex()
    const allTargets = [
      ...Object.keys(wiki_backlinks),
      ...broken_wikilinks.map((b) => b.target),
    ]
    assert.ok(
      !allTargets.includes('ignored-in-fence'),
      '코드블록 안 위키링크가 추출됨 (마스킹 실패)',
    )
  })

  it('인라인 코드 안 [[ignored-inline]] — 추출되면 안 된다', () => {
    const { wiki_backlinks, broken_wikilinks } = loadIndex()
    const allTargets = [
      ...Object.keys(wiki_backlinks),
      ...broken_wikilinks.map((b) => b.target),
    ]
    assert.ok(
      !allTargets.includes('ignored-inline'),
      '인라인 코드 안 위키링크가 추출됨 (마스킹 실패)',
    )
  })

  it('존재하지 않는 slug → broken_wikilinks에 등장해야 한다', () => {
    const { broken_wikilinks } = loadIndex()
    const broken = broken_wikilinks.filter(
      (b) => b.source === 'source-doc' && b.target === 'nonexistent-slug',
    )
    assert.ok(
      broken.length > 0,
      `nonexistent-slug가 broken_wikilinks에 없음: ${JSON.stringify(broken_wikilinks)}`,
    )
  })

  it('중복 위키링크 — adjacency에는 1번만 등장해야 한다', () => {
    const { wikilink_adjacency } = loadIndex()
    const adj = wikilink_adjacency['source-doc'] ?? []
    const count = adj.filter((s) => s === 'target-doc').length
    assert.equal(count, 1, `wikilink_adjacency에 target-doc이 ${count}번 등장 (1번이어야 함)`)
  })

  it('중복 위키링크 — backlinks에는 횟수만큼 등장해야 한다', () => {
    const { wiki_backlinks } = loadIndex()
    const backlinks = wiki_backlinks['target-doc'] ?? []
    // source-doc → target-doc 링크: 일반 1회 + alias 1회 + 중복 2회 = 총 4회
    const fromSourceDoc = backlinks.filter((b) => b.from === 'source-doc')
    assert.ok(
      fromSourceDoc.length > 1,
      `backlinks에 중복 횟수가 반영되지 않음: ${fromSourceDoc.length}건 (2건 이상이어야 함)`,
    )
  })
})
