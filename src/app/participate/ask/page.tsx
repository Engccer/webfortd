import { Metadata } from "next"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"

export const metadata: Metadata = {
  title: "질문하기",
  description: "궁금한 점을 질문하고 전문가의 답변을 받으세요.",
}

const participateNav = mainNavigation.find((item) => item.href === "/participate")

export default function AskPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {participateNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={participateNav.children} title="참여하기" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">질문하기</h1>
          <p className="mb-8 text-lg text-gray-600">
            궁금한 점을 질문해 주세요. 전문가가 답변해 드립니다.
          </p>

          <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h2 className="mb-2 font-semibold text-blue-800">질문 전 확인해 주세요</h2>
            <ul className="list-inside list-disc text-sm text-blue-700">
              <li>
                <a href="/participate/faq" className="underline">
                  자주 묻는 질문
                </a>
                에서 비슷한 질문을 먼저 찾아보세요.
              </li>
              <li>개인정보(이름, 학교명 등)는 입력하지 마세요.</li>
              <li>답변까지 영업일 기준 3~5일이 소요될 수 있습니다.</li>
            </ul>
          </div>

          <form className="space-y-6">
            <div>
              <label
                htmlFor="category"
                className="mb-2 block font-medium text-gray-900"
              >
                질문 분야
              </label>
              <select
                id="category"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">분야를 선택하세요</option>
                <option value="support">편의제공</option>
                <option value="hr">인사관리</option>
                <option value="rights">권리구제</option>
                <option value="tech">보조공학기기</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="title"
                className="mb-2 block font-medium text-gray-900"
              >
                제목
              </label>
              <input
                type="text"
                id="title"
                placeholder="질문 제목을 입력하세요"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label
                htmlFor="content"
                className="mb-2 block font-medium text-gray-900"
              >
                질문 내용
              </label>
              <textarea
                id="content"
                rows={8}
                placeholder="궁금한 점을 자세히 작성해 주세요"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-medium text-gray-900"
              >
                답변 받을 이메일 (선택)
              </label>
              <input
                type="email"
                id="email"
                placeholder="example@email.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p className="mt-1 text-sm text-gray-500">
                이메일을 입력하시면 답변이 등록될 때 알림을 받을 수 있습니다.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="agree"
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="agree" className="text-sm text-gray-600">
                질문 내용이 FAQ에 익명으로 게시될 수 있음에 동의합니다.
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
            >
              질문 등록하기
            </button>
          </form>

          <section className="mt-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-2 font-semibold text-gray-900">긴급 상담이 필요하신가요?</h2>
            <p className="text-gray-600">
              긴급한 상담이 필요하시면 아래 기관에 직접 연락해 주세요.
            </p>
            <ul className="mt-2 text-sm text-gray-600">
              <li>국가인권위원회: 1331</li>
              <li>장애인권익옹호기관: 1644-8295 (24시간)</li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  )
}
