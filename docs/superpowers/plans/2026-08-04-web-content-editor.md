# 웹 콘텐츠 편집기 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비개발자 감수자가 웹앱 안에서 KB 문서 본문을 수정해 GitHub master에 커밋(git-backed)하는 미니멀 마크다운 편집기.

**Architecture:** `/admin/editor` dynamic 페이지 1개 + 서버 액션 3종(로드·프리뷰·반영). 편집기는 DB가 아니라 GitHub Contents API로 마크다운 정본에 커밋하고, push→Vercel 빌드가 사이트를 갱신한다. DB·임베딩은 야간 GitHub Actions(`kb:sync`+`kb:embed`). spec 정본: `docs/superpowers/specs/2026-08-04-web-content-editor-design.md`.

**Tech Stack:** Next.js 16 App Router(서버 액션), next-mdx-remote, gray-matter, node:test(tsx), vitest(컴포넌트), GitHub Contents REST API(fetch 직접, octokit 불추가).

**구현 방식 판정(자율성 헌장)**: subagent-driven. Task 1~4는 인터페이스가 본 플랜에 고정된 독립 라이브러리, Task 5 이후는 그 인터페이스만 소비한다. 파일 겹침은 KbPageLayout(Task 1이 추출, Task 7이 버튼 추가)뿐이라 순서로 해소. 선행 관계: 1→(4,5), 3→5, 5→6, 2→(5,7).

## Global Constraints

- UI 문구·주석·커밋 메시지 전부 한국어. em dash(`—`) 금지, UI 라벨 이모지 금지.
- 접근성 헌장 준수: 단일 polite live region, `aria-disabled`(disabled 금지), 포커스 유지 우선, 44px 타깃.
- 커밋에 감수자 개인 이메일·실명 금지(공개 repo). 가명 식별자 `editor:<uuid 앞 8자>`만.
- frontmatter는 클라이언트 미경유 + 원본 바이트 보존(YAML 재직렬화 금지).
- 본문 크기 상한 200KB. 서버 액션 전부에 역할 재검증 + rate limit.
- 테스트: 백엔드 node:test(`tests/**/*.test.ts`, `npm test`), 컴포넌트 vitest(`tests/components/`, `npm run test:components`). 기존 관례(assert/describe) 따름.
- 새 API 라우트 파일 금지(함수 예산): 서버 액션만. 빌드 후 함수 수 ≤12 실측 확인.
- 각 태스크 완료 시 해당 파일만 pathspec 커밋(`git add <파일> && git commit -- <파일>`).

---

### Task 1: 공용 KB MDX 렌더 헬퍼 추출 (`src/lib/kb-mdx.ts`)

KbPageLayout에 인라인된 escape+serialize를 추출해 프로덕션 렌더·프리뷰·반영 전 검증이 단일 정본을 쓰게 한다.

**Files:**
- Create: `src/lib/kb-mdx.ts`
- Modify: `src/components/kb/KbPageLayout.tsx:76-95` (인라인 escape+serialize를 헬퍼 호출로 교체)
- Test: `tests/kb-mdx.test.ts`

**Interfaces:**
- Produces: `escapeKbContent(content: string): string` / `serializeKbContent(content: string): Promise<MDXRemoteSerializeResult>` (escape 적용 후 serialize, remarkGfm+rehypeSlug 동일 옵션)

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/kb-mdx.test.ts`)

```ts
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
```

- [ ] **Step 2: 실패 확인**: Run: `npm test -- tests/kb-mdx.test.ts` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현** (`src/lib/kb-mdx.ts`)

```ts
/**
 * KB 본문 MDX 변환의 단일 정본.
 * KbPageLayout(프로덕션 렌더)·편집기 프리뷰·반영 전 검증이 모두 이 모듈을 쓴다.
 * escape가 MDX 활성 구문(JSX·표현식·import)을 구조적으로 무력화하는 보안 계층이기도
 * 하므로, 세 소비자의 변환이 갈라지면 안 된다.
 */
import { serialize } from 'next-mdx-remote/serialize'
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'

export function escapeKbContent(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/</g, '&lt;')
    // LaTeX `\frac{...}` 등을 MDX가 JSX expression으로 오해해 acorn 오류: `{`도 escape.
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

export async function serializeKbContent(
  content: string,
): Promise<MDXRemoteSerializeResult> {
  return serialize(escapeKbContent(content), {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    },
  })
}
```

- [ ] **Step 4: KbPageLayout 교체**: `KbPageLayout.tsx`의 `const escapedContent = ...`부터 `const mdxSource = await serialize(...)`까지(76~95행 부근)를 `const mdxSource = await serializeKbContent(doc.content)` 한 줄로 교체하고, 미사용이 된 `serialize`/`remarkGfm`/`rehypeSlug` import 제거. 주석(escape 근거)은 kb-mdx.ts로 이동했으므로 삭제.

- [ ] **Step 5: 통과 확인**: Run: `npm test -- tests/kb-mdx.test.ts && npm run lint && npm run build` / Expected: 테스트 PASS, 빌드 성공(렌더 동작 불변).

- [ ] **Step 6: 커밋**: `git add src/lib/kb-mdx.ts tests/kb-mdx.test.ts src/components/kb/KbPageLayout.tsx && git commit -m "refactor: KB MDX escape+serialize를 kb-mdx 공용 헬퍼로 추출" -- src/lib/kb-mdx.ts tests/kb-mdx.test.ts src/components/kb/KbPageLayout.tsx`

---

### Task 2: editor 권한 헬퍼 (`src/lib/auth/editor.ts`)

**Files:**
- Create: `src/lib/auth/editor.ts`
- Test: `tests/auth/editor.test.ts` (기존 `tests/auth/` 관례)

**Interfaces:**
- Consumes: `getServerClient()`(`src/lib/supabase/server.ts`), 기존 `admin.ts` 패턴
- Produces: `interface EditorStatus { canEdit: boolean; userId: string | null; email: string | null }` / `getCurrentUserEditorStatus(): Promise<EditorStatus>` / `getCurrentUserEditorStatusWith(supabase): Promise<EditorStatus>` / `editorIdShort(userId: string): string` (UUID 앞 8자)

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/auth/editor.test.ts`): 기존 admin 테스트의 mock supabase 패턴 재사용:

