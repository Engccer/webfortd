'use client'

/**
 * Phase 3 M6.2 — 한국어 에러 분기 + 재시도 버튼.
 *
 * 분기 매트릭스 (spec §D9):
 *   - retrieval 0건: "관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요."
 *   - Gateway 5xx: "응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요."
 *   - validateUIMessages: "메시지 형식 오류가 발생했어요."
 *   - 기타: "응답 생성 중 오류가 발생했어요. 다시 시도해 보세요."
 *
 * 접근성:
 *   - role="alert" — 시각장애인 사용자에게 즉시 낭독
 *   - "다시 시도" 버튼 44px 이상 (위원장 §접근성 원칙)
 *   - aria-label 명시 ("마지막 질문 다시 보내기")
 */

import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorBannerProps {
  error: Error
  onRetry: () => void
}

function classifyError(message: string): string {
  if (/관련 정책 문서를 찾지 못/.test(message)) {
    return '관련 정책 문서를 찾지 못했어요. 다른 표현으로 물어보세요.'
  }
  if (/Gateway|50[234]|Service Unavailable/i.test(message)) {
    return '응답 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해 주세요.'
  }
  if (/validateUIMessages|invalid shape|invalid messages/i.test(message)) {
    return '메시지 형식 오류가 발생했어요.'
  }
  return '응답 생성 중 오류가 발생했어요. 다시 시도해 보세요.'
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const friendly = classifyError(error.message)
  return (
    <div
      role="alert"
      className="my-2 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p>{friendly}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        aria-label="마지막 질문 다시 보내기"
        className="inline-flex min-h-11 items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        다시 시도
      </button>
    </div>
  )
}
