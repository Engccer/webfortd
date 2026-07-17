import { Metadata } from "next"
import { notFound } from "next/navigation"
import { KbPageLayout, buildKbMetadata } from "@/components/kb/KbPageLayout"
import {
  ResourcesDocView,
  buildResourcesDocMetadata,
  type ResourcesSubsection,
} from "@/components/kb/ResourcesDocView"
import { getStaticParamsForAxis, getStaticParamsForSubsection } from "@/lib/kb"
import type { ContentAxis } from "@/types/kb"

/**
 * KB 문서 catch-all 라우트 — 축별 [slug] 라우트 9개를 URL 불변으로 통합.
 *
 * 제약: Vercel Hobby는 배포당 Serverless Function 12개까지인데, prerender(SSG)
 * 라우트는 라우트마다 Draft Mode bypass용 함수가 1개씩 생기고 이 함수들은
 * 그룹핑되지 않는다(콘텐츠 파이프라인 트레이스가 커서 공유 람다에도 못 합류).
 * 축마다 별도 라우트를 두면 그 수만큼 함수를 소모하므로, 단일 catch-all로
 * 함수 1개에 전 문서를 수용한다. 새 KB 축·서브섹션 라우트를 별도 파일로 만들지
 * 말고 이 라우트의 파서에 추가할 것.
 *
 * 매칭:
 *   /{axis}/{slug}            axis ∈ WIKI_AXES (7종)
 *   /resources/{law|research}/{slug}
 * 그 외 경로는 notFound. 정적 세그먼트 라우트(/chat, /library/[slug] 등)가
 * 항상 우선 매치되므로 이 라우트는 잔여 경로만 받는다.
 */

const WIKI_AXES = [
  "agreements",
  "disability-types",
  "domains",
  "faq",
  "policies",
  "regions",
  "uncategorized",
] as const satisfies readonly ContentAxis[]

type WikiAxis = (typeof WIKI_AXES)[number]

const RESOURCE_SUBSECTIONS = ["law", "research"] as const

type ParsedKbPath =
  | { kind: "axis"; axis: WikiAxis; slug: string }
  | { kind: "resources"; subsection: ResourcesSubsection; slug: string }

function parseKbPath(kb: string[]): ParsedKbPath | null {
  if (kb.length === 2 && (WIKI_AXES as readonly string[]).includes(kb[0])) {
    return { kind: "axis", axis: kb[0] as WikiAxis, slug: kb[1] }
  }
  if (
    kb.length === 3 &&
    kb[0] === "resources" &&
    (RESOURCE_SUBSECTIONS as readonly string[]).includes(kb[1])
  ) {
    return { kind: "resources", subsection: kb[1] as ResourcesSubsection, slug: kb[2] }
  }
  return null
}

interface PageProps {
  params: Promise<{ kb: string[] }>
}

export async function generateStaticParams() {
  const axisParams = WIKI_AXES.flatMap((axis) =>
    getStaticParamsForAxis(axis).map(({ slug }) => ({ kb: [axis, slug] })),
  )
  const resourceParams = RESOURCE_SUBSECTIONS.flatMap((subsection) =>
    getStaticParamsForSubsection(subsection).map(({ slug }) => ({
      kb: ["resources", subsection, slug],
    })),
  )
  return [...axisParams, ...resourceParams]
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { kb } = await params
  const parsed = parseKbPath(kb)
  if (!parsed) {
    return { title: "문서를 찾을 수 없습니다" }
  }
  if (parsed.kind === "resources") {
    return buildResourcesDocMetadata(parsed.subsection, parsed.slug)
  }
  return buildKbMetadata(parsed.axis, parsed.slug)
}

export default async function Page({ params }: PageProps) {
  const { kb } = await params
  const parsed = parseKbPath(kb)
  if (!parsed) {
    notFound()
  }
  if (parsed.kind === "resources") {
    return <ResourcesDocView subsection={parsed.subsection} slug={parsed.slug} />
  }
  return <KbPageLayout axis={parsed.axis} slug={parsed.slug} />
}
