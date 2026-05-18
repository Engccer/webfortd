"use client"

import { useState } from "react"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import Link from "next/link"
import { ArrowRight, CheckCircle, AlertCircle, Info } from "lucide-react"

const questions = [
  {
    id: 1,
    question: "업무에 필요한 보조공학기기를 지원받고 계신가요?",
    yes: "좋습니다! 보조공학기기 지원을 받고 계시군요.",
    no: "보조공학기기 지원을 신청할 수 있습니다.",
    link: "/support/area#assistive-tech",
  },
  {
    id: 2,
    question: "필요한 경우 근로지원인을 배치받을 수 있나요?",
    yes: "근로지원인 제도를 활용하고 계시군요.",
    no: "근로지원인 배치를 요청할 수 있습니다.",
    link: "/support/area#work-assistant",
  },
  {
    id: 3,
    question: "학교 시설이 장애 특성에 맞게 갖춰져 있나요?",
    yes: "편의시설이 잘 갖춰져 있군요.",
    no: "편의시설 설치를 요청할 수 있습니다.",
    link: "/support/area#facilities",
  },
  {
    id: 4,
    question: "보직 배치 시 장애 특성이 고려되고 있나요?",
    yes: "인사 관리가 적절히 이루어지고 있군요.",
    no: "장애 고려 배치를 요청할 수 있습니다.",
    link: "/support/area#hr",
  },
  {
    id: 5,
    question: "장애를 이유로 차별이나 불이익을 받은 적이 있나요?",
    yes: "권리 구제 절차를 확인해 보세요.",
    no: "다행입니다. 권리 침해 시 구제 절차를 알아두세요.",
    link: "/rights",
  },
  {
    id: 6,
    question: "필요한 편의제공을 거부당한 적이 있나요?",
    yes: "정당한 편의제공 거부는 차별에 해당합니다.",
    no: "필요한 지원을 받고 계시군요.",
    link: "/rights/entitlements",
  },
]

const participateNav = mainNavigation.find((item) => item.href === "/participate")

export default function CheckPage() {
  const [answers, setAnswers] = useState<Record<number, boolean | null>>({})
  const [showResults, setShowResults] = useState(false)

  const handleAnswer = (id: number, value: boolean) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = () => {
    setShowResults(true)
  }

  const handleReset = () => {
    setAnswers({})
    setShowResults(false)
  }

  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === questions.length

  const positiveAnswers = Object.entries(answers).filter(
    ([id, value]) => {
      const q = questions.find((q) => q.id === parseInt(id))
      if (!q) return false
      // For questions 5 and 6, "no" is the positive answer
      if (q.id === 5 || q.id === 6) return value === false
      return value === true
    }
  ).length

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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">나의 권리 알아보기</h1>
          <p className="mb-8 text-lg text-gray-600">
            간단한 체크리스트로 현재 지원 상태를 확인해 보세요.
          </p>

          {!showResults ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {answeredCount} / {questions.length} 응답 완료
                </span>
                <div className="h-2 flex-1 mx-4 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <p className="mb-3 font-medium text-gray-900">{q.question}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAnswer(q.id, true)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                          answers[q.id] === true
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-700 hover:border-blue-300"
                        }`}
                      >
                        예
                      </button>
                      <button
                        onClick={() => handleAnswer(q.id, false)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                          answers[q.id] === false
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-700 hover:border-blue-300"
                        }`}
                      >
                        아니오
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  결과 보기
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  초기화
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8 rounded-lg bg-blue-50 p-6">
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                  체크 결과
                </h2>
                <p className="text-gray-600">
                  {positiveAnswers >= 4
                    ? "대체로 필요한 지원을 받고 계시는 것으로 보입니다. 아래 세부 결과를 확인해 보세요."
                    : positiveAnswers >= 2
                    ? "일부 영역에서 추가 지원이 필요해 보입니다. 아래 권장 사항을 확인해 보세요."
                    : "여러 영역에서 지원이 필요해 보입니다. 아래 권장 사항을 확인하고 적극적으로 지원을 요청해 보세요."}
                </p>
              </div>

              <div className="space-y-4">
                {questions.map((q) => {
                  const answer = answers[q.id]
                  const isPositive =
                    q.id === 5 || q.id === 6 ? answer === false : answer === true
                  return (
                    <div
                      key={q.id}
                      className={`rounded-lg border p-4 ${
                        isPositive
                          ? "border-green-200 bg-green-50"
                          : "border-yellow-200 bg-yellow-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isPositive ? (
                          <CheckCircle className="mt-1 h-5 w-5 shrink-0 text-green-600" />
                        ) : (
                          <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-yellow-600" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{q.question}</p>
                          <p
                            className={`mt-1 text-sm ${
                              isPositive ? "text-green-700" : "text-yellow-700"
                            }`}
                          >
                            {answer ? q.yes : q.no}
                          </p>
                          {!isPositive && (
                            <Link
                              href={q.link}
                              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                            >
                              자세히 알아보기 <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={handleReset}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  다시 체크하기
                </button>
                <Link
                  href="/participate/ask"
                  className="rounded-lg border border-blue-600 px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50"
                >
                  상담 요청하기
                </Link>
              </div>

              <div className="mt-8 rounded-lg border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <Info className="mt-1 h-5 w-5 shrink-0 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    이 체크리스트는 참고용이며, 정확한 권리 확인은 전문 상담을 통해 하시기
                    바랍니다. 국가인권위원회(1331) 또는 장애인권익옹호기관(1644-8295)에서
                    무료 상담을 받으실 수 있습니다.
                  </p>
                </div>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  )
}
