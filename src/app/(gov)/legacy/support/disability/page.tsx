import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "장애유형별 제도",
  description: "시각, 청각, 지체 등 장애유형에 맞는 지원제도를 안내합니다.",
}

const disabilityTypes = [
  {
    id: "visual",
    title: "시각장애",
    description: "시각장애 교원을 위한 지원제도입니다.",
    supports: [
      { name: "화면낭독 소프트웨어", desc: "JAWS, NVDA 등" },
      { name: "화면확대 소프트웨어", desc: "ZoomText 등" },
      { name: "점자정보단말기", desc: "한소네, 브레일센스 등" },
      { name: "음성인식 소프트웨어", desc: "음성으로 문서 작성" },
      { name: "점자 교재 제작 지원", desc: "점역 서비스" },
    ],
  },
  {
    id: "hearing",
    title: "청각장애",
    description: "청각장애 교원을 위한 지원제도입니다.",
    supports: [
      { name: "보청기 지원", desc: "보청기 구입 및 수리 지원" },
      { name: "FM 시스템", desc: "교실 내 청취 보조" },
      { name: "수어통역 서비스", desc: "회의, 연수 시 수어통역" },
      { name: "문자통역 서비스", desc: "실시간 자막 제공" },
      { name: "시각적 알림장치", desc: "진동, 불빛 알림" },
    ],
  },
  {
    id: "physical",
    title: "지체장애",
    description: "지체장애 교원을 위한 지원제도입니다.",
    supports: [
      { name: "이동 보조기기", desc: "전동휠체어, 보행보조기 등" },
      { name: "높낮이 조절 책상", desc: "휠체어 사용 가능" },
      { name: "편의시설 설치", desc: "경사로, 승강기 등" },
      { name: "근로지원인", desc: "이동, 문서작업 보조" },
      { name: "음성인식 소프트웨어", desc: "키보드 사용 어려움 시" },
    ],
  },
  {
    id: "brain",
    title: "뇌병변장애",
    description: "뇌병변장애 교원을 위한 지원제도입니다.",
    supports: [
      { name: "의사소통 보조기기", desc: "AAC 기기" },
      { name: "근로지원인", desc: "전반적 업무 보조" },
      { name: "이동 보조기기", desc: "전동휠체어 등" },
      { name: "특수 입력장치", desc: "트랙볼, 스위치 등" },
      { name: "음성합성 소프트웨어", desc: "의사소통 지원" },
    ],
  },
  {
    id: "internal",
    title: "내부장애",
    description: "신장, 심장, 호흡기 등 내부장애 교원을 위한 지원제도입니다.",
    supports: [
      { name: "휴게공간 확보", desc: "치료 및 휴식 공간" },
      { name: "근무시간 조정", desc: "치료 시간 확보" },
      { name: "업무 경감", desc: "건강 상태 고려" },
      { name: "병가 및 휴직", desc: "치료 기간 보장" },
      { name: "접근성 높은 화장실", desc: "가까운 위치 배치" },
    ],
  },
]

const supportNav = mainNavigation.find((item) => item.href === "/support")

export default function DisabilityPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {supportNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={supportNav.children} title="지원제도 안내" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">장애유형별 제도</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애유형에 따라 필요한 지원제도를 확인하세요.
          </p>

          <nav className="mb-8">
            <h2 className="sr-only">장애유형 바로가기</h2>
            <ul className="flex flex-wrap gap-2">
              {disabilityTypes.map((type) => (
                <li key={type.id}>
                  <a
                    href={`#${type.id}`}
                    className="inline-block rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                  >
                    {type.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-8">
            {disabilityTypes.map((type) => (
              <section
                key={type.id}
                id={type.id}
                className="scroll-mt-24 rounded-lg border border-gray-200 p-6"
              >
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                  {type.title}
                </h2>
                <p className="mb-4 text-gray-600">{type.description}</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 text-left font-medium text-gray-900">
                          지원 항목
                        </th>
                        <th className="py-2 text-left font-medium text-gray-900">
                          내용
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {type.supports.map((support) => (
                        <tr key={support.name} className="border-b border-gray-100">
                          <td className="py-2 font-medium text-gray-900">
                            {support.name}
                          </td>
                          <td className="py-2 text-gray-600">{support.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}
