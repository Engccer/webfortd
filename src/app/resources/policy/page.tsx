import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "정책 제안",
  description: "장애인교원 지원 정책 개선 제안입니다.",
}

const proposals = [
  {
    id: 1,
    title: "장애인교원 편의제공 예산 확대",
    category: "예산",
    status: "검토중",
    summary:
      "현재 장애인교원 편의제공 예산이 수요 대비 부족하여, 필요한 지원을 받지 못하는 사례가 발생하고 있습니다.",
    proposal:
      "시도교육청별 장애인교원 편의제공 예산을 현행 대비 50% 이상 증액하고, 긴급 지원을 위한 예비비를 별도 확보할 것을 제안합니다.",
  },
  {
    id: 2,
    title: "보조공학기기 지원 품목 확대",
    category: "제도개선",
    status: "추진중",
    summary:
      "현재 지원 가능한 보조공학기기 품목이 제한적이어서 새로운 기술 발전에 대응하지 못하고 있습니다.",
    proposal:
      "AI 기반 보조기술, 최신 청각보조기기 등 신기술 제품을 지원 품목에 추가하고, 품목 목록을 정기적으로 업데이트할 것을 제안합니다.",
  },
  {
    id: 3,
    title: "장애인교원 인사관리 가이드라인 강화",
    category: "인사제도",
    status: "검토중",
    summary:
      "장애인교원의 보직 배치, 승진, 전보 시 장애 특성을 고려하지 않는 경우가 있어 어려움을 겪고 있습니다.",
    proposal:
      "장애인교원 인사관리 시 장애 특성을 의무적으로 고려하도록 인사관리 규정을 개정하고, 당사자와의 사전 협의 절차를 의무화할 것을 제안합니다.",
  },
  {
    id: 4,
    title: "장애인교원 전담 지원체계 구축",
    category: "조직",
    status: "제안",
    summary:
      "현재 장애인교원 지원 업무가 여러 부서에 분산되어 있어 통합적인 지원이 어렵습니다.",
    proposal:
      "시도교육청별로 장애인교원 지원 전담 부서 또는 담당자를 지정하고, 원스톱 상담 및 지원 체계를 구축할 것을 제안합니다.",
  },
]

const statusColors: Record<string, string> = {
  제안: "bg-gray-100 text-gray-700",
  검토중: "bg-yellow-100 text-yellow-700",
  추진중: "bg-blue-100 text-blue-700",
  완료: "bg-green-100 text-green-700",
}

const resourcesNav = mainNavigation.find((item) => item.href === "/resources")

export default function PolicyPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {resourcesNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={resourcesNav.children} title="연구·법령·통계" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">정책 제안</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원 지원 정책 개선을 위한 제안들입니다.
          </p>

          <div className="space-y-6">
            {proposals.map((proposal) => (
              <article
                key={proposal.id}
                className="rounded-lg border border-gray-200 p-6"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {proposal.category}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[proposal.status]}`}
                  >
                    {proposal.status}
                  </span>
                </div>
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                  {proposal.title}
                </h2>
                <div className="mb-4">
                  <h3 className="mb-1 text-sm font-medium text-gray-700">현황 및 문제점</h3>
                  <p className="text-gray-600">{proposal.summary}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium text-gray-700">제안 내용</h3>
                  <p className="text-gray-600">{proposal.proposal}</p>
                </div>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded-lg bg-blue-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">정책 제안하기</h2>
            <p className="mb-4 text-gray-600">
              장애인교원 지원 정책에 대한 아이디어가 있으시면 제안해 주세요.
            </p>
            <a
              href="/participate/ask"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              제안하기
            </a>
          </section>
        </article>
      </div>
    </div>
  )
}
