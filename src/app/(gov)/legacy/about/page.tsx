import { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumb } from "@/components/layout/Breadcrumb"

export const metadata: Metadata = {
  title: "플랫폼 소개",
  description: "장애인교원 교육전념 여건 지원 플랫폼을 소개합니다.",
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">플랫폼 소개</h1>
        <p className="mt-2 text-lg text-gray-600">
          장애인교원 교육전념 여건 지원 플랫폼을 소개합니다.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/about/purpose"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg"
        >
          <h2 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
            소개 및 이용안내
          </h2>
          <p className="mb-4 text-gray-600">
            플랫폼의 개설 목적과 이용 방법을 안내합니다.
          </p>
          <span className="inline-flex items-center gap-1 text-blue-600">
            자세히 보기 <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link
          href="/about/partners"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg"
        >
          <h2 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
            연혁 및 협력기관
          </h2>
          <p className="mb-4 text-gray-600">
            플랫폼의 연혁과 협력기관을 소개합니다.
          </p>
          <span className="inline-flex items-center gap-1 text-blue-600">
            자세히 보기 <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  )
}
