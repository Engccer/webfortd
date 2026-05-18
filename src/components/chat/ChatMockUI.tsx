"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Send, Sparkles, User } from "lucide-react"
import { matchMockResponse } from "@/lib/chat-mock-responses"

interface Message {
  id: number
  role: "user" | "bot"
  content: string
  sources?: { href: string; title: string }[]
}

const SUGGESTIONS = [
  "특수 마우스에는 어떤 종류가 있나요?",
  "편의지원 조례를 제정한 시도교육청은 어디인가요?",
  "학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?",
]

export function ChatMockUI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const counter = useRef(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const userMsg: Message = { id: ++counter.current, role: "user", content: trimmed }
    const matched = matchMockResponse(trimmed)
    const botMsg: Message = {
      id: ++counter.current,
      role: "bot",
      content: matched.answer,
      sources: matched.sources,
    }
    setMessages((prev) => [...prev, userMsg, botMsg])
    setInput("")
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 sm:px-6">
      <div
        ref={listRef}
        aria-live="polite"
        aria-label="대화 내역"
        className="flex-1 overflow-y-auto py-6"
      >
        {messages.length === 0 ? (
          <div className="mx-auto mt-8 max-w-2xl text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              무엇이든 물어보세요
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              데모 단계 — 아래 추천 질문을 클릭하거나 직접 입력해 주세요.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-3">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                  aria-hidden="true"
                >
                  {m.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                    {m.content}
                  </p>
                  {m.sources && m.sources.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                      {m.sources.map((s) => (
                        <li key={s.href}>
                          <Link
                            href={s.href}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            📄 {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border py-4">
        <label htmlFor="chat-input" className="sr-only">
          질문 입력
        </label>
        <div className="flex items-center gap-2">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문을 입력하세요…"
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="off"
          />
          <button
            type="submit"
            aria-label="전송"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          데모 단계 — 미리 준비된 주제 외에는 안내 메시지가 나옵니다.
        </p>
      </form>
    </div>
  )
}
