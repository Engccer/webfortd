import { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Accessibility, MapPin, Layers } from "lucide-react"
import { Breadcrumb } from "@/components/layout/Breadcrumb"

export const metadata: Metadata = {
  title: "지원제도 안내",
  description: "장애유형별, 지원영역별, 시도별 지원제도를 안내합니다.",
}

const sections = [
  {
    title: "지원영역별 제도",
    description: "보조공학기기, 근로지원인, 편의시설 등 지원영역별로 제도를 안내합니다.",
    href: "/support/area",
    icon: <Layers className="h-8 w-8" />,
  },
  {
    title: "장애유형별 제도",
    description: "시각, 청각, 지체 등 장애유형에 맞는 지원제도를 안내합니다.",
    href: "/support/disability",
    icon: <Accessibility className="h-8 w-8" />,
  },
  {
    title: "시도별 제도",
    description: "17개 시도교육청별 지원제도와 담당부서를 안내합니다.",
    href: "/support/region",
    icon: <MapPin className="h-8 w-8" />,
  },
]

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">지원제도 안내</h1>
        <p className="mt-2 text-lg text-gray-600">
          장애인교원을 위한 다양한 지원제도를 확인하세요.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg"
          >
            <div className="mb-4 text-blue-600">{section.icon}</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
              {section.title}
            </h2>
            <p className="mb-4 text-gray-600">{section.description}</p>
            <span className="inline-flex items-center gap-1 text-blue-600">
              자세히 보기 <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-12 rounded-xl bg-blue-50 p-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900">지원제도 이용 안내</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold text-gray-900">신청 절차</h3>
            <ol className="list-inside list-decimal space-y-1 text-gray-600">
              <li>필요한 지원 유형 확인</li>
              <li>소속 학교 또는 교육청에 신청</li>
              <li>심사 및 승인</li>
              <li>지원 제공</li>
            </ol>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-gray-900">문의처</h3>
            <p className="text-gray-600">
              지원제도에 대한 자세한 문의는 소속 시도교육청 담당부서로 연락해 주세요.
            </p>
            <Link
              href="/support/region"
              className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              시도별 담당부서 확인 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
