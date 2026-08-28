/**
 * webfortd 콘텐츠 정본(마크다운 frontmatter) 스키마 — v1
 *
 * 단일 진실 원천. `scripts/validate-frontmatter.ts`(M1)와 `scripts/sync-content.ts`(M2)가
 * 모두 이 파일을 import한다. KB_ARCHITECTURE.md §2 Taxonomy / §3 Document와 1:1 매핑.
 *
 * Phase 1 범위만 포함. 다음 항목은 의도적으로 제외(모두 빌드 파이프라인 또는 DB 책임):
 * - content_md       — 빌드 시 파일 본문에서 직접 로딩(파생)
 * - id (uuid)        — Phase 2 Supabase 마이그레이션 시 자동 생성
 * - wiki_links       — 빌드 시 sync-content.ts가 본문에서 추출
 * - embedded_media   — M3 PDF 이미지 복구 후 후처리
 * - created_at / updated_at — 파일시스템 mtime 또는 Phase 2 DB default
 * - slug             — 파일명 stem에서 도출(파생). frontmatter 등재 금지.
 * - source_path      — 파일 경로 자체가 정본. Phase 1 `DocumentSummary.filePath`가 동등 alias.
 *
 * 위 필드들이 frontmatter에 등장하면 `FrontmatterSchema`의 superRefine에서 reject.
 *
 * 슬러그는 frontmatter 필드가 아니라 파일 경로에서 도출:
 *   content/<axis>/<slug>.md  →  slug = 파일명 stem, axis = 부모 디렉터리명
 *   (M1 한계: 레거시 `content/resources/<subsection>/<slug>.md` 같은 중첩 구조는
 *    axis가 `resources`로 잡히고 subsection 정보는 보존되지 않음. M2에서 라우팅
 *    재구성과 함께 정리.)
 */

import { z } from 'zod'

// ===== 1. enum 정의 (KB_ARCHITECTURE.md §2 5축 다중 분류) =====

export const DisabilityTypeSchema = z.enum([
  '시각',
  '청각',
  '지체',
  '뇌병변',
  '발달',
  '내부장애',
  '기타',
  '전체',
])

export const DomainSchema = z.enum([
  '인사관리',
  '복무관리',
  '편의지원',
  '권리구제',
  '연수교육',
  '정책법령',
  '연구통계',
  '인식개선',
])

export const RegionSchema = z.enum([
  '전국',
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
])

export const DocTypeSchema = z.enum([
  '법령',
  '지침',
  '연구보고서',
  '안내서',
  '사례',
  '통계',
  '카드뉴스',
  '영상',
  'FAQ',
  '뉴스',
  '기타',
])

export const StatusSchema = z.enum([
  'draft',
  'in_review',
  'published',
  'archived',
  'deprecated',
])

// 런타임 enum 배열 노출 (휴리스틱·UI 옵션 등에서 활용)
export const DISABILITY_TYPES = DisabilityTypeSchema.options
export const DOMAINS = DomainSchema.options
export const REGIONS = RegionSchema.options
export const DOC_TYPES = DocTypeSchema.options
export const STATUSES = StatusSchema.options

// 허용된 디렉터리 축(axis). 파일 경로 검증에서 활용.
export const CONTENT_AXES = [
  'disability-types',
  'domains',
  'regions',
  'policies',
  'agreements',
  'faq',
  'stories',
  'resources',
  'uncategorized',
] as const
export type ContentAxis = (typeof CONTENT_AXES)[number]

// ===== 2. 서브 스키마 =====

export const ReferenceSchema = z.object({
  citation: z.string().min(1, { message: '인용 텍스트는 필수입니다' }),
  url: z.string().url({ message: 'URL 형식이 아닙니다' }).optional(),
  type: z.enum(['paper', 'law', 'web', 'book', 'media']),
})

export const AccessibilitySchema = z.object({
  alt_text_complete: z.boolean(),
  captions_available: z.boolean(),
  reading_level: z.enum(['easy', 'standard', 'expert']),
  audio_tts_ready: z.boolean(),
})

export const SourceSchema = z.object({
  organization: z.string().min(1, { message: '발행 기관(source.organization)은 필수입니다' }),
  citation: z.string().min(1, { message: '인용 형식(source.citation)은 필수입니다' }),
  url: z.string().url({ message: 'URL 형식이 아닙니다' }).optional(),
  document_id: z.string().optional(),
})

// ===== 3. 메인 Frontmatter 스키마 (Phase 1 범위) =====

// ISO 8601 날짜(YYYY-MM-DD). 월·일 범위까지 검사.
const isoDate = z
  .string()
  .regex(
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    { message: 'YYYY-MM-DD 형식이어야 합니다 (월 01~12, 일 01~31)' },
  )

// frontmatter 등재 금지 키(빌드/DB가 책임지는 파생 필드).
// superRefine에서 reject 처리.
export const RESERVED_FRONTMATTER_KEYS = [
  'slug',
  'id',
  'source_path',
  'content_md',
  'wiki_links',
  'embedded_media',
  'created_at',
  'updated_at',
] as const

