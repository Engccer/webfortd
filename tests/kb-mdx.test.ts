import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escapeKbContent, serializeKbContent } from '../src/lib/kb-mdx.ts'

describe('escapeKbContent', () => {
  it('HTML 주석을 제거한다', () => {
    assert.equal(escapeKbContent('앞<!-- TODO: x -->뒤'), '앞뒤')
  })
  it('<, {, }를 escape하고 >는 보존한다(blockquote)', () => {
    assert.equal(escapeKbContent('<표 Ⅴ-4> {x}'), '&lt;표 Ⅴ-4> &#123;x&#125;')
    assert.equal(escapeKbContent('> 인용'), '> 인용')
  })
  it('JSX·표현식이 escape되어 MDX 활성 구문으로 남지 않는다', () => {
    const out = escapeKbContent('<script>alert(1)</script> {1+1}')
    assert.ok(!out.includes('<script>'))
    assert.ok(!out.includes('{1+1}'))
  })
})

describe('serializeKbContent', () => {
  it('일반 마크다운을 serialize한다', async () => {
    const result = await serializeKbContent('# 제목\n\n본문 **강조** [[위키링크]]', { resolveWikilink: () => '/x/y' })
    assert.ok(result.compiledSource.length > 0)
  })
  it('JSX가 섞인 본문도 escape 덕에 성공한다', async () => {
    const result = await serializeKbContent('<Widget prop={1} /> 본문')
    assert.ok(result.compiledSource.length > 0)
  })
})

describe('escapeKbContent — 허용 태그·위키링크(2026-08-29)', () => {
  it('소문자 허용 태그만 복원한다(대문자 태그는 MDX 컴포넌트 참조가 되므로 글자로 남긴다)', () => {
    assert.equal(escapeKbContent('<br> <BR> <mark>a</mark> <Mark>b</Mark> <SUB>c</SUB>'),
      '<br /> &lt;BR> <mark>a</mark> &lt;Mark>b&lt;/Mark> &lt;SUB>c&lt;/SUB>')
  })
  it('속성이 붙은 태그·다른 태그·표현식은 차단된다', () => {
    assert.equal(escapeKbContent('<br onload="x"> <mark class="y">z</mark> <u>u</u> <img src=x> {1+1}'),
      '&lt;br onload="x"> &lt;mark class="y">z</mark> &lt;u>u&lt;/u> &lt;img src=x> &#123;1+1&#125;')
  })
  it('위키링크는 해석기가 준 href로만 링크가 되고, 실패하면 표시명만 남는다', () => {
    const out = escapeKbContent('[[a-1|표시]] [[b-2]] [[constructor]]', {
      resolveWikilink: (s) => (s === 'a-1' ? '/policies/a-1' : null),
    })
    assert.equal(out, '[표시](/policies/a-1) b-2 constructor')
  })
})
