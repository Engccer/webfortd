'use server'

import { getCurrentUserEditorStatus } from '@/lib/auth/editor'
import { getContentFile, putContentFile } from '@/lib/github/contents'
import { checkRateLimit } from '@/lib/rate-limit'
import { loadDocumentCore, submitBodyCore, MSG } from '@/lib/editor/edit-core'
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
  if (!editor.userId) {
    return { status: 'forbidden', message: MSG.needLogin }
  }
  if (!editor.canEdit) {
    return { status: 'forbidden', message: MSG.forbidden }
  }
  if (!DEPS.rateLimit(`editor-preview:${editor.userId}`)) {
    return { status: 'rate_limited', message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }
  }
  const valid = await validateBody(body)
  if (!valid.ok) return { status: 'rejected', message: valid.message }
  return { status: 'ok', source: await serializeKbContent(body) }
}
