/**
 * WikiHero 옴니박스 Vitest — 홈 첫 화면의 단일 검색 표면.
 *
 * 검증:
 *   - 검색창은 하나(헤더 검색창은 Header가 홈에서 숨김 — Header.test.tsx가 짝)
 *   - [AI에게 질문]이 입력한 텍스트를 /chat?q= 로 넘김(자동 전송은 채팅이 담당)
 *   - 입력이 비면 질문 파라미터 없이 빈 채팅으로 이동
 *   - 별도 "채팅으로 질문" 링크·중복 안내 소제목은 옴니박스에 흡수돼 사라짐
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: () => ({
    state: 'idle',
    duration: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    isSupported: true,
  }),
}))

vi.mock('@/hooks/useRecordingSound', () => ({
  useRecordingSound: () => ({ playStart: vi.fn(), playStop: vi.fn(), playCancel: vi.fn() }),
}))

vi.mock('@/lib/kb-search-data', () => ({
  getSearchDocs: () => [],
}))

import { WikiHero } from '@/components/wiki/WikiHero'

beforeEach(() => {
  push.mockClear()
})

describe('WikiHero 옴니박스', () => {
  it('검색 입력창은 하나만 렌더한다', () => {
    render(<WikiHero />)
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('입력한 텍스트를 질문으로 넘겨 채팅으로 이동한다', () => {
    render(<WikiHero />)

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '장애인교원 병가는 며칠인가요' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'AI에게 질문' }))

    expect(push).toHaveBeenCalledWith(
      `/chat?q=${encodeURIComponent('장애인교원 병가는 며칠인가요')}`,
    )
  })

  it('입력이 비면 질문 파라미터 없이 빈 채팅으로 이동한다', () => {
    render(<WikiHero />)

    fireEvent.click(screen.getByRole('button', { name: 'AI에게 질문' }))

    expect(push).toHaveBeenCalledWith('/chat')
  })

  it('별도 "채팅으로 질문" 링크와 중복 안내 소제목을 두지 않는다', () => {
    render(<WikiHero />)
    expect(screen.queryByRole('link', { name: /채팅으로 질문/ })).toBeNull()
    expect(screen.queryByText(/검색하거나 채팅으로 물어보세요/)).toBeNull()
  })
})
