/**
 * Phase B M2 — server-only Preview Mode 리더.
 * 게이트(KbPageLayout/resources 라우트)와 AdminBar가 사용.
 */
import 'server-only'
import { draftMode } from 'next/headers'
import { getCurrentUserAdminStatus } from '@/lib/auth/admin'
import { computePreviewActive } from './preview-policy'

/**
 * Draft Mode cookie 활성 여부만 반환. AdminBar 토글 상태 표시용.
 */
export async function getDraftModeEnabled(): Promise<boolean> {
  const { isEnabled } = await draftMode()
  return isEnabled
}

/**
 * 미리보기 활성 여부. Draft Mode가 꺼져 있으면 admin 조회 없이 false(빠른 경로).
 * 켜져 있으면 현재 사용자 admin 재확인(B5: cookie 누수 방어).
 *
 * 게이트는 status !== 'published'일 때만 이 함수를 호출 → published 페이지는
 * draftMode()를 읽지 않아 정적 렌더가 보존된다.
 */
export async function getPreviewActive(): Promise<boolean> {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return false
  const { isAdmin } = await getCurrentUserAdminStatus()
  return computePreviewActive(isEnabled, isAdmin)
}
