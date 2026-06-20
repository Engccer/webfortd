import Link from "next/link"
import { MessageCircle, FolderArchive, Image as ImageIcon } from "lucide-react"

const ENTRIES = [
  {
    href: "/chat",
    title: "채팅",
    description: "정책·법령·사례에 대해 자연어로 질문하세요.",
    icon: MessageCircle,
  },
  {
    href: "/library",
    title: "자료실",
    description: "원본 정책 보고서·안내서를 PDF로 다운로드합니다.",
    icon: FolderArchive,
  },
  {
    href: "/media",
    title: "미디어 자료실",
    description: "안내자료의 카드뉴스·인포그래픽을 alt 텍스트와 함께 봅니다.",
    icon: ImageIcon,
  },
]

export function ChatLibraryMediaEntries() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h2 id="chat-library-media-heading" className="sr-only">채팅·자료실·미디어</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground group-hover:text-primary">
                {entry.title}
              </h3>
              <p className="text-sm text-muted-foreground">{entry.description}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
