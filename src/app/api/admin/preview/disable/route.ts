/**
 * Phase B M2 — 관리자 Draft Mode 끄기.
 * POST 전용. same-origin 확인(CSRF) + admin 확인 후 __prerender_bypass cookie 제거.
 */
import { draftMode } from 'next/headers'
import { getCurrentUserAdminStatus } from '@/lib/auth/admin'
import { runPreviewToggle, isSameOriginRequest } from '@/lib/admin/preview-handler'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers.get('sec-fetch-site'))) {
    return Response.json({ error: '잘못된 요청이에요.' }, { status: 403 })
  }
  const adminStatus = await getCurrentUserAdminStatus()
  const draft = await draftMode()
  return runPreviewToggle(false, { adminStatus, draft })
}
