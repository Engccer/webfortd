import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditorClient } from '@/app/(wiki)/admin/editor/EditorClient'

vi.mock('@/app/(wiki)/admin/editor/actions', () => ({
  previewBody: vi.fn(async () => ({ status: 'ok', source: { compiledSource: '', scope: {}, frontmatter: {} } })),
  submitBody: vi.fn(async () => ({ status: 'accepted', message: '반영 커밋이 접수되었습니다. 몇 분 후 문서 페이지를 새로고침해 확인해 주세요.' })),
}))
import { submitBody } from '@/app/(wiki)/admin/editor/actions'

const props = { slug: 's1', title: '표본', body: '원래 본문', baseSha: 'sha-1' }

describe('EditorClient', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('본문 textarea에 가시 라벨이 연결된다', () => {
    render(<EditorClient {...props} />)
    expect(screen.getByLabelText('본문 (마크다운)')).toHaveValue('원래 본문')
  })

  it('반영 성공 시 live region에 접수 메시지', async () => {
    render(<EditorClient {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '수정 반영' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('반영 커밋이 접수되었습니다'))
  })

  it('충돌 시 내 편집본이 별도 영역에 보존되고 textarea는 최신본', async () => {
    vi.mocked(submitBody).mockResolvedValueOnce({
      status: 'conflict', message: '다른 수정과 충돌했습니다.',
      latestBody: '남의 최신 본문', latestSha: 'sha-2',
    })
    render(<EditorClient {...props} />)
    const ta = screen.getByLabelText('본문 (마크다운)')
    fireEvent.change(ta, { target: { value: '내 편집' } })
    fireEvent.click(screen.getByRole('button', { name: '수정 반영' }))
    await waitFor(() => {
      expect(screen.getByLabelText('본문 (마크다운)')).toHaveValue('남의 최신 본문')
      expect(screen.getByText('내 편집본 (충돌로 보존됨)')).toBeInTheDocument()
    })
  })

  it('프리뷰 토글 버튼 라벨이 전환된다', async () => {
    render(<EditorClient {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '프리뷰 보기' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '편집으로 돌아가기' })).toBeInTheDocument())
  })

  it('반영 버튼은 disabled가 아니라 aria-disabled를 쓴다', () => {
    render(<EditorClient {...props} />)
    const btn = screen.getByRole('button', { name: '수정 반영' })
    expect(btn).not.toBeDisabled()
  })
})
