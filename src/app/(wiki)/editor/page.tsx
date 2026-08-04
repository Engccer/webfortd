import { Metadata } from "next"
import { loadDocument } from "./actions"
import { EditorClient } from "./EditorClient"

export const metadata: Metadata = { title: "콘텐츠 편집" }
export const dynamic = "force-dynamic"

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>
}) {
  const { slug } = await searchParams
  if (!slug) {
    return (
      // main 랜드마크와 #main-content(Alt+1 단축키 대상)는 AppShell이 단일 렌더. 페이지 내부는 div.
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-xl font-semibold">콘텐츠 편집</h1>
        <p className="mt-4">편집할 문서 페이지에서 편집 버튼으로 들어와 주세요.</p>
      </div>
    )
  }
  const doc = await loadDocument(slug)
  if (doc.status !== "ok") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-xl font-semibold">콘텐츠 편집</h1>
        <p className="mt-4">{doc.message}</p>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold">{doc.title} 편집</h1>
      <EditorClient
        slug={slug}
        title={doc.title}
        body={doc.body}
        baseSha={doc.baseSha}
        docPath={doc.docPath}
      />
    </div>
  )
}
