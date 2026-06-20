'use client'

/**
 * Phase 3 M4 — 미니멀 출처 인용 칩 (자체 구현).
 *
 * AI Elements <Source> 는 target="_blank" + rel="noreferrer" 외부 링크 의도라
 * webfortd 내부 atomic 정책 페이지 인용에 부적합(새 탭 열림 + Next.js 클라이언트
 * 라우팅 무력화). next/link 기반 자체 칩으로 대체.
 *
 * spec §4.1 표의 Source/Sources 채택 결정 deviation — 디자인 의도(미니멀 칩 한 줄)는 동일.
 *
 * codex-rescue PR #31 P1 fix:
 *   - href는 retrieval.ts(server)가 canonical 합성해 박은 값을 그대로 사용.
 *     UI에서 `/${axis}/${slug}` 합성 금지 (nested resource 404 회피).
 *   - 터치 타깃 44×44px (CLAUDE.md 모바일 접근성 원칙) — min-h-11.
 *
 * 접근성:
 *   - 시맨틱 <ul>/<li>/<Link>
 *   - title 안의 이모지(📄)는 시각 보조이며 스크린리더는 link 라벨로 본문 낭독
 *   - 키보드 Tab 도달 + focus ring (focus:ring-2 토큰)
 */

import Link from 'next/link'
import type { SourceRef } from '@/lib/rag/types'

export type { SourceRef }

interface SourceCardProps {
  sources: readonly SourceRef[]
}

export function SourceCard({ sources }: SourceCardProps) {
  if (sources.length === 0) return null

  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-xs">
      {sources.map((src) => (
        <li key={src.slug}>
          <Link
            href={src.href}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-muted px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <span aria-hidden="true">📄</span>
            <span>{src.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
