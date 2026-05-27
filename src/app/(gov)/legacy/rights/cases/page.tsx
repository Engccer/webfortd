import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "사례 모음",
  description: "차별 및 권리침해 사례와 구제 결과입니다.",
}

const cases = [
  {
    id: 1,
    title: "보조공학기기 지원 거부 사례",
    category: "편의제공 거부",
    result: "권리 구제",
    summary:
      "시각장애 교원이 화면낭독 소프트웨어 지원을 요청했으나 예산 부족을 이유로 거부당한 사례",
    detail:
      "국가인권위원회에 진정하여 '정당한 편의제공 거부'로 인정받아, 교육청에서 해당 소프트웨어를 지원받게 되었습니다.",
    lesson:
      "예산 부족은 정당한 편의제공 거부 사유가 될 수 없으며, 필요한 지원은 예산을 확보하여 제공해야 합니다.",
  },
  {
    id: 2,
    title: "승진 심사 시 장애 고려 미흡 사례",
    category: "인사 차별",
    result: "권리 구제",
    summary:
      "지체장애 교원이 승진 심사 시 출장 실적이 적다는 이유로 불이익을 받은 사례",
    detail:
      "출장 수행의 어려움이 장애로 인한 것임을 주장하여, 합리적 조정을 통해 다른 업무 실적으로 대체 평가받게 되었습니다.",
    lesson:
      "장애로 인해 특정 업무 수행이 어려운 경우, 대체 평가 방법을 마련해야 합니다.",
  },
  {
    id: 3,
    title: "근로지원인 배치 거부 사례",
    category: "편의제공 거부",
    result: "일부 구제",
    summary:
      "뇌병변장애 교원이 수업 보조를 위한 근로지원인 배치를 요청했으나 거부당한 사례",
    detail:
      "노동위원회에 구제 신청하여 부분적으로 인정받아, 주 일정 시간의 근로지원인 지원을 받게 되었습니다.",
    lesson:
      "근로지원인 배치는 장애인고용법에 따른 지원 제도이며, 정당한 사유 없이 거부할 수 없습니다.",
  },
  {
    id: 4,
    title: "장애 정보 무단 공개 사례",
    category: "개인정보 침해",
    result: "권리 구제",
    summary:
      "청각장애 교원의 장애 정보가 본인 동의 없이 학부모에게 공개된 사례",
    detail:
      "국가인권위원회에 진정하여 개인정보 침해로 인정받아, 관련자 징계 및 재발방지 대책 수립이 이루어졌습니다.",
    lesson:
      "장애인교원의 장애 정보는 반드시 본인 동의를 받아야 하며, 무단 공개는 개인정보 침해에 해당합니다.",
  },
]

const resultColors: Record<string, string> = {
  "권리 구제": "bg-green-100 text-green-700",
  "일부 구제": "bg-yellow-100 text-yellow-700",
  기각: "bg-red-100 text-red-700",
}

const rightsNav = mainNavigation.find((item) => item.href === "/rights")

export default function CasesPage() {
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">사례 모음</h1>
          <p className="mb-8 text-lg text-gray-600">
            차별 및 권리침해 사례와 구제 결과를 확인하세요.
          </p>

          <div className="mb-6 text-sm text-gray-500">
            * 사례는 실제 사례를 바탕으로 재구성한 것이며, 개인정보 보호를 위해 일부 내용이 변경되었습니다.
          </div>

          <div className="space-y-6">
            {cases.map((caseItem) => (
              <article
                key={caseItem.id}
                className="rounded-lg border border-gray-200 p-6"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {caseItem.category}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${resultColors[caseItem.result]}`}
                  >
                    {caseItem.result}
                  </span>
                </div>
                <h2 className="mb-3 text-xl font-semibold text-gray-900">
                  {caseItem.title}
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-1 text-sm font-medium text-gray-700">사례 개요</h3>
                    <p className="text-gray-600">{caseItem.summary}</p>
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-medium text-gray-700">처리 경과</h3>
                    <p className="text-gray-600">{caseItem.detail}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-1 text-sm font-medium text-gray-700">시사점</h3>
                    <p className="text-gray-600">{caseItem.lesson}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded-lg bg-blue-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">사례 제보</h2>
            <p className="text-gray-600">
              다른 교원들에게 도움이 될 수 있는 사례가 있으시면 제보해 주세요.
              개인정보는 보호됩니다.
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
