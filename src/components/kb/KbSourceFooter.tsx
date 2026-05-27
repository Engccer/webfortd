import { Download, FileText } from "lucide-react"
import { getSourceDownload } from "@/lib/atomic-source-map"

interface KbSourceFooterProps {
  sourceOrigin: string | undefined
}

export function KbSourceFooter({ sourceOrigin }: KbSourceFooterProps) {
  const download = getSourceDownload(sourceOrigin)
  if (!download) return null

  return (
    <footer className="mt-12 rounded-lg border border-border bg-muted/30 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
        원본 자료
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        이 페이지는 다음 원본 자료에서 분해된 atomic 페이지입니다.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">{download.title}</span>
        <span className="text-xs text-muted-foreground">{download.fileSize}</span>
        <a
          href={download.url}
          download
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${download.title} PDF 다운로드 (${download.fileSize})`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          PDF 다운로드
        </a>
      </div>
    </footer>
  )
}
