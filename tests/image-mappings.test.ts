/**
 * image-mappings.ts apply 가드 회귀 테스트
 *
 * 데이터 무결성 가드를 셋업한 fixture로 검증:
 *  - source 교차 검증 (M4-C P0)
 *  - _alt_original 교차 검증 (M4-D P0, 본 패치)
 *  - manifest path 존재 검증
 *  - manifest_path null인 항목은 skip
 *  - 정상 매핑은 본문 TODO를 ![alt](path)로 교체
 *
 * IMG_MAPPINGS_ROOT 환경변수로 fixture 디렉터리 주입.
 */

import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx')
const APPLY_SCRIPT = path.join(REPO_ROOT, 'scripts/image-mappings.ts')

interface FixtureSpec {
  sources: Array<{ source: string; pages: Array<{ page: number; figures: number[] }> }>
  mdFiles: Array<{ relPath: string; frontmatter: string; body: string }>
  mappings: Record<
    string,
    {
      manifest_path: string | null
      alt_override?: string | null
      _alt_original?: string
      notes?: string
    }
  >
}

function setupFixture(spec: FixtureSpec): string {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'img-mappings-test-'))

  // sentinel — IMG_MAPPINGS_ROOT override 인정 조건 (P1-2 안전장치).
  // 운영 환경에 ENV 실수 설정 시 sentinel 부재로 자동 차단.
  fs.writeFileSync(path.join(tmpRoot, '.image-mappings-test-root'), '')

  // manifest.json + raster 더미 파일 생성
  const manifestDir = path.join(tmpRoot, 'public/source-images')
  fs.mkdirSync(manifestDir, { recursive: true })
  const manifest: Array<{
    source: string
    page: number
    figure: number
    path: string
    alt: null
  }> = []
  for (const s of spec.sources) {
    const sourceDir = path.join(manifestDir, s.source)
    fs.mkdirSync(sourceDir, { recursive: true })
    for (const p of s.pages) {
      for (const f of p.figures) {
        const fname = `page-${String(p.page).padStart(3, '0')}-fig-${String(f).padStart(2, '0')}.png`
        fs.writeFileSync(path.join(sourceDir, fname), 'fake-png-bytes')
        manifest.push({
          source: s.source,
          page: p.page,
          figure: f,
          path: `public/source-images/${s.source}/${fname}`,
          alt: null,
        })
      }
    }
  }
  fs.writeFileSync(path.join(manifestDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  // content/<rel>.md
  for (const md of spec.mdFiles) {
    const abs = path.join(tmpRoot, md.relPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, `---\n${md.frontmatter}\n---\n${md.body}`)
  }

  // mappings.json
  const mappingsObj = {
    _comment: 'test fixture',
    mappings: spec.mappings,
  }
  fs.writeFileSync(
    path.join(tmpRoot, 'content/_image-mappings.json'),
    JSON.stringify(mappingsObj, null, 2),
  )

  return tmpRoot
}

function runApply(root: string): { stdout: string; stderr: string; status: number | null } {
  try {
    const stdout = execFileSync(TSX_BIN, [APPLY_SCRIPT, 'apply'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, IMG_MAPPINGS_ROOT: root },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout, stderr: '', status: 0 }
  } catch (e) {
    const err = e as { stdout: Buffer | string; stderr: Buffer | string; status: number | null }
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      status: err.status,
    }
  }
}

const TODO_MARKER = (source: string, alt: string) =>
  `<!-- TODO: image-link source=${source} -- 원본: (이미지: ${alt}) -->`

const FM = `title: Test\nslug: test\naxis: domains\nstatus: published\nflow:\n  - 전체\n`

const fixturesToCleanup: string[] = []

after(() => {
  for (const dir of fixturesToCleanup) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
})

