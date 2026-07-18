'use client'

/**
 * Phase 3 M6.1 — 답변 복사 (마크다운/평문 듀얼).
 *
 * 패턴 출처: dodo-planet `src/components/chat/MessageBubble.tsx:64-100` CopyButton.
 * 변경점:
 *   - i18n 제거 (한국어 카피 고정)
 *   - shadcn Dialog 대신 native modal (deps 최소화, ESC 핸들러는 useEffect)
 *   - 모바일 항상 노출은 부모(ChatUI)의 wrapper className에서 처리
 *
 * 접근성:
 *   - 버튼 aria-label="응답 복사" + 44px 터치 타깃
 *   - modal role="dialog" aria-modal="true" aria-labelledby
 *   - aria-live="polite" announcer (복사 직후 1.5초간 표시)
 *   - ESC로 닫힘 (window keydown listener)
 *   - 모달 열릴 때 첫 버튼 포커스 + Tab 순환 트랩 + 닫힐 때 Copy 버튼 복귀 (WCAG 2.4.3)
 */

import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { markdownToPlainText } from '@/lib/utils/markdown'

interface CopyButtonProps {
  /** 복사 대상 마크다운 본문 */
  content: string
}

export function CopyButton({ content }: CopyButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'markdown' | 'text' | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  // 닫힘 시 포커스 복귀 대상 — 모달을 연 Copy 버튼
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // ESC 닫기 + 포커스 이동/복귀 + Tab 순환 트랩
  useEffect(() => {
    if (!open) return
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    // 열릴 때 첫 버튼으로 포커스 이동
    const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>('button')
    buttons?.[0]?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const focusables = modalRef.current?.querySelectorAll<HTMLButtonElement>('button')
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      // 닫힐 때 Copy 버튼으로 복귀
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
    }
  }, [open])

  async function handleCopy(type: 'markdown' | 'text') {
    try {
      const text = type === 'markdown' ? content : markdownToPlainText(content)
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setOpen(false)
      setAnnouncement(
        type === 'markdown' ? '마크다운으로 복사되었어요' : '평문으로 복사되었어요',
      )
      setTimeout(() => {
        setCopied(null)
        setAnnouncement(null)
      }, 1500)
    } catch (err) {
      console.error('[CopyButton] clipboard write failed:', err)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="응답 복사"
        className={
          copied
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:bg-emerald-900 dark:text-emerald-200'
            : 'inline-flex h-11 w-11 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
        }
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {announcement && (
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      )}

      {open && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-xs overflow-hidden rounded-xl bg-card text-card-foreground shadow-xl">
            <div className="flex items-center justify-center gap-2 p-5">
              <Copy className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 id="copy-modal-title" className="font-semibold text-foreground">
                복사 형식 선택
              </h2>
            </div>
            <div className="space-y-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => handleCopy('text')}
                className="w-full rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                평문으로 복사
              </button>
              <button
                type="button"
                onClick={() => handleCopy('markdown')}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                마크다운으로 복사
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
