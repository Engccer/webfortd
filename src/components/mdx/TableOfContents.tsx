"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface Heading {
  level: number
  text: string
  id: string
}

interface TableOfContentsProps {
  headings: Heading[]
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: "-80px 0px -80% 0px" }
    )

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  // level 2, 3만 표시
  const filteredHeadings = headings.filter((h) => h.level >= 2 && h.level <= 3)

  if (filteredHeadings.length === 0) return null

  return (
    <nav className="sticky top-24" aria-label="목차">
      <h2 className="mb-4 text-sm font-semibold text-foreground">목차</h2>
      <ul className="space-y-2 text-sm">
        {filteredHeadings.map((heading) => (
          <li
            key={heading.id}
            style={{ paddingLeft: `${(heading.level - 2) * 12}px` }}
          >
            <a
              href={`#${heading.id}`}
              aria-current={activeId === heading.id ? "location" : undefined}
              className={cn(
                "block py-1 transition-colors hover:text-primary",
                activeId === heading.id
                  ? "font-medium text-primary"
                  : "text-muted-foreground"
              )}
              onClick={(e) => {
                e.preventDefault()
                const target = document.getElementById(heading.id)
                if (!target) return
                target.scrollIntoView({ behavior: "smooth" })
                // 스크린리더 읽기 위치도 함께 이동 (WCAG 2.4.3):
                // 대상 헤딩에 프로그래매틱 포커스를 부여한다.
                target.tabIndex = -1
                target.focus({ preventScroll: true })
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