```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentUserEditorStatusWith, editorIdShort } from '../../src/lib/auth/editor.ts'

function mockClient(user: { id: string; email: string } | null, roles: Array<{ role: string }> | null, error: object | null = null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: roles, error }),
        }),
      }),
    }),
  } as never
}

describe('getCurrentUserEditorStatusWith', () => {
  it('editor role이면 canEdit=true', async () => {
    const s = await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, [{ role: 'editor' }]))
    assert.deepEqual(s, { canEdit: true, userId: 'u1', email: 'a@b.c' })
  })
  it('admin role도 canEdit=true', async () => {
    const s = await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, [{ role: 'admin' }]))
    assert.equal(s.canEdit, true)
  })
  it('role 없으면 canEdit=false, 비로그인이면 userId=null', async () => {
    assert.equal((await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, []))).canEdit, false)
    assert.equal((await getCurrentUserEditorStatusWith(mockClient(null, null))).userId, null)
  })
  it('조회 error는 fail-safe로 canEdit=false + user 정보 보존', async () => {
    const s = await getCurrentUserEditorStatusWith(mockClient({ id: 'u1', email: 'a@b.c' }, null, { message: 'x' }))
    assert.deepEqual(s, { canEdit: false, userId: 'u1', email: 'a@b.c' })
  })
})

describe('editorIdShort', () => {
  it('UUID 앞 8자를 반환한다', () => {
    assert.equal(editorIdShort('123e4567-e89b-12d3-a456-426614174000'), '123e4567')
  })
})
```

- [ ] **Step 2: 실패 확인**: Run: `npm test -- tests/auth/editor.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** (`src/lib/auth/editor.ts`): `admin.ts`와 동형. 차이는 role 조건뿐:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from '../supabase/server.ts'

export interface EditorStatus {
  canEdit: boolean
  userId: string | null
  email: string | null
}

/** 편집 권한(editor 또는 admin) server-side 판정. 기존 admin 게이트는 건드리지 않는다. */
export async function getCurrentUserEditorStatus(): Promise<EditorStatus> {
  let supabase
  try {
    supabase = await getServerClient()
  } catch {
    return { canEdit: false, userId: null, email: null }
  }
  return getCurrentUserEditorStatusWith(supabase)
}

export async function getCurrentUserEditorStatusWith(
  supabase: SupabaseClient,
): Promise<EditorStatus> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user ?? null
  if (!user) return { canEdit: false, userId: null, email: null }

  const { data: roles, error } = await supabase
    .from('editor_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['editor', 'admin'])

  if (error) return { canEdit: false, userId: user.id, email: user.email ?? null }
  return {
    canEdit: (roles ?? []).length > 0,
    userId: user.id,
    email: user.email ?? null,
  }
}

/** 공개 커밋용 가명 식별자: 개인 이메일·실명은 public repo에 남기지 않는다(spec §4). */
export function editorIdShort(userId: string): string {
  return userId.slice(0, 8)
}
```

- [ ] **Step 4: 통과 확인**: Run: `npm test -- tests/auth/editor.test.ts` / Expected: PASS
- [ ] **Step 5: 커밋**: `git add src/lib/auth/editor.ts tests/auth/editor.test.ts && git commit -m "feat: editor-or-admin 권한 판정 헬퍼 + 가명 식별자" -- src/lib/auth/editor.ts tests/auth/editor.test.ts`

---

### Task 3: GitHub Contents API 래퍼 (`src/lib/github/contents.ts`)

**Files:**
- Create: `src/lib/github/contents.ts`
- Test: `tests/github-contents.test.ts`

**Interfaces:**
- Produces:

```ts
type GithubResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'conflict' | 'not_found' | 'auth' | 'network' }
getContentFile(path: string): Promise<GithubResult<{ text: string; sha: string }>>
putContentFile(args: { path: string; text: string; sha: string; message: string }): Promise<GithubResult<{ commitSha: string }>>
```

- 환경변수: `GITHUB_CONTENT_TOKEN`(필수), `GITHUB_CONTENT_REPO`(기본 `khudt-org/webfortd`), 브랜치 `master` 고정.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/github-contents.test.ts`): `globalThis.fetch`를 스텁:

```ts
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
```

- [ ] **Step 2: 실패 확인**: Run: `npm test -- tests/github-contents.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** (`src/lib/github/contents.ts`)

```ts
/**
 * GitHub Contents API 얇은 래퍼(fetch 직접, octokit 불추가: 호출 2종뿐).
 * master 고정: 감수자 반영 경로는 master 직행이 위원장 확정 결정(spec §2).
 */
export type GithubResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'conflict' | 'not_found' | 'auth' | 'network' }

const REPO = () => process.env.GITHUB_CONTENT_REPO ?? 'khudt-org/webfortd'
const BRANCH = 'master'

function headers(): Record<string, string> {
  return {
    authorization: `Bearer ${process.env.GITHUB_CONTENT_TOKEN ?? ''}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  }
}

