"use client"

import { MDXRemote, MDXRemoteSerializeResult } from "next-mdx-remote"
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

// 커스텀 컴포넌트
//
// 헤딩 데모션(h1→h2, h2→h3, h3→h4, h4→h5): 페이지 제목 <h1>은 KbPageLayout이 렌더하므로
// 본문 헤딩을 한 단계씩 내려 페이지당 h1 1개 + 헤딩 레벨 건너뛰기 없음을 보장 (WCAG 1.3.1/2.4.6).
// 앵커 id는 rehype-slug가 부여한 props.id가 {...props} 스프레드로 우선 적용되므로
// 데모션 후에도 목차(TableOfContents)의 doc.headings id와 동일하게 유지된다.
// 색상은 다크모드·고대비 모드 대응을 위해 테마 토큰(text-foreground 등)만 사용 (WCAG 1.4.3).
const components = {
  // 헤딩에 자동 ID 부여 (rehype-slug 미적용 환경 fallback)
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h2 id={id} className="scroll-mt-24 text-3xl font-bold text-foreground mt-8 mb-4" {...props}>
        {children}
      </h2>
    )
  },
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h3 id={id} className="scroll-mt-24 text-2xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border" {...props}>
        {children}
      </h3>
    )
  },
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h4 id={id} className="scroll-mt-24 text-xl font-semibold text-foreground mt-6 mb-3" {...props}>
        {children}
      </h4>
    )
  },
  h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = String(children)
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, "")
      .replace(/\s+/g, "-")
    return (
      <h5 id={id} className="scroll-mt-24 text-lg font-semibold text-foreground mt-4 mb-2" {...props}>
        {children}
      </h5>
    )
  },
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-foreground leading-7 mb-4" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-inside space-y-2 mb-4 text-foreground" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside space-y-2 mb-4 text-foreground" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-7" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-primary hover:underline" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted text-muted-foreground italic" {...props} />
  ),
  // 표 래퍼: 가로 스크롤 영역을 키보드로도 스크롤할 수 있도록 tabIndex + role 부여 (WCAG 2.1.1)
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-4" tabIndex={0} role="region" aria-label="표">
      <table className="min-w-full border-collapse border border-border" {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-muted" {...props} />
  ),
  // remark-gfm 표의 th는 thead 안에만 생성되므로 scope="col" 고정 (WCAG 1.3.1)
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th scope="col" className="border border-border px-4 py-2 text-left font-semibold text-foreground" {...props} />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-border px-4 py-2 text-foreground" {...props} />
  ),
  hr: () => <hr className="my-8 border-border" />,
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4" {...props} />
  ),
  // 커스텀 Callout 컴포넌트 — 파스텔 배경이 항상 라이트 고정이라 본문색도 고정 유지(토큰화 시 다크에서 충돌)
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
  // 이미지 placeholder 처리.
  // next/image 미사용 사유: MDX 본문 이미지는 동적 src(로컬 경로·외부 URL 혼재)라 next/image의
  // 도메인 화이트리스트·정적 분석과 정합 어려움. <img> 의도된 선택. alt는 MDX 마크다운에서 전달.
  // 스프레드를 앞에 두어 alt fallback("")이 props에 덮이지 않도록 보장 (WCAG 1.1.1).
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    if (typeof props.src === "string" && props.src.includes("placeholder")) {
      return null // placeholder 이미지는 표시하지 않음
    }
    // eslint-disable-next-line @next/next/no-img-element -- MDX 본문 dynamic src로 next/image 불가. 의도된 <img>.
    return <img {...props} className="max-w-full h-auto my-4 rounded-lg" alt={props.alt ?? ""} />
  },
}

interface MDXContentProps {
  source: MDXRemoteSerializeResult
}

export function MDXContent({ source }: MDXContentProps) {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <MDXRemote {...source} components={components} />
    </div>
  )
}
