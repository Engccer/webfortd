import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { EditorClient } from '@/app/(wiki)/admin/editor/EditorClient'

vi.mock('@/app/(wiki)/admin/editor/actions', () => ({
  previewBody: vi.fn(async () => ({ status: 'ok', source: { compiledSource: '', scope: {}, frontmatter: {} } })),
  submitBody: vi.fn(async () => ({ status: 'accepted', message: '반영 커밋이 접수되었습니다. 몇 분 후 문서 페이지를 새로고침해 확인해 주세요.' })),
}))
import { submitBody } from '@/app/(wiki)/admin/editor/actions'

const props = { slug: 's1', title: '표본', body: '원래 본문', baseSha: 'sha-1', docPath: '/agreements/s1' }

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

  it('저장 시점이 지나도 초안 복원이 마운트 시점 원본을 되살린다 (C1 회귀 방지)', () => {
    localStorage.setItem('editor-draft:s1:sha-1', '이전 초안')
    vi.useFakeTimers()
    try {
      render(<EditorClient {...props} />)
      // 사용자가 배너를 읽는 데 걸리는 지연을 흉내: 저장 debounce(500ms)를 넘겨도
      // dirty 전이라 저장 effect가 초안을 initialBody로 덮어쓰지 않아야 한다.
      act(() => {
        vi.advanceTimersByTime(600)
      })
      fireEvent.click(screen.getByRole('button', { name: '초안 복원' }))
      expect(screen.getByLabelText('본문 (마크다운)')).toHaveValue('이전 초안')
    } finally {
      vi.useRealTimers()
    }
  })

  it('반영 accepted 시 초안 키가 삭제된다', async () => {
    localStorage.setItem('editor-draft:s1:sha-1', '임시 초안')
    render(<EditorClient {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '수정 반영' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('반영 커밋이 접수되었습니다'))
    expect(localStorage.getItem('editor-draft:s1:sha-1')).toBeNull()
  })

  it('더블클릭해도 반영 요청은 한 번만 전송된다', async () => {
    render(<EditorClient {...props} />)
    const btn = screen.getByRole('button', { name: '수정 반영' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    await waitFor(() => expect(submitBody).toHaveBeenCalledTimes(1))
  })

  it('반영 진행 중에는 aria-disabled가 true, 완료 후 해제된다', async () => {
    let resolveSubmit: (value: { status: 'accepted'; message: string }) => void = () => {}
    vi.mocked(submitBody).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve
      }),
    )
    render(<EditorClient {...props} />)
    const btn = screen.getByRole('button', { name: '수정 반영' })
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toHaveAttribute('aria-disabled', 'true'))
    resolveSubmit({ status: 'accepted', message: '반영 커밋이 접수되었습니다.' })
    await waitFor(() => expect(btn).toHaveAttribute('aria-disabled', 'false'))
  })

  it('문서로 돌아가기 링크가 서버가 해석한 docPath를 그대로 쓴다', () => {
    render(<EditorClient {...props} />)
    expect(
      screen.getByRole('link', { name: `${props.title} 문서로 돌아가기` }),
    ).toHaveAttribute('href', props.docPath)
  })

  it('Cmd+E로 프리뷰 전환 시 포커스가 토글 버튼에 유지된다 (I1 회귀 방지)', async () => {
    render(<EditorClient {...props} />)
    const textarea = screen.getByLabelText('본문 (마크다운)')
    textarea.focus()
    fireEvent.keyDown(textarea, { key: 'e', metaKey: true })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '편집으로 돌아가기' })).toHaveFocus())
  })
})
