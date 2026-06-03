/**
 * AuthModal 2단계 로그인 플로우 테스트.
 *
 * 매직링크 클릭 방식은 "링크를 연 브라우저"와 "재방문 브라우저"가 달라지면
 * 세션 쿠키가 다른 jar에 박혀 매번 재로그인하게 된다(특히 모바일 메일앱 인앱
 * 브라우저). 6자리(실측 8자리) 인증코드를 *같은 화면*에 입력하면 verifyOtp가
 * 그 브라우저에 세션을 생성하므로 컨텍스트 분리가 원천 차단된다.
 *
 * 플로우: 이메일 입력 → requestOtp → 코드 입력 단계 → verifyOtp → 모달 닫힘.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    requestOtp: mocks.requestOtp,
    verifyOtp: mocks.verifyOtp,
    signOut: vi.fn(),
  }),
}))

import { AuthModal } from '@/components/auth/AuthModal'

beforeEach(() => {
  mocks.requestOtp.mockReset()
  mocks.verifyOtp.mockReset()
})

describe('AuthModal — 인증코드 2단계 플로우', () => {
  it('초기에는 이메일 입력 단계 (인증 코드 받기 버튼)', () => {
    render(<AuthModal open onOpenChange={vi.fn()} />)
    expect(screen.getByLabelText('이메일 주소 입력')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /인증 코드 받기/ })).toBeInTheDocument()
    // 아직 코드 입력칸은 없음
    expect(screen.queryByLabelText('인증 코드 입력')).not.toBeInTheDocument()
  })

  it('이메일 제출 성공 → requestOtp 호출 + 코드 입력 단계로 전환', async () => {
    const user = userEvent.setup()
    mocks.requestOtp.mockResolvedValue({ error: null })
    render(<AuthModal open onOpenChange={vi.fn()} />)

    await user.type(screen.getByLabelText('이메일 주소 입력'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: /인증 코드 받기/ }))

    expect(mocks.requestOtp).toHaveBeenCalledWith('me@example.com')
    // 코드 입력 단계로 전환
    expect(await screen.findByLabelText('인증 코드 입력')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('requestOtp 실패 → 오류 표시 + 이메일 단계 유지', async () => {
    const user = userEvent.setup()
    mocks.requestOtp.mockResolvedValue({ error: new Error('rate limit') })
    render(<AuthModal open onOpenChange={vi.fn()} />)

    await user.type(screen.getByLabelText('이메일 주소 입력'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: /인증 코드 받기/ }))

    expect(await screen.findByText(/오류/)).toBeInTheDocument()
    // 코드 단계로 전환되지 않음
    expect(screen.queryByLabelText('인증 코드 입력')).not.toBeInTheDocument()
  })

  it('코드 제출 성공 → verifyOtp 호출 + 모달 닫힘', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    mocks.requestOtp.mockResolvedValue({ error: null })
    mocks.verifyOtp.mockResolvedValue({ error: null })
    render(<AuthModal open onOpenChange={onOpenChange} />)

    await user.type(screen.getByLabelText('이메일 주소 입력'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: /인증 코드 받기/ }))

    const codeInput = await screen.findByLabelText('인증 코드 입력')
    await user.type(codeInput, '12345678')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(mocks.verifyOtp).toHaveBeenCalledWith('me@example.com', '12345678')
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('코드 검증 실패 → 친절한 한국어 오류 + 코드 단계 유지 (모달 안 닫힘)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    mocks.requestOtp.mockResolvedValue({ error: null })
    mocks.verifyOtp.mockResolvedValue({ error: new Error('Token has expired or is invalid') })
    render(<AuthModal open onOpenChange={onOpenChange} />)

    await user.type(screen.getByLabelText('이메일 주소 입력'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: /인증 코드 받기/ }))
    await user.type(await screen.findByLabelText('인증 코드 입력'), '00000000')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText(/코드가 올바르지 않거나 만료/)).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    // 코드 단계 유지
    expect(screen.getByLabelText('인증 코드 입력')).toBeInTheDocument()
  })

  it('"이메일 다시 입력" → 이메일 단계로 복귀', async () => {
    const user = userEvent.setup()
    mocks.requestOtp.mockResolvedValue({ error: null })
    render(<AuthModal open onOpenChange={vi.fn()} />)

    await user.type(screen.getByLabelText('이메일 주소 입력'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: /인증 코드 받기/ }))
    await screen.findByLabelText('인증 코드 입력')

    await user.click(screen.getByRole('button', { name: '이메일 다시 입력' }))
    expect(screen.getByLabelText('이메일 주소 입력')).toBeInTheDocument()
    expect(screen.queryByLabelText('인증 코드 입력')).not.toBeInTheDocument()
  })
})
