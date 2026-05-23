/**
 * Phase 3 M4 — SourceCard Vitest 단위 (Vitest 부분 도입 첫 사례).
 *
 * 검증 범위:
 *   - sources props → DOM 렌더가 axis/slug 경로로 next/link href 합성
 *   - 빈 배열일 때 렌더 안 됨 (불필요 DOM 노드 회피)
 *   - top-k=5 까지 안정 (개수 검증)
 *
 * 회귀 차단 의도: SourceRef shape 변경(axis/slug/title) 또는 Link href 형식
 * 변경 시 즉시 잡힘.
 *
 * 접근성·VoiceOver 흐름은 JSDOM이 정확하지 않으므로 위원장 수동 검증으로 보강
 * (plan Task 6 시나리오 1).
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SourceCard } from '@/components/chat/SourceCard'

describe('SourceCard (M4 미니멀 출처 인용)', () => {
  it('단일 출처를 axis/slug 경로로 렌더한다', () => {
    render(
      <SourceCard
        sources={[
          { slug: '2023-hr-1', title: '1) 장애정도', axis: 'policies' },
        ]}
      />,
    )
    const link = screen.getByRole('link', { name: /1\) 장애정도/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/policies/2023-hr-1')
  })

  it('빈 배열일 때 렌더하지 않는다', () => {
    const { container } = render(<SourceCard sources={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('top-k=5 까지 모두 link role로 노출된다', () => {
    const sources = [
      { slug: '2023-hr-1', title: '1) 장애정도', axis: 'policies' },
      { slug: '2023-hr-2', title: '2) 신청 절차', axis: 'policies' },
      { slug: 'visual', title: '시각장애', axis: 'disability-types' },
      { slug: '2024-ca-5', title: '5조 편의지원', axis: 'agreements' },
      { slug: 'seoul', title: '서울특별시', axis: 'regions' },
    ]
    render(<SourceCard sources={sources} />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
})
