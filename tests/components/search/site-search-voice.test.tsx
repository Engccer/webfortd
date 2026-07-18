/**
 * SiteSearch hero 음성 검색 Vitest — 웹판 "정지=쿼리 입력+즉시 검색" 계약.
 *
 * JSDOM은 MediaRecorder/getUserMedia 미지원이라 useVoiceRecorder를 mock해
 * 지원 환경을 시뮬레이트하고, 훅 옵션(onTranscribed/onError)을 캡처해 직접 발화한다.
 *
 * 검증:
 *   - hero 변형에만 마이크 버튼("음성으로 검색"), header 변형엔 없음
 *   - 전사 완료 → 쿼리 대체 + 결과 팝오버 즉시 표시 (라이브 검색 = 제출 효과)
 *   - 음성 오류 → role=alert 표시 + 닫기로 해제
 *   - VoiceRecordButton 기본 라벨(채팅 카피)은 회귀 없이 유지
 */

import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VoiceRecorderErrorCode } from '@/hooks/useVoiceRecorder'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// 훅 옵션 캡처 — 테스트가 전사 성공·오류를 직접 트리거한다
interface CapturedOpts {
  onTranscribed?: (text: string) => void
  onError?: (code: VoiceRecorderErrorCode) => void
}
let recorderOpts: CapturedOpts = {}

vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: (opts: CapturedOpts) => {
    recorderOpts = opts
    return {
      state: 'idle',
      duration: 0,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      isSupported: true,
    }
  },
}))

vi.mock('@/hooks/useRecordingSound', () => ({
  useRecordingSound: () => ({ playStart: vi.fn(), playStop: vi.fn(), playCancel: vi.fn() }),
}))

// 1.2MB 실 인덱스 대신 소형 문서 1건 — 전사 텍스트와 매칭되도록 구성
vi.mock('@/lib/kb-search-data', () => ({
  getSearchDocs: () => [
    {
      slug: 'edu-support',
      title: '교육활동 지원 인력',
      subtitle: '지원 제도 안내',
      axis: 'policies',
      body_excerpt: '교육활동 지원 인력 제도',
      domains: ['정책'],
      disability_types: [],
      href: '/policies/edu-support',
    },
  ],
}))

import { SiteSearch } from '@/components/search/SiteSearch'
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton'

beforeEach(() => {
  recorderOpts = {}
})

describe('SiteSearch hero 음성 검색', () => {
  it('hero 변형에 마이크 버튼 — 라벨 "음성으로 검색"', () => {
    render(<SiteSearch variant="hero" />)
    expect(screen.getByRole('button', { name: '음성으로 검색' })).toBeInTheDocument()
  })

  it('header 변형(기본)엔 마이크 버튼 없음', () => {
    render(<SiteSearch />)
    expect(screen.queryByRole('button', { name: '음성으로 검색' })).not.toBeInTheDocument()
  })

  it('전사 완료 → 쿼리 대체 + 결과 즉시 표시 (검색 제출 효과)', async () => {
    render(<SiteSearch variant="hero" />)
    await act(async () => {
      recorderOpts.onTranscribed?.('교육활동')
    })
    const input = screen.getByRole('combobox')
    expect(input).toHaveValue('교육활동')
    expect(
      await screen.findByRole('option', { name: /교육활동 지원 인력/ }),
    ).toBeInTheDocument()
    // 포커스는 입력창으로 — combobox 화살표 탐색·aria-activedescendant의 전제 (리뷰 P1)
    expect(input).toHaveFocus()
  })

  it('음성 오류 → role=alert 표시, 닫기로 해제', async () => {
    render(<SiteSearch variant="hero" />)
    act(() => {
      recorderOpts.onError?.('mic_denied')
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('마이크 권한이 거부되었어요')
    fireEvent.click(screen.getByRole('button', { name: '음성 오류 닫기' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('VoiceRecordButton 기본 라벨은 채팅 카피 유지 (회귀 가드)', () => {
    render(<VoiceRecordButton onTranscribed={vi.fn()} />)
    expect(screen.getByRole('button', { name: '음성으로 질문 시작' })).toBeInTheDocument()
  })
})
