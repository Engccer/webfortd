import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripFrontmatter, stripPageHeaders, splitByH2 } from '../../scripts/lib/chunker.ts'

test('stripFrontmatter — frontmatter 블록 제거', () => {
  const input = '---\nslug: foo\ntitle: bar\n---\n\n본문 내용입니다.'
  const result = stripFrontmatter(input)
  assert.equal(result, '본문 내용입니다.')
})

test('stripFrontmatter — frontmatter 없으면 원본 반환', () => {
  const input = '본문만 있음'
  assert.equal(stripFrontmatter(input), '본문만 있음')
})

test('stripPageHeaders — <page_header> 태그 제거', () => {
  const input = '본문\n<page_header>p.10</page_header>\n다음 문단'
  assert.equal(stripPageHeaders(input), '본문\n\n다음 문단')
})

test('splitByH2 — H2 헤딩 기준 분할, 헤딩 라인은 섹션 첫 줄로 포함', () => {
  const input = '서두 문장.\n\n## 첫 섹션\n내용 A.\n\n## 두 번째\n내용 B.'
  const result = splitByH2(input)
  assert.equal(result.length, 3)
  assert.equal(result[0].section, '(no-section)')
  assert.equal(result[0].text, '서두 문장.')
  assert.equal(result[1].section, '## 첫 섹션')
  assert.equal(result[1].text, '## 첫 섹션\n내용 A.')
  assert.equal(result[2].section, '## 두 번째')
  assert.equal(result[2].text, '## 두 번째\n내용 B.')
})

test('splitByH2 — H2 없으면 단일 청크', () => {
  const input = '제목 없는 단편 문장.'
  const result = splitByH2(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].section, '(no-section)')
})
