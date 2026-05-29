/**
 * webfortd Phase B M1 — bootstrap-publish promoteFrontmatter 단위 테스트
 *
 * 마크다운 frontmatter를 published로 승격하는 순수 함수.
 * 핵심 invariant: 본문은 절대 변경하지 않는다 (frontmatter만).
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { promoteFrontmatter } from '../../scripts/bootstrap-publish.ts'

const REVIEWER = '1차 검토(김헌용)'

describe('promoteFrontmatter', () => {
  test('draft → published + reviewed_by placeholder 추가', () => {
    const raw = `---
title: 테스트
status: draft
reviewed_by: []
---
본문 내용입니다.
`
    const { changed, output } = promoteFrontmatter(raw)
    assert.equal(changed, true)
    assert.match(output, /status: published/)
    assert.match(output, /1차 검토\(김헌용\)/)
    assert.match(output, /본문 내용입니다\./)
  })

  test('이미 published → changed=false (idempotent)', () => {
    const raw = `---
title: 이미 게시됨
status: published
reviewed_by:
  - hudt0715
---
본문.
`
    const { changed, output } = promoteFrontmatter(raw)
    assert.equal(changed, false)
    assert.equal(output, raw)
  })

  test('reviewed_by 이미 값 있음 → placeholder 추가 안 함, status만 변경', () => {
    const raw = `---
title: 검토자 있음
status: draft
reviewed_by:
  - 기존검토자
---
본문.
`
    const { changed, output } = promoteFrontmatter(raw)
    assert.equal(changed, true)
    assert.match(output, /status: published/)
    assert.match(output, /기존검토자/)
    assert.doesNotMatch(output, /1차 검토\(김헌용\)/)
  })

  test('본문은 절대 변경하지 않음 (frontmatter만)', () => {
    const body = `# 제목

본문 단락 1.

\`\`\`js
const x = 1 // status: draft 같은 가짜 frontmatter
\`\`\`

본문 단락 2.
`
    const raw = `---
title: 본문보존
status: draft
reviewed_by: []
---
${body}`
    const { output } = promoteFrontmatter(raw)
    // 본문 부분이 그대로 보존되는지 — gray-matter content가 동일해야 함
    assert.ok(output.includes('# 제목'))
    assert.ok(output.includes('const x = 1 // status: draft 같은 가짜 frontmatter'))
    assert.ok(output.includes('본문 단락 2.'))
  })

  test('in_review → published 도 승격', () => {
    const raw = `---
title: 검수중
status: in_review
reviewed_by: []
---
본문.
`
    const { changed, output } = promoteFrontmatter(raw)
    assert.equal(changed, true)
    assert.match(output, /status: published/)
  })
})
