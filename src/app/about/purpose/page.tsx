import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "소개 및 이용안내",
  description: "장애인교원 교육전념 여건 지원 플랫폼의 개설 목적과 이용안내입니다.",
}

const aboutNav = mainNavigation.find((item) => item.href === "/about")

export default function PurposePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {aboutNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={aboutNav.children} title="플랫폼 소개" />
          </aside>
        )}

        <article className="flex-1 prose prose-gray max-w-none">
          <h1>소개 및 이용안내</h1>

          <section className="mb-8">
            <h2>개설 목적</h2>
            <p>
              장애인교원은 교육현장에서 필요한 지원 정보를 찾기 어렵거나,
              제도가 있어도 실제로 어떻게 활용할 수 있는지 알기 힘든 어려움에 직면해 왔습니다.
            </p>
            <p>
              장애인교원의 편의지원, 인사관리 등의 관련 정보가 여러 기관과 문서에 흩어져 있어
              접근성과 활용성이 떨어진다는 점도 큰 문제였습니다.
            </p>
            <p>
              이 웹사이트는 이러한 어려움을 해소하기 위해, 장애인교원이 필요한 지원 정보를
              한곳에서 쉽고 빠르게 확인할 수 있도록 구축되었습니다.
            </p>
          </section>

          <section className="mb-8">
            <h2>주요 기능</h2>
            <ul>
              <li><strong>지원제도 안내</strong>: 장애유형별, 지원영역별, 시도별 제도 안내</li>
              <li><strong>권리 구제</strong>: 장애인교원의 권리와 구제 절차 안내</li>
              <li><strong>현장 사례</strong>: 우수사례 및 인식 개선 콘텐츠</li>
              <li><strong>참여하기</strong>: FAQ, 질문하기, 나의 권리 알아보기</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>이용자별 안내</h2>
            <div className="not-prose grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">장애인교원 (당사자)</h3>
                <p className="mt-1 text-sm text-gray-600">
                  장애유형별 맞춤 지원제도를 확인하고, 동료 교원의 경험을 참조할 수 있습니다.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">학교 관리자</h3>
                <p className="mt-1 text-sm text-gray-600">
                  소속 장애인교원 지원 방법과 편의제공 의무를 확인할 수 있습니다.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">교육청 담당자</h3>
                <p className="mt-1 text-sm text-gray-600">
                  시도별 제도 비교와 실무 매뉴얼을 확인할 수 있습니다.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">정책입안자</h3>
                <p className="mt-1 text-sm text-gray-600">
                  현황 통계와 정책 제안 자료를 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2>접근성</h2>
            <p>
              이 웹사이트는 장애인교원을 주요 이용자로 하므로, 다양한 접근성 기능을 제공합니다.
            </p>
            <ul>
              <li>글자 크기 조절 (80% ~ 200%)</li>
              <li>줄 간격 조절</li>
              <li>고대비 모드</li>
              <li>키보드 단축키 (Alt+0~3)</li>
              <li>스크린리더 호환</li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  )
}