function failFromStatus(status: number): GithubResult<never> {
  if (status === 401 || status === 403) return { ok: false, reason: 'auth' }
  if (status === 404) return { ok: false, reason: 'not_found' }
  if (status === 409 || status === 422) return { ok: false, reason: 'conflict' }
  return { ok: false, reason: 'network' }
}

export async function getContentFile(
  path: string,
): Promise<GithubResult<{ text: string; sha: string }>> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO()}/contents/${path}?ref=${BRANCH}`,
      { headers: headers(), cache: 'no-store' },
    )
    if (!res.ok) return failFromStatus(res.status)
    const json = (await res.json()) as { content: string; sha: string }
    const text = Buffer.from(json.content, 'base64').toString('utf-8')
    return { ok: true, value: { text, sha: json.sha } }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function putContentFile(args: {
  path: string
  text: string
  sha: string
  message: string
}): Promise<GithubResult<{ commitSha: string }>> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO()}/contents/${args.path}`,
      {
        method: 'PUT',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({
          message: args.message,
          content: Buffer.from(args.text, 'utf-8').toString('base64'),
          sha: args.sha,
          branch: BRANCH,
        }),
      },
    )
    if (!res.ok) return failFromStatus(res.status)
    const json = (await res.json()) as { commit: { sha: string } }
    return { ok: true, value: { commitSha: json.commit.sha } }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
```

- [ ] **Step 4: 통과 확인**: Run: `npm test -- tests/github-contents.test.ts` / Expected: PASS
- [ ] **Step 5: 커밋**: `git add src/lib/github/contents.ts tests/github-contents.test.ts && git commit -m "feat: GitHub Contents API 래퍼(GET/PUT, 타입드 실패 사유)" -- src/lib/github/contents.ts tests/github-contents.test.ts`

---

### Task 4: 문서 IO: 경로 해석·frontmatter 바이트 보존·본문 검증 (`src/lib/editor/document-io.ts`)

**Files:**
- Create: `src/lib/editor/document-io.ts`
- Test: `tests/editor-document-io.test.ts`

**Interfaces:**
- Consumes: `serializeKbContent`(Task 1), kb-index(`src/lib/kb.ts`의 `getKBDocBySlug`가 쓰는 `kb-index.generated.json`: 여기서는 `documents[].{slug, filePath}` 직접 로드)
- Produces:

```ts
resolveContentPath(slug: string): string | null   // 화이트리스트 통과 시 'content/...' 경로
splitDocument(raw: string): { frontmatterRaw: string; body: string } | null
                                                  // frontmatterRaw는 여는 '---\n'부터 닫는 '---\n'까지 원본 그대로
mergeDocument(frontmatterRaw: string, body: string): string
BODY_MAX_BYTES = 200 * 1024
validateBody(body: string): Promise<{ ok: true } | { ok: false; message: string }>
```

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/editor-document-io.test.ts`)

```ts
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
```

- [ ] **Step 2: 실패 확인**: Run: `npm test -- tests/editor-document-io.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** (`src/lib/editor/document-io.ts`)

```ts
import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { serializeKbContent } from '../kb-mdx.ts'

/**
 * slug → content 파일 경로 화이트리스트.
 * 클라이언트는 slug만 보내고 경로는 서버가 kb-index에서 해석한다(spec §6).
 * kb-index는 빌드 산출물이라 stale일 수 있다: 소비자는 GET 404를 별도 처리(Task 5).
 */
interface KbIndexDoc { slug: string; filePath: string }

let slugToPath: Map<string, string> | null = null
function loadIndex(): Map<string, string> {
  if (slugToPath) return slugToPath
  const indexPath = path.join(process.cwd(), 'src/lib/kb-index.generated.json')
  const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as { documents: KbIndexDoc[] }
  slugToPath = new Map(parsed.documents.map((d) => [d.slug, d.filePath]))
  return slugToPath
}

export function resolveContentPath(slug: string): string | null {
  const filePath = loadIndex().get(slug)
  if (!filePath) return null
  const normalized = path.posix.normalize(filePath)
  if (!/^content\/[^\0]+\.md$/.test(normalized)) return null
  if (normalized.includes('..')) return null
  return normalized
}

/** frontmatter 원본 바이트 보존 분리: YAML 파싱·재직렬화 금지(주석·순서·줄바꿈 보존). */
export function splitDocument(
  raw: string,
): { frontmatterRaw: string; body: string } | null {
  if (!raw.startsWith('---\n')) return null
  const closeIdx = raw.indexOf('\n---\n', 4)
  if (closeIdx === -1) return null
  const end = closeIdx + '\n---\n'.length
  return { frontmatterRaw: raw.slice(0, end), body: raw.slice(end) }
}

export function mergeDocument(frontmatterRaw: string, body: string): string {
  return frontmatterRaw + body
}

export const BODY_MAX_BYTES = 200 * 1024

/**
 * 반영 전 본문 검증: 구문 결함 차단(빌드 성공의 완전 보장 아님, spec §7).
 * serialize는 프로덕션 렌더와 동일 경로(kb-mdx)라 여기서 실패하면 렌더도 실패한다.
 */
