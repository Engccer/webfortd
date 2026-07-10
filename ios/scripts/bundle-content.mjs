// content/ 마크다운(published만) + kb-index를 WebfortdKit 리소스로 복사하는 결정적 파이프라인.
// 실행: node ios/scripts/bundle-content.mjs  (repo 루트 기준)
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..", "..")
const INDEX_SRC = path.join(ROOT, "src", "lib", "kb-index.generated.json")
const OUT_DIR = path.join(ROOT, "ios", "WebfortdKit", "Sources", "WebfortdKit", "Resources", "KB")

const index = JSON.parse(fs.readFileSync(INDEX_SRC, "utf8"))
const published = index.documents.filter((d) => d.frontmatter.status === "published")
const publishedSlugs = new Set(published.map((d) => d.slug))

// 산출 디렉터리 초기화(.gitkeep 보존)
fs.rmSync(path.join(OUT_DIR, "content"), { recursive: true, force: true })
fs.rmSync(path.join(OUT_DIR, "kb-index.json"), { force: true })

// published 문서만 복사
for (const doc of published) {
  const src = path.join(ROOT, doc.filePath)
  const dst = path.join(OUT_DIR, doc.filePath) // filePath = content/<axis>/<slug>.md
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
}

// 축소 인덱스: 앱이 쓰는 필드만 + published만 + 백링크는 from도 published인 것만
const bundleIndex = {
  generated_at: index.generated_at,
  source_count: published.length,
  documents: published
    .map(({ slug, axis, filePath, frontmatter }) => ({ slug, axis, filePath, frontmatter }))
    .sort((a, b) => a.slug.localeCompare(b.slug)),
  wiki_backlinks: Object.fromEntries(
    Object.entries(index.wiki_backlinks)
      .filter(([target]) => publishedSlugs.has(target))
      .map(([target, links]) => [target, links.filter((l) => publishedSlugs.has(l.from))])
      .filter(([, links]) => links.length > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  ),
  slug_index: Object.fromEntries(
    published.map((d) => [d.slug, d.filePath]).sort(([a], [b]) => a.localeCompare(b)),
  ),
}
fs.writeFileSync(path.join(OUT_DIR, "kb-index.json"), JSON.stringify(bundleIndex, null, 1))

console.log(`bundle-content: ${published.length}/${index.documents.length} published 문서, ` +
  `backlink 대상 ${Object.keys(bundleIndex.wiki_backlinks).length}건 → ${path.relative(ROOT, OUT_DIR)}`)
