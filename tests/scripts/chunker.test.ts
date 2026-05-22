import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripFrontmatter, stripPageHeaders } from '../../scripts/lib/chunker.ts'

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
