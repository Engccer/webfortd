import Image from "next/image"
import Link from "next/link"
import { Download, ExternalLink } from "lucide-react"
import type { MediaItem } from "@/lib/media-curation"

interface MediaDetailProps {
  item: MediaItem
}

export function MediaDetail({ item }: MediaDetailProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/media"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span aria-hidden="true">←</span> 미디어 자료실 목록
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{item.caption}</h1>
      </header>
      <div className="mb-6 overflow-hidden rounded-lg border border-border bg-muted">
        <Image
          src={item.imagePath}
          alt={item.alt}
          width={1200}
          height={800}
          sizes="(min-width: 768px) 720px, 100vw"
          className="h-auto w-full object-contain"
        />
      </div>
      <section className="mb-6 rounded-md border border-border bg-muted/30 p-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">이미지 설명 (alt text)</h2>
        <p className="text-sm text-foreground">{item.alt}</p>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={item.imagePath}
          download
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${item.caption} 이미지 다운로드`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          이미지 다운로드
        </a>
        <Link
          href={`/${item.sourceAxis}/${item.sourceDocSlug}`}
          className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          출처 페이지 보기
        </Link>
      </div>
    </article>
  )
}
