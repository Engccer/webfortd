import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import { ArrowDown, ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "구제 절차",
  description: "권리 침해 시 구제받을 수 있는 절차를 안내합니다.",
}

const procedures = [
  {
    name: "국가인권위원회 진정",
    description: "장애차별 관련 가장 일반적인 구제 절차입니다.",
    steps: [
      "진정서 작성 (온라인, 우편, 방문)",
      "조사 개시 및 사실관계 확인",
      "조정 또는 심의",
      "권고 결정 (시정권고, 고발 등)",
    ],
    contact: {
      name: "국가인권위원회",
      phone: "1331",
      url: "https://www.humanrights.go.kr",
    },
    pros: ["무료", "비교적 신속한 처리", "전문 조사"],
    cons: ["권고에 강제력 없음"],
  },
  {
    name: "법원 소송",
    description: "손해배상 또는 차별행위 중지 등을 청구할 수 있습니다.",
    steps: [
      "소장 작성 및 제출",
      "재판 진행",
      "판결 선고",
      "판결 이행 (강제집행)",
    ],
    contact: {
      name: "대한법률구조공단",
      phone: "132",
      url: "https://www.klac.or.kr",
    },
    pros: ["법적 구속력 있는 판결"],
    cons: ["비용 발생", "시간 소요"],
  },
  {
    name: "노동위원회 구제 신청",
    description: "부당해고, 부당노동행위 등에 대한 구제를 신청합니다.",
    steps: [
      "구제 신청서 제출",
      "심문 및 조사",
      "판정",
      "이행명령 (불이행시 과태료)",
    ],
    contact: {
      name: "중앙노동위원회",
      phone: "1644-8295",
      url: "https://www.nlrc.go.kr",
    },
    pros: ["신속한 처리", "이행명령 제도"],
    cons: ["노동관계에 한정"],
  },
  {
    name: "행정심판",
    description: "교육청 등 행정기관의 처분에 대해 불복하는 절차입니다.",
    steps: [
      "심판청구서 제출",
      "심리",
      "재결",
    ],
    contact: {
      name: "중앙행정심판위원회",
      phone: "110",
      url: "https://www.simpan.go.kr",
    },
    pros: ["무료", "행정처분에 대한 직접적 불복"],
    cons: ["행정처분에 한정"],
  },
]

const rightsNav = mainNavigation.find((item) => item.href === "/rights")

export default function ProcedurePage() {
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">구제 절차</h1>
          <p className="mb-8 text-lg text-gray-600">
            권리 침해 시 구제받을 수 있는 다양한 절차를 안내합니다.
          </p>

          <div className="space-y-8">
            {procedures.map((procedure) => (
              <section
                key={procedure.name}
                className="rounded-lg border border-gray-200 p-6"
              >
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                  {procedure.name}
                </h2>
                <p className="mb-4 text-gray-600">{procedure.description}</p>

                <div className="mb-4">
                  <h3 className="mb-2 font-medium text-gray-900">진행 절차</h3>
                  <div className="flex flex-col gap-2">
                    {procedure.steps.map((step, index) => (
                      <div key={step} className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                          {index + 1}
                        </span>
                        <span className="text-gray-600">{step}</span>
                        {index < procedure.steps.length - 1 && (
                          <ArrowDown className="ml-2 h-4 w-4 text-gray-300" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 font-medium text-gray-900">장점</h3>
                    <ul className="list-inside list-disc text-sm text-gray-600">
                      {procedure.pros.map((pro) => (
                        <li key={pro}>{pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-gray-900">고려사항</h3>
                    <ul className="list-inside list-disc text-sm text-gray-600">
                      {procedure.cons.map((con) => (
                        <li key={con}>{con}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 font-medium text-gray-900">문의처</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span>{procedure.contact.name}</span>
                    <span className="text-blue-600">{procedure.contact.phone}</span>
                    <a
                      href={procedure.contact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      홈페이지
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-lg bg-blue-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">전문 상담 안내</h2>
            <p className="text-gray-600">
              어떤 절차를 선택해야 할지 모르시겠다면, 먼저 상담을 받아보세요.
              국가인권위원회(1331) 또는 대한법률구조공단(132)에서 무료 상담을 받으실 수 있습니다.
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
