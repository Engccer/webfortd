import Link from "next/link"
import {
  User,
  School,
  FileText,
  BarChart3,
  ArrowRight,
  BookOpen,
  Scale,
  Users,
  Heart,
} from "lucide-react"
import { Card } from "@/components/ui/Card"
import { userEntries } from "@/lib/navigation"

const iconMap: Record<string, React.ReactNode> = {
  user: <User className="h-6 w-6" />,
  school: <School className="h-6 w-6" />,
  "file-text": <FileText className="h-6 w-6" />,
  "bar-chart": <BarChart3 className="h-6 w-6" />,
}

const quickLinks = [
  {
    title: "지원제도 안내",
    description: "장애유형별, 지원영역별 제도를 확인하세요",
    href: "/support",
    icon: <BookOpen className="h-6 w-6" />,
  },
  {
    title: "권리 구제",
    description: "장애인교원의 권리와 구제 절차를 안내합니다",
    href: "/rights",
    icon: <Scale className="h-6 w-6" />,
  },
  {
    title: "현장 사례",
    description: "우수 사례와 인식 개선 콘텐츠를 만나보세요",
    href: "/stories",
    icon: <Users className="h-6 w-6" />,
  },
  {
    title: "자주 묻는 질문",
    description: "궁금한 점에 대한 답변을 확인하세요",
    href: "/participate/faq",
    icon: <Heart className="h-6 w-6" />,
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              장애인교원의 교육활동을 보호하고
              <br />
              <span className="text-blue-600">교육에 전념할 수 있는 여건</span>을
              마련합니다
            </h1>
            <p className="mt-6 text-lg text-gray-600">
              장애인교원이 필요한 지원 정보를 한곳에서 쉽고 빠르게 확인할 수
              있습니다. 장애유형별 맞춤형 안내와 지역사회 연계 정보를 제공합니다.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                지원제도 안내
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                플랫폼 소개
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* User Entry Points */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              이용자별 바로가기
            </h2>
            <p className="mt-2 text-gray-600">
              이용자 유형에 맞는 정보를 빠르게 찾아보세요
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {userEntries.map((entry) => (
              <Card
                key={entry.href}
                title={entry.title}
                description={entry.description}
                href={entry.href}
                icon={iconMap[entry.icon]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              주요 메뉴
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((link) => (
              <Card
                key={link.href}
                title={link.title}
                description={link.description}
                href={link.href}
                icon={link.icon}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* About */}
            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                플랫폼 소개
              </h2>
              <p className="mb-4 text-gray-600">
                이 웹사이트는 장애인교원이 교육현장에서 필요한 지원 정보를 쉽게
                찾을 수 있도록 구축되었습니다. 장애유형별 맞춤형 안내와 지역사회
                연계 정보를 제공합니다.
              </p>
              <Link
                href="/about/purpose"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                자세히 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Partners */}
            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <h2 className="mb-4 text-xl font-bold text-gray-900">협력기관</h2>
              <p className="mb-4 text-gray-600">
                교육부와 17개 시도교육청이 협력하여 장애인교원의 교육활동을
                지원합니다.
              </p>
              <Link
                href="/about/partners"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                협력기관 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
