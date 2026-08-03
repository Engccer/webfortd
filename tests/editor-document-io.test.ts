import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  resolveContentPath, splitDocument, mergeDocument, validateBody, BODY_MAX_BYTES,
} from '../src/lib/editor/document-io.ts'

describe('resolveContentPath', () => {
  it('실존 slug는 content/ 경로를 반환한다', () => {
    const p = resolveContentPath('2020-ca-1-2')
    assert.ok(p && p.startsWith('content/') && p.endsWith('.md'))
  })
  it('미등록 slug·탈출 시도는 null', () => {
    assert.equal(resolveContentPath('no-such-slug-xyz'), null)
    assert.equal(resolveContentPath('../src/app/page'), null)
    assert.equal(resolveContentPath('a/../../etc/passwd'), null)
  })
})

describe('splitDocument / mergeDocument', () => {
  it('실제 콘텐츠 파일 왕복이 바이트 동일하다', () => {
    const p = resolveContentPath('2020-ca-1-2')
    const raw = fs.readFileSync(p as string, 'utf-8')
    const parts = splitDocument(raw)
    assert.ok(parts)
    assert.equal(mergeDocument(parts.frontmatterRaw, parts.body), raw)
  })
  it('YAML 주석·키 순서가 재직렬화 없이 보존된다', () => {
    const raw = '---\n# 주석\ntitle: "제목"\nstatus: published\n---\n본문\n'
    const parts = splitDocument(raw)
    assert.ok(parts)
    assert.ok(parts.frontmatterRaw.includes('# 주석'))
    assert.equal(parts.body, '본문\n')
    assert.equal(mergeDocument(parts.frontmatterRaw, parts.body), raw)
  })
  it('CRLF 문서도 바이트 보존으로 지원한다', () => {
    const raw = '---\r\ntitle: x\r\n---\r\n본문\r\n'
    const parts = splitDocument(raw)
    assert.ok(parts)
    assert.equal(parts.body, '본문\r\n')
    assert.equal(mergeDocument(parts.frontmatterRaw, parts.body), raw)
  })
  it('frontmatter 없는 문서는 null', () => {
    assert.equal(splitDocument('본문뿐'), null)
  })
})

describe('validateBody', () => {
  it('정상 마크다운은 ok', async () => {
    assert.deepEqual(await validateBody('# 제목\n\n본문'), { ok: true })
  })
  it('크기 상한 초과는 거부한다', async () => {
    const big = 'a'.repeat(BODY_MAX_BYTES + 1)
    const r = await validateBody(big)
    assert.equal(r.ok, false)
  })
})
