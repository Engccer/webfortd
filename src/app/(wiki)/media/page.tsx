import type { Metadata } from "next"
import { MediaGrid } from "@/components/media/MediaGrid"

export const metadata: Metadata = {
  title: "미디어 자료실",
  description: "장애인교원 안내자료의 카드뉴스·인포그래픽·삽화 모음. alt 텍스트와 출처 포함.",
}

export default function MediaPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">미디어 자료실</h1>
        <p className="mt-2 text-muted-foreground">
          정책 안내자료의 시각 자료를 alt 텍스트와 함께 모은 곳입니다. 출처 페이지로 이동해 전체 맥락을 확인할 수 있습니다.
        </p>
      </header>
      <MediaGrid />
    </section>
  )
}
