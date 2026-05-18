import type { Metadata } from "next"
import { WikiHero } from "@/components/wiki/WikiHero"
import { PopularPages } from "@/components/wiki/PopularPages"

export const metadata: Metadata = {
  title: "위키",
  description:
    "장애인교원에 관한 535개 정책·법령·사례·보조공학 페이지를 위키 형태로 검색하고 챗봇에 질문하세요.",
}

export default function WikiHomePage() {
  return (
    <>
      <WikiHero />
      <PopularPages />
      <section className="mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-muted-foreground sm:px-6">
        <p>
          이곳은 정보 발견을 빠르게 만드는 베타 entry입니다.
          기관용 정식 메뉴는 우측 상단{" "}
          <span className="font-medium text-foreground">기관용</span> 토글로
          이동하세요.
        </p>
      </section>
    </>
  )
}