describe('image-mappings apply — 무결성 가드', () => {
  it('정상 매핑: TODO 마커가 ![alt](path)로 교체된다', () => {
    const root = setupFixture({
      sources: [{ source: 'test-src', pages: [{ page: 10, figures: [1] }] }],
      mdFiles: [
        {
          relPath: 'content/domains/test-doc.md',
          frontmatter: FM,
          body: `본문\n\n${TODO_MARKER('test-src', '정상 그림 alt')}\n\n끝.`,
        },
      ],
      mappings: {
        'test-doc#test-src#0': {
          manifest_path: 'public/source-images/test-src/page-010-fig-01.png',
          _alt_original: '정상 그림 alt',
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.equal(r.status, 0, `apply 실패: ${r.stderr}`)
    assert.match(r.stdout, /수정 파일: 1/)
    assert.match(r.stdout, /교체 마커: 1/)
    const body = fs.readFileSync(path.join(root, 'content/domains/test-doc.md'), 'utf8')
    assert.match(body, /!\[정상 그림 alt\]\(\/source-images\/test-src\/page-010-fig-01\.png\)/)
    assert.doesNotMatch(body, /TODO: image-link/)
  })

  it('alt_override가 있으면 새 alt가 적용된다', () => {
    const root = setupFixture({
      sources: [{ source: 'test-src', pages: [{ page: 5, figures: [1] }] }],
      mdFiles: [
        {
          relPath: 'content/domains/test-ov.md',
          frontmatter: FM,
          body: `\n${TODO_MARKER('test-src', '원본 alt')}\n`,
        },
      ],
      mappings: {
        'test-ov#test-src#0': {
          manifest_path: 'public/source-images/test-src/page-005-fig-01.png',
          _alt_original: '원본 alt',
          alt_override: '정제된 alt',
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.equal(r.status, 0)
    const body = fs.readFileSync(path.join(root, 'content/domains/test-ov.md'), 'utf8')
    assert.match(body, /!\[정제된 alt\]/)
    assert.doesNotMatch(body, /!\[원본 alt\]/)
  })

  it('M4-C P0: source 불일치 → dry stop + 본문 미수정', () => {
    const root = setupFixture({
      sources: [
        { source: 'src-A', pages: [{ page: 1, figures: [1] }] },
        { source: 'src-B', pages: [{ page: 1, figures: [1] }] },
      ],
      mdFiles: [
        {
          relPath: 'content/domains/test-srcmix.md',
          frontmatter: FM,
          body: `\n${TODO_MARKER('src-A', 'A의 그림')}\n`,
        },
      ],
      mappings: {
        // src-A TODO에 src-B의 raster를 매핑 (잘못된 매핑)
        'test-srcmix#src-A#0': {
          manifest_path: 'public/source-images/src-B/page-001-fig-01.png',
          _alt_original: 'A의 그림',
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.notEqual(r.status, 0, 'source 불일치는 exit 1이어야 함')
    assert.match(r.stderr, /source 불일치/)
    const body = fs.readFileSync(path.join(root, 'content/domains/test-srcmix.md'), 'utf8')
    assert.match(body, /TODO: image-link/, '본문 TODO 마커가 보존되어야 함')
  })

  it('M4-D P0: _alt_original 불일치 → dry stop + 본문 미수정 (stale indexInFile 차단)', () => {
    const root = setupFixture({
      sources: [{ source: 'test-src', pages: [{ page: 10, figures: [1] }] }],
      mdFiles: [
        {
          relPath: 'content/domains/test-stale.md',
          frontmatter: FM,
          body: `\n${TODO_MARKER('test-src', '현재 본문에 있는 alt (다른 그림)')}\n`,
        },
      ],
      mappings: {
        // mappings의 _alt_original은 본문 alt와 다름 — stale indexInFile 시나리오
        'test-stale#test-src#0': {
          manifest_path: 'public/source-images/test-src/page-010-fig-01.png',
          _alt_original: '오래된 PoC 시점 alt (이미 inserted된 다른 그림)',
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.notEqual(r.status, 0, '_alt_original 불일치는 exit 1이어야 함')
    assert.match(r.stderr, /_alt_original 불일치/)
    assert.match(r.stderr, /stale indexInFile/)
    const body = fs.readFileSync(path.join(root, 'content/domains/test-stale.md'), 'utf8')
    assert.match(body, /TODO: image-link/, '본문 TODO 마커가 보존되어야 함')
  })

  it('_alt_original이 없는 명세는 검증 skip (backward compat)', () => {
    const root = setupFixture({
      sources: [{ source: 'test-src', pages: [{ page: 7, figures: [1] }] }],
      mdFiles: [
        {
          relPath: 'content/domains/test-noalt.md',
          frontmatter: FM,
          body: `\n${TODO_MARKER('test-src', '아무 alt')}\n`,
        },
      ],
      mappings: {
        'test-noalt#test-src#0': {
          manifest_path: 'public/source-images/test-src/page-007-fig-01.png',
          // _alt_original 일부러 생략
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.equal(r.status, 0, `apply 실패: ${r.stderr}`)
    assert.match(r.stdout, /교체 마커: 1/)
  })

  it('manifest_path가 null인 매핑은 skip (본문 보존)', () => {
    const root = setupFixture({
      sources: [{ source: 'test-src', pages: [{ page: 1, figures: [1] }] }],
      mdFiles: [
        {
          relPath: 'content/domains/test-null.md',
          frontmatter: FM,
          body: `\n${TODO_MARKER('test-src', '미매핑 그림')}\n`,
        },
      ],
      mappings: {
        'test-null#test-src#0': {
          manifest_path: null,
          _alt_original: '미매핑 그림',
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /수정 파일: 0/)
    const body = fs.readFileSync(path.join(root, 'content/domains/test-null.md'), 'utf8')
    assert.match(body, /TODO: image-link/, 'null 매핑은 본문 TODO를 그대로 둠')
  })

  it('P1-1: alt 비교 정규화 — whitespace squash + NFC 정규화 후 같으면 통과', () => {
    // 본문 TODO alt: 줄바꿈 + 연속 공백
    // mapping _alt_original: 단일 공백
    // 정규화 후 같으면 가드 통과해야 함 (false positive 차단 방지)
    const altInBody = '여러\n줄에   걸친  alt'
    const altInJson = '여러 줄에 걸친 alt'
    const root = setupFixture({
      sources: [{ source: 'test-src', pages: [{ page: 12, figures: [1] }] }],
      mdFiles: [
        {
          relPath: 'content/domains/test-norm.md',
          frontmatter: FM,
          body: `\n${TODO_MARKER('test-src', altInBody)}\n`,
        },
      ],
      mappings: {
        'test-norm#test-src#0': {
          manifest_path: 'public/source-images/test-src/page-012-fig-01.png',
          _alt_original: altInJson,
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.equal(r.status, 0, `정규화 후 일치인데 차단됨: ${r.stderr}`)
    assert.match(r.stdout, /교체 마커: 1/)
  })

  it('P1-2: sentinel 파일 없는 디렉터리는 IMG_MAPPINGS_ROOT override 차단 (production 보호)', () => {
    // sentinel 없는 임시 디렉터리
    const noSentinelRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'img-mappings-nosent-'))
    fixturesToCleanup.push(noSentinelRoot)

    // spawnSync: exit code(0 또는 non-zero) 무관하게 stderr 캡쳐.
    // execFileSync는 exit 0이면 stderr를 결과로 반환하지 않아 sentinel 경고를 못 잡음.
    const r = spawnSync(TSX_BIN, [APPLY_SCRIPT, 'apply'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, IMG_MAPPINGS_ROOT: noSentinelRoot },
    })
    const stderr = (r.stderr ?? '').toString()

    assert.match(stderr, /sentinel.*부재.*override 무시/, '경고 메시지 누락')
  })

  it('manifest_path가 manifest.json에 없으면 dry stop', () => {
    const root = setupFixture({
      sources: [{ source: 'test-src', pages: [{ page: 1, figures: [1] }] }],
      mdFiles: [
        {
          relPath: 'content/domains/test-missing.md',
          frontmatter: FM,
          body: `\n${TODO_MARKER('test-src', 'alt')}\n`,
        },
      ],
      mappings: {
        'test-missing#test-src#0': {
          manifest_path: 'public/source-images/test-src/page-999-fig-99.png',
          _alt_original: 'alt',
        },
      },
    })
    fixturesToCleanup.push(root)

    const r = runApply(root)
    assert.notEqual(r.status, 0)
    assert.match(r.stderr, /manifest\.json에 없음/)
  })
})
