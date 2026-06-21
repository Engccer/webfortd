/**
 * Phase B M2 — non-published 문서를 일반 사용자에게 보여줄 때의 "검수 중" 안내(200).
 * spec B5: 페이지 존재는 알리되 내용은 비공개. 404 아님.
 * KbPageLayout과 동일한 fixed overlay + --admin-bar-h 정합.
 */
import Link from "next/link"
import { Home } from "lucide-react"
import { FocusManager } from "@/components/accessibility/FocusManager"

interface UnderReviewNoticeProps {
  title?: string
  backHref: string
  backLabel: string
}

export function UnderReviewNotice({
  title,
  backHref,
  backLabel,
}: UnderReviewNoticeProps) {
  return (
    <>
      <FocusManager />
      <div
        className="fixed inset-x-0 bottom-0 z-50 overflow-auto bg-background"
        style={{ top: "var(--admin-bar-h, 0px)" }}
      >
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
            {/* 홈 / {axis} 목록 — KbPageLayout과 동일한 진입점(메인으로 돌아가기). */}
            <div className="flex min-w-0 items-center gap-0.5 text-sm font-medium text-muted-foreground">
              <Link
                href="/"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                홈
              </Link>
              <span aria-hidden="true" className="shrink-0 text-muted-foreground/50">
                /
              </span>
              <Link
                href={backHref}
                className="inline-flex min-w-0 items-center rounded-lg px-2.5 py-2 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span className="truncate">{backLabel}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* main 랜드마크와 #main-content(Alt+1 단축키 대상)는 AppShell이 단일 렌더 — 내부는 div. */}
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-lg border border-border bg-muted/40 p-8 text-center">
            <h1 className="mb-3 text-2xl font-bold text-foreground">
              검수 중인 페이지입니다
            </h1>
            {title && (
              <p className="mb-4 text-lg text-muted-foreground">「{title}」</p>
            )}
            <p className="text-muted-foreground">
              이 페이지는 현재 검수 진행 중이라 아직 공개되지 않았어요. 검수가
              끝나면 내용을 보실 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
