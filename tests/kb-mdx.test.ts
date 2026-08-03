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
    const result = await serializeKbContent('# 제목\n\n본문 **강조** [[위키링크]]')
    assert.ok(result.compiledSource.length > 0)
  })
  it('JSX가 섞인 본문도 escape 덕에 성공한다', async () => {
    const result = await serializeKbContent('<Widget prop={1} /> 본문')
    assert.ok(result.compiledSource.length > 0)
  })
})
