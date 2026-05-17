import { Metadata } from "next"
import { KbPageLayout, buildKbMetadata } from "@/components/kb/KbPageLayout"
import { getStaticParamsForAxis } from "@/lib/kb"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getStaticParamsForAxis('domains')
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  return buildKbMetadata('domains', slug)
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  return <KbPageLayout axis="domains" slug={slug} />
}
