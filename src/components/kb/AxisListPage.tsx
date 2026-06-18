/**
 * axis 목록(카테고리 인덱스) 페이지 셸 — async 서버 컴포넌트.
 *
 * 6개 본문 axis 라우트(/disability-types 등)가 동일 레이아웃을 쓰므로 단일 컴포넌트로 합친다.
 * library/page.tsx와 동일한 published 게이트:
 *   - 익명/일반: status='published'만
 *   - admin Draft Mode(getPreviewActive): 전체
 * 현재는 535건 모두 published라 다 보이되, 향후 draft가 생기면 자동으로 검수 게이트가 작동한다.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ContentAxis } from "@/types/kb"
import { getDocsByFilter } from "@/lib/kb-query"
import { getPreviewActive } from "@/lib/admin/preview"
import {
  AXIS_LABEL,
  BROWSABLE_AXES,
  toListItem,
  sortDocsForList,
} from "@/lib/kb-axis"
import { AxisDocList } from "./AxisDocList"

export function buildAxisMetadata(axis: ContentAxis): Metadata {
  const meta = BROWSABLE_AXES.find((b) => b.axis === axis)
  if (!meta) return { title: AXIS_LABEL[axis] }
  return { title: meta.label, description: meta.description }
}

export async function AxisListPage({ axis }: { axis: ContentAxis }) {
  const meta = BROWSABLE_AXES.find((b) => b.axis === axis)
  if (!meta) notFound()

  const includeUnpublished = await getPreviewActive()
  const docs = await getDocsByFilter(
    includeUnpublished ? { axis } : { axis, status: "published" },
  )
  const items = sortDocsForList(docs.map(toListItem))

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {meta.label}
        </h1>
        <p className="mt-2 text-muted-foreground">{meta.description}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          문서 {items.length}개
        </p>
      </header>
      <AxisDocList items={items} />
    </section>
  )
}