export async function validateBody(
  body: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (Buffer.byteLength(body, 'utf-8') > BODY_MAX_BYTES) {
    return { ok: false, message: '본문이 200KB를 넘습니다. 나누어 저장해 주세요.' }
  }
  try {
    await serializeKbContent(body)
    return { ok: true }
  } catch (e) {
    const detail = e instanceof Error ? e.message.split('\n')[0] : ''
    return { ok: false, message: `본문 형식에 문제가 있어 저장하지 않았습니다. (${detail})` }
  }
}
```

주의: kb-index를 쓰는 이 모듈은 `server-only`이며, 테스트는 tsx 로더로 직접 import한다(기존 `tests/admin-client.test.ts`가 같은 방식). `server-only` import가 node:test에서 문제가 되면 기존 테스트들이 쓰는 우회 관례를 따른다(먼저 `grep -rn "server-only" tests/` 로 확인).

- [ ] **Step 4: 통과 확인**: Run: `npm test -- tests/editor-document-io.test.ts` / Expected: PASS
- [ ] **Step 5: 커밋**: `git add src/lib/editor/document-io.ts tests/editor-document-io.test.ts && git commit -m "feat: 편집기 문서 IO(slug 화이트리스트, frontmatter 바이트 보존, 본문 검증)" -- src/lib/editor/document-io.ts tests/editor-document-io.test.ts`

---

### Task 5: 편집 코어 로직 + 서버 액션 (`src/lib/editor/edit-core.ts`, `src/app/(wiki)/admin/editor/actions.ts`)

서버 액션은 얇게, 판정 로직은 DI 가능한 코어로 분리해 unit 테스트를 건다.

**Files:**
- Create: `src/lib/editor/edit-core.ts`, `src/app/(wiki)/admin/editor/actions.ts`
- Test: `tests/editor-edit-core.test.ts`

**Interfaces:**
- Consumes: Task 1 `serializeKbContent` / Task 2 `EditorStatus`·`editorIdShort` / Task 3 `getContentFile`·`putContentFile`·`GithubResult` / Task 4 전부 / `checkRateLimit`(`src/lib/rate-limit.ts`)
- Produces (코어: 액션이 그대로 반환):

```ts
type LoadResult =
  | { status: 'ok'; body: string; baseSha: string; title: string }
  | { status: 'forbidden' | 'not_found' | 'system' | 'rate_limited'; message: string }
type SubmitResult =
  | { status: 'accepted'; message: string }        // "커밋 접수"
  | { status: 'rejected'; message: string }        // 검증 거부
  | { status: 'conflict'; message: string; latestBody: string; latestSha: string }
  | { status: 'forbidden' | 'system' | 'rate_limited'; message: string }
loadDocumentCore(deps, slug): Promise<LoadResult>
submitBodyCore(deps, args: { slug: string; baseSha: string; body: string }): Promise<SubmitResult>
interface EditDeps {
  getEditor(): Promise<EditorStatus>
  getFile(path: string): ReturnType<typeof getContentFile>
  putFile(args: Parameters<typeof putContentFile>[0]): ReturnType<typeof putContentFile>
  rateLimit(key: string): boolean
}
```

- 액션: `loadDocument(slug)` / `previewBody(body)`(검증+serialize 결과 반환) / `submitBody(args)`: 모두 `'use server'`, 코어에 실 의존성 주입.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/editor-edit-core.test.ts`)

```ts
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
```

- [ ] **Step 2: 실패 확인**: Run: `npm test -- tests/editor-edit-core.test.ts` / Expected: FAIL

- [ ] **Step 3: 코어 구현** (`src/lib/editor/edit-core.ts`)

```ts
import 'server-only'
import type { EditorStatus } from '../auth/editor.ts'
import { editorIdShort } from '../auth/editor.ts'
import type { GithubResult } from '../github/contents.ts'
import {
  resolveContentPath, splitDocument, mergeDocument, validateBody,
} from './document-io.ts'

export interface EditDeps {
  getEditor(): Promise<EditorStatus>
  getFile(path: string): Promise<GithubResult<{ text: string; sha: string }>>
  putFile(args: { path: string; text: string; sha: string; message: string }): Promise<GithubResult<{ commitSha: string }>>
  rateLimit(key: string): boolean
}

const MSG = {
  forbidden: '편집 권한이 없습니다. 로그인 상태와 권한 등록을 확인해 주세요.',
  notFound: '문서를 찾을 수 없습니다. 문서 위치가 바뀌었을 수 있으니 관리자에게 알려 주세요.',
  system: '시스템 연결에 문제가 있습니다. 잠시 후에도 계속되면 관리자에게 알려 주세요.',
  rateLimited: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  conflict: '다른 수정과 충돌했습니다. 아래에 보존된 내 편집본을 참고해 최신 본문에 다시 반영해 주세요.',
  accepted: '반영 커밋이 접수되었습니다. 몇 분 후 문서 페이지를 새로고침해 확인해 주세요.',
} as const

export type LoadResult =
  | { status: 'ok'; body: string; baseSha: string; title: string }
  | { status: 'forbidden' | 'not_found' | 'system' | 'rate_limited'; message: string }

export type SubmitResult =
  | { status: 'accepted'; message: string }
  | { status: 'rejected'; message: string }
  | { status: 'conflict'; message: string; latestBody: string; latestSha: string }
  | { status: 'forbidden' | 'system' | 'rate_limited'; message: string }

function githubFail(reason: 'conflict' | 'not_found' | 'auth' | 'network'):
  { status: 'not_found' | 'system'; message: string } {
  if (reason === 'not_found') return { status: 'not_found', message: MSG.notFound }
  return { status: 'system', message: MSG.system }
}

export async function loadDocumentCore(deps: EditDeps, slug: string): Promise<LoadResult> {
  const editor = await deps.getEditor()
  if (!editor.canEdit || !editor.userId) return { status: 'forbidden', message: MSG.forbidden }
  if (!deps.rateLimit(`editor-load:${editor.userId}`)) return { status: 'rate_limited', message: MSG.rateLimited }

  const path = resolveContentPath(slug)
  if (!path) return { status: 'not_found', message: MSG.notFound }

  const file = await deps.getFile(path)
  if (!file.ok) return githubFail(file.reason)

  const parts = splitDocument(file.value.text)
  if (!parts) return { status: 'system', message: MSG.system }

  // title은 화면 표시용: frontmatter의 title 값만 정규식으로 추출(파싱·재직렬화 아님)
  const titleMatch = parts.frontmatterRaw.match(/^title:\s*["']?(.+?)["']?\s*$/m)
  return {
    status: 'ok',
    body: parts.body,
    baseSha: file.value.sha,
    title: titleMatch?.[1] ?? slug,
  }
}

export async function submitBodyCore(
  deps: EditDeps,
  args: { slug: string; baseSha: string; body: string },
): Promise<SubmitResult> {
  const editor = await deps.getEditor()
  if (!editor.canEdit || !editor.userId) return { status: 'forbidden', message: MSG.forbidden }
  if (!deps.rateLimit(`editor-submit:${editor.userId}`)) return { status: 'rate_limited', message: MSG.rateLimited }

  const path = resolveContentPath(args.slug)
  if (!path) return { status: 'system', message: MSG.system }

  const valid = await validateBody(args.body)
  if (!valid.ok) return { status: 'rejected', message: valid.message }

  // 제출 시점 재조회: 서버리스라 로드 때 상태를 보관하지 않는다(stateless 프로토콜, spec §4)
  const current = await deps.getFile(path)
  if (!current.ok) {
    const f = githubFail(current.reason)
    return { status: 'system', message: f.message }
  }
  if (current.value.sha !== args.baseSha) {
    const latest = splitDocument(current.value.text)
    return {
      status: 'conflict',
      message: MSG.conflict,
      latestBody: latest?.body ?? current.value.text,
      latestSha: current.value.sha,
    }
  }

  const parts = splitDocument(current.value.text)
  if (!parts) return { status: 'system', message: MSG.system }

  const put = await deps.putFile({
    path,
    text: mergeDocument(parts.frontmatterRaw, args.body),
    sha: current.value.sha,
    message: `content(edit): ${args.slug} [editor:${editorIdShort(editor.userId)}]`,
  })
  if (!put.ok) {
    if (put.reason === 'conflict') {
      return { status: 'conflict', message: MSG.conflict, latestBody: args.body, latestSha: args.baseSha }
    }
    return { status: 'system', message: MSG.system }
  }
  return { status: 'accepted', message: MSG.accepted }
}
```

