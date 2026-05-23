import type { Metadata } from "next"
import { ChatMockUI } from "@/components/chat/ChatMockUI"

export const metadata: Metadata = {
  title: "채팅 (데모)",
  description:
    "장애인교원 정보에 자연어로 질문하세요. 현재 데모 단계로 미리 준비된 주제에 답변합니다.",
}

export default function ChatPage() {
  return <ChatMockUI />
}
