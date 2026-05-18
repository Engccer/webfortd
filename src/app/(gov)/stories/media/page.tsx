import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import { Video, FileText, Image, Download } from "lucide-react"

export const metadata: Metadata = {
  title: "미디어 자료",
  description: "교육 영상, 홍보 자료 등을 확인하세요.",
}

const videos = [
  {
    title: "장애인교원의 하루",
    description: "장애인교원의 교육현장 일상을 담은 다큐멘터리 형식의 영상입니다.",
    duration: "15:30",
    thumbnail: null,
  },
  {
    title: "편의제공 이해하기",
    description: "장애인교원을 위한 편의제공의 의미와 방법을 설명하는 교육 영상입니다.",
    duration: "10:45",
    thumbnail: null,
  },
  {
    title: "인식 개선 캠페인",
    description: "장애인교원에 대한 인식 개선을 위한 캠페인 영상입니다.",
    duration: "3:20",
    thumbnail: null,
  },
]

const documents = [
  {
    title: "장애인교원 지원 가이드북",
    description: "학교 관리자와 교육청 담당자를 위한 종합 가이드입니다.",
    format: "PDF",
    size: "5.2MB",
  },
  {
    title: "편의제공 신청서 양식",
    description: "장애인교원 편의제공 신청을 위한 공식 양식입니다.",
    format: "HWP",
    size: "120KB",
  },
  {
    title: "인식 개선 교육 자료",
    description: "학교에서 활용할 수 있는 인식 개선 교육 PPT 자료입니다.",
    format: "PPTX",
    size: "8.5MB",
  },
]

const infographics = [
  {
    title: "장애유형별 편의제공 한눈에 보기",
    description: "장애유형별로 필요한 편의제공을 정리한 인포그래픽입니다.",
  },
  {
    title: "구제 절차 흐름도",
    description: "권리 침해 시 구제 절차를 시각화한 자료입니다.",
  },
  {
    title: "장애인교원 현황 통계",
    description: "전국 장애인교원 현황을 시각화한 인포그래픽입니다.",
  },
]

const storiesNav = mainNavigation.find((item) => item.href === "/stories")

export default function MediaPage() {
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">미디어 자료</h1>
          <p className="mb-8 text-lg text-gray-600">
            교육 영상, 문서, 인포그래픽 등 다양한 자료를 확인하세요.
          </p>

          {/* 샘플 데이터 안내 */}
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              샘플 데이터: 아래 항목들은 예시이며, 실제 자료는 준비 중입니다.
            </p>
          </div>

          <section className="mb-12">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900">
              <Video className="h-5 w-5" />
              영상 자료
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {videos.map((video) => (
                <div
                  key={video.title}
                  className="overflow-hidden rounded-lg border border-gray-200"
                >
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    <Video className="h-12 w-12 text-gray-300" />
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-semibold text-gray-900">
                      {video.title}
                    </h3>
                    <p className="mb-2 text-sm text-gray-600">
                      {video.description}
                    </p>
                    <span className="text-sm text-gray-500">{video.duration}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              * 영상 자료는 준비 중입니다.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900">
              <FileText className="h-5 w-5" />
              문서 자료
            </h2>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.title}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{doc.title}</h3>
                    <p className="text-sm text-gray-600">{doc.description}</p>
                    <div className="mt-1 flex gap-2 text-xs text-gray-500">
                      <span>{doc.format}</span>
                      <span>•</span>
                      <span>{doc.size}</span>
                    </div>
                  </div>
                  <button
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                    aria-label={`${doc.title} 다운로드`}
                  >
                    <Download className="h-4 w-4" />
                    다운로드
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              * 문서 자료는 준비 중입니다.
            </p>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900">
              <Image className="h-5 w-5" />
              인포그래픽
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {infographics.map((info) => (
                <div
                  key={info.title}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="mb-3 aspect-[4/3] rounded bg-gray-100 flex items-center justify-center">
                    <Image className="h-12 w-12 text-gray-300" />
                  </div>
                  <h3 className="mb-1 font-medium text-gray-900">{info.title}</h3>
                  <p className="text-sm text-gray-600">{info.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              * 인포그래픽은 준비 중입니다.
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