- [ ] **Step 4: 통과 확인**: Run: `npm test -- tests/editor-edit-core.test.ts` / Expected: PASS

- [ ] **Step 5: 서버 액션 작성** (`src/app/(wiki)/admin/editor/actions.ts`)

```ts
'use server'

import { getCurrentUserEditorStatus } from '@/lib/auth/editor'
import { getContentFile, putContentFile } from '@/lib/github/contents'
import { checkRateLimit } from '@/lib/rate-limit'
import { loadDocumentCore, submitBodyCore } from '@/lib/editor/edit-core'
import type { LoadResult, SubmitResult } from '@/lib/editor/edit-core'
import { validateBody } from '@/lib/editor/document-io'
import { serializeKbContent } from '@/lib/kb-mdx'
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'

const DEPS = {
  getEditor: getCurrentUserEditorStatus,
  getFile: getContentFile,
  putFile: putContentFile,
  rateLimit: (key: string) => checkRateLimit(key, 20, 60_000).ok,
}

export async function loadDocument(slug: string): Promise<LoadResult> {
  return loadDocumentCore(DEPS, slug)
}

export async function submitBody(args: {
  slug: string; baseSha: string; body: string
}): Promise<SubmitResult> {
  return submitBodyCore(DEPS, args)
}

export type PreviewResult =
  | { status: 'ok'; source: MDXRemoteSerializeResult }
  | { status: 'rejected' | 'forbidden' | 'rate_limited'; message: string }

export async function previewBody(body: string): Promise<PreviewResult> {
  const editor = await getCurrentUserEditorStatus()
  if (!editor.canEdit || !editor.userId) {
    return { status: 'forbidden', message: '편집 권한이 없습니다.' }
  }
  if (!DEPS.rateLimit(`editor-preview:${editor.userId}`)) {
    return { status: 'rate_limited', message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }
  }
  const valid = await validateBody(body)
  if (!valid.ok) return { status: 'rejected', message: valid.message }
  return { status: 'ok', source: await serializeKbContent(body) }
}
```

- [ ] **Step 6: lint·전체 테스트**: Run: `npm run lint && npm test` / Expected: PASS
- [ ] **Step 7: 커밋**: `git add src/lib/editor/edit-core.ts src/app/\(wiki\)/admin/editor/actions.ts tests/editor-edit-core.test.ts && git commit -m "feat: 편집 코어 로직(DI) + 서버 액션 3종(로드·프리뷰·반영)" -- src/lib/editor/edit-core.ts "src/app/(wiki)/admin/editor/actions.ts" tests/editor-edit-core.test.ts`

---

### Task 6: `/admin/editor` 페이지 UI (`page.tsx` + `EditorClient.tsx`)

**Files:**
- Create: `src/app/(wiki)/admin/editor/page.tsx`, `src/app/(wiki)/admin/editor/EditorClient.tsx`
- Test: `tests/components/editor-client.test.tsx` (vitest)

**Interfaces:**
- Consumes: Task 5 액션 전부(`loadDocument`·`previewBody`·`submitBody`와 그 Result 타입), `MDXContent`(`src/components/mdx/MDXContent.tsx`, props `{ source: MDXRemoteSerializeResult }`)
- Produces: 페이지 `/admin/editor?slug=<slug>` (dynamic)

