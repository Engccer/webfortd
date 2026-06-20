import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { SiteSearch } from "@/components/search/SiteSearch"

export function WikiHero() {
  return (
    <section className="bg-gradient-to-b from-primary/5 to-background py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          장애인교원에 관한
          <br className="hidden sm:inline" />
          <span className="text-primary"> 모든 정보를 한 번에</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          정책·법령·사례부터 보조공학까지, 검색하거나 채팅으로 물어보세요.
        </p>
        {/* 버튼 우회 없이 검색 편집창을 바로 노출 — 헤더와 동일한 즉시 인라인 검색. */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="w-full max-w-xl text-left">
            <SiteSearch variant="hero" />
          </div>
          <Link
            href="/chat"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            채팅으로 질문
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
