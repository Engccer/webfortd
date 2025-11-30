import { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, FileText, Scale, BarChart3, Lightbulb } from "lucide-react"
import { Breadcrumb } from "@/components/layout/Breadcrumb"

export const metadata: Metadata = {
  title: "연구·법령·통계",
  description: "장애인교원 관련 연구자료, 법령, 통계, 정책제안을 제공합니다.",
}

const sections = [
  {
    title: "연구자료",
    description: "장애인교원 관련 학술 연구 및 보고서를 확인하세요.",
    href: "/resources/research",
    icon: <FileText className="h-8 w-8" />,
  },
  {
    title: "법령 및 지침",
    description: "관련 법률, 시행령, 교육청 지침을 안내합니다.",
    href: "/resources/law",
    icon: <Scale className="h-8 w-8" />,
  },
  {
    title: "현황 통계",
    description: "장애인교원 현황 및 지원 실적 통계입니다.",
    href: "/resources/statistics",
    icon: <BarChart3 className="h-8 w-8" />,
  },
  {
    title: "정책 제안",
    description: "장애인교원 지원 정책 개선 제안을 확인하세요.",
    href: "/resources/policy",
    icon: <Lightbulb className="h-8 w-8" />,
  },
]

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">연구·법령·통계</h1>
        <p className="mt-2 text-lg text-gray-600">
          장애인교원 관련 자료를 한곳에서 확인하세요.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
    </div>
  )
}
