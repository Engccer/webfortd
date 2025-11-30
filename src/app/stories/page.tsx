import { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Award, Heart, Video } from "lucide-react"
import { Breadcrumb } from "@/components/layout/Breadcrumb"

export const metadata: Metadata = {
  title: "현장 사례",
  description: "우수 사례와 인식 개선 콘텐츠를 확인하세요.",
}

const sections = [
  {
    title: "우수 사례",
    description: "장애인교원 지원 우수 사례와 성공 경험을 공유합니다.",
    href: "/stories/best-practices",
    icon: <Award className="h-8 w-8" />,
  },
  {
    title: "인식 개선",
    description: "장애인교원에 대한 인식 개선 콘텐츠입니다.",
    href: "/stories/awareness",
    icon: <Heart className="h-8 w-8" />,
  },
  {
    title: "미디어 자료",
    description: "교육 영상, 홍보 자료 등을 확인하세요.",
    href: "/stories/media",
    icon: <Video className="h-8 w-8" />,
  },
]

const featuredStory = {
  title: "시각장애 교원의 교단 이야기",
  summary:
    "20년간 교단에서 학생들을 가르쳐온 시각장애 교원의 경험과 노하우를 공유합니다. 보조공학기기와 동료 교원의 지원으로 어떻게 교육활동을 이어왔는지 들어보세요.",
  href: "/stories/best-practices",
}

export default function StoriesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">현장 사례</h1>
        <p className="mt-2 text-lg text-gray-600">
          장애인교원의 우수 사례와 인식 개선 콘텐츠를 확인하세요.
        </p>
      </div>

      <section className="mb-12 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
        <span className="mb-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
          추천 이야기
        </span>
        <h2 className="mb-3 text-2xl font-bold text-gray-900">
          {featuredStory.title}
        </h2>
        <p className="mb-4 text-gray-600">{featuredStory.summary}</p>
        <Link
          href={featuredStory.href}
          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
        >
          자세히 보기 <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

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
              자세히 보기 <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-12 rounded-xl bg-gray-50 p-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900">나의 이야기 공유하기</h2>
        <p className="mb-4 text-gray-600">
          장애인교원으로서의 경험과 노하우를 다른 교원들과 나눠주세요.
          귀하의 이야기가 다른 교원에게 힘이 됩니다.
        </p>
        <Link
          href="/participate/ask"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          이야기 공유하기
        </Link>
      </section>
    </div>
  )
}
