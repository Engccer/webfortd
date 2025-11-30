import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "인식 개선",
  description: "장애인교원에 대한 인식 개선 콘텐츠입니다.",
}

const myths = [
  {
    myth: "장애인교원은 수업을 제대로 할 수 없다",
    fact: "보조공학기기와 합리적 편의제공을 통해 장애인교원도 충분히 효과적으로 수업을 진행할 수 있습니다. 오히려 다양성에 대한 이해를 학생들에게 자연스럽게 가르칠 수 있는 장점이 있습니다.",
  },
  {
    myth: "장애인교원에게 편의를 제공하면 다른 교원에게 불공평하다",
    fact: "편의제공은 장애인이 비장애인과 동등한 조건에서 업무를 수행할 수 있도록 하는 것입니다. 이는 특혜가 아니라 기회의 평등을 위한 조치입니다.",
  },
  {
    myth: "장애인교원은 학생들을 통제하기 어렵다",
    fact: "교실 운영 능력은 장애 유무와 관계없이 개인의 역량에 따릅니다. 많은 장애인교원들이 뛰어난 교실 운영 능력을 보여주고 있습니다.",
  },
  {
    myth: "장애인교원을 위한 지원은 비용이 많이 든다",
    fact: "많은 편의제공은 상대적으로 적은 비용으로 가능합니다. 또한 이러한 투자는 우수한 교원 인력을 확보하고 다양성 있는 교육환경을 조성하는 데 기여합니다.",
  },
]

const tips = [
  {
    title: "함께 일하는 동료로서",
    items: [
      "장애를 먼저 보지 말고 동료 교원으로 대해주세요",
      "도움이 필요한지 먼저 물어보고, 요청하면 도와주세요",
      "회의나 행사 시 접근성을 미리 고려해주세요",
      "장애 관련 정보를 함부로 다른 사람에게 이야기하지 마세요",
    ],
  },
  {
    title: "학교 관리자로서",
    items: [
      "편의제공 요청에 적극적으로 응해주세요",
      "보직 배치 시 장애 특성을 고려해주세요",
      "장애인교원이 소외되지 않도록 배려해주세요",
      "인식 개선 교육을 정기적으로 실시해주세요",
    ],
  },
  {
    title: "학부모로서",
    items: [
      "장애인 교원도 훌륭한 교육자임을 이해해주세요",
      "자녀에게 다양성 존중을 가르쳐주세요",
      "장애에 대한 편견 없이 열린 마음으로 대해주세요",
      "필요한 경우 학교와 협력하여 지원해주세요",
    ],
  },
]

const storiesNav = mainNavigation.find((item) => item.href === "/stories")

export default function AwarenessPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {storiesNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={storiesNav.children} title="현장 사례" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">인식 개선</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원에 대한 올바른 이해를 돕는 콘텐츠입니다.
          </p>

          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-semibold text-gray-900">
              오해와 진실
            </h2>
            <div className="space-y-6">
              {myths.map((item, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-6">
                  <div className="mb-3">
                    <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                      오해
                    </span>
                    <p className="mt-2 font-medium text-gray-900">{item.myth}</p>
                  </div>
                  <div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                      진실
                    </span>
                    <p className="mt-2 text-gray-600">{item.fact}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-6 text-2xl font-semibold text-gray-900">
              함께하는 방법
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {tips.map((tip) => (
                <div
                  key={tip.title}
                  className="rounded-lg border border-gray-200 p-6"
                >
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    {tip.title}
                  </h3>
                  <ul className="list-inside list-disc space-y-2 text-sm text-gray-600">
                    {tip.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>
    </div>
  )
}
