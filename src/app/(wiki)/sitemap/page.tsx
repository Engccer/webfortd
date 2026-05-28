import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "사이트맵",
}

export default function SitemapPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">사이트맵</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        본 페이지의 본문은 작성 중입니다.
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Phase 5(중부대 이관 또는 장교조 직접 운영 확정 시점)에서 정식 본문이
        제공됩니다. 현재는 placeholder 상태입니다.
      </p>
    </article>
  )
}
