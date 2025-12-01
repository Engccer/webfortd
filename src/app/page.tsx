import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              장애인교원의 교육활동을 보호하고
              <br />
              <span className="text-blue-600">교육에 전념할 수 있는 여건</span>을
              마련합니다
            </h1>
            <p className="mt-6 text-lg text-gray-600">
              장애인교원이 필요한 지원 정보를 한곳에서 쉽고 빠르게 확인할 수
              있습니다. 장애유형별 맞춤형 안내와 지역사회 연계 정보를 제공합니다.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                지원제도 안내
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                플랫폼 소개
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* About */}
            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                플랫폼 소개
              </h2>
              <p className="mb-4 text-gray-600">
                이 웹사이트는 장애인교원이 교육현장에서 필요한 지원 정보를 쉽게
                찾을 수 있도록 구축되었습니다. 장애유형별 맞춤형 안내와 지역사회
                연계 정보를 제공합니다.
              </p>
              <Link
                href="/about/purpose"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                자세히 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Partners */}
            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <h2 className="mb-4 text-xl font-bold text-gray-900">협력기관</h2>
              <p className="mb-4 text-gray-600">
                교육부와 17개 시도교육청이 협력하여 장애인교원의 교육활동을
                지원합니다.
              </p>
              <Link
                href="/about/partners"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                협력기관 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
