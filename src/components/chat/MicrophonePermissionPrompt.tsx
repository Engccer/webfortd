'use client'

/**
 * Phase 3 M7.1 — 마이크 권한 요청 모달.
 *
 * 출처: dodo-planet MicrophonePermissionPrompt (한국어 카피 고정).
 *
 * 접근성:
 *   - role="dialog" aria-modal="true"
 *   - ESC 닫힘 (window keydown — CopyButton 패턴 재사용)
 *   - 열릴 때 첫 버튼 포커스 + Tab 순환 트랩 + 닫힐 때 호출 버튼 복귀 (WCAG 2.4.3)
 *   - "허용" / "취소" 버튼 44px 이상
 */

import { useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'

interface MicrophonePermissionPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAllow: () => void
}

export function MicrophonePermissionPrompt({ open, onOpenChange, onAllow }: MicrophonePermissionPromptProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 닫힘 시 포커스 복귀 대상 — 모달을 연 마이크 버튼
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    // 열릴 때 첫 버튼으로 포커스 이동
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button')
    buttons?.[0]?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
        return
      }
      // 간단한 포커스 트랩 — Tab이 모달 버튼들 사이에서 순환
      if (e.key !== 'Tab') return
      const focusables = containerRef.current?.querySelectorAll<HTMLButtonElement>('button')
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
      // 닫힐 때 마이크 버튼으로 복귀
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-prompt-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-card text-card-foreground shadow-xl">
        <div className="flex flex-col items-center gap-3 p-6">
          <Mic className="h-8 w-8 text-primary" aria-hidden="true" />
          <h2 id="mic-prompt-title" className="text-lg font-semibold text-foreground">
            마이크 권한이 필요해요
          </h2>
          <p className="text-center text-sm text-muted-foreground">
            질문을 음성으로 입력할 수 있어요. 음성은 안전한 외부 변환 서비스(Deepgram)로 전송되며,
            처리 후 즉시 폐기됩니다.
          </p>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-11 flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onAllow()
            }}
            className="min-h-11 flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            허용
          </button>
        </div>
      </div>
    </div>
  )
}
