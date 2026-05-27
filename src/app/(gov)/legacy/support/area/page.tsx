import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "지원영역별 제도",
  description: "보조공학기기, 근로지원인, 편의시설 등 지원영역별 제도를 안내합니다.",
}

const areas = [
  {
    id: "assistive-tech",
    title: "보조공학기기",
    description: "장애인교원의 교육활동을 지원하는 보조공학기기 지원 제도입니다.",
    items: [
      "화면확대 소프트웨어",
      "화면낭독 소프트웨어",
      "점자정보단말기",
      "보청기 및 FM시스템",
      "의사소통 보조기기",
    ],
  },
  {
    id: "work-assistant",
    title: "근로지원인",
    description: "장애인교원의 직무 수행을 보조하는 근로지원인 제도입니다.",
    items: [
      "수업 보조 (자료 준비, 판서 대필 등)",
      "이동 보조",
      "문서 작성 보조",
      "의사소통 지원 (수어통역 등)",
    ],
  },
  {
    id: "facilities",
    title: "편의시설",
    description: "장애인교원을 위한 학교 시설 개선 및 편의시설 설치 지원입니다.",
    items: [
      "경사로 및 승강기 설치",
      "장애인 화장실",
      "높낮이 조절 책상",
      "점자블록 설치",
    ],
  },
  {
    id: "hr",
    title: "인사 지원",
    description: "장애인교원의 인사관리 관련 지원 제도입니다.",
    items: [
      "보직 배치 시 장애 고려",
      "출장 및 연수 시 편의 제공",
      "승진·전보 시 합리적 조정",
      "병가 및 휴직 제도",
    ],
  },
]

const supportNav = mainNavigation.find((item) => item.href === "/support")

export default function AreaPage() {
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">지원영역별 제도</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원을 위한 지원제도를 영역별로 안내합니다.
          </p>

          <div className="space-y-8">
            {areas.map((area) => (
              <section
                key={area.id}
                id={area.id}
                className="rounded-lg border border-gray-200 p-6"
              >
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                  {area.title}
                </h2>
                <p className="mb-4 text-gray-600">{area.description}</p>
                <h3 className="mb-2 font-medium text-gray-900">주요 지원 내용</h3>
                <ul className="list-inside list-disc space-y-1 text-gray-600">
                  {area.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}
