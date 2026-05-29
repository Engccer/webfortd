/**
 * Phase B M2 — Preview Mode 순수 판정.
 * server-only / next-headers 의존 없음 → 단위 테스트 가능.
 */

/**
 * 미리보기 활성 = Draft Mode 켜짐 AND 현재 사용자가 admin.
 * spec B5: Draft Mode cookie가 비-admin에게 새더라도 isAdmin 재확인으로 차단.
 */
export function computePreviewActive(
  draftEnabled: boolean,
  isAdmin: boolean,
): boolean {
  return draftEnabled && isAdmin
}

/**
 * "검수 중" 안내(200)를 렌더할지 여부.
 * published는 항상 공개. non-published는 미리보기 활성 시에만 본문 노출.
 */
export function shouldRenderUnderReview(
  status: string,
  previewActive: boolean,
): boolean {
  return status !== 'published' && !previewActive
}
