import type { Metadata } from "next"
import { WikiHero } from "@/components/wiki/WikiHero"
import { TodaysWiki } from "@/components/wiki/TodaysWiki"
import { AxisBrowseEntries } from "@/components/wiki/AxisBrowseEntries"
import { RoleEntries } from "@/components/wiki/RoleEntries"
import { PopularPages } from "@/components/wiki/PopularPages"

export const metadata: Metadata = {
  title: "장애인교원 위키",
  description:
    "장애인교원에 관한 535개 정책·법령·사례·보조공학 페이지를 위키 형태로 검색하고 채팅으로 질문하세요.",
}

export default function WikiHomePage() {
  return (
    <>
      <WikiHero />
      <TodaysWiki />
      <AxisBrowseEntries />
      <RoleEntries />
      <PopularPages />
    </>
  )
}
