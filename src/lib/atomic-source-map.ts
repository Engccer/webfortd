/**
 * atomic 페이지의 source_origin frontmatter → 원본 PDF 다운로드 URL 매핑.
 *
 * KbPageLayout의 footer에서 사용. source_origin이 없거나 미매핑이면 footer 다운로드
 * 링크 미노출 (graceful degradation).
 *
 * library-catalog.ts와 정합 — library 자료의 slug가 source_origin과 일치하도록 명명.
 */

import { LIBRARY_ITEMS } from "./library-catalog"

export interface SourceMapEntry {
  origin: string
  libraryItemSlug: string
}

export const SOURCE_MAP: SourceMapEntry[] = [
  { origin: "2023-hr-guide", libraryItemSlug: "2023-hr-guide" },
  { origin: "2024-jbu-work-support-guide", libraryItemSlug: "2024-jbu-work-support-guide" },
  { origin: "2024-support-staff-duty-guide", libraryItemSlug: "2024-support-staff-duty-guide" },
]

export function getSourceDownload(sourceOrigin: string | undefined): { url: string; title: string; fileSize: string } | undefined {
  if (!sourceOrigin) return undefined
  const entry = SOURCE_MAP.find((e) => e.origin === sourceOrigin)
  if (!entry) return undefined
  const item = LIBRARY_ITEMS.find((i) => i.slug === entry.libraryItemSlug)
  if (!item) return undefined
  return { url: item.downloadUrl, title: item.title, fileSize: item.fileSize }
}
