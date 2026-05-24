/**
 * Phase 3 M6.2 — ErrorBanner Vitest.
 *
 * 검증:
 *   - role="alert" 렌더
 *   - 한국어 분기 4종 (retrieval 0건 · Gateway 5xx · validateUIMessages · fallback)
 *   - "다시 시도" 버튼 → onRetry 호출
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ErrorBanner } from '@/components/chat/ErrorBanner'

describe('ErrorBanner (M6.2 에러 재시도)', () => {
  it('role="alert"로 렌더', () => {
    render(<ErrorBanner error={new Error('whatever')} onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('retrieval 0건 분기 메시지', () => {
    render(
      <ErrorBanner
        error={new Error('관련 정책 문서를 찾지 못했어요')}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요/,
    )
  })

  it('Gateway 5xx (HTTP 502/503/504) 분기 메시지', () => {
    render(
      <ErrorBanner
        error={new Error('Gateway 503 Service Unavailable')}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요/,
    )
  })

  it('validateUIMessages 분기 메시지', () => {
    render(
      <ErrorBanner
        error={new Error('validateUIMessages: invalid shape')}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/메시지 형식 오류/)
  })

  it('알 수 없는 에러 fallback 메시지', () => {
    render(<ErrorBanner error={new Error('TypeError: x is undefined')} onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /응답 생성 중 오류가 발생했어요. 다시 시도해 보세요/,
    )
  })

  it('"다시 시도" 버튼 클릭 시 onRetry 호출', () => {
    const onRetry = vi.fn()
    render(<ErrorBanner error={new Error('any')} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /마지막 질문 다시 보내기/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
