import { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, HelpCircle, MessageSquare, ClipboardCheck } from "lucide-react"
import { Breadcrumb } from "@/components/layout/Breadcrumb"

export const metadata: Metadata = {
  title: "참여하기",
  description: "FAQ, 질문하기, 나의 권리 알아보기 등 참여 메뉴입니다.",
}

const sections = [
  {
    title: "자주 묻는 질문",
    description: "장애인교원 지원에 관해 자주 묻는 질문과 답변입니다.",
    href: "/participate/faq",
    icon: <HelpCircle className="h-8 w-8" />,
  },
  {
    title: "질문하기",
    description: "궁금한 점을 질문하고 전문가의 답변을 받으세요.",
    href: "/participate/ask",
    icon: <MessageSquare className="h-8 w-8" />,
  },
  {
    title: "나의 권리 알아보기",
    description: "간단한 체크리스트로 나의 권리 상태를 확인하세요.",
    href: "/participate/check",
    icon: <ClipboardCheck className="h-8 w-8" />,
  },
]

export default function ParticipatePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">참여하기</h1>
        <p className="mt-2 text-lg text-gray-600">
          질문하고, 참여하고, 나의 권리를 확인하세요.
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
              바로가기 <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-12 rounded-xl bg-blue-50 p-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900">함께 만들어가는 플랫폼</h2>
        <p className="mb-4 text-gray-600">
          이 플랫폼은 장애인교원과 관계자들의 참여로 더욱 발전합니다.
          여러분의 경험과 의견을 나눠주세요.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/participate/ask"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            의견 보내기
          </Link>
          <Link
            href="/stories/best-practices"
            className="inline-block rounded-lg border border-blue-600 bg-white px-4 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            경험 공유하기
          </Link>
        </div>
      </section>
    </div>
  )
}
