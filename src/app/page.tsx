import Link from "next/link"
import { ArrowRight, Users, BookOpen, Scale, FileText, MessageCircle, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"
import { Badge } from "@/components/ui/badge"

const sections = [
  {
    title: "지원제도 안내",
    description: "영역별, 장애유형별, 시도별 지원제도를 안내합니다.",
    icon: Users,
    href: "/support",
  },
  {
    title: "연구·법령·통계",
    description: "관련 연구자료, 법령, 통계 정보를 제공합니다.",
    icon: BookOpen,
    href: "/resources",
  },
  {
    title: "권리 구제",
    description: "권리 침해 시 구제 절차와 사례를 안내합니다.",
    icon: Scale,
    href: "/rights",
  },
  {
    title: "현장 사례",
    description: "우수 사례와 인식 개선 자료를 공유합니다.",
    icon: Lightbulb,
    href: "/stories",
  },
  {
    title: "자주 묻는 질문",
    description: "자주 묻는 질문과 답변을 확인하세요.",
    icon: MessageCircle,
    href: "/participate/faq",
  },
  {
    title: "질문하기",
    description: "궁금한 점을 질문하고 전문가 답변을 받으세요.",
    icon: FileText,
    href: "/participate/ask",
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              장애인교원 지원 플랫폼
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              장애인교원의 교육활동을 보호하고
              <br />
              <span className="text-primary">교육에 전념할 수 있는 여건</span>을
              마련합니다
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              장애인교원이 필요한 지원 정보를 한곳에서 쉽고 빠르게 확인할 수
              있습니다. 장애유형별 맞춤형 안내와 지역사회 연계 정보를 제공합니다.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/support">
                  지원제도 안내
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg">
                <Link href="/about">플랫폼 소개</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              빠른 메뉴
            </h2>
            <p className="mt-2 text-muted-foreground">
              필요한 정보에 바로 접근하세요
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Link key={section.href} href={section.href}>
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/50">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <section.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle>플랫폼 소개</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground">
                  이 웹사이트는 장애인교원이 교육현장에서 필요한 지원 정보를 쉽게
                  찾을 수 있도록 구축되었습니다. 장애유형별 맞춤형 안내와 지역사회
                  연계 정보를 제공합니다.
                </p>
                <Button variant="link" asChild className="p-0">
                  <Link href="/about/purpose">
                    자세히 보기
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Partners */}
            <Card>
              <CardHeader>
                <CardTitle>협력기관</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground">
                  교육부와 17개 시도교육청이 협력하여 장애인교원의 교육활동을
                  지원합니다.
                </p>
                <Button variant="link" asChild className="p-0">
                  <Link href="/about/partners">
                    협력기관 보기
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
