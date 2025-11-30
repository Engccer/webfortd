import { Metadata } from "next"
import { notFound } from "next/navigation"
import { serialize } from "next-mdx-remote/serialize"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import { MDXClientWrapper } from "@/components/mdx/MDXClientWrapper"
import { getDocBySlug, getAllDocs } from "@/lib/mdx"
import { Calendar, User, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const docs = await getAllDocs("resources", "research")
  return docs.map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const doc = await getDocBySlug("resources", "research", slug)

  if (!doc) {
    return { title: "문서를 찾을 수 없습니다" }
  }

  return {
    title: doc.title,
    description: doc.description,
  }
}

export default async function ResearchDocPage({ params }: PageProps) {
  const { slug } = await params
  const doc = await getDocBySlug("resources", "research", slug)

  if (!doc) {
    notFound()
  }

  const mdxSource = await serialize(doc.content, {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    },
  })

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white">
      {/* 읽기 모드 헤더 */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/resources/research"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            연구자료 목록
          </Link>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <article>
          {/* 문서 헤더 */}
          <header className="mb-8 border-b border-gray-200 pb-6">
            <h1 className="mb-4 text-3xl font-bold text-gray-900">{doc.title}</h1>
            {doc.description && (
              <p className="mb-4 text-lg text-gray-600">{doc.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {doc.date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {doc.date}
                </span>
              )}
              {doc.author && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" aria-hidden="true" />
                  {doc.author}
                </span>
              )}
            </div>
            {doc.tags && doc.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <MDXClientWrapper source={mdxSource} headings={doc.headings} />
        </article>
      </main>
    </div>
  )
}
