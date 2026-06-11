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
import { serialize } from "next-mdx-remote/serialize"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import { MDXClientWrapper } from "@/components/mdx/MDXClientWrapper"
import { getKBDocBySlug } from "@/lib/kb"
import { adaptFrontmatterToLegacy } from "@/lib/kb-adapter"
import { Calendar, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ContentAxis } from "@/types/kb"
import { FocusManager } from "@/components/accessibility/FocusManager"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { KbSourceFooter } from "./KbSourceFooter"
import { StatusBadge } from "./StatusBadge"
import { UnderReviewNotice } from "./UnderReviewNotice"
import { getPreviewActive } from "@/lib/admin/preview"
import { shouldRenderUnderReview } from "@/lib/admin/preview-policy"

const AXIS_LABEL: Record<ContentAxis, string> = {
  'disability-types': '장애유형별',
  'domains': '영역별',
  'regions': '지역별',
  'policies': '정책·법령',
  'agreements': '단체협약',
  'stories': '사례',
  'resources': '자료실',
  'uncategorized': '미분류',
}

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

  // MDX 호환 정리:
  // 1) HTML 주석 `<!-- TODO ... -->`는 MDX 비지원 — 렌더 시점에 제거(원본 .md에는 유지,
  //    M4 검수자가 파일 직접 보면서 처리).
  // 2) 한국어 본문의 `<표 Ⅴ-4>`, `</표>` 같은 패턴은 MDX가 태그로 오인. 분해 결과 본문에는
  //    의도된 HTML/JSX 태그가 없으므로 모든 `<`를 `&lt;`로 일괄 escape.
  //    `>`는 blockquote(`> parent`) 의미를 유지하기 위해 escape 안 함.
  const escapedContent = doc.content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/</g, '&lt;')
    // LaTeX `\frac{...}` 같은 본문 표기를 MDX가 JSX expression으로 오해해 acorn 오류.
    // 분해 결과 본문에 의도된 JSX 표현식이 없으므로 `{`도 escape.
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')

  const mdxSource = await serialize(escapedContent, {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    },
  })

  return (
    <>
      <FocusManager />
      <div
        className="fixed inset-x-0 bottom-0 z-50 overflow-auto bg-background"
        style={{ top: "var(--admin-bar-h, 0px)" }}
      >
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link
              href={axisHref}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {axisLabel} 목록
            </Link>
            <div className="flex items-center gap-2">
              <StatusBadge status={fm.status} />
              <AccessibilityToolbar />
            </div>
          </div>
        </div>

        {/* main 랜드마크와 #main-content(SkipLink 대상)는 AppShell이 단일 렌더 —
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
                <nav
                  aria-label="출처 문서 내 위치"
                  className="mb-3 text-sm text-muted-foreground"
                >
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
                </nav>
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
