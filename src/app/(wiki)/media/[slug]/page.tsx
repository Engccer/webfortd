import { Metadata } from "next"
import { notFound } from "next/navigation"
import { filterMediaItems, getMediaItemBySlug } from "@/lib/media-curation"
import { isCatalogItemVisible } from "@/lib/catalog-visibility"
import { getPreviewActive } from "@/lib/admin/preview"
import { MediaDetail } from "@/components/media/MediaDetail"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  // M3: published만 사전 렌더. draft slug는 on-demand + 런타임 게이트.
  return filterMediaItems({}).map((item) => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = getMediaItemBySlug(slug)
  if (!item) {
    return { title: "문서를 찾을 수 없습니다" }
  }
  // M3 게이트: 비-admin에게 draft 미디어의 메타데이터(캡션/alt)도 노출하지 않음.
  const includeUnpublished = await getPreviewActive()
  if (!isCatalogItemVisible(item.status, includeUnpublished)) {
    return { title: "문서를 찾을 수 없습니다" }
  }
  return {
    title: item.caption,
    description: item.alt,
  }
}

export default async function MediaDetailPage({ params }: PageProps) {
  const { slug } = await params
  const item = getMediaItemBySlug(slug)
  if (!item) {
    notFound()
  }
  // M3 게이트: draft 미디어는 admin Draft Mode에서만 접근. 비-admin 직접 접근은 404.
  const includeUnpublished = await getPreviewActive()
  if (!isCatalogItemVisible(item.status, includeUnpublished)) {
    notFound()
  }
  return <MediaDetail item={item} />
}
