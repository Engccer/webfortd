import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MEDIA_ITEMS, getMediaItemBySlug } from "@/lib/media-curation"
import { MediaDetail } from "@/components/media/MediaDetail"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return MEDIA_ITEMS.map((item) => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = getMediaItemBySlug(slug)
  if (!item) return { title: "미디어 자료를 찾을 수 없습니다" }
  return { title: item.caption, description: item.alt.slice(0, 160) }
}

export default async function MediaItemPage({ params }: PageProps) {
  const { slug } = await params
  const item = getMediaItemBySlug(slug)
  if (!item) notFound()
  return <MediaDetail item={item} />
}
