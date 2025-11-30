import { Metadata } from "next"
import Link from "next/link"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import { getAllDocs } from "@/lib/mdx"
import { FileText, Calendar, BookOpen } from "lucide-react"

export const metadata: Metadata = {
  title: "연구자료",
  description: "장애인교원 관련 학술 연구 및 보고서입니다.",
}

const researchPapers = [
  {
    title: "2023 장애유형별 장애인교원 근무 지원 방안",
    author: "교육부",
    year: "2023",
    type: "정책연구",
    summary: "시각, 청각, 지체장애 등 장애유형별 맞춤형 근무 지원 방안을 제시한 연구입니다.",
  },
  {
    title: "2024 장애인교원 근무지원 안내자료",
    author: "교육부",
    year: "2024",
    type: "안내자료",
    summary: "장애인교원을 위한 근무지원 제도와 신청 절차를 안내하는 자료입니다.",
  },
  {
    title: "장애인교원 지원인력 직무 수행 안내자료",
    author: "교육부",
    year: "2024",
    type: "안내자료",
    summary: "장애인교원을 보조하는 지원인력의 역할과 직무 수행 방법을 안내합니다.",
  },
]

const resourcesNav = mainNavigation.find((item) => item.href === "/resources")

export default async function ResearchPage() {
  // MDX 문서 목록 가져오기
  const docs = await getAllDocs("resources", "research")

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {resourcesNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={resourcesNav.children} title="연구·법령·통계" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">연구자료</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원 관련 학술 연구 및 정책 보고서를 확인하세요.
          </p>

          {/* 내부 문서 (MDX) - 웹에서 바로 확인 가능 */}
          {docs.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900">
                <BookOpen className="h-5 w-5 text-green-600" />
                웹에서 바로 보기
              </h2>
              <p className="mb-4 text-sm text-gray-600">
                다운로드 없이 웹에서 바로 확인할 수 있는 자료입니다.
              </p>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {docs.map((doc) => (
                  <article
                    key={doc.slug}
                    className="rounded-lg border-2 border-green-200 bg-green-50 p-5 transition-all hover:border-green-400 hover:bg-green-100"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900">
                          <Link
                            href={`/resources/research/${doc.slug}`}
                            className="hover:text-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                          >
                            {doc.title}
                          </Link>
                        </h3>
                        {doc.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                            {doc.description}
                          </p>
                        )}
                        {doc.date && (
                          <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
                            {doc.date}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 외부 연구자료 (준비중) */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">관련 연구</h2>
            {/* 샘플 데이터 안내 */}
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                샘플 데이터: 아래 항목들은 예시이며, 실제 자료는 확보 후 업로드 예정입니다.
              </p>
            </div>
            <div className="space-y-4">
              {researchPapers.map((paper) => (
                <article
                  key={paper.title}
                  className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-blue-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-gray-100 p-3 text-gray-500">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          {paper.type}
                        </span>
                        <span className="text-sm text-gray-500">{paper.year}</span>
                      </div>
                      <h3 className="mb-1 text-lg font-semibold text-gray-900">
                        {paper.title}
                      </h3>
                      <p className="mb-2 text-sm text-gray-500">{paper.author}</p>
                      <p className="text-gray-600">{paper.summary}</p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-400">
                      준비중
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="mt-8 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">자료 요청</h2>
            <p className="text-gray-600">
              필요한 연구자료가 있으시면 요청해 주세요. 확보 가능한 자료를 추가하겠습니다.
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}
