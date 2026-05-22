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

export const MAX_CHUNK_CHARS = 800
export const MIN_CHUNK_CHARS = 50

export function applyCharLimits(sections: RawSection[]): RawSection[] {
  const result: RawSection[] = []
  let buffer: RawSection | null = null

  for (const sec of sections) {
    // 큰 섹션은 문단(빈 줄) 단위로 800자 cap 적용
    if (sec.text.length > MAX_CHUNK_CHARS) {
      if (buffer) {
        result.push(buffer)
        buffer = null
      }
      const paragraphs = sec.text.split(/\n\n+/)
      let chunk = ''
      for (const p of paragraphs) {
        if ((chunk + '\n\n' + p).length > MAX_CHUNK_CHARS && chunk) {
          result.push({ section: sec.section, text: chunk.trim() })
          chunk = p
        } else {
          chunk = chunk ? chunk + '\n\n' + p : p
        }
      }
      if (chunk.trim()) result.push({ section: sec.section, text: chunk.trim() })
      continue
    }

    // 작은 섹션은 buffer에 누적, MIN 이상이면 flush
    if (!buffer) {
      buffer = { ...sec }
    } else {
      buffer.text = buffer.text + '\n\n' + sec.text
      buffer.section = buffer.section // 첫 섹션 라벨 유지 — 검색·인용에 우호적
    }
    if (buffer.text.length >= MIN_CHUNK_CHARS) {
      result.push(buffer)
      buffer = null
    }
  }
  if (buffer) result.push(buffer)
  return result
}
