import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { cache } from "react"

const CONTENT_DIR = path.join(process.cwd(), "content")

export interface DocMeta {
  slug: string
  title: string
  description?: string
  date?: string
  author?: string
  category?: string
  tags?: string[]
}

export interface Doc extends DocMeta {
  content: string
  headings: Heading[]
}

export interface Heading {
  level: number
  text: string
  id: string
}

// 슬러그 생성
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/\s+/g, "-")
    .trim()
}

// 목차(TOC) 추출
export function extractHeadings(content: string): Heading[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: Heading[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = slugify(text)
    headings.push({ level, text, id })
  }

  return headings
}

// 특정 디렉토리의 모든 문서 가져오기
export const getAllDocs = cache(async (section: string, subsection?: string): Promise<DocMeta[]> => {
  const dirPath = subsection
    ? path.join(CONTENT_DIR, section, subsection)
    : path.join(CONTENT_DIR, section)

  if (!fs.existsSync(dirPath)) {
    return []
  }

  const files = fs.readdirSync(dirPath).filter((file) => file.endsWith(".mdx") || file.endsWith(".md"))

  const docs: DocMeta[] = files.map((file) => {
    const filePath = path.join(dirPath, file)
    const fileContent = fs.readFileSync(filePath, "utf-8")
    const { data } = matter(fileContent)
    const slug = file.replace(/\.(mdx|md)$/, "")

    return {
      slug,
      title: data.title || slug,
      description: data.description,
      date: data.date,
      author: data.author,
      category: data.category,
      tags: data.tags,
    }
  })

  // 날짜 기준 정렬 (최신순)
  return docs.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    }
    return 0
  })
})

// 특정 문서 가져오기
export const getDocBySlug = cache(async (section: string, subsection: string, slug: string): Promise<Doc | null> => {
  const possiblePaths = [
    path.join(CONTENT_DIR, section, subsection, `${slug}.mdx`),
    path.join(CONTENT_DIR, section, subsection, `${slug}.md`),
  ]

  let filePath: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      filePath = p
      break
    }
  }

  if (!filePath) {
    return null
  }

  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContent)
  const headings = extractHeadings(content)

  return {
    slug,
    title: data.title || slug,
    description: data.description,
    date: data.date,
    author: data.author,
    category: data.category,
    tags: data.tags,
    content,
    headings,
  }
})

// 검색용 모든 문서 가져오기
export const getAllDocsForSearch = cache(async (): Promise<(DocMeta & { section: string; subsection: string; path: string })[]> => {
  const allDocs: (DocMeta & { section: string; subsection: string; path: string })[] = []

  const sections = ["resources", "support", "rights", "stories"]

  for (const section of sections) {
    const sectionPath = path.join(CONTENT_DIR, section)
    if (!fs.existsSync(sectionPath)) continue

    const subsections = fs.readdirSync(sectionPath).filter((item) => {
      const itemPath = path.join(sectionPath, item)
      return fs.statSync(itemPath).isDirectory()
    })

    for (const subsection of subsections) {
      const docs = await getAllDocs(section, subsection)
      for (const doc of docs) {
        allDocs.push({
          ...doc,
          section,
          subsection,
          path: `/${section}/${subsection}/${doc.slug}`,
        })
      }
    }
  }

  return allDocs
})
