"use client"

/**
 * /admin/editor 편집 화면 클라이언트 컴포넌트.
 *
 * 접근성 계약(spec §8):
 * - textarea는 연결된 <label>("본문 (마크다운)"). 자동 저장 없음(명시 버튼으로만 반영).
 * - 프리뷰 토글은 라벨 전환("프리뷰 보기"↔"편집으로 돌아가기")이 상태 신호, 포커스는 토글 버튼에 유지.
 * - "수정 반영"은 disabled 대신 aria-disabled(disabled는 포커스를 body로 떨군다) +
 *   in-flight useRef 가드(더블클릭 중복 제출 방지, 클로저 가드만으론 부족).
 * - 단일 polite live region 1개로 4상태(accepted/rejected/conflict/forbidden 등) 메시지를
 *   서버 반환 message 그대로 출력.
 * - 충돌 시 textarea는 latestBody로 교체 + baseSha를 latestSha로 갱신, 내 편집본은
 *   별도 <section>(읽기 전용 textarea)에 보존.
 * - 단축키(Cmd/Ctrl+S 반영, Cmd/Ctrl+E 프리뷰 토글)는 래퍼 div의 onKeyDown에서만 처리
 *   (전역 window 리스너 금지) — 모든 기능은 버튼만으로도 완결.
 */

import { Component, useEffect, useRef, useState, type ReactNode } from "react"
import type { MDXRemoteSerializeResult } from "next-mdx-remote"
import { previewBody, submitBody } from "./actions"
import { MDXContent } from "@/components/mdx/MDXContent"

interface EditorClientProps {
  slug: string
  title: string
  body: string
  baseSha: string
}

// MDXContent 렌더 실패(예: 예상 밖 compiledSource)가 편집기 전체를 무너뜨리지 않도록 격리.
// mode가 'edit'으로 바뀌면 이 서브트리 자체가 언마운트되므로 다음 프리뷰 진입 시 자연 리셋된다.
class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return <p className="text-sm text-destructive">프리뷰를 표시할 수 없습니다.</p>
    }
    return this.props.children
  }
}

function draftKey(slug: string, baseSha: string) {
  return `editor-draft:${slug}:${baseSha}`
}

export function EditorClient({ slug, title, body: initialBody, baseSha: initialBaseSha }: EditorClientProps) {
  const [body, setBody] = useState(initialBody)
  const [baseSha, setBaseSha] = useState(initialBaseSha)
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const [notice, setNotice] = useState("")
  const [conflictBackup, setConflictBackup] = useState<string | null>(null)
  const [previewSource, setPreviewSource] = useState<MDXRemoteSerializeResult | null>(null)
  const [draftAvailable, setDraftAvailable] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submitInFlightRef = useRef(false)
  const previewInFlightRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 마운트 시 저장하지 않은 초안 확인 — 로드 본문과 다른 경우에만 안내.
  useEffect(() => {
    const saved = localStorage.getItem(draftKey(slug, initialBaseSha))
    if (saved !== null && saved !== initialBody) {
      setDraftAvailable(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회만 확인
  }, [])

  // localStorage 초안 자동 백업 — 500ms debounce, 자동 반영이 아닌 로컬 임시 저장뿐.
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(slug, baseSha), body)
    }, 500)
    return () => clearTimeout(t)
  }, [slug, baseSha, body])

  function restoreDraft() {
    const saved = localStorage.getItem(draftKey(slug, initialBaseSha))
    if (saved !== null) setBody(saved)
    setDraftAvailable(false)
    // 복원 버튼이 속한 안내 배너가 이 클릭으로 사라진다 — 포커스가 body로 떨어지지
    // 않도록 계속 존재하는 textarea로 옮긴다 (WCAG 2.4.3).
    textareaRef.current?.focus()
  }

  async function handleTogglePreview() {
    if (mode === "preview") {
      setMode("edit")
      return
    }
    if (previewInFlightRef.current) return
    previewInFlightRef.current = true
    try {
      const result = await previewBody(body)
      if (result.status === "ok") {
        setPreviewSource(result.source)
        setMode("preview")
      } else {
        setNotice(result.message)
      }
    } finally {
      previewInFlightRef.current = false
    }
  }

  async function handleSubmit() {
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true
    setSubmitting(true)
    try {
      const result = await submitBody({ slug, baseSha, body })
      setNotice(result.message)
      if (result.status === "accepted") {
        localStorage.removeItem(draftKey(slug, baseSha))
      } else if (result.status === "conflict") {
        setConflictBackup(body)
        setBody(result.latestBody)
        setBaseSha(result.latestSha)
      }
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!(e.metaKey || e.ctrlKey)) return
    if (e.key === "s") {
      e.preventDefault()
      void handleSubmit()
    } else if (e.key === "e") {
      e.preventDefault()
      void handleTogglePreview()
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      {draftAvailable && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <span>저장하지 않은 초안이 있습니다.</span>
          <button
            type="button"
            onClick={restoreDraft}
            className="min-h-11 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            초안 복원
          </button>
        </div>
      )}

      {mode === "edit" ? (
        <div className="space-y-2">
          <label htmlFor="editor-body" className="text-sm font-medium text-foreground">
            본문 (마크다운)
          </label>
          <textarea
            ref={textareaRef}
            id="editor-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-input bg-background p-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      ) : (
        previewSource && (
          <PreviewErrorBoundary>
            <MDXContent source={previewSource} />
          </PreviewErrorBoundary>
        )
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleTogglePreview()}
          className="min-h-11 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {mode === "edit" ? "프리뷰 보기" : "편집으로 돌아가기"}
        </button>
        <button
          type="button"
          aria-disabled={submitting}
          onClick={() => void handleSubmit()}
          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          수정 반영
        </button>
        <a
          href={`/${slug}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {title} 문서로 돌아가기
        </a>
      </div>

      {conflictBackup !== null && (
        <section className="mt-6 space-y-2 rounded-lg border border-border bg-muted p-4">
          <h2 className="text-sm font-semibold text-foreground">내 편집본 (충돌로 보존됨)</h2>
          <textarea
            readOnly
            value={conflictBackup}
            rows={10}
            aria-label="내 편집본 (충돌로 보존됨)"
            className="w-full rounded-lg border border-input bg-background p-3 font-mono text-sm text-foreground"
          />
        </section>
      )}

      <div role="status" className="mt-4 min-h-6 text-sm">
        {notice}
      </div>
    </div>
  )
}
