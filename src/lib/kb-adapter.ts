/**
 * 신/구 frontmatter 어댑터 — M2
 *
 * 신 스키마(src/types/kb.ts FrontmatterSchema)의 필드를 기존 라우팅 코드가 사용하는
 * 레거시 표면 필드(description, date, author, tags)로 매핑한다.
 * 라우팅 코드 변경을 최소화하면서 신 스키마 도입 + 기존 콘텐츠 호환을 동시 달성.
 *
 * 동작 원칙:
 *  - 레거시 필드(passthrough로 통과)가 있으면 우선 사용.
 *  - 신 필드(subtitle, reviewed_at, authors[] 등)는 fallback.
 */

import type { Frontmatter } from '@/types/kb'

export interface LegacyDocFields {
  title: string
  description?: string
  /** ISO 날짜(YYYY-MM-DD). reviewed_at/effective_date 같은 실제 날짜가 있을 때만 채움. */
  date?: string
  /** 발행 연도. date가 없고 year만 frontmatter에 있을 때 노출. */
  year?: number
  author?: string
  tags?: string[]
}

export function adaptFrontmatterToLegacy(fm: Frontmatter): LegacyDocFields {
  // year를 `${year}-01-01`로 강제하면 부정확한 날짜가 UI에 그대로 노출된다.
  // 시각장애 사용자 스크린 리더가 잘못된 일자를 읽지 않도록, 실제 날짜 필드만 date에
  // 매핑하고 year는 별도 표시용 필드로 분리한다.
  const date = fm.date ?? fm.reviewed_at ?? fm.effective_date
  return {
    title: fm.title,
    description: fm.description ?? fm.subtitle,
    date,
    year: typeof fm.year === 'number' ? fm.year : undefined,
    author: fm.author ?? fm.authors?.[0],
    tags: fm.tags,
  }
}
