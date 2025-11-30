import { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Shield, FileSearch, Route, AlertTriangle } from "lucide-react"
import { Breadcrumb } from "@/components/layout/Breadcrumb"

export const metadata: Metadata = {
  title: "권리 구제",
  description: "장애인교원의 권리와 구제 절차를 안내합니다.",
}

const sections = [
  {
    title: "권리 및 의무",
    description: "장애인교원의 법적 권리와 학교·교육청의 의무를 안내합니다.",
    href: "/rights/entitlements",
    icon: <Shield className="h-8 w-8" />,
  },
  {
    title: "사례 모음",
    description: "차별 및 권리침해 사례와 구제 결과를 확인하세요.",
    href: "/rights/cases",
    icon: <FileSearch className="h-8 w-8" />,
  },
  {
    title: "구제 절차",
    description: "권리 침해 시 구제받을 수 있는 절차를 안내합니다.",
    href: "/rights/procedure",
    icon: <Route className="h-8 w-8" />,
  },
  {
    title: "침해 신고",
    description: "권리 침해 사례를 신고하고 상담받을 수 있습니다.",
    href: "/rights/report",
    icon: <AlertTriangle className="h-8 w-8" />,
  },
]

export default function RightsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">권리 구제</h1>
        <p className="mt-2 text-lg text-gray-600">
          장애인교원의 권리와 구제 절차를 안내합니다.
        </p>
      </div>

      <div className="mb-8 rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
        <p className="text-blue-800">
          장애인차별금지법에 따라 장애인교원은 정당한 편의제공을 받을 권리가 있으며,
          장애를 이유로 한 차별은 금지됩니다.
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

      <section className="mt-12 rounded-xl bg-gray-50 p-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900">긴급 상담 안내</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg bg-white p-4">
            <h3 className="mb-2 font-semibold text-gray-900">국가인권위원회</h3>
            <p className="text-gray-600">전화: 1331 (무료)</p>
            <p className="text-sm text-gray-500">평일 09:00~18:00</p>
          </div>
          <div className="rounded-lg bg-white p-4">
            <h3 className="mb-2 font-semibold text-gray-900">장애인권익옹호기관</h3>
            <p className="text-gray-600">전화: 1644-8295</p>
            <p className="text-sm text-gray-500">24시간 운영</p>
          </div>
        </div>
      </section>
    </div>
  )
}
