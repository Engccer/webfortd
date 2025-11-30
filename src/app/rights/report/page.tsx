import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import { Phone, Mail, Globe, MessageCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "침해 신고",
  description: "권리 침해 사례를 신고하고 상담받을 수 있습니다.",
}

const contacts = [
  {
    name: "국가인권위원회",
    description: "장애차별 진정 및 상담",
    phone: "1331 (무료)",
    email: "human@humanrights.go.kr",
    url: "https://www.humanrights.go.kr",
    hours: "평일 09:00~18:00",
  },
  {
    name: "장애인권익옹호기관",
    description: "장애인 권익옹호 및 피해자 지원",
    phone: "1644-8295",
    email: null,
    url: "https://www.naapd.or.kr",
    hours: "24시간 운영",
  },
  {
    name: "고용노동부",
    description: "직장 내 차별 및 부당행위 신고",
    phone: "1350",
    email: null,
    url: "https://www.moel.go.kr",
    hours: "평일 09:00~18:00",
  },
  {
    name: "대한법률구조공단",
    description: "무료 법률 상담 및 소송 지원",
    phone: "132",
    email: null,
    url: "https://www.klac.or.kr",
    hours: "평일 09:00~18:00",
  },
]

const rightsNav = mainNavigation.find((item) => item.href === "/rights")

export default function ReportPage() {
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">침해 신고</h1>
          <p className="mb-8 text-lg text-gray-600">
            권리 침해 사례를 신고하고 전문 상담을 받을 수 있습니다.
          </p>

          <section className="mb-8 rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
            <h2 className="mb-2 font-semibold text-red-800">긴급 상황 안내</h2>
            <p className="text-red-700">
              폭력, 학대 등 긴급한 상황에서는 즉시 경찰(112) 또는
              장애인권익옹호기관(1644-8295, 24시간)에 연락하세요.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">상담 및 신고 기관</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {contacts.map((contact) => (
                <div
                  key={contact.name}
                  className="rounded-lg border border-gray-200 p-6"
                >
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">
                    {contact.name}
                  </h3>
                  <p className="mb-4 text-sm text-gray-600">{contact.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-blue-600">{contact.phone}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <a
                        href={contact.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        홈페이지 방문
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{contact.hours}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">신고 전 준비사항</h2>
            <div className="rounded-lg border border-gray-200 p-6">
              <ul className="list-inside list-disc space-y-2 text-gray-600">
                <li>침해 사실의 일시, 장소, 내용을 정리해 주세요.</li>
                <li>관련 증거(문서, 녹음, 증인 등)가 있다면 확보해 주세요.</li>
                <li>신고자 및 피신고자 정보를 확인해 주세요.</li>
                <li>원하는 구제 방법(사과, 시정, 손해배상 등)을 생각해 주세요.</li>
              </ul>
            </div>
          </section>

          <section className="rounded-lg bg-blue-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">비밀 보장 안내</h2>
            <p className="text-gray-600">
              신고 및 상담 내용은 철저히 비밀이 보장됩니다.
              신고자의 인적사항은 본인 동의 없이 공개되지 않습니다.
              안심하고 상담받으세요.
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
