/**
 * Phase 3 M4 — SourceCard Vitest 단위 (Vitest 부분 도입 첫 사례).
 *
 * 검증 범위:
 *   - sources[].href를 그대로 <Link>에 전달 (UI에서 axis/slug 재합성 금지 — codex P1 fix)
 *   - nested resource href(예: /resources/law/<slug>) 정상 렌더
 *   - 빈 배열일 때 렌더 안 됨 (불필요 DOM 노드 회피)
 *   - top-k=5 까지 안정 (개수 검증)
 *
 * 회귀 차단 의도: SourceRef shape 변경(href 누락 또는 axis 합성 회귀) 즉시 잡힘.
 *
 * 접근성·VoiceOver 흐름은 JSDOM이 정확하지 않으므로 위원장 수동 검증으로 보강
 * (plan Task 6 시나리오 1).
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SourceCard } from '@/components/chat/SourceCard'

// SourceRef shape: { slug, title, axis, type, href }
// href는 retrieval.ts가 canonical 합성해 박은 값 (nested resource 404 회피).
const baseRef = { axis: 'policies', type: '안내서' } as const

describe('SourceCard (M4 미니멀 출처 인용)', () => {
  it('href를 그대로 렌더한다 — UI에서 axis/slug 재합성 금지', () => {
    render(
      <SourceCard
        sources={[
          { ...baseRef, slug: '2023-hr-1', title: '1) 장애정도', href: '/policies/2023-hr-1' },
        ]}
      />,
    )
    const link = screen.getByRole('link', { name: /1\) 장애정도/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/policies/2023-hr-1')
  })

  it('nested resource href도 그대로 렌더 (예: /resources/law/<slug>)', () => {
    render(
      <SourceCard
        sources={[
          {
            ...baseRef,
            slug: 'ordinance-comparison',
            title: '편의지원 조례 비교',
            axis: 'resources',
            href: '/resources/law/ordinance-comparison',
          },
        ]}
      />,
    )
    const link = screen.getByRole('link', { name: /편의지원 조례 비교/ })
    expect(link).toHaveAttribute('href', '/resources/law/ordinance-comparison')
  })

  it('빈 배열일 때 렌더하지 않는다', () => {
    const { container } = render(<SourceCard sources={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('top-k=5 까지 모두 link role로 노출된다', () => {
    const sources = [
      { ...baseRef, slug: '2023-hr-1', title: '1) 장애정도', href: '/policies/2023-hr-1' },
      { ...baseRef, slug: '2023-hr-2', title: '2) 신청 절차', href: '/policies/2023-hr-2' },
      { ...baseRef, slug: 'visual', title: '시각장애', axis: 'disability-types', href: '/disability-types/visual' },
      { ...baseRef, slug: '2024-ca-5', title: '5조 편의지원', axis: 'agreements', href: '/agreements/2024-ca-5' },
      { ...baseRef, slug: 'seoul', title: '서울특별시', axis: 'regions', href: '/regions/seoul' },
    ]
    render(<SourceCard sources={sources} />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
})
