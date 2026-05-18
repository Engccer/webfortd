import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "우수 사례",
  description: "장애인교원 지원 우수 사례와 성공 경험을 공유합니다.",
}

const stories = [
  {
    id: 1,
    title: "시각장애 교원의 20년 교단 이야기",
    author: "김OO 교사",
    disability: "시각장애",
    school: "초등학교",
    summary:
      "화면낭독 소프트웨어와 점자정보단말기를 활용하여 20년간 초등학교에서 교육활동을 이어온 경험을 공유합니다.",
    content: `처음 교단에 섰을 때는 막막했습니다. 하지만 보조공학기기의 도움과 동료 교원들의 지지로 지금까지 교육활동을 이어올 수 있었습니다.

특히 화면낭독 소프트웨어는 교무업무 처리에 큰 도움이 되었고, 점자정보단말기를 통해 학생들의 과제를 확인하고 피드백을 줄 수 있었습니다.

후배 교원들에게 전하고 싶은 말은, 필요한 지원을 적극적으로 요청하라는 것입니다. 우리에게는 그럴 권리가 있습니다.`,
    tips: [
      "화면낭독 소프트웨어(NVDA) 사용법을 꼼꼼히 익히세요",
      "수업 자료는 미리 디지털화해두면 좋습니다",
      "동료 교원들에게 필요한 도움을 명확히 요청하세요",
    ],
  },
  {
    id: 2,
    title: "청각장애 교원의 수업 운영 노하우",
    author: "이OO 교사",
    disability: "청각장애",
    school: "중학교",
    summary:
      "FM 시스템과 시각적 자료를 활용하여 중학교에서 효과적으로 수업을 운영하는 방법을 공유합니다.",
    content: `청각장애가 있지만 학생들과 소통하는 데 큰 어려움은 없습니다. FM 시스템을 통해 학생들의 발표를 들을 수 있고, 시각적 자료를 많이 활용하여 수업을 진행합니다.

처음에는 학생들에게 제 장애를 어떻게 설명할지 고민이 많았는데, 솔직하게 이야기하니 오히려 학생들이 더 배려해주더군요.

회의나 연수 시에는 문자통역 서비스를 활용하고 있습니다. 교육청에서 지원받을 수 있으니 꼭 신청하세요.`,
    tips: [
      "FM 시스템은 교실 환경에 맞게 조절하세요",
      "학생들에게 장애를 자연스럽게 설명하면 좋습니다",
      "회의 시 문자통역 서비스를 활용하세요",
    ],
  },
  {
    id: 3,
    title: "지체장애 교원의 학교생활 적응기",
    author: "박OO 교사",
    disability: "지체장애",
    school: "고등학교",
    summary:
      "휠체어를 사용하면서 고등학교에서 교육활동을 하는 데 필요한 환경 조성과 지원에 대해 공유합니다.",
    content: `휠체어를 사용하기 때문에 학교 시설이 중요합니다. 다행히 현재 학교에는 경사로와 승강기가 잘 갖춰져 있어 이동에 불편함이 없습니다.

처음 발령받은 학교는 시설이 미비했지만, 교육청에 요청하여 편의시설을 설치받았습니다. 권리를 알고 요청하는 것이 중요합니다.

높낮이 조절 책상 덕분에 서류 작업도 편하게 할 수 있게 되었습니다.`,
    tips: [
      "편의시설 설치는 교육청에 요청할 수 있습니다",
      "높낮이 조절 책상은 업무 효율을 높여줍니다",
      "동선을 미리 확인하고 필요한 조정을 요청하세요",
    ],
  },
]

const storiesNav = mainNavigation.find((item) => item.href === "/stories")

export default function BestPracticesPage() {
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">우수 사례</h1>
          <p className="mb-8 text-lg text-gray-600">
            장애인교원의 교육현장 경험과 노하우를 공유합니다.
          </p>

          <div className="space-y-8">
            {stories.map((story) => (
              <article
                key={story.id}
                className="rounded-lg border border-gray-200 p-6"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {story.disability}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    {story.school}
                  </span>
                </div>
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                  {story.title}
                </h2>
                <p className="mb-4 text-sm text-gray-500">{story.author}</p>
                <p className="mb-4 text-gray-600">{story.summary}</p>
                <div className="mb-4 whitespace-pre-line text-gray-600">
                  {story.content}
                </div>
                <div className="rounded-lg bg-blue-50 p-4">
                  <h3 className="mb-2 font-medium text-gray-900">실천 팁</h3>
                  <ul className="list-inside list-disc text-sm text-gray-600">
                    {story.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}
