/**
 * 위키 홈 "주제별 둘러보기" — axis 목록 페이지(/disability-types 등)로 가는 진입 카드.
 *
 * 535개 문서가 published이지만 위키 홈엔 인기 페이지 일부만 링크돼 있어 카테고리로
 * 둘러볼 경로가 없던 문제를 해결한다. 각 axis의 published 문서 수를 빌드타임에 집계해 노출.
 *
 * 접근성: 카드 제목만 링크로 둔다(설명·문서 수는 링크 밖 텍스트). 스크린리더 사용자가
 * 카드 그리드를 순회할 때 링크 이름이 "장애유형별", "정책·법령"처럼 또렷하게 읽힌다.
 * 시각 텍스트를 aria-label로 덮지 않는다(영구 원칙: 내부 텍스트 손실 방지).
 */

import Link from "next/link"
import { Accessibility, Layers, Scale, FileText, MapPin } from "lucide-react"
import type { ContentAxis } from "@/types/kb"
import { BROWSABLE_AXES } from "@/lib/kb-axis"
import { getDocsByFilter } from "@/lib/kb"

const AXIS_ICON: Record<ContentAxis, typeof Layers> = {
  "disability-types": Accessibility,
  domains: Layers,
  policies: Scale,
  agreements: FileText,
  regions: MapPin,
  // 아래는 BROWSABLE_AXES에 없지만 타입 완전성을 위해 채운다.
  stories: FileText,
  resources: FileText,
  uncategorized: Layers,
}

export async function AxisBrowseEntries() {
  const entries = await Promise.all(
    BROWSABLE_AXES.map(async (b) => ({
      ...b,
      count: (await getDocsByFilter({ axis: b.axis, status: "published" })).length,
    })),
  )

  return (
    <section
      aria-labelledby="axis-browse-heading"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6"
    >
      <div className="mb-6">
        <h2
          id="axis-browse-heading"
          className="text-xl font-semibold text-foreground sm:text-2xl"
        >
          주제별 둘러보기
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          카테고리를 골라 전체 문서를 둘러보세요.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((b) => {
          const Icon = AXIS_ICON[b.axis] ?? Layers
          return (
            <li
              key={b.axis}
              className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-foreground">
                  <Link
                    href={`/${b.axis}`}
                    className="rounded-sm hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {b.label}
                  </Link>
                </h3>
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{b.description}</p>
              <span className="mt-3 text-sm font-medium text-primary">
                문서 {b.count}개
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
