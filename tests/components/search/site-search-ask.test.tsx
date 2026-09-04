/**
 * SiteSearch 옴니박스 듀얼 액션 Vitest — 입력창 하나 + [AI에게 질문].
 *
 * webfortd 검색은 타이핑 즉시 결과가 펼쳐지는 라이브 검색이라 [검색] 제출 버튼이
 * 없다(gildongmu 옴니박스와의 유일한 구조 차이). 따라서 듀얼 액션의 두 번째 축만
 * 붙인다: onAsk를 주면 [AI에게 질문] 버튼 + Cmd/Ctrl+Enter가 활성된다.
 *
 * 검증:
 *   - onAsk 없으면 버튼 없음(헤더 검색창 회귀 방지)
 *   - onAsk 있으면 버튼 렌더 + 클릭 시 현재 입력값 전달
 *   - Cmd+Enter / Ctrl+Enter = AI 질문, 맨 Enter는 질문으로 새지 않음
 *   - 입력이 비어도 질문 액션은 동작(빈 채팅 열기 = 호출부 책임)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

import { SiteSearch } from '@/components/search/SiteSearch'

describe('SiteSearch 옴니박스 듀얼 액션', () => {
  it('onAsk 없으면 [AI에게 질문] 버튼이 없다', () => {
    render(<SiteSearch />)
    expect(screen.queryByRole('button', { name: 'AI에게 질문' })).toBeNull()
  })

  it('onAsk 있으면 버튼을 렌더하고 클릭 시 현재 입력값을 전달한다', () => {
    const onAsk = vi.fn()
    render(<SiteSearch variant="hero" onAsk={onAsk} />)

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: '병가 일수' } })
    fireEvent.click(screen.getByRole('button', { name: 'AI에게 질문' }))

    expect(onAsk).toHaveBeenCalledTimes(1)
    expect(onAsk).toHaveBeenCalledWith('병가 일수')
  })

  it('입력이 비어 있어도 질문 액션은 동작한다 (빈 채팅 열기)', () => {
    const onAsk = vi.fn()
    render(<SiteSearch variant="hero" onAsk={onAsk} />)

    fireEvent.click(screen.getByRole('button', { name: 'AI에게 질문' }))

    expect(onAsk).toHaveBeenCalledWith('')
  })

  it('Cmd+Enter와 Ctrl+Enter는 AI 질문, 맨 Enter는 질문을 유발하지 않는다', () => {
    const onAsk = vi.fn()
    render(<SiteSearch variant="hero" onAsk={onAsk} />)

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: '전보 가산점' } })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAsk).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter', metaKey: true })
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    expect(onAsk).toHaveBeenCalledTimes(2)
    expect(onAsk).toHaveBeenLastCalledWith('전보 가산점')
  })
})
