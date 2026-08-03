import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getContentFile, putContentFile } from '../src/lib/github/contents.ts'

const realFetch = globalThis.fetch
function stubFetch(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status })) as typeof fetch
}
beforeEach(() => { process.env.GITHUB_CONTENT_TOKEN = 'test-token' })
afterEach(() => { globalThis.fetch = realFetch })

describe('getContentFile', () => {
  it('base64 content와 sha를 반환한다', async () => {
    stubFetch(200, { content: Buffer.from('# 제목\n한글 본문').toString('base64'), sha: 'abc' })
    const r = await getContentFile('content/policies/x.md')
    assert.ok(r.ok)
    assert.equal(r.value.text, '# 제목\n한글 본문')
    assert.equal(r.value.sha, 'abc')
  })
  it('404는 not_found', async () => {
    stubFetch(404, { message: 'Not Found' })
    const r = await getContentFile('content/policies/x.md')
    assert.deepEqual(r, { ok: false, reason: 'not_found' })
  })
  it('401/403은 auth', async () => {
    stubFetch(401, {})
    assert.deepEqual(await getContentFile('a.md'), { ok: false, reason: 'auth' })
  })
  it('fetch throw는 network', async () => {
    globalThis.fetch = (async () => { throw new Error('ECONNRESET') }) as typeof fetch
    assert.deepEqual(await getContentFile('a.md'), { ok: false, reason: 'network' })
  })
})

describe('putContentFile', () => {
  it('성공 시 commitSha 반환', async () => {
    stubFetch(200, { commit: { sha: 'deadbeef' } })
    const r = await putContentFile({ path: 'a.md', text: '본문', sha: 'abc', message: 'msg' })
    assert.ok(r.ok)
    assert.equal(r.value.commitSha, 'deadbeef')
  })
  it('409/422는 conflict(SHA 불일치)', async () => {
    stubFetch(409, {})
    const r = await putContentFile({ path: 'a.md', text: '본문', sha: 'stale', message: 'msg' })
    assert.deepEqual(r, { ok: false, reason: 'conflict' })
  })
})
