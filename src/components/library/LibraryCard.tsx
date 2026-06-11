import Link from "next/link"
import { FileText, Download } from "lucide-react"
import type { LibraryItem } from "@/lib/library-catalog"

const CATEGORY_LABEL: Record<LibraryItem["category"], string> = {
  guide: "안내서",
  policy: "정책 보고서",
  manual: "매뉴얼",
  agreement: "단체협약",
}

interface LibraryCardProps {
  item: LibraryItem
}

export function LibraryCard({ item }: LibraryCardProps) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <header className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">
            <Link
              href={`/library/${item.slug}`}
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {item.title}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.year}년 · {item.organization} · {CATEGORY_LABEL[item.category]}
          </p>
        </div>
      </header>
      <p className="mb-4 flex-1 text-sm text-muted-foreground">{item.summary}</p>
      <footer className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{item.fileSize}</span>
        <a
          href={item.downloadUrl}
          download
          className="inline-flex min-h-11 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${item.title} 다운로드 (${item.fileSize})`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          다운로드
        </a>
      </footer>
    </article>
  )
}
