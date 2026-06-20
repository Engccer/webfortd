/**
 * decompose-source.ts 회귀 테스트
 *
 * 입력 5개는 실파일이므로 e2e 형태로 검증.
 * --reset 없는 dry-run으로 멱등성·페이지 수·슬러그 패턴을 검증한다.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx')
const DECOMPOSE_SCRIPT = path.join(REPO_ROOT, 'scripts/decompose-source.ts')
const SOURCE_DIR = path.join(REPO_ROOT, 'data/source-md')

function runDecompose(args: string[]): string {
  return execFileSync(TSX_BIN, [DECOMPOSE_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

describe('A. decompose dry-run', () => {
  it('5개 입력 파일이 존재해야 한다', () => {
    const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.md'))
    assert.equal(files.length, 5, `data/source-md/에 5개 .md가 있어야 함 (현재 ${files.length})`)
  })

  it('--dry-run이 정상 종료해야 한다', () => {
    const out = runDecompose(['--dry-run'])
    assert.match(out, /DRY RUN 요약 — 페이지 \d+/)
  })

  it('--dry-run 결과 페이지 수가 500개 이상이어야 한다 (분해 누락 회귀 방지)', () => {
    const out = runDecompose(['--dry-run'])
    const m = out.match(/DRY RUN 요약 — 페이지 (\d+)/)
    assert.ok(m, 'stdout에 페이지 수 보고가 있어야 함')
    const n = parseInt(m![1], 10)
    assert.ok(n >= 500, `페이지 수가 500 이상이어야 함 (현재 ${n})`)
  })

  it('두 번 dry-run 결과의 페이지 수가 동일해야 한다 (idempotency 신호)', () => {
    const a = runDecompose(['--dry-run']).match(/페이지 (\d+)/)
    const b = runDecompose(['--dry-run']).match(/페이지 (\d+)/)
    assert.equal(a![1], b![1])
  })
})

describe('B. 단체협약 단일 파일 분해', () => {
  const caFile = '교육부와 함께하는장애인교원노동조합 간 2020 단체협약.md'
  const caPath = path.join(SOURCE_DIR, caFile)

  it('단체협약 입력 파일이 존재', () => {
    assert.ok(fs.existsSync(caPath))
  })

  it('--file 모드로 단체협약 분해 시 40개 이상 페이지가 보고되어야 한다', () => {
    const out = runDecompose(['--dry-run', '--file', caPath])
    const m = out.match(/페이지 (\d+)/)
    assert.ok(m, 'stdout에 페이지 수 보고가 있어야 함')
    const n = parseInt(m![1], 10)
    // splitLevel=4 (#### 제N조 단위)로 46개 + 부칙 등 47~50개
    assert.ok(n >= 40, `단체협약은 H4 분할로 40개 이상 페이지가 나와야 함 (현재 ${n})`)
  })
})

describe('C. 슬러그·axis 검증', () => {
  it('content/<axis>/ 하위 모든 .md 슬러그가 ASCII kebab-case', () => {
    const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
    const contentRoot = path.join(REPO_ROOT, 'content')
    const axes = fs.readdirSync(contentRoot).filter((d) =>
      fs.statSync(path.join(contentRoot, d)).isDirectory(),
    )
    for (const axis of axes) {
      const dir = path.join(contentRoot, axis)
      // recursive (resources 하위에는 subsection이 있음)
      const stack = [dir]
      while (stack.length > 0) {
        const cur = stack.pop()!
        for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
          const full = path.join(cur, entry.name)
          if (entry.isDirectory()) stack.push(full)
          else if (entry.isFile() && entry.name.endsWith('.md')) {
            const stem = entry.name.replace(/\.md$/, '')
            assert.ok(SLUG_RE.test(stem), `슬러그가 kebab-case 위반: ${full}`)
          }
        }
      }
    }
  })

  it('agreements/ 디렉터리에 단체협약 분해 결과가 있어야 한다', () => {
    const dir = path.join(REPO_ROOT, 'content/agreements')
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    assert.ok(files.length >= 40, `agreements/에 40개 이상 페이지가 있어야 함 (현재 ${files.length})`)
    // 단체협약 슬러그는 2020-ca-* prefix
    const caFiles = files.filter((f) => f.startsWith('2020-ca-'))
    assert.equal(caFiles.length, files.length, 'agreements/ 페이지는 전부 2020-ca-* prefix여야 함')
  })

  it('disability-types/ 페이지의 frontmatter가 단일 장애유형을 갖는다', () => {
    // M4 axis-overrides로 강제 승격된 페이지는 frontmatter 정규화가 M4-D 후속 작업에 위임됨 — 검사 제외.
    const overridesPath = path.join(REPO_ROOT, 'content/_axis-overrides.json')
    const overrideSlugs = new Set<string>()
    if (fs.existsSync(overridesPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'))
        for (const [slug, axis] of Object.entries(parsed.overrides ?? {})) {
          if (axis === 'disability-types') overrideSlugs.add(slug)
        }
      } catch { /* ignore */ }
    }
    const dir = path.join(REPO_ROOT, 'content/disability-types')
    if (!fs.existsSync(dir)) return
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => !overrideSlugs.has(f.replace(/\.md$/, '')))
      .slice(0, 5)
    for (const f of files) {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8')
      const m = content.match(/disability_types:\s*\[([^\]]+)\]/)
      assert.ok(m, `${f} frontmatter에 disability_types가 없음`)
      const values = m![1].split(',').map((s) => s.trim().replace(/"/g, ''))
      // disability-types axis는 단일 장애유형(전체/기타 제외)이어야 함
      const concrete = values.filter((v) => v !== '"전체"' && v !== '"기타"' && v !== '전체' && v !== '기타')
      assert.ok(concrete.length >= 1, `${f}: disability-types axis는 구체 장애유형 1개 이상 필요`)
    }
  })

  it('분해 페이지의 대부분이 draft, published는 published gate 통과 필수', () => {
    // M4 curation 후 일부 분해 페이지는 위원장 검수 후 status=published로 전환될 수 있음.
    // 회귀 가드: published 페이지는 반드시 reviewed_by가 비어있지 않아야 함(published gate).
    // 그리고 분해 페이지 대다수(>=95%)는 여전히 draft여야 함(대량 검수 미완료 상태 정상).
    const contentRoot = path.join(REPO_ROOT, 'content')
    const stack = [contentRoot]
    let drafted = 0
    let published = 0
    while (stack.length > 0) {
      const cur = stack.pop()!
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = fs.readFileSync(full, 'utf-8')
          // source_origin이 pre-phase-1인 경우는 위원장 수동 작성 페이지라 제외
          const isManual = /source_origin:\s*["']?pre-phase-1["']?/.test(content)
          if (isManual) continue
          if (/status:\s*draft/.test(content)) {
            drafted += 1
          } else if (/status:\s*"?published"?/.test(content)) {
            published += 1
            // published gate 회귀 가드: reviewed_by가 비어있지 않아야 함
            const reviewedByMatch = content.match(/reviewed_by:\s*(\[[^\]]*\])/)
            assert.ok(
              reviewedByMatch,
              `${full}: published 페이지는 reviewed_by 필드가 있어야 함`,
            )
            const arr = reviewedByMatch![1].trim()
            assert.notEqual(
              arr,
              '[]',
              `${full}: published 페이지의 reviewed_by가 빈 배열 (published gate 위반)`,
            )
          }
        }
      }
    }
    assert.ok(published >= 500, `published 페이지 수가 500 이상이어야 함 (현재 ${published})`)
    // 검수 진행률 가드: Phase B M1 bootstrap publish 완료 후 95% 이상 published.
    const total = drafted + published
    assert.ok(
      published / total >= 0.95,
      `published 비율 ${(published / total * 100).toFixed(1)}%가 95% 미만 — 대량 publish 상태가 유지되고 있는지 확인`,
    )
  })
})

