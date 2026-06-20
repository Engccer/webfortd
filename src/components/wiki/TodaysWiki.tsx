/**
 * 위키 홈 "오늘의 장애인교원 위키" — 매일 무작위 5건의 위키 페이지를 노출한다.
 *
 * 선택은 KST 날짜를 시드로 한 결정적 셔플(@/lib/wiki-daily)이라 같은 날 같은 5건이고,
 * 한국 자정에 새로 바뀐다. SSR(동적 렌더)이라 서버가 고른 결과가 그대로 내려가 hydration
 * mismatch가 없다.
 *
 * 데이터는 published 문서만 대상으로 한다(공개 노출). fs 비의존 kb-query만 import해
 * 함수 번들 NFT 폭증(PR #81)을 피한다.
 *
 * 접근성: 카드 제목만 링크로 둔다(배지·발췌는 링크 밖 텍스트). 스크린리더로 카드 그리드를
 * 순회할 때 링크 이름이 문서 제목으로 또렷하게 읽힌다. 시각 텍스트를 aria-label로 덮지 않는다.
 */

import Link from "next/link"
import type { Frontmatter } from "@/types/kb"
import { getDocsByFilter } from "@/lib/kb-query"
import { AXIS_LABEL } from "@/lib/kb-axis"
import { dateKeyKST, pickDailyDocs, hrefForDoc } from "@/lib/wiki-daily"

const DAILY_COUNT = 5

export async function TodaysWiki() {
  const published = await getDocsByFilter({ status: "published" })
  const today = pickDailyDocs(published, dateKeyKST(new Date()), DAILY_COUNT)

  if (today.length === 0) return null

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h2 className="mb-6 text-xl font-semibold text-foreground sm:text-2xl">
        오늘 추천하는 위키 문서입니다
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {today.map((doc) => {
          const fm = doc.frontmatter as Frontmatter
          const blurb = fm.subtitle ?? doc.body_excerpt
          return (
            <li
              key={`${doc.axis}/${doc.slug}`}
              className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="mb-2 w-fit rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {AXIS_LABEL[doc.axis]}
              </span>
              <h3 className="mb-1 text-base font-semibold text-foreground">
                <Link
                  href={hrefForDoc(doc)}
                  className="rounded-sm hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {fm.title}
                </Link>
              </h3>
              {blurb && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{blurb}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
