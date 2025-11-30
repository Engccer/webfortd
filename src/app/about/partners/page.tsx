import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "연혁 및 협력기관",
  description: "장애인교원 교육전념 여건 지원 사업의 연혁과 협력기관을 소개합니다.",
}

const partners = [
  { name: "교육부", url: "https://www.moe.go.kr/" },
  { name: "서울특별시교육청", url: "https://www.sen.go.kr/" },
  { name: "부산광역시교육청", url: "https://www.pen.go.kr/" },
  { name: "대구광역시교육청", url: "https://www.dge.go.kr/" },
  { name: "인천광역시교육청", url: "https://www.ice.go.kr/" },
  { name: "광주광역시교육청", url: "https://www.gen.go.kr/" },
  { name: "대전광역시교육청", url: "https://www.dje.go.kr/" },
  { name: "울산광역시교육청", url: "https://use.go.kr/" },
  { name: "세종특별자치시교육청", url: "https://www.sje.go.kr/" },
  { name: "경기도교육청", url: "https://www.goe.go.kr/" },
  { name: "강원특별자치도교육청", url: "https://www.gwe.go.kr/" },
  { name: "충청북도교육청", url: "https://www.cbe.go.kr/" },
  { name: "충청남도교육청", url: "http://www.cne.go.kr/" },
  { name: "전북특별자치도교육청", url: "https://www.jbe.go.kr/" },
  { name: "전라남도교육청", url: "https://www.jne.go.kr/" },
  { name: "경상북도교육청", url: "https://www.gbe.kr/" },
  { name: "경상남도교육청", url: "https://www.gne.go.kr/" },
  { name: "제주특별자치도교육청", url: "https://www.jje.go.kr/" },
]

const aboutNav = mainNavigation.find((item) => item.href === "/about")

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {aboutNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={aboutNav.children} title="플랫폼 소개" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">연혁 및 협력기관</h1>

          <section className="mb-12">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">연혁</h2>
            <div className="relative border-l-2 border-blue-200 pl-6">
              <div className="mb-6">
                <div className="absolute -left-2 h-4 w-4 rounded-full bg-blue-600"></div>
                <time className="text-sm font-medium text-blue-600">2025년</time>
                <h3 className="mt-1 font-semibold text-gray-900">플랫폼 구축</h3>
                <p className="text-gray-600">장애인교원 교육전념 여건 지원 플랫폼 구축 시작</p>
              </div>
              <div className="mb-6">
                <div className="absolute -left-2 h-4 w-4 rounded-full bg-blue-400"></div>
                <time className="text-sm font-medium text-blue-600">2024년</time>
                <h3 className="mt-1 font-semibold text-gray-900">사업 기획</h3>
                <p className="text-gray-600">교육부 주관 장애인교원 지원 사업 기획</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">협력기관</h2>
            <p className="mb-6 text-gray-600">
              교육부와 17개 시도교육청이 협력하여 장애인교원의 교육활동을 지원합니다.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map((partner) => (
                <a
                  key={partner.name}
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gray-200 p-4 text-center transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="font-medium text-gray-900">{partner.name}</span>
                </a>
              ))}
            </div>
          </section>
        </article>
      </div>
    </div>
  )
}