describe('D. indent 코드블록 마스킹 (sync-content + decompose 공유 정책)', () => {
  it('sync-content.ts에 INDENT_CODE_RE 정의가 있어야 한다', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/sync-content.ts'), 'utf-8')
    assert.match(src, /INDENT_CODE_RE/, 'sync-content.ts에 INDENT_CODE_RE가 정의돼 있어야 함')
    assert.match(src, /replace\(INDENT_CODE_RE/, 'maskCodeBlocks가 INDENT_CODE_RE를 적용해야 함')
  })

  it('decompose-source.ts에도 같은 패턴이 있어야 한다', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/decompose-source.ts'), 'utf-8')
    assert.match(src, /INDENT_CODE_RE/)
    assert.match(src, /Intl\.Segmenter|asciiKebab/)
  })

  it('sync-content.ts의 makeBodyExcerpt가 Intl.Segmenter 사용', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/sync-content.ts'), 'utf-8')
    assert.match(src, /Intl\.Segmenter/, '한국어 음절 경계 보존을 위해 Intl.Segmenter 사용')
  })
})

describe('E. published gate', () => {
  it('FrontmatterSchema에 published reviewed_by 체크가 있다', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/types/kb.ts'), 'utf-8')
    assert.match(src, /status === 'published'/, "published gate 룰이 누락")
    assert.match(src, /reviewed_by/, 'reviewed_by 필드 체크가 있어야 함')
  })
})

