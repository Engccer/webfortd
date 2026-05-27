/**
 * 자료실(/library) 자산 카탈로그.
 *
 * downloadUrl = Supabase Storage public URL. PDF는 `library` 버킷에 보관 (PR A M3).
 * 빌드 시 NEXT_PUBLIC_SUPABASE_URL 환경변수 필수 — 미설정 시 prefix가 깨져 LibraryCard 다운로드 링크 무효.
 *
 * D6 협업 영역 placeholder — 위원장-허유진 교수 협업 결과 추가 자산은 별도 PR.
 */

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/library`

export type LibraryCategory = "guide" | "policy" | "manual" | "agreement"

export interface LibraryItem {
  slug: string
  title: string
  year: number
  organization: string
  category: LibraryCategory
  summary: string
  fileSize: string
  mimeType: "application/pdf" | "application/x-hwpx"
  downloadUrl: string
  relatedAtomicAxis?: string
  relatedAtomicPrefix?: string
}

export const LIBRARY_ITEMS: LibraryItem[] = [
  {
    slug: "2023-disability-work-support-research",
    title: "장애유형별 장애인교원 근무 지원 방안 최종보고서",
    year: 2023,
    organization: "교육부",
    category: "policy",
    summary:
      "장애유형별 근무 지원 방안을 종합 분석한 정책 보고서. 9개 시도 사례 + 외국 사례 + 정책 제언.",
    fileSize: "12.3 MB",
    mimeType: "application/pdf",
    downloadUrl: `${STORAGE_BASE}/2023-disability-work-support-research.pdf`,
  },
  {
    slug: "2023-hr-guide",
    title: "장애인교원 인사관리 안내서",
    year: 2023,
    organization: "교육부",
    category: "guide",
    summary:
      "장애인교원 채용·배치·근무·복무 전 과정 인사 안내. 188개 atomic 페이지로 분해됨.",
    fileSize: "15.3 MB",
    mimeType: "application/pdf",
    downloadUrl: `${STORAGE_BASE}/2023-hr-guide.pdf`,
    relatedAtomicAxis: "disability-types",
    relatedAtomicPrefix: "2023-hr",
  },
  {
    slug: "2024-jbu-work-support-guide",
    title: "중부대학교 장애인교원 근무지원 안내자료",
    year: 2024,
    organization: "중부대학교",
    category: "guide",
    summary:
      "중부대학교 사업으로 제작된 장애인교원 근무지원 안내자료. 시범 사이트 콘텐츠 원본.",
    fileSize: "8.1 MB",
    mimeType: "application/pdf",
    downloadUrl: `${STORAGE_BASE}/2024-jbu-work-support-guide.pdf`,
    relatedAtomicAxis: "disability-types",
    relatedAtomicPrefix: "2024-jbu",
  },
  {
    slug: "2024-support-staff-duty-guide",
    title: "장애인교원 지원인력 직무 수행 안내자료",
    year: 2024,
    organization: "교육부",
    category: "manual",
    summary:
      "지원인력(근로지원인 등) 직무 수행 안내 156쪽 자료. atomic 페이지 분해됨.",
    fileSize: "5.4 MB",
    mimeType: "application/pdf",
    downloadUrl: `${STORAGE_BASE}/2024-support-staff-duty-guide.pdf`,
    relatedAtomicAxis: "disability-types",
    relatedAtomicPrefix: "2024-staff",
  },
]

export function getLibraryItemBySlug(slug: string): LibraryItem | undefined {
  return LIBRARY_ITEMS.find((item) => item.slug === slug)
}

export function filterLibraryItems(opts: {
  category?: LibraryCategory
  query?: string
}): LibraryItem[] {
  const { category, query } = opts
  const q = query?.trim().toLowerCase() ?? ""
  return LIBRARY_ITEMS.filter((item) => {
    if (category && item.category !== category) return false
    if (q) {
      const hay = `${item.title} ${item.organization} ${item.summary}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
