import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import { ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "시도별 제도",
  description: "17개 시도교육청별 지원제도와 담당부서를 안내합니다.",
}

const regions = [
  { name: "서울특별시교육청", url: "https://www.sen.go.kr/", dept: "교원인사과" },
  { name: "부산광역시교육청", url: "https://www.pen.go.kr/", dept: "교원인사과" },
  { name: "대구광역시교육청", url: "https://www.dge.go.kr/", dept: "교원정책과" },
  { name: "인천광역시교육청", url: "https://www.ice.go.kr/", dept: "교원인사과" },
  { name: "광주광역시교육청", url: "https://www.gen.go.kr/", dept: "교원인사과" },
  { name: "대전광역시교육청", url: "https://www.dje.go.kr/", dept: "교원정책과" },
  { name: "울산광역시교육청", url: "https://use.go.kr/", dept: "교원인사과" },
  { name: "세종특별자치시교육청", url: "https://www.sje.go.kr/", dept: "교원정책과" },
  { name: "경기도교육청", url: "https://www.goe.go.kr/", dept: "교원인사과" },
  { name: "강원특별자치도교육청", url: "https://www.gwe.go.kr/", dept: "교원인사과" },
  { name: "충청북도교육청", url: "https://www.cbe.go.kr/", dept: "교원인사과" },
  { name: "충청남도교육청", url: "http://www.cne.go.kr/", dept: "교원정책과" },
  { name: "전북특별자치도교육청", url: "https://www.jbe.go.kr/", dept: "교원인사과" },
  { name: "전라남도교육청", url: "https://www.jne.go.kr/", dept: "교원인사과" },
  { name: "경상북도교육청", url: "https://www.gbe.kr/", dept: "교원정책과" },
  { name: "경상남도교육청", url: "https://www.gne.go.kr/", dept: "교원인사과" },
  { name: "제주특별자치도교육청", url: "https://www.jje.go.kr/", dept: "교원인사과" },
]

const supportNav = mainNavigation.find((item) => item.href === "/support")

export default function RegionPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {supportNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={supportNav.children} title="지원제도 안내" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">시도별 제도</h1>
          <p className="mb-8 text-lg text-gray-600">
            17개 시도교육청별 지원제도와 담당부서 정보입니다.
          </p>

          <div className="mb-8 rounded-lg bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              각 시도교육청의 장애인교원 지원 담당부서로 문의하시면 상세한 안내를 받으실 수 있습니다.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full rounded-lg border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    시도교육청
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    담당부서
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    홈페이지
                  </th>
                </tr>
              </thead>
              <tbody>
                {regions.map((region, index) => (
                  <tr
                    key={region.name}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {region.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{region.dept}</td>
                    <td className="px-4 py-3">
                      <a
                        href={region.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        바로가기
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              교육부 문의처
            </h2>
            <div className="rounded-lg border border-gray-200 p-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-gray-900">담당부서</dt>
                  <dd className="text-gray-600">교육부 교원정책과</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-900">홈페이지</dt>
                  <dd>
                    <a
                      href="https://www.moe.go.kr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      www.moe.go.kr
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </article>
      </div>
    </div>
  )
}