export const FrontmatterSchema = z
  .object({
    // === 필수 ===
    title: z.string().min(1, { message: '제목(title)은 필수입니다' }),
    type: DocTypeSchema,
    disability_types: z
      .array(DisabilityTypeSchema)
      .min(1, { message: '장애유형(disability_types)을 최소 1개 지정하세요' }),
    domains: z
      .array(DomainSchema)
      .min(1, { message: '영역(domains)을 최소 1개 지정하세요' })
      .max(3, { message: '영역(domains)은 최대 3개까지 권장합니다' }),
    regions: z
      .array(RegionSchema)
      .min(1, { message: '지역(regions)을 최소 1개 지정하세요' }),
    year: z
      .number()
      .int({ message: '연도(year)는 정수여야 합니다' })
      .min(2000, { message: '연도(year)가 너무 이릅니다 (2000 이상)' })
      .max(2100, { message: '연도(year)가 너무 큽니다' }),
    status: StatusSchema,
    source: SourceSchema,
    source_origin: z
      .string()
      .min(1, { message: 'source_origin은 필수입니다 (파일 stem 또는 pre-phase-1)' }),

    // === 선택 (배열은 default([])로 §3 Document 계약 정합) ===
    subtitle: z.string().optional(),
    /**
     * 출처 문서 내 상위 헤딩 경로(breadcrumb).
     * M3 분해 결과: 본문에 `> 부모1 > 부모2` blockquote으로 prepend되던 컨텍스트를
     * M4-B에서 frontmatter 필드로 승격. KbPageLayout이 시맨틱 breadcrumb UI로 렌더.
     * 분해 페이지가 아닌 수동 작성 페이지에서는 비어있을 수 있음(default []).
     */
    parent_headings: z.array(z.string()).default([]),
    /**
     * 원본 인쇄 쪽(2026-08 3층 재생성). 2층 v4의 `<!-- p.230 (pdf 254) -->` 주석에서
     * 분해 스크립트가 채운다. `source_page`는 「Ⅰ-3」「pdf2」 같은 접두를 허용하는 문자열,
     * `source_page_end`는 절이 끝나는 쪽, `source_page_pdf`는 PDF 절대 쪽(정수).
     * 수동 작성 페이지·단체협약에는 없다.
     */
    source_page: z.string().optional(),
    source_page_end: z.string().optional(),
    source_page_pdf: z.number().int().positive().optional(),
    authors: z.array(z.string()).default([]),
    reviewed_by: z.array(z.string()).default([]),
    reviewed_at: isoDate.optional(),
    reviewer_notes: z.string().optional(),
    effective_date: isoDate.optional(),
    references: z.array(ReferenceSchema).default([]),
    accessibility: AccessibilitySchema.default({
      alt_text_complete: false,
      captions_available: false,
      reading_level: 'standard',
      audio_tts_ready: false,
    }),

    // === 레거시 호환 (mdx.ts가 여전히 사용) ===
    // Phase 1 동안 기존 페이지 렌더와의 호환을 위해 허용. M2에서 mdx.ts → kb.ts 교체 후
    // 제거 검토. 검증은 하지 않고 통과만 시킴.
    description: z.string().optional(),
    date: z.string().optional(),
    author: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  // passthrough: 미정의 필드 허용(레거시·확장 가능성). reserved 키만 superRefine으로 차단.
  .passthrough()
  .superRefine((data, ctx) => {
    for (const key of RESERVED_FRONTMATTER_KEYS) {
      if (key in data) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `'${key}'는 파생 필드입니다. frontmatter에 등재 금지(빌드/DB가 자동 채움).`,
        })
      }
    }
    // Published gate — M3에서 도입.
    // status='published'인데 reviewed_by가 비어있으면 reject.
    // M3 분해 결과는 전부 status='draft'라 영향 없음 — M4 검수 결과 정합성용.
    if (data.status === 'published' && (!data.reviewed_by || data.reviewed_by.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewed_by'],
        message: "status='published'이면 reviewed_by가 비어있을 수 없습니다",
      })
    }
  })

// ===== 4. 파생 타입 =====

export type Frontmatter = z.infer<typeof FrontmatterSchema>

/**
 * 빌드 파이프라인(M2)이 사용할 계약. sync-content.ts가 이 타입을 확장해
 * `content_md`, `wiki_links` 등을 추가한 `DocumentFull`을 자체 정의한다.
 */
export interface DocumentSummary {
  /** 파일명 stem. 파일 경로에서 도출 (frontmatter 필드 아님) */
  slug: string
  /** 부모 디렉터리명 — content/<axis>/ */
  axis: ContentAxis
  /** 저장소 루트 기준 상대 경로 (예: content/resources/research/hr-guide-2023.md) */
  filePath: string
  frontmatter: Frontmatter
}
