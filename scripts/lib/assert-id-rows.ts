/**
 * Supabase slug→id 페치 결과가 완전한지 검증하는 헬퍼.
 * sync-content-to-db.ts와 embed-content.ts 양쪽에서 재사용.
 */
export function assertIdRowsComplete(
  idRows: { id: string; slug: string }[] | null,
  expectedCount: number,
): void {
  const actual = idRows?.length ?? 0
  if (actual < expectedCount) {
    throw new Error(
      `slug→id fetch 누락: ${expectedCount} upserted but ${actual} returned. ` +
        `Supabase default limit 1000 의심 — .range(0, expectedCount-1) 또는 페이징 필요.`,
    )
  }
}
