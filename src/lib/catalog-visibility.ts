/**
 * Phase B M3 — 카탈로그(/library·/media) 아이템 가시성 순수 판정.
 * server-only/next-headers 의존 없음 → 단위 테스트 가능.
 *
 * 정책(위원장 결정 2026-05-30): status 미표기는 published 간주(기존 seed 공개 유지).
 * 명시적 'draft'만 비-admin에게 숨김. admin Draft Mode(includeUnpublished=true)면 draft도 노출.
 */
export type CatalogStatus = 'draft' | 'published'

export function isCatalogItemVisible(
  status: CatalogStatus | undefined,
  includeUnpublished: boolean,
): boolean {
  if (status !== 'draft') return true // undefined | 'published' → 항상 노출
  return includeUnpublished
}
