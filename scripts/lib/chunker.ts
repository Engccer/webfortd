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

export interface RawSection {
  section: string
  text: string
}

export function splitByH2(body: string): RawSection[] {
  const lines = body.split('\n')
  const sections: RawSection[] = []
  let current: RawSection = { section: '(no-section)', text: '' }

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (current.text.trim()) sections.push({ ...current, text: current.text.trim() })
      current = { section: line.trim(), text: line + '\n' }
    } else {
      current.text += line + '\n'
    }
  }
  if (current.text.trim()) sections.push({ ...current, text: current.text.trim() })
  return sections
}