**UI 계약(접근성 헌장·spec §8)**:
- `<textarea>`에 가시 `<label>` "본문 (마크다운)". 자동 저장 없음.
- 버튼 3개: "프리뷰 보기"↔"편집으로 돌아가기"(라벨 전환 = 상태 신호, 포커스 버튼 유지), "수정 반영"(`aria-disabled` + in-flight `useRef` 가드), 문서로 돌아가기 링크.
- 단일 polite live region 1개: 4상태 메시지(`accepted`/`rejected`/`conflict`/`system`·`rate_limited`)를 서버 반환 `message` 그대로 출력.
- 충돌 시: textarea에는 `latestBody` 로드 + `baseSha`를 `latestSha`로 갱신, **내 편집본은 별도 `<section>`(헤딩 "내 편집본 (충돌로 보존됨)") 읽기 전용 `<textarea readOnly>`로 보존**.
- 단축키: 편집기 컨테이너(`onKeyDown` on wrapper div) 안에서만 Cmd/Ctrl+S=반영, Cmd/Ctrl+E=프리뷰 토글. `e.preventDefault()` 필수.
- localStorage 초안: key `editor-draft:<slug>:<baseSha>`, body 변경 시 debounce 500ms 저장, 마운트 시 같은 키가 있고 로드 본문과 다르면 "저장하지 않은 초안이 있습니다" + "초안 복원" 버튼 노출. 반영 accepted 시 키 삭제.
- 미권한/미로그인 접근: 액션 `forbidden` 메시지를 본문 영역에 표시(구분 문구는 서버 반환 그대로).

- [ ] **Step 1: 실패하는 컴포넌트 테스트 작성** (`tests/components/editor-client.test.tsx`): 액션 모듈은 `vi.mock`으로 스텁:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditorClient } from '@/app/(wiki)/admin/editor/EditorClient'

vi.mock('@/app/(wiki)/admin/editor/actions', () => ({
  previewBody: vi.fn(async () => ({ status: 'ok', source: { compiledSource: '', scope: {}, frontmatter: {} } })),
  submitBody: vi.fn(async () => ({ status: 'accepted', message: '반영 커밋이 접수되었습니다. 몇 분 후 문서 페이지를 새로고침해 확인해 주세요.' })),
}))
import { submitBody } from '@/app/(wiki)/admin/editor/actions'

const props = { slug: 's1', title: '표본', body: '원래 본문', baseSha: 'sha-1' }

