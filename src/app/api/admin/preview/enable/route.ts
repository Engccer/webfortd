/**
 * Phase B M2 — 관리자 Draft Mode 켜기.
 * POST 전용. admin 확인 후 __prerender_bypass cookie 설정.
 */
import { draftMode } from 'next/headers'
import { getCurrentUserAdminStatus } from '@/lib/auth/admin'
import { runPreviewToggle } from '@/lib/admin/preview-handler'

export async function POST() {
  const adminStatus = await getCurrentUserAdminStatus()
  const draft = await draftMode()
  return runPreviewToggle(true, { adminStatus, draft })
}
