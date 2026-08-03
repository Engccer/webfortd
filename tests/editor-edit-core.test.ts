import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { loadDocumentCore, submitBodyCore } from '../src/lib/editor/edit-core.ts'

const SAMPLE = '---\ntitle: "표본"\nstatus: published\n---\n원래 본문\n'
const editor = { canEdit: true, userId: '123e4567-e89b-12d3-a456-426614174000', email: 'e@x.y' }

function deps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getEditor: async () => editor,
    getFile: async () => ({ ok: true, value: { text: SAMPLE, sha: 'sha-1' } }),
    putFile: async () => ({ ok: true, value: { commitSha: 'c1' } }),
    rateLimit: () => true,
    ...overrides,
  } as never
}

describe('loadDocumentCore', () => {
  it('권한자는 본문과 baseSha를 받는다', async () => {
    const r = await loadDocumentCore(deps(), '2020-ca-1-2')
    assert.equal(r.status, 'ok')
    if (r.status === 'ok') {
      assert.equal(r.body, '원래 본문\n')
      assert.equal(r.baseSha, 'sha-1')
    }
  })
  it('무권한은 forbidden', async () => {
    const r = await loadDocumentCore(
      deps({ getEditor: async () => ({ canEdit: false, userId: null, email: null }) }),
      '2020-ca-1-2',
    )
    assert.equal(r.status, 'forbidden')
  })
  it('미등록 slug·GET 404는 not_found', async () => {
    assert.equal((await loadDocumentCore(deps(), 'no-such-slug-xyz')).status, 'not_found')
    const r = await loadDocumentCore(deps({ getFile: async () => ({ ok: false, reason: 'not_found' }) }), '2020-ca-1-2')
    assert.equal(r.status, 'not_found')
  })
  it('auth 실패는 system(관리자 문의 문구)', async () => {
    const r = await loadDocumentCore(deps({ getFile: async () => ({ ok: false, reason: 'auth' }) }), '2020-ca-1-2')
    assert.equal(r.status, 'system')
    assert.ok(r.message.includes('관리자'))
  })
})

describe('submitBodyCore', () => {
  const args = { slug: '2020-ca-1-2', baseSha: 'sha-1', body: '고친 본문\n' }
  it('정상 경로: frontmatter 보존 병합 + 가명 커밋 메시지 + accepted', async () => {
    let put: { text: string; message: string } | null = null
    const r = await submitBodyCore(
      deps({ putFile: async (a: { text: string; message: string }) => { put = a; return { ok: true, value: { commitSha: 'c1' } } } }),
      args,
    )
    assert.equal(r.status, 'accepted')
    assert.ok(put)
    assert.ok(put!.text.startsWith('---\ntitle: "표본"'))
    assert.ok(put!.text.endsWith('고친 본문\n'))
    assert.ok(put!.message.includes('[editor:123e4567]'))
    assert.ok(!put!.message.includes('e@x.y'))
  })
  it('SHA가 다르면 conflict + 최신본 동봉', async () => {
    const r = await submitBodyCore(
      deps({ getFile: async () => ({ ok: true, value: { text: SAMPLE, sha: 'sha-2' } }) }),
      args,
    )
    assert.equal(r.status, 'conflict')
    if (r.status === 'conflict') {
      assert.equal(r.latestSha, 'sha-2')
      assert.equal(r.latestBody, '원래 본문\n')
    }
  })
  it('검증 실패 본문은 rejected(커밋 시도 없음)', async () => {
    let putCalled = false
    const big = 'a'.repeat(200 * 1024 + 1)
    const r = await submitBodyCore(
      deps({ putFile: async () => { putCalled = true; return { ok: true, value: { commitSha: 'c1' } } } }),
      { ...args, body: big },
    )
    assert.equal(r.status, 'rejected')
    assert.equal(putCalled, false)
  })
  it('rate limit 초과는 rate_limited', async () => {
    const r = await submitBodyCore(deps({ rateLimit: () => false }), args)
    assert.equal(r.status, 'rate_limited')
  })
})
