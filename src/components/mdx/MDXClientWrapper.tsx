"use client"

import dynamic from "next/dynamic"
import type { MDXRemoteSerializeResult } from "next-mdx-remote"

const MDXContent = dynamic(
  () => import("./MDXContent").then((mod) => mod.MDXContent),
  {
    ssr: false,
    loading: () => <div className="animate-pulse h-96 bg-gray-100 rounded-lg" />
  }
)

const TableOfContents = dynamic(
  () => import("./TableOfContents").then((mod) => mod.TableOfContents),
  { ssr: false }
)

interface Heading {
  level: number
  text: string
  id: string
}

interface MDXClientWrapperProps {
  source: MDXRemoteSerializeResult
  headings: Heading[]
}

export function MDXClientWrapper({ source, headings }: MDXClientWrapperProps) {
  return (
    <div className="flex gap-8">
      {/* 본문 */}
      <div className="min-w-0 flex-1">
        <MDXContent source={source} />
      </div>

      {/* 목차 (TOC) - 넓은 화면에서만 표시 */}
      {headings.length > 0 && (
        <aside className="hidden w-64 shrink-0 xl:block">
          <TableOfContents headings={headings} />
        </aside>
      )}
    </div>
  )
}
