/**
 * Phase 7 M4 — VoiceChatOverlay Vitest.
 *
 * useGeminiLive를 모킹하므로 AudioContext/genai 호출 없음.
 * 검증:
 *   - dialog role + aria-label 값 (열림 상태)
 *   - aria-live 상태 영역 존재
 *   - 종료 버튼 접근성
 *   - 닫힘 상태에서 렌더 없음
 *   - 출처 링크는 새 탭으로 열림 (C-2 회귀 가드)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { VoiceChatOverlay } from '@/components/chat/VoiceChatOverlay'
import type { SourceRef } from '@/lib/voice/types'

// onSourceRefs는 hook 반환 필드가 아니라 옵션 콜백으로 들어온다.
// 실 흐름(connect → 사용자 발화 → 검색 후 출처 도착)을 모사하려면 콜백이
// 컴포넌트의 open-effect(마운트 시 setSources([]))보다 *나중에* 발화해야 한다.
// → 마운트 effect가 끝난 뒤 마이크로태스크에서 onSourceRefs를 호출해
//   setState-in-render 없이 sources state를 채운다 (findByRole로 비동기 단언).
vi.mock('@/hooks/useGeminiLive', () => ({
  useGeminiLive: (opts?: { onSourceRefs?: (s: SourceRef[]) => void }) => {
    useEffect(() => {
      queueMicrotask(() => {
        opts?.onSourceRefs?.([
          { slug: 's1', title: '출처1', axis: 'policies', type: 'guide', href: '/policies/s1' },
        ])
      })
      // 모킹은 옵션 콜백을 1회만 호출하면 충분
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return {
      state: 'listening',
      warmupAudio: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      toggleMute: vi.fn(),
      isMuted: false,
      transcripts: [],
      functionStatus: null,
      errorMessage: null,
    }
  },
}))

describe('VoiceChatOverlay', () => {
  it('열림 상태에서 dialog role + aria-label', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', '음성으로 정책 안내 받기')
  })

  it('aria-live 상태 영역 존재', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  it('종료 버튼 접근 가능', () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /종료|닫기/ })).toBeTruthy()
  })

  it('닫힘 상태에서는 아무것도 렌더하지 않음', () => {
    const { container } = render(<VoiceChatOverlay open={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('출처 링크는 새 탭으로 열림 (라이브 세션 유지, C-2)', async () => {
    render(<VoiceChatOverlay open onClose={() => {}} />)
    const link = await screen.findByRole('link', { name: /출처1/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})
