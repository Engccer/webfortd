import type { Metadata } from 'next'
import { ChatUI } from '@/components/chat/ChatUI'

export const metadata: Metadata = {
  title: '채팅',
  description:
    '대한민국 장애인교원 제도와 정책을 자연어로 질문할 수 있는 채팅이에요.',
}

export default async function ChatPage({
  searchParams,
}: {
  // Next.js 16 — searchParams는 async.
  // q: 홈 옴니박스 [AI에게 질문]이 넘긴 첫 질문. ChatUI가 1회 전송 후 주소에서 지운다.
  searchParams: Promise<{ thread?: string; q?: string }>
}) {
  const params = await searchParams
  return <ChatUI initialThreadId={params.thread} initialQuestion={params.q} />
}
