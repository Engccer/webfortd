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

export interface ChunkMetadata {
  slug: string
  title: string
  axis: string
  type: string
  section: string
  chunk_index: number
  source_origin: string | null
}

export interface Chunk {
  text: string
  metadata: ChunkMetadata
}

export type ChunkDocumentInput = Omit<ChunkMetadata, 'section' | 'chunk_index'>

export function chunkDocument(raw: string, meta: ChunkDocumentInput): Chunk[] {
  const body = stripPageHeaders(stripFrontmatter(raw))
  const sections = applyCharLimits(splitByH2(body))

  return sections.map((sec, i) => ({
    text: sec.text,
    metadata: {
      slug: meta.slug,
      title: meta.title,
      axis: meta.axis,
      type: meta.type,
      section: sec.section,
      chunk_index: i,
      source_origin: meta.source_origin,
    },
  }))
}

export const MAX_CHUNK_CHARS = 800
export const MIN_CHUNK_CHARS = 50

/**
 * 문장 경계 후보 정규식 — 한국어/영어 마침표·물음표·느낌표·전각부호·줄바꿈
 * lookbehind: 부호 뒤에서만 split (부호는 직전 문장에 붙어 남음)
 */
const SENTENCE_BOUNDARY = /(?<=[\.!\?。！？\n])\s+/

/**
 * 800자 초과 단일 문단을 sentence boundary 단위로 split.
 * sentence가 여전히 800자 초과면 hard char-slice fallback.
 * 모든 글자 보존 (정보 손실 없음).
 */
export function splitLongParagraph(p: string): string[] {
  if (p.length === 0) return []
  if (p.length <= MAX_CHUNK_CHARS) return [p]

  // 1단계: sentence boundary로 split
  const sentences = p.split(SENTENCE_BOUNDARY).filter((s) => s.length > 0)
  const merged: string[] = []
  let buf = ''
  for (const s of sentences) {
    const candidate = buf ? buf + ' ' + s : s
    if (candidate.length > MAX_CHUNK_CHARS && buf) {
      merged.push(buf)
      buf = s
    } else {
      buf = candidate
    }
  }
  if (buf) merged.push(buf)

  // 2단계: 여전히 cap 초과면 hard slice
  const final: string[] = []
  for (const chunk of merged) {
    if (chunk.length <= MAX_CHUNK_CHARS) {
      final.push(chunk)
    } else {
      for (let i = 0; i < chunk.length; i += MAX_CHUNK_CHARS) {
        final.push(chunk.slice(i, i + MAX_CHUNK_CHARS))
      }
    }
  }
  return final
}

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
        // M1 carry #1: 단일 문단이 cap 초과면 split 후 각각 처리
        const pieces = splitLongParagraph(p)
        for (const piece of pieces) {
          if ((chunk + '\n\n' + piece).length > MAX_CHUNK_CHARS && chunk) {
            result.push({ section: sec.section, text: chunk.trim() })
            chunk = piece
          } else {
            chunk = chunk ? chunk + '\n\n' + piece : piece
          }
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
      // 첫 섹션 라벨 유지 — 검색·인용에 우호적
    }
    if (buffer.text.length >= MIN_CHUNK_CHARS) {
      result.push(buffer)
      buffer = null
    }
  }
  if (buffer) result.push(buffer)
  return result
}
