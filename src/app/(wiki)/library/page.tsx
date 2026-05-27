import type { Metadata } from "next"
import { LibraryGrid } from "@/components/library/LibraryGrid"

export const metadata: Metadata = {
  title: "자료실",
  description: "장애인교원 정책·법령·안내서 원본 PDF·HWPX 자료실. 4건 시작.",
}

export default function LibraryPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">자료실</h1>
        <p className="mt-2 text-muted-foreground">
          정책 보고서·안내서·매뉴얼·단체협약 등 원본 자료를 다운로드할 수 있습니다.
        </p>
      </header>
      <LibraryGrid />
    </section>
  )
}
