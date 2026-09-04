"use client"

/**
 * 홈 첫 화면 — 옴니박스 하나가 검색과 AI 질문의 공용 진입점이다(2026-09-04).
 *
 * 종전에는 이 화면에 검색창이 둘이었다(헤더 소형 + 여기 대형). 헤더 검색창은
 * Header가 홈에서 숨기고(경로 분기), 그 아래에 따로 있던 "채팅으로 질문" 링크는
 * 옴니박스의 [AI에게 질문]으로 흡수했다 — 링크와 달리 입력한 텍스트를 첫 질문으로
 * 함께 넘긴다. 제목 아래 소제목은 제거했다(바로 아래 컨트롤이 이미 두 액션을
 * 보여주므로 중복 안내였다. 미니멀 원칙 + SR 낭독 노이즈).
 *
 * 검색/질문 분기는 사용자의 버튼 선택이 곧 분기다. 입력 의도를 추측해 자동
 * 라우팅하는 방식은 도입하지 않는다(gildongmu에서 폐기된 이력).
 */

import { useRouter } from "next/navigation"
import { SiteSearch } from "@/components/search/SiteSearch"

const MAX_QUESTION_LENGTH = 500

export function WikiHero() {
  const router = useRouter()

  // 질문은 /chat?q= 로 넘기고, 채팅 화면이 mount 시 1회 전송한 뒤 주소에서 q를
  // 지운다(useAutoSendInitialQuestion). 입력이 비면 빈 채팅으로 — 종전 링크와 동일.
  // 상한 500자: 검색창에 장문을 붙여넣어도 URL이 브라우저·서버 한계를 넘지 않게 한다
  // (잘린 질문은 채팅에서 이어 물으면 되고, 검색창은 애초에 장문 입력 표면이 아니다).
  function askAi(query: string) {
    const text = query.trim().slice(0, MAX_QUESTION_LENGTH)
    router.push(text ? `/chat?q=${encodeURIComponent(text)}` : "/chat")
  }

  return (
    <section className="bg-gradient-to-b from-primary/5 to-background py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          장애인교원에 관한
          <br className="hidden sm:inline" />
          <span className="text-primary"> 모든 정보를 한 번에</span>
        </h1>
        <div className="mx-auto mt-8 w-full max-w-xl text-left">
          <SiteSearch variant="hero" onAsk={askAi} />
        </div>
      </div>
    </section>
  )
}
