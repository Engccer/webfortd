import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { serializeKbContent } from '../kb-mdx.ts'

/**
 * slug to content 파일 경로 화이트리스트.
 * 클라이언트는 slug만 보내고 경로는 서버가 kb-index에서 해석한다(spec 6).
 * kb-index는 빌드 산출물이라 stale일 수 있다 — 소비자는 GET 404를 별도 처리(Task 5).
 */
interface KbIndexDoc { slug: string; filePath: string }

let slugToPath: Map<string, string> | null = null
function loadIndex(): Map<string, string> {
  if (slugToPath) return slugToPath
  const indexPath = path.join(process.cwd(), 'src/lib/kb-index.generated.json')
  const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as { documents: KbIndexDoc[] }
  slugToPath = new Map(parsed.documents.map((d) => [d.slug, d.filePath]))
  return slugToPath
}

export function resolveContentPath(slug: string): string | null {
  const filePath = loadIndex().get(slug)
  if (!filePath) return null
  const normalized = path.posix.normalize(filePath)
  if (!/^content\/[^\0]+\.md$/.test(normalized)) return null
  if (normalized.includes('..')) return null
  return normalized
}

/** frontmatter 원본 바이트 보존 분리 — YAML 파싱·재직렬화 금지(주석·순서·줄바꿈 보존). */
export function splitDocument(
  raw: string,
): { frontmatterRaw: string; body: string } | null {
  if (!raw.startsWith('---\n')) return null
  const closeIdx = raw.indexOf('\n---\n', 4)
  if (closeIdx === -1) return null
  const end = closeIdx + '\n---\n'.length
  return { frontmatterRaw: raw.slice(0, end), body: raw.slice(end) }
}

export function mergeDocument(frontmatterRaw: string, body: string): string {
  return frontmatterRaw + body
}

export const BODY_MAX_BYTES = 200 * 1024

/**
 * 반영 전 본문 검증 — 구문 결함 차단(빌드 성공의 완전 보장 아님, spec 7).
 * serialize는 프로덕션 렌더와 동일 경로(kb-mdx)라 여기서 실패하면 렌더도 실패한다.
 */
export async function validateBody(
  body: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (Buffer.byteLength(body, 'utf-8') > BODY_MAX_BYTES) {
    return { ok: false, message: '본문이 200KB를 넘습니다. 나누어 저장해 주세요.' }
  }
  try {
    await serializeKbContent(body)
    return { ok: true }
  } catch (e) {
    const detail = e instanceof Error ? e.message.split('\n')[0] : ''
    return { ok: false, message: `본문 형식에 문제가 있어 저장하지 않았습니다. (${detail})` }
  }
}
