import { Metadata } from "next"
import Link from "next/link"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import { getAllDocs } from "@/lib/mdx"
import { ExternalLink, FileText, Calendar } from "lucide-react"

export const metadata: Metadata = {
  title: "법령 및 지침",
  description: "장애인교원 관련 법률, 시행령, 교육청 지침입니다.",
}

const laws = [
  {
    category: "법률",
    items: [
      {
        name: "장애인차별금지 및 권리구제 등에 관한 법률",
        shortName: "장애인차별금지법",
        url: "https://www.law.go.kr/법령/장애인차별금지및권리구제등에관한법률",
        key: "제11조(정당한 편의제공 의무)",
      },
      {
        name: "장애인복지법",
        shortName: "장애인복지법",
        url: "https://www.law.go.kr/법령/장애인복지법",
        key: "제38조(장애인보조기구), 제81조(직장 내 장애인 편의제공)",
      },
      {
        name: "장애인고용촉진 및 직업재활법",
        shortName: "장애인고용법",
        url: "https://www.law.go.kr/법령/장애인고용촉진및직업재활법",
        key: "제21조(장애인 근로자 지원)",
      },
      {
        name: "교육기본법",
        shortName: "교육기본법",
        url: "https://www.law.go.kr/법령/교육기본법",
        key: "제4조(교육의 기회균등)",
      },
    ],
  },
  {
    category: "시행령 및 규칙",
    items: [
      {
        name: "장애인차별금지법 시행령",
        shortName: "시행령",
        url: "https://www.law.go.kr/법령/장애인차별금지및권리구제등에관한법률시행령",
        key: "정당한 편의의 내용 및 범위",
      },
      {
        name: "공무원임용시험령",
        shortName: "시험령",
        url: "https://www.law.go.kr/법령/공무원임용시험령",
        key: "장애인 응시 편의 제공",
      },
    ],
  },
  {
    category: "교육부 지침",
    items: [
      {
        name: "장애인 공무원 인사관리 지침",
        shortName: "인사관리 지침",
        url: "#",
        key: "장애인 공무원 배치, 승진, 전보 등",
      },
      {
        name: "교원 편의제공 매뉴얼",
        shortName: "편의제공 매뉴얼",
        url: "#",
        key: "장애유형별 편의제공 방법",
      },
    ],
  },
]

const resourcesNav = mainNavigation.find((item) => item.href === "/resources")

export default async function LawPage() {
  // MDX 문서 목록 가져오기
  const docs = await getAllDocs("resources", "law")

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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">법령 및 지침</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원 관련 법률, 시행령, 교육청 지침을 안내합니다.
          </p>

          {/* 내부 문서 (MDX) */}
          {docs.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                분석 자료 및 협약
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {docs.map((doc) => (
                  <article
                    key={doc.slug}
                    className="rounded-lg border border-gray-200 p-5 transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900">
                          <Link
                            href={`/resources/law/${doc.slug}`}
                            className="hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
                          <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
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

          {/* 외부 법령 링크 */}
          <div className="space-y-8">
            {laws.map((category) => (
              <section key={category.category}>
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  {category.category}
                </h2>
                <div className="space-y-3">
                  {category.items.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-gray-900">{item.name}</h3>
                          <p className="mt-1 text-sm text-gray-600">{item.key}</p>
                        </div>
                        {item.url !== "#" ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            법령 보기
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="shrink-0 text-sm text-gray-400">
                            준비중
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-12 rounded-lg bg-blue-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">법령 해석 문의</h2>
            <p className="text-gray-600">
              법령 해석에 대한 문의는 교육부 또는 소속 시도교육청으로 연락해 주세요.
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
