/**
 * src/lib/kb.ts 로더 동작 회귀 테스트
 *
 * 테스트 D:
 *   - getKBDocBySlug('ordinance-comparison') → not-null, title 일치
 *   - getKBDocBySlug('non-existent') → null
 *   - getSlugsBySubsection('law') → ['ordinance-comparison'] 포함
 *   - getSlugsBySubsection('research') → 빈 배열 (Phase 1 정리 후 통문서 자산 제거됨)
 *   - getBacklinks('ordinance-comparison') → 빈 배열 (현재 위키링크 없음)
 *
 * 배경: Phase 1 정리에서 docparse 통문서 2건(hr-guide-2023, collective-agreement)이
 *       atomic 분해본과 중복되어 삭제됨. 남은 published 통문서는 ordinance-comparison 1건뿐.
 *
 * 주의: kb.ts는 react의 `cache()`를 사용한다. node:test에서 직접 import하면
 *       react가 서버 컨텍스트 없이 실행되지만, cache()는 단순 memoize로만 동작하므로
 *       테스트 환경에서도 정상 작동한다.
 *
 * 또한 kb.ts는 src/lib/kb-index.generated.json을 정적 import한다.
 * 테스트 실행 전 `npm run sync:content`가 완료된 상태를 가정한다.
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

// @/ 경로는 tsx가 tsconfig.json paths를 읽어 해석한다.
// kb.ts가 의존하는 kb-index.generated.json도 정적 import이므로
// cwd가 REPO_ROOT인 상태에서 실행되어야 한다.

const REPO_ROOT = path.resolve(import.meta.dirname, '..')

// Dynamic import로 kb.ts 로딩 (react cache는 첫 호출 시 초기화됨)
let getKBDocBySlug: (slug: string) => Promise<unknown>
let getSlugsBySubsection: (subsection: string) => string[]
let getBacklinks: (slug: string) => Array<{ from: string; anchor?: string }>

before(async () => {
  // process.cwd()가 REPO_ROOT여야 kb.ts 내부의 path.join(process.cwd(), filePath) 동작
  process.chdir(REPO_ROOT)

  const kb = await import('../src/lib/kb.ts')
  getKBDocBySlug = kb.getKBDocBySlug
  getSlugsBySubsection = kb.getSlugsBySubsection
  getBacklinks = kb.getBacklinks
})

// ============================================================
// D. kb.ts 로더 동작
// ============================================================

describe('D. getKBDocBySlug', () => {
  it("'ordinance-comparison' — not-null DocumentFull 반환", async () => {
    const doc = (await getKBDocBySlug('ordinance-comparison')) as {
      slug: string
      frontmatter: { title: string }
    } | null
    assert.notEqual(doc, null, 'ordinance-comparison 문서가 null을 반환함')
    assert.equal(doc!.slug, 'ordinance-comparison')
  })

  it("'ordinance-comparison' — title이 frontmatter와 일치", async () => {
    const doc = (await getKBDocBySlug('ordinance-comparison')) as {
      frontmatter: { title: string }
    } | null
    assert.notEqual(doc, null)
    assert.equal(
      doc!.frontmatter.title,
      '시도교육청 장애인교원 편의지원 조례 비교 분석 보고서',
    )
  })

  it("'non-existent' — null 반환", async () => {
    const doc = await getKBDocBySlug('non-existent')
    assert.equal(doc, null)
  })
})

describe('D. getSlugsBySubsection', () => {
  it("'law' — ordinance-comparison 포함", () => {
    const slugs = getSlugsBySubsection('law')
    assert.ok(
      slugs.includes('ordinance-comparison'),
      `'law' subsection에 ordinance-comparison가 없음: ${JSON.stringify(slugs)}`,
    )
  })

  it("'research' — Phase 1 정리 후 빈 배열", () => {
    const slugs = getSlugsBySubsection('research')
    assert.deepEqual(
      slugs,
      [],
      `'research' subsection은 통문서 자산 제거 후 비어 있어야 함: ${JSON.stringify(slugs)}`,
    )
  })

  it("'nonexistent-section' — 빈 배열 반환", () => {
    const slugs = getSlugsBySubsection('nonexistent-section')
    assert.deepEqual(slugs, [])
  })
})

describe('D. getBacklinks', () => {
  it("'ordinance-comparison' — 현재 위키링크 없으므로 빈 배열", () => {
    const backlinks = getBacklinks('ordinance-comparison')
    assert.deepEqual(
      backlinks,
      [],
      `ordinance-comparison의 backlinks가 비어있지 않음: ${JSON.stringify(backlinks)}`,
    )
  })
})
