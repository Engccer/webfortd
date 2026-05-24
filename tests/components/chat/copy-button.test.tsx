/**
 * Phase 3 M6.1 — CopyButton Vitest.
 *
 * 검증:
 *   - Copy 아이콘 버튼 렌더 + aria-label
 *   - 클릭 → modal 열림 (role="dialog" + 평문/마크다운 두 버튼)
 *   - 평문 클릭 → markdownToPlainText 결과 clipboard
 *   - 마크다운 클릭 → 원본 clipboard
 *   - aria-live announcer "복사되었어요"
 *   - ESC 키로 modal 닫힘
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CopyButton } from '@/components/chat/CopyButton'

describe('CopyButton (M6.1 답변 복사 듀얼)', () => {
  beforeEach(() => {
    // navigator.clipboard mock
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('렌더링 시 Copy 아이콘 버튼 노출', () => {
    render(<CopyButton content="# 제목\n본문" />)
    const button = screen.getByRole('button', { name: /응답 복사/ })
    expect(button).toBeInTheDocument()
  })

  it('버튼 클릭 시 modal 열림 — 평문/마크다운 두 버튼', () => {
    render(<CopyButton content="# 제목" />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /평문으로 복사/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /마크다운으로 복사/ })).toBeInTheDocument()
  })

  it('평문 클릭 시 markdownToPlainText 결과를 clipboard로', async () => {
    render(<CopyButton content={'# 제목\n**굵게**'} />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.click(screen.getByRole('button', { name: /평문으로 복사/ }))
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('제목\n굵게')
    })
  })

  it('마크다운 클릭 시 원본 그대로 clipboard로', async () => {
    const original = '# 제목\n**굵게**'
    render(<CopyButton content={original} />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.click(screen.getByRole('button', { name: /마크다운으로 복사/ }))
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(original)
    })
  })

  it('복사 후 aria-live announcer에 한국어 안내', async () => {
    render(<CopyButton content="텍스트" />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.click(screen.getByRole('button', { name: /마크다운으로 복사/ }))
    await vi.waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/복사되었어요/)
    })
  })

  it('ESC 키로 modal 닫힘', () => {
    render(<CopyButton content="텍스트" />)
    fireEvent.click(screen.getByRole('button', { name: /응답 복사/ }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
