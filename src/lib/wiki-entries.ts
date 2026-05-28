import type { LucideIcon } from "lucide-react"
import { Home, MessageSquare, FolderArchive, Image as ImageIcon, Info } from "lucide-react"

export interface WikiEntry {
  href: string
  title: string
  description?: string
  icon: LucideIcon
}

export const wikiEntries: WikiEntry[] = [
  { href: "/", title: "위키 홈", icon: Home, description: "메인 진입점" },
  { href: "/chat", title: "채팅", icon: MessageSquare, description: "정책·법령 자연어 질문" },
  { href: "/library", title: "자료실", icon: FolderArchive, description: "PDF 자료실" },
  { href: "/media", title: "미디어", icon: ImageIcon, description: "카드뉴스·인포그래픽" },
  { href: "/about", title: "About", icon: Info, description: "사이트 소개" },
]
