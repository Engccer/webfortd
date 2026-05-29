'use client'

/**
 * Phase 3 M7.2 — 첨부 칩 (PromptInput 상단 썸네일 카드).
 *
 * 파일명 truncate + 크기 + X 제거 버튼 + 파싱 중 status.
 *
 * 접근성:
 *   - X 버튼 aria-label "첨부 제거"
 *   - 파싱 중 aria-live status "문서 분석 중..."
 *   - 에러는 role="alert"
 *   - 44px 터치 타깃 (X 버튼)
 */

import { X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

export type AttachmentStatus = 'idle' | 'parsing' | 'ready' | 'error'

interface AttachmentChipProps {
  file: File
  status: AttachmentStatus
  errorMessage?: string
  onRemove: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentChip({ file, status, errorMessage, onRemove }: AttachmentChipProps) {
  const isImage = file.type.startsWith('image/')
  // M7.2 patch (codex-rescue P2 #4) — HWP/HWPX는 Upstage, PDF/이미지는 Gemini로 전송.
  // PIPA 동의 카피를 첨부 칩 본문에 명시 (마이크 모달과 동일 패턴).
  const isHwp = /hwp|hancom|zip/.test(file.type)
  const externalService = isHwp ? 'Upstage' : 'Google Gemini'

  return (
    <div className="mb-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {isImage ? (
          <ImageIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="flex-1 overflow-hidden">
          <p className="truncate font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
        </div>
        {status === 'parsing' && (
          <div role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            <span>문서 분석 중...</span>
          </div>
        )}
        {status === 'error' && errorMessage && (
          <p role="alert" className="text-xs text-destructive">{errorMessage}</p>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="첨부 제거"
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        첨부 파일은 안전한 외부 분석 서비스({externalService})로 전송되며, 처리 후 즉시 폐기됩니다.
      </p>
    </div>
  )
}
