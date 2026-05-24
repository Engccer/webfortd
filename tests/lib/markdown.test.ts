import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { markdownToPlainText } from '@/lib/utils/markdown'

describe('markdownToPlainText (M6.1 답변 복사 평문 변환)', () => {
  it('헤딩 # 제거', () => {
    assert.equal(markdownToPlainText('# 제목\n본문'), '제목\n본문')
    assert.equal(markdownToPlainText('### H3'), 'H3')
  })

  it('bold/italic 제거', () => {
    assert.equal(markdownToPlainText('**굵게** 일반 *기울임*'), '굵게 일반 기울임')
    assert.equal(markdownToPlainText('__굵__과 _기_'), '굵과 기')
  })

  it('inline code 제거', () => {
    assert.equal(markdownToPlainText('`코드` 일반'), '코드 일반')
  })

  it('code block 본문만 보존', () => {
    assert.equal(
      markdownToPlainText('설명\n```ts\nconst x = 1\n```\n끝'),
      '설명\nconst x = 1\n끝',
    )
  })

  it('링크는 텍스트만 남김', () => {
    assert.equal(
      markdownToPlainText('자세히는 [위키](/wiki/foo)를 보세요'),
      '자세히는 위키를 보세요',
    )
  })

  it('list marker는 bullet으로', () => {
    assert.equal(markdownToPlainText('- 첫째\n- 둘째'), '• 첫째\n• 둘째')
    assert.equal(markdownToPlainText('1. 첫째\n2. 둘째'), '첫째\n둘째')
  })

  it('이미지는 alt만 남김', () => {
    assert.equal(markdownToPlainText('![대체 텍스트](/img.png)'), '대체 텍스트')
  })
})
