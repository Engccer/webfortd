"use client"

import { MDXRemote, MDXRemoteSerializeResult } from "next-mdx-remote"
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

// 커스텀 컴포넌트
const components = {
  // 헤딩에 자동 ID 부여
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h1 id={id} className="scroll-mt-24 text-3xl font-bold text-gray-900 mt-8 mb-4" {...props}>
        {children}
      </h1>
    )
  },
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h2 id={id} className="scroll-mt-24 text-2xl font-semibold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200" {...props}>
        {children}
      </h2>
    )
  },
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h3 id={id} className="scroll-mt-24 text-xl font-semibold text-gray-900 mt-6 mb-3" {...props}>
        {children}
      </h3>
    )
  },
  h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h4 id={id} className="scroll-mt-24 text-lg font-semibold text-gray-900 mt-4 mb-2" {...props}>
        {children}
      </h4>
    )
  },
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-gray-700 leading-7 mb-4" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-7" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-blue-600 hover:underline" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 text-gray-700 italic" {...props} />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse border border-gray-300" {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-gray-50" {...props} />
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900" {...props} />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-gray-300 px-4 py-2 text-gray-700" {...props} />
  ),
  hr: () => <hr className="my-8 border-gray-200" />,
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800" {...props} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4" {...props} />
  ),
  // 커스텀 Callout 컴포넌트
  Callout: ({ type = "info", children }: { type?: "info" | "warning" | "success" | "error"; children: React.ReactNode }) => {
    const styles = {
      info: { bg: "bg-blue-50", border: "border-blue-500", icon: <Info className="h-5 w-5 text-blue-500" /> },
      warning: { bg: "bg-yellow-50", border: "border-yellow-500", icon: <AlertTriangle className="h-5 w-5 text-yellow-500" /> },
      success: { bg: "bg-green-50", border: "border-green-500", icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
      error: { bg: "bg-red-50", border: "border-red-500", icon: <XCircle className="h-5 w-5 text-red-500" /> },
    }
    const style = styles[type]
    return (
      <div className={`${style.bg} border-l-4 ${style.border} p-4 my-4 rounded-r-lg`}>
        <div className="flex gap-3">
          {style.icon}
          <div className="text-gray-700">{children}</div>
        </div>
      </div>
    )
  },
  // 이미지 placeholder 처리
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    if (props.src?.includes("placeholder")) {
      return null // placeholder 이미지는 표시하지 않음
    }
    return <img className="max-w-full h-auto my-4 rounded-lg" {...props} />
  },
}

interface MDXContentProps {
  source: MDXRemoteSerializeResult
}

export function MDXContent({ source }: MDXContentProps) {
  return (
    <div className="prose prose-gray max-w-none">
      <MDXRemote {...source} components={components} />
    </div>
  )
}
