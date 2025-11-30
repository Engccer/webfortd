import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "현황 통계",
  description: "장애인교원 현황 및 지원 실적 통계입니다.",
}

const statistics = {
  overview: [
    { label: "전국 장애인교원 수", value: "약 2,500명", note: "2024년 기준" },
    { label: "장애인교원 비율", value: "약 0.5%", note: "전체 교원 대비" },
    { label: "편의제공 수혜율", value: "약 60%", note: "편의제공 신청 대비" },
  ],
  byDisability: [
    { type: "지체장애", count: 1050, percentage: 42 },
    { type: "시각장애", count: 375, percentage: 15 },
    { type: "청각장애", count: 350, percentage: 14 },
    { type: "뇌병변장애", count: 175, percentage: 7 },
    { type: "내부장애", count: 300, percentage: 12 },
    { type: "기타", count: 250, percentage: 10 },
  ],
  bySchool: [
    { type: "초등학교", count: 875, percentage: 35 },
    { type: "중학교", count: 625, percentage: 25 },
    { type: "고등학교", count: 750, percentage: 30 },
    { type: "특수학교", count: 250, percentage: 10 },
  ],
}

const resourcesNav = mainNavigation.find((item) => item.href === "/resources")

export default function StatisticsPage() {
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">현황 통계</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원 현황 및 지원 실적 통계입니다.
          </p>

          <div className="mb-4 text-sm text-gray-500">
            * 본 통계는 예시 데이터이며, 실제 통계는 교육부 공식 자료를 확인해 주세요.
          </div>

          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">전체 현황</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {statistics.overview.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-gray-200 p-6 text-center"
                >
                  <div className="text-3xl font-bold text-blue-600">{stat.value}</div>
                  <div className="mt-1 font-medium text-gray-900">{stat.label}</div>
                  <div className="text-sm text-gray-500">{stat.note}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              장애유형별 분포
            </h2>
            <div className="rounded-lg border border-gray-200 p-6">
              <div className="space-y-4">
                {statistics.byDisability.map((item) => (
                  <div key={item.type}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{item.type}</span>
                      <span className="text-gray-600">
                        {item.count}명 ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">학교급별 분포</h2>
            <div className="rounded-lg border border-gray-200 p-6">
              <div className="space-y-4">
                {statistics.bySchool.map((item) => (
                  <div key={item.type}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{item.type}</span>
                      <span className="text-gray-600">
                        {item.count}명 ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-gray-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">통계 자료 출처</h2>
            <ul className="list-inside list-disc text-gray-600">
              <li>교육부 교육통계연보</li>
              <li>한국교육개발원 교육통계서비스</li>
              <li>국가통계포털 (KOSIS)</li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  )
}
