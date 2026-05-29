'use client'

/**
 * Phase 3 M7.2 — 파일 첨부 버튼.
 *
 * 클릭 → <input type="file"> 클릭 → 파일 선택 → validateAttachment →
 * 통과 시 onSelect 콜백, 실패 시 onError(reason).
 *
 * 접근성:
 *   - aria-label "파일 첨부"
 *   - 44px 터치 타깃
 *   - 시각 + 텍스트 라벨 결합 (lucide Paperclip + sr-only)
 */

import { useRef } from 'react'
import { Paperclip } from 'lucide-react'
import { validateAttachment, ALLOWED_MIMES } from '@/lib/chat/file-validation'

interface AttachmentButtonProps {
  onSelect: (file: File) => void
  onError: (reason: string) => void
  disabled?: boolean
}

export function AttachmentButton({ onSelect, onError, disabled }: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const result = validateAttachment(file)
    if (!result.ok) {
      onError(result.reason)
      e.target.value = '' // 동일 파일 재선택 가능
      return
    }
    onSelect(file)
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIMES.join(',') + ',.hwp,.hwpx'}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="파일 첨부"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Paperclip className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  )
}