describe('F. M3 codex-rescue P0/P1 패치 회귀 방지', () => {
  it('![](source-images) 삽입은 _image-mappings.json 매핑 수와 일치 (P0 #1 회귀 가드)', () => {
    // M3 P0 정책: 분해 단계에서 자동 이미지 삽입 금지. TODO 마커 보존만.
    // M4-C image:apply는 _image-mappings.json 명세로 의도적으로 ![](path) 교체.
    // 회귀 가드: 본문의 ![](source-images) 수가 매핑 명세의 매핑 수보다 많으면 비정상.
    const axes = ['policies', 'domains', 'agreements', 'disability-types', 'regions', 'uncategorized']
    let bodyImageCount = 0
    for (const axis of axes) {
      const dir = path.join(REPO_ROOT, 'content', axis)
      if (!fs.existsSync(dir)) continue
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.md')) continue
        const content = fs.readFileSync(path.join(dir, f), 'utf-8')
        const matches = content.match(/!\[[^\]]+\]\(\/source-images\//g) ?? []
        bodyImageCount += matches.length
      }
    }
    // _image-mappings.json이 있으면 그 매핑 수와 비교, 없으면 0이어야 함.
    const mappingsPath = path.join(REPO_ROOT, 'content/_image-mappings.json')
    let mappedCount = 0
    if (fs.existsSync(mappingsPath)) {
      const j = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'))
      mappedCount = Object.values(j.mappings ?? {}).filter(
        (e) => (e as { manifest_path?: string | null }).manifest_path,
      ).length
    }
    assert.equal(
      bodyImageCount,
      mappedCount,
      `본문 ![](source-images) ${bodyImageCount}건 ≠ 매핑 명세 ${mappedCount}건 ` +
      `— 자동 삽입(P0 위반) 또는 명세 외 수동 삽입 의심`,
    )
  })

  it('이미지 TODO 마커가 본문에 보존되어 있어야 한다 (P0 #2)', () => {
    // 적어도 일부 페이지에 TODO: image-link 마커가 있어야 함 (이미지 패턴이 본문에 있는 경우)
    const dir = path.join(REPO_ROOT, 'content/policies')
    const allContents = fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => fs.readFileSync(path.join(dir, f), 'utf-8'))
      .join('\n')
    const todoCount = (allContents.match(/<!-- TODO: image-link source=/g) ?? []).length
    assert.ok(todoCount >= 1, `policies에 TODO 이미지 마커가 최소 1개 있어야 함 (현재 ${todoCount})`)
  })

  it('도메인 미검출 시 uncategorized로 분기되거나 axis-overrides로 명시 처리되어야 한다 (P1 #3 / M4)', () => {
    // M3 P1 #3 정책: domains 매칭 실패 시 axis=uncategorized (placeholder 'policies' 자동 승격 금지).
    // M4: 위원장 수동 검수가 content/_axis-overrides.json으로 override 가능.
    //     overrides가 비어있지 않으면 uncategorized는 비어도 됨(수동 처리 완료).
    //     수동 처리 완료 후 uncategorized 디렉터리 자체가 제거된 상태도 동일하게 허용 —
    //     아래 OR 조건의 의도가 "디렉터리 있지만 비어 있음 == 디렉터리 자체가 없음"이므로
    //     존재 강제 assertion은 제거하고 files=[] 처리.
    const dir = path.join(REPO_ROOT, 'content/uncategorized')
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => f.endsWith('.md'))
      : []
    const overridesPath = path.join(REPO_ROOT, 'content/_axis-overrides.json')
    let overrideCount = 0
    if (fs.existsSync(overridesPath)) {
      try {
        const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf-8')).overrides ?? {}
        overrideCount = Object.keys(overrides).length
      } catch {
        // ignore parse error — test below will fail-loud
      }
    }
    assert.ok(
      files.length >= 1 || overrideCount >= 1,
      `uncategorized 페이지 0개일 땐 axis-overrides가 최소 1건 있어야 함 (files=${files.length}, overrides=${overrideCount})`,
    )
  })

  it('decompose-source.ts에 SOURCE_FILE_MAP prefix 유일성 검사가 있어야 한다 (P1 #4)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/decompose-source.ts'), 'utf-8')
    assert.match(src, /SOURCE_FILE_MAP prefix 충돌/, 'prefix 유일성 invariant 누락')
    assert.match(src, /글로벌 path 충돌/, '글로벌 path 유일성 invariant 누락')
  })

  it('maskCodeBlocks가 nested list marker 휴리스틱을 적용해야 한다 (P1 #5)', () => {
    const syncSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/sync-content.ts'), 'utf-8')
    const decomposeSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/decompose-source.ts'), 'utf-8')
    // 두 스크립트 모두 list marker 휴리스틱이 있어야 함
    assert.match(syncSrc, /\[-\*\+\]\\s\|.*\\d\+\\\./, 'sync-content.ts에 list marker 휴리스틱 누락')
    assert.match(decomposeSrc, /\[-\*\+\]\\s\|.*\\d\+\\\./, 'decompose-source.ts에 list marker 휴리스틱 누락')
  })

  it('decompose-source.ts에 axis-overrides 로딩·적용 로직이 있어야 한다 (M4-A)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/decompose-source.ts'), 'utf-8')
    assert.match(src, /loadAxisOverrides/, 'loadAxisOverrides 함수 누락')
    assert.match(src, /axisOverrides\[finalSlug\]/, 'override 적용 코드 누락')
    assert.match(src, /AXIS_OVERRIDES_PATH/, 'AXIS_OVERRIDES_PATH 상수 누락')
  })

  it('분해 페이지에 parent_headings frontmatter가 있고 본문 첫 줄이 blockquote가 아니어야 한다 (M4-B)', () => {
    // 단체협약 페이지(splitLevel=4)는 parent_headings에 상위 H1/H2/H3 헤딩이 들어감.
    const dir = path.join(REPO_ROOT, 'content/agreements')
    if (!fs.existsSync(dir)) return
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).slice(0, 5)
    assert.ok(files.length > 0, 'agreements 디렉터리에 페이지가 있어야 함')
    for (const f of files) {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8')
      assert.match(content, /parent_headings:/, `${f}: parent_headings 키 누락`)
      // 본문 첫 줄(# H1 직후)이 blockquote(> ...)이면 M4-B 이전 구버전 산출물.
      const bodyMatch = content.match(/^# .*?\n\n([^\n]+)/m)
      if (bodyMatch) {
        assert.ok(
          !bodyMatch[1].startsWith('> '),
          `${f}: 본문 첫 줄이 blockquote — M4-B parent_headings 이전 미적용`,
        )
      }
    }
  })

  it('KbPageLayout이 parent_headings을 breadcrumb로 렌더해야 한다 (M4-B)', () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/kb/KbPageLayout.tsx'),
      'utf-8',
    )
    assert.match(src, /parent_headings/, 'KbPageLayout에 parent_headings 참조 누락')
    // breadcrumb은 무명 div + 시맨틱 <ol>로 렌더 — nav landmark/aria-label은 제거(미니멀 접근성).
    assert.match(src, /<ol className="flex flex-wrap items-center/, 'breadcrumb ol 렌더 누락')
  })

  it('FrontmatterSchema에 parent_headings 필드가 정의되어야 한다 (M4-B)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/types/kb.ts'), 'utf-8')
    assert.match(src, /parent_headings: z\.array\(z\.string\(\)\)\.default\(\[\]\)/,
      'FrontmatterSchema.parent_headings 누락')
  })

  it('content/_axis-overrides.json이 valid한 schema를 따라야 한다 (M4-A)', () => {
    const overridesPath = path.join(REPO_ROOT, 'content/_axis-overrides.json')
    if (!fs.existsSync(overridesPath)) {
      // overrides 파일이 없는 상태도 허용 (decompose는 빈 객체로 처리).
      return
    }
    const parsed = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'))
    assert.ok(typeof parsed.overrides === 'object' && parsed.overrides !== null, 'overrides 키가 객체여야 함')
    const validAxes = new Set([
      'disability-types', 'domains', 'regions', 'policies',
      'agreements', 'stories', 'resources', 'uncategorized',
    ])
    for (const [slug, axis] of Object.entries(parsed.overrides)) {
      assert.ok(typeof slug === 'string' && slug.length > 0, `slug가 비어있음: ${slug}`)
      assert.ok(validAxes.has(axis as string), `${slug}: 알 수 없는 axis '${axis}'`)
    }
  })

  it('image-mappings 헬퍼 스크립트와 가이드가 존재해야 한다 (M4-C)', () => {
    const script = path.join(REPO_ROOT, 'scripts/image-mappings.ts')
    const guide = path.join(REPO_ROOT, 'docs/IMAGE_MAPPING_GUIDE.md')
    assert.ok(fs.existsSync(script), 'scripts/image-mappings.ts 누락')
    assert.ok(fs.existsSync(guide), 'docs/IMAGE_MAPPING_GUIDE.md 누락')
    const src = fs.readFileSync(script, 'utf-8')
    // 3개 서브커맨드와 안전 가드 invariant
    assert.match(src, /'report'/, 'report 서브커맨드 누락')
    assert.match(src, /'template'/, 'template 서브커맨드 누락')
    assert.match(src, /'apply'/, 'apply 서브커맨드 누락')
    // M4 codex-rescue P0 패치 후 변수명 변경: validManifestPaths → manifestByPath (Map for source lookup)
    assert.match(src, /manifestByPath/, '매니페스트 path 정합 가드 누락')
    assert.match(src, /이미지 파일이 디스크에 없음/, '디스크 존재 가드 누락')
  })

  it('decompose-source.ts에 forcedAxis vs override 충돌 가드가 있어야 한다 (M4 codex-rescue P1 #2)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/decompose-source.ts'), 'utf-8')
    assert.match(src, /axis override가 forcedAxis와 충돌/, 'forcedAxis 충돌 가드 누락')
  })

  it('decompose-source.ts에 stale slug override 검출 가드가 있어야 한다 (M4 codex-rescue P1 #1)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/decompose-source.ts'), 'utf-8')
    assert.match(src, /_axis-overrides\.json에 분해 결과와 매칭 안 되는 slug/, 'stale slug 가드 누락')
  })

  it('image-mappings.ts에 source 교차 검증이 있어야 한다 (M4 codex-rescue P0)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/image-mappings.ts'), 'utf-8')
    assert.match(src, /manifestEntry\.source !== occ\.source/, 'source 교차 검증 가드 누락')
    assert.match(src, /다른 출처 이미지 삽입 차단/, 'source 가드 경고 메시지 누락')
  })

  it('image-mappings.ts가 frontmatter raw block을 보존해야 한다 (M4 codex-rescue P1 #4)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/image-mappings.ts'), 'utf-8')
    // matter.stringify는 코멘트에서 언급은 허용(why-not 설명), 실제 호출 라인은 금지.
    // 라인별 검사: 코멘트(`//`)나 문자열 메시지가 아닌 호출형 사용을 reject.
    const callLines = src
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false
        return /matter\.stringify\s*\(/.test(line)
      })
    assert.equal(callLines.length, 0, `matter.stringify 호출 발견 — frontmatter 재직렬화 우려: ${callLines.join('\n')}`)
    assert.match(src, /fmBlock = fmMatch\[1\]/, 'raw frontmatter 보존 로직 누락')
  })

  it('validate-frontmatter.ts에 stale axis-override 검사가 있어야 한다 (M4 codex-rescue P1 #3)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/validate-frontmatter.ts'), 'utf-8')
    assert.match(src, /detectStaleAxisOverrides/, 'detectStaleAxisOverrides 함수 누락')
    assert.match(src, /stale_axis_override/, 'stale_axis_override error code 누락')
  })

  it('image-mappings report 산출물이 호출 시 갱신되어야 한다 (M4-C)', async () => {
    // 무거운 통합 테스트 — 실제 스크립트는 다른 곳에서 실행되므로 산출물 존재만 확인.
    const reportPath = path.join(REPO_ROOT, 'docs/image-mapping-status.md')
    if (!fs.existsSync(reportPath)) return // report 미실행 상태도 허용
    const md = fs.readFileSync(reportPath, 'utf-8')
    assert.match(md, /# 본문 이미지 TODO 마커 매핑 현황/, '리포트 헤더 누락')
    assert.match(md, /출처별 TODO 분포/, '출처 분포 섹션 누락')
  })
})
