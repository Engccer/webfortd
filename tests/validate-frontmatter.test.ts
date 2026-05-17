/**
 * validate-frontmatter.ts 회귀 테스트
 *
 * 테스트 C:
 *   - 실제 3개 파일 통과 (exit 0)
 *   - reserved key 주입 → exit 1, 해당 키 언급
 *   - 잘못된 axis → exit 1, invalid_axis 코드
 *   - .mdx 확장자 → exit 1, invalid_extension 코드
 *   - 슬러그 중복 → exit 1, duplicate_slug 코드
 *
 * 모든 fixture 테스트는 격리된 임시 디렉터리에서 수행.
 * 실제 content/ 디렉터리를 건드리지 않는다.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import os from 'node:os'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx')
const VALIDATE_SCRIPT = path.join(REPO_ROOT, 'scripts/validate-frontmatter.ts')
const REAL_CONTENT_DIR = path.join(REPO_ROOT, 'content')

// 유효한 frontmatter 템플릿
function validFrontmatter(title: string, extra: string = ''): string {
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
source_origin: "test"${extra ? '\n' + extra : ''}
---

본문입니다.
`
}

// validate-frontmatter.ts를 실행하고 결과를 반환
function runValidate(
  contentDir: string,
  env: Record<string, string> = {},
): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync(TSX_BIN, [VALIDATE_SCRIPT], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      WEBFORTD_CONTENT_DIR: contentDir,
      ...env,
    },
    encoding: 'utf-8',
  })
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

// 임시 디렉터리에 파일들을 생성하는 헬퍼
function createTempDir(
  files: Record<string, string>,
): { tmpRoot: string; contentDir: string } {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'webfortd-test-'))
  const contentDir = path.join(tmpRoot, 'content')

  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(tmpRoot, relPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf-8')
  }

  return { tmpRoot, contentDir }
}

// ============================================================
// C-1. 실제 콘텐츠 3개 파일 통과
// ============================================================

describe('C-1. 실제 content/ 3개 파일이 통과해야 한다', () => {
  it('exit 0 반환', () => {
    const { exitCode, stderr } = runValidate(REAL_CONTENT_DIR)
    assert.equal(
      exitCode,
      0,
      `validate-frontmatter가 exit 1을 반환함. stderr:\n${stderr}`,
    )
  })
})

// ============================================================
// C-2. Reserved key 주입 → exit 1
// ============================================================

describe('C-2. reserved key 주입 → exit 1', () => {
  const reservedKeys = ['slug', 'content_md', 'id'] as const

  for (const key of reservedKeys) {
    let tmpRoot = ''
    let contentDir = ''

    before(() => {
      ;({ tmpRoot, contentDir } = createTempDir({
        [`content/resources/research/test-reserved-${key}.md`]: validFrontmatter(
          `테스트 ${key}`,
          `${key}: "forbidden-value"`,
        ),
      }))
    })

    after(() => {
      if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
    })

    it(`'${key}' reserved key → exit 1, 오류 메시지에 '${key}' 포함`, () => {
      const { exitCode, stderr } = runValidate(contentDir)
      assert.equal(exitCode, 1, `exit 1이어야 하는데 ${exitCode}를 반환함`)
      assert.ok(
        stderr.includes(key),
        `오류 메시지에 '${key}'가 포함되어야 함.\nstderr: ${stderr}`,
      )
    })
  }
})

// ============================================================
// C-3. 잘못된 axis → exit 1, invalid_axis 코드
// ============================================================

describe('C-3. 잘못된 axis → exit 1, invalid_axis 코드', () => {
  let tmpRoot = ''
  let contentDir = ''

  before(() => {
    ;({ tmpRoot, contentDir } = createTempDir({
      'content/bad-axis/test-file.md': validFrontmatter('bad axis 테스트'),
    }))
  })

  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('exit 1 반환', () => {
    const { exitCode } = runValidate(contentDir)
    assert.equal(exitCode, 1)
  })

  it('stderr에 invalid_axis 코드 포함', () => {
    const { stderr } = runValidate(contentDir)
    assert.ok(
      stderr.includes('invalid_axis'),
      `stderr에 'invalid_axis' 코드가 없음:\n${stderr}`,
    )
  })
})

// ============================================================
// C-4. .mdx 확장자 → exit 1, invalid_extension 코드
// ============================================================

describe('C-4. .mdx 확장자 → exit 1, invalid_extension 코드', () => {
  let tmpRoot = ''
  let contentDir = ''

  before(() => {
    ;({ tmpRoot, contentDir } = createTempDir({
      'content/resources/research/test-file.mdx': validFrontmatter('MDX 테스트'),
    }))
  })

  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('exit 1 반환', () => {
    const { exitCode } = runValidate(contentDir)
    assert.equal(exitCode, 1)
  })

  it('stderr에 invalid_extension 코드 포함', () => {
    const { stderr } = runValidate(contentDir)
    assert.ok(
      stderr.includes('invalid_extension'),
      `stderr에 'invalid_extension' 코드가 없음:\n${stderr}`,
    )
  })
})

// ============================================================
// C-6. M5 라인 정밀도 — frontmatter 필드별 라인 번호
// ============================================================

describe('C-6. M5 라인 정밀도 — invalid year는 year 키의 실제 라인을 보고', () => {
  let tmpRoot = ''
  let contentDir = ''

  // year 필드를 7번째 줄에 두는 fixture. frontmatter 시작은 1번 줄(`---`),
  // 첫 키는 2번 줄. year는 7번째 줄.
  // 1: ---
  // 2: title: "라인 정밀도 테스트"
  // 3: type: "안내서"
  // 4: disability_types: ["전체"]
  // 5: domains: ["인사관리"]
  // 6: regions: ["전국"]
  // 7: year: 1500   <- 정밀 추적 대상
  // 8: status: "draft"
  // ...
  const FIXTURE = `---
title: "라인 정밀도 테스트"
type: "안내서"
disability_types: ["전체"]
domains: ["인사관리"]
regions: ["전국"]
year: 1500
status: "draft"
source:
  organization: "테스트기관"
  citation: "테스트기관(2023). 라인 정밀도 테스트."
source_origin: "test"
---

본문입니다.
`

  before(() => {
    ;({ tmpRoot, contentDir } = createTempDir({
      'content/resources/research/line-precision-test.md': FIXTURE,
    }))
  })

  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('exit 1 + stderr가 year 키의 실제 라인(7)을 포함', () => {
    const { exitCode, stderr } = runValidate(contentDir)
    assert.equal(exitCode, 1)
    // stderr 포맷: <file>:<line>: <code>: [<field>] <message>
    // year 키가 7번째 줄에 있으므로 `:7:`이 포함되어야 함.
    assert.ok(
      /line-precision-test\.md:7:/.test(stderr),
      `stderr가 year 키의 라인 7을 보고해야 함:\n${stderr}`,
    )
    assert.ok(
      stderr.includes('[year]'),
      `stderr가 [year] 필드를 명시해야 함:\n${stderr}`,
    )
  })
})

// ============================================================
// C-7. M5 Published gate — status='published' + reviewed_by 비어있음 → reject
// ============================================================

describe("C-7. M5 published gate — status='published' + reviewed_by 빈 배열 → exit 1", () => {
  let tmpRoot = ''
  let contentDir = ''

  const FIXTURE = `---
title: "검수 안 된 published"
type: "안내서"
disability_types: ["전체"]
domains: ["인사관리"]
regions: ["전국"]
year: 2023
status: "published"
reviewed_by: []
source:
  organization: "테스트기관"
  citation: "테스트기관(2023). 검수 안 된 published."
source_origin: "test"
---

본문입니다.
`

  before(() => {
    ;({ tmpRoot, contentDir } = createTempDir({
      'content/resources/research/unreviewed-published.md': FIXTURE,
    }))
  })

  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('exit 1 + reviewed_by 메시지 포함', () => {
    const { exitCode, stderr } = runValidate(contentDir)
    assert.equal(exitCode, 1, `exit 1이어야 함:\n${stderr}`)
    assert.ok(
      stderr.includes('reviewed_by'),
      `stderr에 reviewed_by 필드 언급이 있어야 함:\n${stderr}`,
    )
  })
})

// ============================================================
// C-8. M5 GitHub 파일 존재 + 핵심 구조
// ============================================================

describe('C-8. M5 GitHub 파일이 모두 존재하고 핵심 구조를 갖는다', () => {
  it('.github/workflows/content-validate.yml 존재 + 핵심 step 포함', () => {
    const p = path.join(REPO_ROOT, '.github/workflows/content-validate.yml')
    assert.ok(fs.existsSync(p), 'content-validate.yml 없음')
    const src = fs.readFileSync(p, 'utf-8')
    // 핵심 트리거
    assert.match(src, /pull_request:/, 'pull_request 트리거 없음')
    // 최소 permissions
    assert.match(src, /pull-requests:\s*write/, 'pull-requests:write 권한 없음')
    // idempotency 마커
    assert.match(src, /webfortd-content-validate/, 'BOT_MARKER 없음')
    // 핵심 npm 스크립트 호출
    assert.match(src, /npm run validate:content/, 'validate:content 호출 없음')
    assert.match(src, /npm run sync:content/, 'sync:content 호출 없음')
    // pull_request_target 트리거 사용 금지 (보안 — fork PR에서 secrets 노출 위험)
    // 주석 안 멘션은 OK. 실제 트리거 키로 쓰이는 라인만 차단.
    const triggerLines = src.split('\n').filter((l) => /^\s*pull_request_target\s*:/.test(l))
    assert.equal(
      triggerLines.length,
      0,
      `pull_request_target을 트리거로 사용 중. fork PR secret 노출 위험:\n${triggerLines.join('\n')}`,
    )
    // codex-rescue M5 P0: 자동 라벨은 needs:accessibility-review (reviewed:* 와 의미 충돌 방지)
    assert.match(
      src,
      /needs:accessibility-review/,
      '자동 라벨은 needs:accessibility-review여야 함 (reviewed:accessibility 의미 충돌)',
    )
    // codex-rescue M5 P0: 자동 라벨로 reviewed:accessibility를 부착하지 않음
    const autoReviewedAccessibility = src.split('\n').some(
      (l) => /labels:\s*\[.*reviewed:accessibility/.test(l),
    )
    assert.equal(
      autoReviewedAccessibility,
      false,
      'reviewed:accessibility는 자동 부착 대상이 아님 (수동 검수 완료 시에만)',
    )
    // codex-rescue M5 P1 #1: write step은 fork PR head.repo 일치 조건 필요
    assert.match(
      src,
      /head\.repo\.full_name\s*==\s*github\.repository/,
      'fork PR write 차단 조건이 없음',
    )
  })

  it('.github/CODEOWNERS 존재 + 핵심 경로 매핑', () => {
    const p = path.join(REPO_ROOT, '.github/CODEOWNERS')
    assert.ok(fs.existsSync(p), 'CODEOWNERS 없음')
    const src = fs.readFileSync(p, 'utf-8')
    assert.match(src, /\/content\//, '/content/ 경로 매핑 없음')
    assert.match(src, /\/src\/types\/kb\.ts/, 'kb.ts 매핑 없음')
    assert.match(src, /\/scripts\/validate-frontmatter\.ts/, 'validate-frontmatter.ts 매핑 없음')
  })

  it('.github/pull_request_template.md 존재 + 한국어 체크리스트', () => {
    const p = path.join(REPO_ROOT, '.github/pull_request_template.md')
    assert.ok(fs.existsSync(p), 'PR template 없음')
    const src = fs.readFileSync(p, 'utf-8')
    assert.match(src, /콘텐츠/, '한국어 "콘텐츠" 키워드 없음')
    assert.match(src, /validate:content/, 'validate:content 안내 없음')
    assert.match(src, /reviewed:editorial/, 'editorial 라벨 안내 없음')
    assert.match(src, /reviewed:accessibility/, 'accessibility 라벨 안내 없음')
  })
})

// ============================================================
// C-9. M5 보조 스크립트(alt_text, mdx-escape) 존재 + 핵심 동작
// ============================================================

describe('C-9. M5 보조 스크립트가 존재하고 비-CI 환경에서 안전하게 종료', () => {
  it('check-alt-text-labels.ts 존재', () => {
    const p = path.join(REPO_ROOT, 'scripts/check-alt-text-labels.ts')
    assert.ok(fs.existsSync(p), 'check-alt-text-labels.ts 없음')
  })

  it('check-mdx-escape.ts 존재', () => {
    const p = path.join(REPO_ROOT, 'scripts/check-mdx-escape.ts')
    assert.ok(fs.existsSync(p), 'check-mdx-escape.ts 없음')
  })

  it('package.json에 check:alt-text + check:mdx-escape 스크립트 등록', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
    )
    assert.ok(pkg.scripts['check:alt-text'], 'check:alt-text npm script 없음')
    assert.ok(pkg.scripts['check:mdx-escape'], 'check:mdx-escape npm script 없음')
  })

  it('codex-rescue M5 P2: frontmatter delimiter는 파일 1행에만 인정', () => {
    // 본문 중간에 `---`(horizontal rule)가 있는 파일에서 그것을 frontmatter로 오인하지 않아야 함.
    // 1행이 `---`가 아니면 frontmatter 없음으로 처리되어 required field 오류가 발생.
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'webfortd-fm-strict-'))
    const contentDir = path.join(tmpRoot, 'content')
    const file = path.join(contentDir, 'resources/research/no-frontmatter.md')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
      file,
      `# Header

본문이 먼저 나옴.

---

다음 섹션. 위의 \`---\`는 horizontal rule이지 frontmatter가 아니다.
`,
      'utf-8',
    )
    const result = spawnSync(TSX_BIN, [VALIDATE_SCRIPT], {
      cwd: REPO_ROOT,
      env: { ...process.env, WEBFORTD_CONTENT_DIR: contentDir },
      encoding: 'utf-8',
    })
    assert.equal(result.status, 1, 'frontmatter 없음 → required 필드 오류로 exit 1')
    // body line 5의 `---`를 frontmatter delimiter로 오인했다면 line 6, 7 등에 매핑됐을 것.
    // 정확한 동작은 startLine=1로 fallback해 오류 라인이 1로 보고됨.
    const stderr = result.stderr ?? ''
    // 라인 6, 7, 8 같은 잘못된 라인 번호로 보고되면 안 됨.
    // 단, 정확한 라인 1 매핑이라 ":1:"가 다수 등장해야 정상.
    const mismatchLines = stderr.split('\n').filter((l) =>
      /no-frontmatter\.md:[5-9]:/.test(l),
    )
    assert.equal(
      mismatchLines.length,
      0,
      `body line의 '---'를 frontmatter로 오인함:\n${mismatchLines.join('\n')}`,
    )
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('check-mdx-escape.ts는 GITHUB_EVENT_NAME 없으면 exit 0 + 빈 배열 출력', () => {
    const tmpIssues = fs.mkdtempSync(path.join(os.tmpdir(), 'webfortd-mdx-'))
    const issuesPath = path.join(tmpIssues, 'issues.json')
    const result = spawnSync(
      TSX_BIN,
      [path.join(REPO_ROOT, 'scripts/check-mdx-escape.ts')],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: '', // 비-CI 환경 시뮬레이션
          MDX_ESCAPE_ISSUES_PATH: issuesPath,
        },
        encoding: 'utf-8',
      },
    )
    assert.equal(result.status, 0, `exit 0이어야 함. stderr:\n${result.stderr}`)
    assert.ok(fs.existsSync(issuesPath), 'issues.json이 생성돼야 함')
    const parsed = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'))
    assert.deepEqual(parsed, [], 'CI 외부에서는 빈 배열을 기록해야 함')
    fs.rmSync(tmpIssues, { recursive: true, force: true })
  })
})

// ============================================================
// C-5. 슬러그 중복 → exit 1, duplicate_slug 코드
// ============================================================

describe('C-5. 슬러그 중복 → exit 1, duplicate_slug 코드', () => {
  let tmpRoot = ''
  let contentDir = ''

  before(() => {
    ;({ tmpRoot, contentDir } = createTempDir({
      'content/resources/research/duplicate-doc.md': validFrontmatter('중복 문서 1'),
      'content/resources/law/duplicate-doc.md': validFrontmatter('중복 문서 2'),
    }))
  })

  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('exit 1 반환', () => {
    const { exitCode } = runValidate(contentDir)
    assert.equal(exitCode, 1)
  })

  it('stderr에 duplicate_slug 코드 포함', () => {
    const { stderr } = runValidate(contentDir)
    assert.ok(
      stderr.includes('duplicate_slug'),
      `stderr에 'duplicate_slug' 코드가 없음:\n${stderr}`,
    )
  })
})
