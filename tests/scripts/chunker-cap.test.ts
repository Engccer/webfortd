import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  splitLongParagraph,
  applyCharLimits,
  MAX_CHUNK_CHARS,
} from '../../scripts/lib/chunker.ts'

describe('splitLongParagraph (M1 carry #1)', () => {
  test('짧은 문단은 단일 원소 배열 반환', () => {
    const p = '짧은 문단입니다. 800자 미만.'
    assert.deepEqual(splitLongParagraph(p), [p])
  })

  test('800자 초과 문단을 sentence boundary로 split', () => {
    // 한국어 문장 부호로 끝나는 5개 문장, 각 200자 = 총 1000자
    const sentence = '가'.repeat(199) + '.'
    const long = Array(5).fill(sentence).join(' ')
    const result = splitLongParagraph(long)
    assert.ok(result.length >= 2, `2개 이상 split 필요. got ${result.length}`)
    for (const chunk of result) {
      assert.ok(
        chunk.length <= MAX_CHUNK_CHARS,
        `cap 위반: ${chunk.length}자`,
      )
    }
  })

  test('sentence boundary가 없는 800자 초과 문단은 hard slice', () => {
    // 마침표·줄바꿈 없는 1500자
    const noBoundary = '가'.repeat(1500)
    const result = splitLongParagraph(noBoundary)
    assert.ok(result.length >= 2)
    for (const chunk of result) {
      assert.ok(chunk.length <= MAX_CHUNK_CHARS)
    }
    // 모든 글자 보존
    assert.equal(result.join('').length, 1500)
  })

  test('빈 문단은 빈 배열', () => {
    assert.deepEqual(splitLongParagraph(''), [])
  })
})

describe('applyCharLimits + splitLongParagraph 통합', () => {
  test('800자 초과 단일 문단을 포함한 섹션은 cap 모두 통과', () => {
    const section = {
      section: '## 긴 섹션',
      text: '가'.repeat(1500),
    }
    const result = applyCharLimits([section])
    for (const r of result) {
      assert.ok(
        r.text.length <= MAX_CHUNK_CHARS,
        `cap 위반: ${r.text.length}자 in ${r.section}`,
      )
    }
  })
})
