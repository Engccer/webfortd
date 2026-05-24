'use client'

/**
 * Phase 3 M5 — 로그인 사용자의 채팅 thread 사이드바.
 *
 * shadcn Sheet 기반 — 데스크탑 sticky drawer + 모바일 햄버거 (M4 install).
 * SWR로 /api/chat/threads 조회 + ChatUI에서 신규 thread 생성 후 mutate로 즉시 갱신.
 *
 * 접근성:
 *   - Sheet 자체에 focus trap + Esc close (shadcn 기본)
 *   - aria-current="true"로 활성 thread 시각·청각 표시
 *   - 햄버거 trigger aria-label="대화 목록 열기" + 44×44px (h-11 w-11) 터치 타깃
 *   - 빈 목록 안내 메시지
 */

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import useSWR from 'swr'

interface ThreadSummary {
  id: string
  title: string
  updated_at: string
}

interface ThreadDrawerProps {
  currentThreadId?: string
  onSelect: (threadId: string) => void
}

async function fetcher(url: string): Promise<{ threads: ThreadSummary[] }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('대화 목록 fetch 실패')
  return res.json()
}

export function ThreadDrawer({ currentThreadId, onSelect }: ThreadDrawerProps) {
  // revalidateOnFocus 기본값 (탭 전환 시 자동 갱신).
  // ChatUI가 신규 thread 생성 후 mutate('/api/chat/threads')로 즉시 갱신.
  const { data } = useSWR('/api/chat/threads', fetcher)
  const threads = data?.threads ?? []

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="대화 목록 열기"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" aria-label="대화 목록">
        <SheetTitle className="text-base font-semibold">최근 대화</SheetTitle>
        {threads.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            아직 저장된 대화가 없어요.
          </p>
        ) : (
          <nav className="mt-4">
            <ul role="list" className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    aria-current={t.id === currentThreadId ? 'true' : undefined}
                    className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring aria-[current=true]:bg-accent aria-[current=true]:font-medium"
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </SheetContent>
    </Sheet>
  )
}
