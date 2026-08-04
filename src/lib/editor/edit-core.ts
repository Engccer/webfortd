import 'server-only'
import type { EditorStatus } from '../auth/editor.ts'
import { editorIdShort } from '../auth/editor.ts'
import type { GithubResult } from '../github/contents.ts'
import {
  resolveContentPath, contentPathToHref, splitDocument, mergeDocument, validateBody,
} from './document-io.ts'

export interface EditDeps {
  getEditor(): Promise<EditorStatus>
  getFile(path: string): Promise<GithubResult<{ text: string; sha: string }>>
  putFile(args: { path: string; text: string; sha: string; message: string }): Promise<GithubResult<{ commitSha: string; contentSha: string }>>
  rateLimit(key: string): boolean
}

// 비로그인(needLogin)과 로그인했지만 무권한(forbidden)은 status는 같은 'forbidden'이지만
// 메시지로 원인을 구분한다(spec §5) — 비로그인 사용자에게 "권한 등록을 확인하라"는 안내는 무의미.
export const MSG = {
  forbidden: '편집 권한이 없습니다. 로그인 상태와 권한 등록을 확인해 주세요.',
  needLogin: '로그인이 필요합니다. 로그인 후 다시 시도해 주세요.',
  notFound: '문서를 찾을 수 없습니다. 문서 위치가 바뀌었을 수 있으니 관리자에게 알려 주세요.',
  system: '시스템 연결에 문제가 있습니다. 잠시 후에도 계속되면 관리자에게 알려 주세요.',
  rateLimited: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  conflict: '다른 수정과 충돌했습니다. 아래에 보존된 내 편집본을 참고해 최신 본문에 다시 반영해 주세요.',
  accepted: '반영 커밋이 접수되었습니다. 몇 분 후 문서 페이지를 새로고침해 확인해 주세요.',
} as const

export type LoadResult =
  | { status: 'ok'; body: string; baseSha: string; title: string; docPath: string }
  | { status: 'forbidden' | 'not_found' | 'system' | 'rate_limited'; message: string }

export type SubmitResult =
  | { status: 'accepted'; message: string; newBaseSha: string }
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
  if (!editor.userId) return { status: 'forbidden', message: MSG.needLogin }
  if (!editor.canEdit) return { status: 'forbidden', message: MSG.forbidden }
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
    docPath: contentPathToHref(path),
  }
}

export async function submitBodyCore(
  deps: EditDeps,
  args: { slug: string; baseSha: string; body: string },
): Promise<SubmitResult> {
  const editor = await deps.getEditor()
  if (!editor.userId) return { status: 'forbidden', message: MSG.needLogin }
  if (!editor.canEdit) return { status: 'forbidden', message: MSG.forbidden }
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
      // PUT 시점 레이스: 사전 SHA 비교 통과 후에도 그 사이 원격이 바뀌었을 수 있다.
      // latestBody/latestSha는 서버의 진짜 최신 상태여야 하므로 재조회한다(자기 제출값 재사용 금지).
      const refetched = await deps.getFile(path)
      if (!refetched.ok) return { status: 'system', message: MSG.system }
      const latest = splitDocument(refetched.value.text)
      return {
        status: 'conflict',
        message: MSG.conflict,
        latestBody: latest?.body ?? refetched.value.text,
        latestSha: refetched.value.sha,
      }
    }
    return { status: 'system', message: MSG.system }
  }
  return { status: 'accepted', message: MSG.accepted, newBaseSha: put.value.contentSha }
}
