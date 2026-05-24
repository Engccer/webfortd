import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripFrontmatter, stripPageHeaders, splitByH2, applyCharLimits, MAX_CHUNK_CHARS, MIN_CHUNK_CHARS, chunkDocument } from '../../scripts/lib/chunker.ts'

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

test('applyCharLimits — 800자 cap 초과 시 문단 단위 분할', () => {
  const longSection = {
    section: '## 긴 섹션',
    text: '## 긴 섹션\n' + Array(20).fill('가나다라마바사아자차카타파하'.repeat(8)).join('\n\n'),
  }
  // 각 라인 ~96자 × 20개 ≈ 1900자, 문단 구분이 있어야 분할 가능
  const result = applyCharLimits([longSection])
  assert.ok(result.length >= 2, '800자 초과는 최소 2개로 분할')
  for (const r of result) {
    assert.ok(r.text.length <= MAX_CHUNK_CHARS + 100, '하드 cap 근사치')
  }
})

test('applyCharLimits — 50자 미만 인접 섹션 병합', () => {
  const tiny = [
    { section: '(no-section)', text: '짧은 한 줄.' },
    { section: '## A', text: '## A\n또 짧음.' },
    { section: '## B', text: '## B\n' + '내용'.repeat(50) },
  ]
  const result = applyCharLimits(tiny)
  // 앞의 두 단편은 병합 또는 다음 정상 청크에 합류, 50자 이상 청크만 남음
  for (const r of result) {
    assert.ok(r.text.length >= MIN_CHUNK_CHARS || result.length === 1, '최소 길이 보장')
  }
})

test('chunkDocument — frontmatter+page_header strip → 청크 배열 + metadata', () => {
  const raw = `---
slug: test-1
title: 테스트
axis: policies
type: 안내서
---

서두.

## 섹션 A
내용 A.
<page_header>p.5</page_header>

## 섹션 B
내용 B.`
  const result = chunkDocument(raw, {
    slug: 'test-1',
    title: '테스트',
    axis: 'policies',
    type: '안내서',
    source_origin: 'sample-source',
  })
  assert.ok(result.length >= 1)
  for (let i = 0; i < result.length; i++) {
    assert.equal(result[i].metadata.chunk_index, i)
    assert.equal(result[i].metadata.slug, 'test-1')
    assert.equal(result[i].metadata.axis, 'policies')
    assert.ok(!result[i].text.includes('<page_header>'))
    assert.ok(!result[i].text.includes('---\nslug:'))
  }
})

test('chunkDocument — frontmatter-only doc → 빈 배열', () => {
  const raw = '---\nslug: empty\n---\n\n'
  const result = chunkDocument(raw, { slug: 'empty', title: 'Empty', axis: 'policies', type: 't', source_origin: null })
  assert.deepEqual(result, [])
})

test('chunkDocument — chunk_index 연속성', () => {
  const raw = `---\nslug: x\n---\n\n## A\n` + '가'.repeat(900) + '\n\n## B\n' + '나'.repeat(900)
  const result = chunkDocument(raw, { slug: 'x', title: 'X', axis: 'policies', type: 't', source_origin: null })
  const indices = result.map((c) => c.metadata.chunk_index)
  assert.deepEqual(indices, Array.from({ length: result.length }, (_, i) => i))
})
