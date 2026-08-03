/**
 * EditButton: KB 문서 페이지 sticky 헤더의 편집 진입점.
 *
 * 권한 판정은 client-side editor_roles 조회(자기 행만 허용하는 RLS "editor read
 * own role")에 의존한다. 비로그인·무권한·조회 실패는 모두 null 렌더. 발견 경로가
 * 없을 뿐 직접 URL 접근은 /admin/editor 페이지가 별도로 안내한다(Task 6).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const authMocks = vi.hoisted(() => ({
  user: null as null | { id: string },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authMocks.user,
    loading: false,
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

const supabaseMocks = vi.hoisted(() => ({
  eq: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({
    from: () => ({
      select: () => ({
        eq: supabaseMocks.eq,
      }),
    }),
  }),
}))

import { EditButton } from '@/components/kb/EditButton'

beforeEach(() => {
  authMocks.user = null
  supabaseMocks.eq.mockReset()
})

describe('EditButton', () => {
  it('세션 없음 → 렌더 없음', async () => {
    const { container } = render(<EditButton slug="s1" />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
    expect(supabaseMocks.eq).not.toHaveBeenCalled()
  })

  it('editor role 행 존재 → 편집 링크 렌더', async () => {
    authMocks.user = { id: 'u1' }
    supabaseMocks.eq.mockResolvedValue({ data: [{ role: 'editor' }], error: null })

    render(<EditButton slug="s1" />)

    const link = await screen.findByRole('link', { name: '편집' })
    expect(link.getAttribute('href')).toBe('/admin/editor?slug=s1')
  })

  it('조회 error → 렌더 없음', async () => {
    authMocks.user = { id: 'u1' }
    supabaseMocks.eq.mockResolvedValue({ data: null, error: { message: '조회 실패' } })

    const { container } = render(<EditButton slug="s1" />)

    await waitFor(() => {
      expect(supabaseMocks.eq).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeNull()
  })
})
