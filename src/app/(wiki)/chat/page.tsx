import type { Metadata } from 'next'
import { ChatUI } from '@/components/chat/ChatUI'

export const metadata: Metadata = {
  title: '채팅',
  description:
    '대한민국 장애인교원 제도와 정책을 자연어로 질문할 수 있는 채팅이에요.',
}

export default function ChatPage() {
  return <ChatUI />
}
