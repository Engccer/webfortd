/**
 * KB 페이지 공통 레이아웃 — M3 axis-only 라우트의 공유 서버 컴포넌트.
 *
 * 6개 axis 라우트(disability-types/domains/regions/policies/agreements/uncategorized)는
 * 동일한 레이아웃을 사용하므로 단일 컴포넌트로 합친다.
 *
 * 본문은 next-mdx-remote의 serialize로 처리. 기존 resources/law 라우트와
 * 동일 패턴이라 검수 부담이 적다.
 */

import { Metadata } from "next"
import { notFound } from "next/navigation"
import { MDXClientWrapper } from "@/components/mdx/MDXClientWrapper"
import { getKBDocBySlug } from "@/lib/kb"
import { serializeKbContent } from "@/lib/kb-mdx"
import { adaptFrontmatterToLegacy } from "@/lib/kb-adapter"
import { Calendar, Home } from "lucide-react"
import Link from "next/link"
import type { ContentAxis } from "@/types/kb"
import { FocusManager } from "@/components/accessibility/FocusManager"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { KbSourceFooter } from "./KbSourceFooter"
import { StatusBadge } from "./StatusBadge"
import { UnderReviewNotice } from "./UnderReviewNotice"
import { getPreviewActive } from "@/lib/admin/preview"
import { shouldRenderUnderReview } from "@/lib/admin/preview-policy"
import { AXIS_LABEL } from "@/lib/kb-axis"

export async function buildKbMetadata(
  axis: ContentAxis,
  slug: string,
): Promise<Metadata> {
  const doc = await getKBDocBySlug(slug)
  if (!doc || doc.axis !== axis) {
    return { title: '문서를 찾을 수 없습니다' }
  }
  const legacy = adaptFrontmatterToLegacy(doc.frontmatter)
  return {
    title: legacy.title,
    description: legacy.description,
  }
}

interface KbPageLayoutProps {
  axis: ContentAxis
  slug: string
}

export async function KbPageLayout({ axis, slug }: KbPageLayoutProps) {
  const doc = await getKBDocBySlug(slug)
  if (!doc || doc.axis !== axis) {
    notFound()
  }
  const legacy = adaptFrontmatterToLegacy(doc.frontmatter)
  const fm = doc.frontmatter

  // M2 게이트: published만 일반 공개. non-published는 admin Draft Mode에서만 본문 노출.
  // published는 getPreviewActive()를 호출하지 않아 정적 렌더가 보존된다.
  const axisLabel = AXIS_LABEL[axis] ?? axis
  const axisHref = `/${axis}`
  if (fm.status !== 'published') {
    const previewActive = await getPreviewActive()
    if (shouldRenderUnderReview(fm.status, previewActive)) {
      return (
        <UnderReviewNotice
          title={legacy.title}
          backHref={axisHref}
          backLabel={`${axisLabel} 목록`}
        />
      )
    }
  }

  const mdxSource = await serializeKbContent(doc.content)

  return (
    <>
      <FocusManager />
      <div
        className="fixed inset-x-0 bottom-0 z-50 overflow-auto bg-background"
        style={{ top: "var(--admin-bar-h, 0px)" }}
      >
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
            {/* 홈 / {axis} 목록 — 문서 오버레이가 AppShell 헤더(로고→홈)를 가리므로
                메인으로 돌아갈 진입점을 이 고정 헤더에 직접 둔다. nav 래핑 없이
                링크 2개 + aria-hidden 구분자(미니멀 ARIA). */}
            <div className="flex min-w-0 items-center gap-0.5 text-sm font-medium text-muted-foreground">
              <Link
                href="/"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                홈
              </Link>
              <span aria-hidden="true" className="shrink-0 text-muted-foreground/50">
                /
              </span>
              <Link
                href={axisHref}
                className="inline-flex min-w-0 items-center rounded-lg px-2.5 py-2 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span className="truncate">{axisLabel} 목록</span>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={fm.status} />
              <AccessibilityToolbar />
            </div>
          </div>
        </div>

        {/* main 랜드마크와 #main-content(Alt+1 단축키 대상)는 AppShell이 단일 렌더 —
            내부 중첩 main은 로터에 main 2개를 만들어 WCAG 1.3.1 위반이라 div로 유지. */}
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <article>
          <header className="mb-8 border-b border-border pb-6">
            {/* M4-B: 출처 문서 내 상위 헤딩 경로 — 분해 페이지의 컨텍스트를
                인용처럼 보이는 blockquote가 아닌 시맨틱 breadcrumb로 렌더.
                coderabbit P1 #1: non-null assertion 제거 위해 closure에 로컬 var 캡처. */}
            {(() => {
              const parents = fm.parent_headings ?? []
              if (parents.length === 0) return null
              return (
                <div className="mb-3 text-sm text-muted-foreground">
                  <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {parents.map((heading, idx) => (
                      <li key={idx} className="flex items-center gap-x-1.5">
                        <span>{heading}</span>
                        {idx < parents.length - 1 && (
                          <span aria-hidden="true" className="text-muted-foreground/60">
                            /
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )
            })()}
            <h1 className="mb-4 text-3xl font-bold text-foreground">{legacy.title}</h1>
            {legacy.description && (
              <p className="mb-4 text-lg text-muted-foreground">{legacy.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {legacy.date ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {legacy.date}
                </span>
              ) : legacy.year ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {legacy.year}년
                </span>
              ) : null}
            </div>
            {fm.source && (
              <p className="mt-4 text-sm text-muted-foreground">
                출처: {fm.source.organization} — {fm.source.citation}
              </p>
            )}
          </header>

          <MDXClientWrapper source={mdxSource} headings={doc.headings} />
          <KbSourceFooter sourceOrigin={fm.source_origin} />
        </article>
      </div>
      </div>
    </>
  )
}
