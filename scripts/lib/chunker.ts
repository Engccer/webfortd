import matter from 'gray-matter'

export function stripFrontmatter(raw: string): string {
  const { content } = matter(raw)
  return content.trim()
}

export function stripPageHeaders(body: string): string {
  return body
    .replace(/<page_header>[^<]*<\/page_header>/g, '')
    .replace(/\n{3,}/g, '\n\n')
}