describe('EditorClient', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('본문 textarea에 가시 라벨이 연결된다', () => {
    render(<EditorClient {...props} />)
    expect(screen.getByLabelText('본문 (마크다운)')).toHaveValue('원래 본문')
  })

  it('반영 성공 시 live region에 접수 메시지', async () => {
    render(<EditorClient {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '수정 반영' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('반영 커밋이 접수되었습니다'))
  })

  it('충돌 시 내 편집본이 별도 영역에 보존되고 textarea는 최신본', async () => {
    vi.mocked(submitBody).mockResolvedValueOnce({
      status: 'conflict', message: '다른 수정과 충돌했습니다.',
      latestBody: '남의 최신 본문', latestSha: 'sha-2',
    })
    render(<EditorClient {...props} />)
    const ta = screen.getByLabelText('본문 (마크다운)')
    fireEvent.change(ta, { target: { value: '내 편집' } })
    fireEvent.click(screen.getByRole('button', { name: '수정 반영' }))
    await waitFor(() => {
      expect(screen.getByLabelText('본문 (마크다운)')).toHaveValue('남의 최신 본문')
      expect(screen.getByText('내 편집본 (충돌로 보존됨)')).toBeInTheDocument()
    })
  })

  it('프리뷰 토글 버튼 라벨이 전환된다', async () => {
    render(<EditorClient {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '프리뷰 보기' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '편집으로 돌아가기' })).toBeInTheDocument())
  })

  it('반영 버튼은 disabled가 아니라 aria-disabled를 쓴다', () => {
    render(<EditorClient {...props} />)
    const btn = screen.getByRole('button', { name: '수정 반영' })
    expect(btn).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: 실패 확인**: Run: `npm run test:components -- editor-client` / Expected: FAIL

- [ ] **Step 3: `EditorClient.tsx` 구현**: `"use client"`. 상태: `body`, `mode: 'edit' | 'preview'`, `baseSha`, `notice: string`, `conflictBackup: string | null`, `previewSource`. in-flight `useRef(false)` + `finally` 해제. 반영 후 포커스는 반영 버튼 유지(재포커스 불필요: `aria-disabled` 패턴이라 이탈 없음). localStorage debounce는 `useEffect` + `setTimeout` 500ms. 단축키는 래퍼 `<div onKeyDown>`에서 `(e.metaKey || e.ctrlKey) && e.key === 's'|'e'` 판정. 프리뷰는 `previewBody` 호출 성공 시 `<MDXContent source={...} />` 렌더, `rejected`면 live region에 메시지 출력하고 편집 모드 유지. 스타일은 기존 페이지의 Tailwind 관용구(`min-h-11`, `rounded-lg`, `focus:ring-2`)를 따른다.

- [ ] **Step 4: `page.tsx` 구현**

```tsx
import { Metadata } from 'next'
import { loadDocument } from './actions'
import { EditorClient } from './EditorClient'

export const metadata: Metadata = { title: '콘텐츠 편집' }
export const dynamic = 'force-dynamic'

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>
}) {
  const { slug } = await searchParams
  if (!slug) {
    return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-xl font-semibold">콘텐츠 편집</h1><p className="mt-4">편집할 문서 페이지에서 편집 버튼으로 들어와 주세요.</p></main>
  }
  const doc = await loadDocument(slug)
  if (doc.status !== 'ok') {
    return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-xl font-semibold">콘텐츠 편집</h1><p className="mt-4">{doc.message}</p></main>
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold">{doc.title} 편집</h1>
      <EditorClient slug={slug} title={doc.title} body={doc.body} baseSha={doc.baseSha} />
    </main>
  )
}
```

(참고: `(wiki)` 레이아웃이 이미 `<main>`을 렌더하면 중첩 main 금지: 구현 시 `src/app/(wiki)/layout.tsx`를 확인해 `<div>`로 강등할 것.)

- [ ] **Step 5: 통과 확인**: Run: `npm run test:components -- editor-client && npm run lint && npm run build` / Expected: PASS + 빌드 성공. 빌드 출력에서 ƒ(dynamic) 함수 수를 세어 12 이하 확인·기록.
- [ ] **Step 6: 커밋**: `git add "src/app/(wiki)/admin/editor/page.tsx" "src/app/(wiki)/admin/editor/EditorClient.tsx" tests/components/editor-client.test.tsx && git commit -m "feat: /admin/editor 편집 화면(텍스트영역+프리뷰 토글+4상태 통지+충돌 보존+초안 백업)" -- "src/app/(wiki)/admin/editor/page.tsx" "src/app/(wiki)/admin/editor/EditorClient.tsx" tests/components/editor-client.test.tsx`

---

### Task 7: KB 문서 페이지 편집 버튼 (`EditButton.tsx`)

**Files:**
- Create: `src/components/kb/EditButton.tsx`
- Modify: `src/components/kb/KbPageLayout.tsx` (sticky 헤더의 `StatusBadge` 옆에 `<EditButton slug={slug} />` 추가)
- Test: `tests/components/edit-button.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`(`src/contexts/AuthContext.tsx`: client 세션), Supabase browser client(`src/lib/supabase/client`), 기존 RLS "editor read own role"(0002: 자기 행 SELECT 허용)
- Produces: 권한자에게만 `/admin/editor?slug=<slug>` 링크 렌더. 비로그인·무권한·조회 실패는 null 렌더(정적 페이지 훼손 없음: 직접 URL 접근 시의 구분 안내는 Task 6 페이지가 담당).

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/components/edit-button.test.tsx`): AuthContext·supabase client를 `vi.mock`: ① 세션 없음 → 렌더 없음 ② editor role 행 존재 → link `편집` 렌더(`href="/admin/editor?slug=s1"`) ③ 조회 error → 렌더 없음. (mock 형상은 기존 `tests/components/`의 AuthContext mock 관례를 먼저 확인해 따른다.)
- [ ] **Step 2: 실패 확인**: Run: `npm run test:components -- edit-button` / Expected: FAIL
- [ ] **Step 3: 구현**: `"use client"`. `useAuth()`의 user가 없으면 null. 있으면 `useEffect`에서 `supabase.from('editor_roles').select('role').eq('user_id', user.id)` 1회 조회(기존 RLS가 자기 행만 허용), 행이 있으면 `<Link href={...} className="min-h-11 ...">편집</Link>` 렌더. 로딩 중·실패는 null(깜빡임 없는 미니멀: 발견 경로는 감수자 안내문이 담당).
- [ ] **Step 4: KbPageLayout에 배치**: sticky 헤더 우측 `StatusBadge`와 `AccessibilityToolbar` 사이에 삽입.
- [ ] **Step 5: 통과 확인**: Run: `npm run test:components -- edit-button && npm run build` / Expected: PASS(정적 프리렌더 수 불변 확인: EditButton은 client라 빌드 산출 불변).
- [ ] **Step 6: 커밋**: `git add src/components/kb/EditButton.tsx src/components/kb/KbPageLayout.tsx tests/components/edit-button.test.tsx && git commit -m "feat: KB 문서 페이지 편집 버튼(권한자 한정 노출)" -- src/components/kb/EditButton.tsx src/components/kb/KbPageLayout.tsx tests/components/edit-button.test.tsx`

---

### Task 8: editor_roles RLS 거부 integration 테스트

**Files:**
- Create: `tests/migrations/editor-roles-rls.test.ts` (기존 `tests/migrations/` 관례·`.env.local` 필요)

**Interfaces:**
- Consumes: 기존 integration 테스트 헬퍼(anon/service 클라이언트 생성 관례: `tests/migrations/`의 기존 파일에서 복제)

- [ ] **Step 1: 테스트 작성**: ① anon 클라이언트로 `editor_roles` insert 시도 → RLS 거부(error 존재) 확인 ② anon update/delete 도 거부 ③ service_role 클라이언트로 임시 행 insert→delete 성공(권한 부여는 service만 가능함을 실증). 기존 파일의 스킵 가드(`.env.local` 없으면 skip) 패턴 준수.
- [ ] **Step 2: 실행 확인**: Run: `npm run test:integration -- tests/migrations/editor-roles-rls.test.ts` / Expected: PASS
- [ ] **Step 3: 커밋**: `git add tests/migrations/editor-roles-rls.test.ts && git commit -m "test: editor_roles 권한 자기부여 차단 RLS 고정" -- tests/migrations/editor-roles-rls.test.ts`

---

### Task 9: 야간 sync+embed 워크플로 (`.github/workflows/nightly-embed.yml`)

**Files:**
- Create: `.github/workflows/nightly-embed.yml`

**Interfaces:**
- Consumes: `npm run kb:sync`·`npm run kb:embed`(단, CI에는 `.env.local`이 없으므로 `--env-file` 없이 환경변수 직접 주입: package.json 스크립트를 우회해 `npx tsx scripts/sync-content-to-db.ts` / `npx tsx scripts/embed-content.ts`를 직접 호출; 두 스크립트가 요구하는 env 변수명은 `scripts/lib/env-loader.ts`에서 확인해 그대로 사용), Secrets `GEMINI_API_KEY`·`SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`, 상태 저장은 repo variable `LAST_EMBED_SHA`.

- [ ] **Step 1: 워크플로 작성**

```yaml
name: nightly-embed
on:
  schedule:
    - cron: '0 18 * * *' # KST 03:00
  workflow_dispatch: {}   # 수동 재처리 경로(spec §11-6)

permissions:
  contents: read

jobs:
  sync-and-embed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: content 변경 확인 (마지막 성공 SHA 대비)
        id: gate
        env:
          GH_TOKEN: ${{ secrets.VAR_RW_TOKEN }}
        run: |
          CURRENT=$(git log -1 --format=%H -- content/)
          LAST="${{ vars.LAST_EMBED_SHA }}"
          echo "current=$CURRENT" >> "$GITHUB_OUTPUT"
          if [ "$CURRENT" = "$LAST" ]; then
            echo "skip=true" >> "$GITHUB_OUTPUT"
          else
            echo "skip=false" >> "$GITHUB_OUTPUT"
          fi
      - uses: actions/setup-node@v4
        if: steps.gate.outputs.skip == 'false'
        with: { node-version: 24, cache: npm }
      - name: 의존성 설치 + 인덱스 생성
        if: steps.gate.outputs.skip == 'false'
        run: npm ci && npm run sync:content
      - name: kb:sync + kb:embed
        if: steps.gate.outputs.skip == 'false'
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          npx tsx scripts/sync-content-to-db.ts --apply
          npx tsx scripts/embed-content.ts --apply
      - name: 성공 SHA 기록 (실패 시 미기록 → 다음 실행이 자동 재시도)
        if: steps.gate.outputs.skip == 'false'
        env:
          GH_TOKEN: ${{ secrets.VAR_RW_TOKEN }}
        run: gh variable set LAST_EMBED_SHA --body "${{ steps.gate.outputs.current }}" --repo "$GITHUB_REPOSITORY"
```

주의(구현자가 확인할 것): ① 두 스크립트의 실제 CLI 플래그(`--apply` 형식)와 env 변수명(`NEXT_PUBLIC_SUPABASE_URL`일 수 있음)을 `scripts/lib/env-loader.ts`·각 스크립트 헤더에서 확인해 맞출 것. ② `vars.LAST_EMBED_SHA` 미존재 시 빈 문자열 비교로 정상 동작(첫 실행은 무조건 실행). ③ repo variable 쓰기는 기본 `GITHUB_TOKEN` 권한 밖이라 fine-grained PAT(`VAR_RW_TOKEN`, Variables write)을 Secrets에 등록하는 항목을 spec §11 운영 체크리스트에 이미 반영된 Secrets 목록에 추가.

- [ ] **Step 2: 문법 검증**: Run: `npx --yes @action-validator/cli .github/workflows/nightly-embed.yml || npx --yes yaml-lint .github/workflows/nightly-embed.yml` (둘 다 실패 시 `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/nightly-embed.yml'))"` 로 최소 YAML 파스 확인) / Expected: 파스 성공
- [ ] **Step 3: 커밋**: `git add .github/workflows/nightly-embed.yml && git commit -m "ci: 야간 kb:sync+kb:embed 워크플로(SHA 게이트, 실패 자동 재시도)" -- .github/workflows/nightly-embed.yml`

---

### Task 10: a11y 테스트 + 감수자 안내 문서 + PROGRESS 갱신

**Files:**
- Modify: `tests/a11y/` 기존 axe 스위트(파일명은 `ls tests/a11y`로 확인)에 editor 페이지 케이스 추가
- Create: `docs/EDITOR_GUIDE.md`
- Modify: `PROGRESS.md`

- [ ] **Step 1: a11y 테스트 추가**: 기존 Playwright axe 스위트 관례를 따라 `/admin/editor`(slug 없는 안내 화면: 미로그인 상태에서도 렌더되는 화면) axe 검사 케이스 1건 추가. Run: `npm run test:a11y` / Expected: PASS
- [ ] **Step 2: `docs/EDITOR_GUIDE.md` 작성**: 감수자 1쪽 안내(한국어): 로그인(이메일 코드) → 문서에서 "편집" → 본문 수정 → 프리뷰 확인 → "수정 반영" → 몇 분 후 새로고침 확인. 문제 해결: 편집 버튼이 안 보일 때(로그인 만료/권한 미등록), "다른 수정과 충돌" 안내, 시스템 연결 문제 시 관리자 연락. 단축키 표(Cmd/Ctrl+S, Cmd/Ctrl+E).
- [ ] **Step 3: PROGRESS.md 갱신**: 편집기 트랙 상태·운영 체크리스트(spec §11) 잔여 항목 기록.
- [ ] **Step 4: 커밋**: `git add tests/a11y docs/EDITOR_GUIDE.md PROGRESS.md && git commit -m "docs+test: 편집기 a11y 케이스, 감수자 안내, PROGRESS 갱신" -- tests/a11y docs/EDITOR_GUIDE.md PROGRESS.md`

---

## 마일스톤 마감 게이트 (플랜 필수 단계)

- [ ] cross-cutting 리뷰: 전체 diff 대상 spec-compliance + 코드품질 subagent 리뷰(리뷰어에게 spec·플랜과 diff만 제공, 세션 히스토리 금지)
- [ ] `npm test && npm run test:components && npm run lint && npm run build` 전체 green + 함수 수 실측(≤12) 기록
- [ ] PR 생성(feat/web-content-editor → master). 머지 전 실측 게이트: Vercel preview에서 편집→커밋 접수→빌드→페이지 반영 1회 실호출(위원장 또는 테스트 계정, PAT 등록 후)
- [ ] 위원장 VoiceOver 실기기 실측(편집 흐름 전체): 리뷰로 대체 불가
