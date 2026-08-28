/**
 * 위키링크 슬러그 → 라우트 href 해석기. kb-index.generated.json의 slug_index만 읽는다
 * (fs 비의존, kb-query와 같은 계층). KbPageLayout·편집기 프리뷰가 kb-mdx에 주입한다.
 */
import { INDEX } from "@/lib/kb-query"

export function hrefForSlug(slug: string): string | null {
  if (!Object.hasOwn(INDEX.slug_index, slug)) return null
  const filePath = INDEX.slug_index[slug]
  const parts = filePath.split("/")
  // content/<axis>/<sub>/<slug>.md → 4 / content/<axis>/<slug>.md → 3
  if (parts.length === 4 && parts[0] === "content") return `/${parts[1]}/${parts[2]}/${slug}`
  if (parts.length === 3 && parts[0] === "content") return `/${parts[1]}/${slug}`
  return null
}
