import { Metadata } from "next"
import { KbPageLayout, buildKbMetadata } from "@/components/kb/KbPageLayout"
import { getStaticParamsForAxis } from "@/lib/kb"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getStaticParamsForAxis('policies')
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  return buildKbMetadata('policies', slug)
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  return <KbPageLayout axis="policies" slug={slug} />
}
