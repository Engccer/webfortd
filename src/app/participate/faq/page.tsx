import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: "장애인교원 지원에 관해 자주 묻는 질문과 답변입니다.",
}

const faqs = [
  {
    category: "편의제공",
    questions: [
      {
        q: "보조공학기기 지원은 어떻게 신청하나요?",
        a: "소속 학교를 통해 시도교육청에 신청합니다. 신청서와 장애인등록증 사본, 필요성을 증명하는 서류를 제출하면 심사 후 지원 여부가 결정됩니다. 자세한 절차는 소속 시도교육청 담당부서에 문의하세요.",
      },
      {
        q: "근로지원인은 어떤 업무를 도와주나요?",
        a: "근로지원인은 장애인교원의 직무 수행을 보조합니다. 수업 자료 준비, 판서 대필, 이동 보조, 문서 작성 보조, 의사소통 지원(수어통역 등) 등의 업무를 지원받을 수 있습니다.",
      },
      {
        q: "편의시설 설치를 요청할 수 있나요?",
        a: "네, 요청할 수 있습니다. 경사로, 승강기, 장애인 화장실, 높낮이 조절 책상 등 필요한 편의시설 설치를 학교와 교육청에 요청할 수 있습니다. 장애인차별금지법에 따라 정당한 사유 없이 거부할 수 없습니다.",
      },
    ],
  },
  {
    category: "인사관리",
    questions: [
      {
        q: "보직 배치 시 장애를 고려해달라고 요청할 수 있나요?",
        a: "네, 가능합니다. 장애 특성에 맞는 보직 배치를 요청할 수 있으며, 학교와 교육청은 이를 합리적으로 고려해야 합니다. 다만, 본인의 동의 없이 장애를 이유로 특정 보직에서 배제하는 것은 차별에 해당할 수 있습니다.",
      },
      {
        q: "장애로 인해 승진에 불이익을 받으면 어떻게 하나요?",
        a: "장애를 이유로 한 승진 차별은 장애인차별금지법 위반입니다. 불합리한 차별을 받았다면 국가인권위원회에 진정하거나, 행정심판을 청구할 수 있습니다. 구체적인 절차는 '권리 구제' 메뉴를 참조하세요.",
      },
      {
        q: "병가나 휴직을 자유롭게 사용할 수 있나요?",
        a: "장애인교원도 일반 교원과 동일하게 병가와 휴직을 사용할 수 있습니다. 장애 관련 치료를 위한 병가 사용 시 불이익을 받지 않도록 법적으로 보호됩니다.",
      },
    ],
  },
  {
    category: "권리구제",
    questions: [
      {
        q: "차별을 당하면 어디에 신고하나요?",
        a: "국가인권위원회(1331), 장애인권익옹호기관(1644-8295), 고용노동부(1350) 등에 신고할 수 있습니다. 상황에 따라 적합한 기관을 선택하시고, 어디에 신고해야 할지 모르겠다면 먼저 상담을 받아보세요.",
      },
      {
        q: "편의제공을 거부당하면 어떻게 해야 하나요?",
        a: "정당한 사유 없는 편의제공 거부는 장애인차별금지법 위반입니다. 먼저 학교와 교육청에 재요청하고, 해결되지 않으면 국가인권위원회에 진정을 제기할 수 있습니다.",
      },
      {
        q: "신고하면 불이익을 받을까 걱정됩니다.",
        a: "법적으로 진정이나 신고를 이유로 불이익을 주는 것은 금지되어 있습니다. 만약 신고 후 보복 행위가 있다면 이 또한 별도로 신고할 수 있습니다. 비밀 보장도 철저히 됩니다.",
      },
    ],
  },
]

const participateNav = mainNavigation.find((item) => item.href === "/participate")

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {participateNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={participateNav.children} title="참여하기" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">자주 묻는 질문</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원 지원에 관해 자주 묻는 질문과 답변입니다.
          </p>

          {/* 샘플 데이터 안내 */}
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              샘플 데이터: 아래 질문과 답변은 예시입니다.
            </p>
          </div>

          <div className="space-y-8">
            {faqs.map((category) => (
              <section key={category.category}>
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  {category.category}
                </h2>
                <div className="space-y-4">
                  {category.questions.map((item, index) => (
                    <details
                      key={index}
                      className="group rounded-lg border border-gray-200"
                    >
                      <summary className="flex cursor-pointer items-center justify-between p-4 font-medium text-gray-900 hover:bg-gray-50">
                        <span>{item.q}</span>
                        <span className="ml-4 shrink-0 text-gray-400 group-open:rotate-180 transition-transform">
                          ▼
                        </span>
                      </summary>
                      <div className="border-t border-gray-200 p-4 text-gray-600">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-lg bg-blue-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">
              원하는 답변을 찾지 못하셨나요?
            </h2>
            <p className="mb-4 text-gray-600">
              직접 질문을 남겨주시면 전문가가 답변해 드립니다.
            </p>
            <Link
              href="/participate/ask"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
            >
              질문하기 <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </article>
      </div>
    </div>
  )
}
