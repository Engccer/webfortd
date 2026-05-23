"use client"

import { useEffect, useRef } from "react"
import { Search, ArrowRight } from "lucide-react"
import Link from "next/link"

export function WikiHero() {
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    function focus() {
      const search = document.querySelector<HTMLButtonElement>(
        '[aria-haspopup="dialog"][aria-label*="검색"], [aria-label*="사이트 검색"]'
      )
      search?.click()
    }
    const node = buttonRef.current
    node?.addEventListener("click", focus)
    return () => node?.removeEventListener("click", focus)
  }, [])

  return (
    <section className="bg-gradient-to-b from-primary/5 to-background py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          장애인교원에 관한
          <br className="hidden sm:inline" />
          <span className="text-primary"> 모든 정보를 한 번에</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          535개의 정책·법령·사례·보조공학 페이지가 위키로 연결되어 있습니다.
          단어 하나로 답을 찾거나, 채팅으로 자연어 질문도 가능합니다.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-input bg-background px-5 text-base text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:min-w-[320px]"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left">검색어를 입력하세요…</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs sm:inline">
              /
            </kbd>
          </button>
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
