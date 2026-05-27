import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "권리 및 의무",
  description: "장애인교원의 법적 권리와 학교·교육청의 의무를 안내합니다.",
}

const rights = [
  {
    title: "정당한 편의제공 요청권",
    description:
      "장애인교원은 업무 수행에 필요한 정당한 편의제공을 요청할 권리가 있습니다.",
    legal: "장애인차별금지법 제11조",
    examples: [
      "보조공학기기 지원 요청",
      "근로지원인 배치 요청",
      "근무환경 조정 요청",
      "편의시설 설치 요청",
    ],
  },
  {
    title: "차별받지 않을 권리",
    description:
      "장애를 이유로 한 모든 형태의 차별로부터 보호받을 권리가 있습니다.",
    legal: "장애인차별금지법 제4조",
    examples: [
      "채용, 승진, 전보 시 차별 금지",
      "보직 배치 시 불합리한 차별 금지",
      "교육, 연수 참여 기회 보장",
      "해고 또는 불이익 처분 금지",
    ],
  },
  {
    title: "개인정보 보호권",
    description:
      "장애 관련 정보는 본인 동의 없이 공개되거나 활용될 수 없습니다.",
    legal: "장애인차별금지법 제32조",
    examples: [
      "장애 정보 비밀유지",
      "본인 동의 없는 정보 공개 금지",
      "장애 정보 목적 외 사용 금지",
    ],
  },
  {
    title: "구제 청구권",
    description:
      "권리 침해 시 국가인권위원회, 법원 등에 구제를 청구할 권리가 있습니다.",
    legal: "장애인차별금지법 제38조",
    examples: [
      "국가인권위원회 진정",
      "법원에 손해배상 청구",
      "행정심판 청구",
      "노동위원회 구제 신청",
    ],
  },
]

const duties = [
  {
    title: "정당한 편의제공 의무",
    responsible: "학교, 교육청",
    description:
      "장애인교원이 요청한 정당한 편의를 제공해야 합니다. 정당한 사유 없이 거부할 수 없습니다.",
  },
  {
    title: "차별 금지 의무",
    responsible: "학교, 교육청, 동료교원",
    description:
      "장애를 이유로 한 직접차별, 간접차별, 괴롭힘 등 모든 형태의 차별이 금지됩니다.",
  },
  {
    title: "비밀유지 의무",
    responsible: "학교, 교육청",
    description:
      "장애인교원의 장애 관련 정보를 보호하고, 본인 동의 없이 공개하지 않아야 합니다.",
  },
  {
    title: "합리적 조정 의무",
    responsible: "학교, 교육청",
    description:
      "장애인교원이 비장애인과 동등하게 업무를 수행할 수 있도록 합리적 조정을 해야 합니다.",
  },
]

const rightsNav = mainNavigation.find((item) => item.href === "/rights")

export default function EntitlementsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {rightsNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={rightsNav.children} title="권리 구제" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">권리 및 의무</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원의 법적 권리와 학교·교육청의 의무를 안내합니다.
          </p>

          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-semibold text-gray-900">
              장애인교원의 권리
            </h2>
            <div className="space-y-6">
              {rights.map((right) => (
                <div
                  key={right.title}
                  className="rounded-lg border border-gray-200 p-6"
                >
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {right.title}
                  </h3>
                  <p className="mb-3 text-gray-600">{right.description}</p>
                  <p className="mb-3 text-sm text-blue-600">근거: {right.legal}</p>
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-gray-700">예시</h4>
                    <ul className="list-inside list-disc text-sm text-gray-600">
                      {right.examples.map((example) => (
                        <li key={example}>{example}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-6 text-2xl font-semibold text-gray-900">
              학교·교육청의 의무
            </h2>
            <div className="space-y-4">
              {duties.map((duty) => (
                <div
                  key={duty.title}
                  className="rounded-lg border border-gray-200 p-6"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {duty.title}
                    </h3>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {duty.responsible}
                    </span>
                  </div>
                  <p className="text-gray-600">{duty.description}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>
    </div>
  )
}
