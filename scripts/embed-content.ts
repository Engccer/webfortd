#!/usr/bin/env tsx
// Phase 3 M1 — 청크 분해 + 임베딩 파이프라인 CLI
// 마크다운 정본 → 청크 분해 → gemini-embedding-2 임베딩 → document_chunks upsert.

import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import matter from 'gray-matter'
import { loadDotEnvLocalOverrides } from './lib/env-loader.ts'
import { chunkDocument } from './lib/chunker.ts'
import { embedTexts, type EmbeddingInput } from './lib/gemini-embed.ts'
import { formatSupabaseError } from './lib/error-format.ts'
import { assertIdRowsComplete } from './lib/assert-id-rows.ts'

loadDotEnvLocalOverrides()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

function createCliAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 미설정')
  }
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function fetchSlugToIdMap(client: SupabaseClient, slugs: string[]): Promise<Map<string, string>> {
  const { data, error } = await client
    .from('documents')
    .select('id, slug')
    .in('slug', slugs)
    .range(0, slugs.length - 1)
  if (error) throw new Error(`slug→id fetch 실패: ${formatSupabaseError(error)}`)
  assertIdRowsComplete(data, slugs.length)
  const map = new Map<string, string>()
  for (const row of data!) map.set(row.slug, row.id)
  return map
}

const REPO_ROOT = process.cwd()
const CONTENT_ROOT = path.join(REPO_ROOT, 'content')

interface MarkdownDoc {
  filePath: string
  raw: string
  frontmatter: Record<string, unknown>
  slug: string
  title: string
  axis: string
  type: string
  sourceOrigin: string | null
}

function* walkMarkdown(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue  // _image-mappings.json 등 underscore 파일 제외
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walkMarkdown(full)
    else if (entry.name.endsWith('.md')) yield full
  }
}

function loadDocuments(): MarkdownDoc[] {
  const docs: MarkdownDoc[] = []
  for (const filePath of walkMarkdown(CONTENT_ROOT)) {
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(raw)
    const slug = (data.slug as string) ?? path.basename(filePath, '.md')
    docs.push({
      filePath,
      raw,
      frontmatter: data,
      slug,
      title: (data.title as string) ?? slug,
      axis: (data.axis as string) ?? 'uncategorized',
      type: (data.type as string) ?? 'unknown',
      sourceOrigin: (data.source_origin as string) ?? null,
    })
  }
  return docs
}

async function main(): Promise<void> {
  console.log(dryRun ? '=== DRY-RUN MODE ===' : '=== APPLY MODE ===')
  const docs = loadDocuments()
  console.log(`[embed-content] 마크다운 문서 ${docs.length}개 로드`)

  // 1. 청크 분해
  type DocChunks = { slug: string; chunks: ReturnType<typeof chunkDocument> }
  const docChunks: DocChunks[] = docs.map((doc) => ({
    slug: doc.slug,
    chunks: chunkDocument(doc.raw, {
      slug: doc.slug,
      title: doc.title,
      axis: doc.axis,
      type: doc.type,
      source_origin: doc.sourceOrigin,
    }),
  }))
  const totalChunks = docChunks.reduce((a, b) => a + b.chunks.length, 0)
  console.log(`[embed-content] 청크 총 ${totalChunks}개`)

  if (dryRun) {
    console.log('[embed-content] dry-run — 임베딩 호출/DB 쓰기 skip')
    return
  }

  // 2. 임베딩 호출
  const inputs: EmbeddingInput[] = []
  for (const dc of docChunks) {
    for (const c of dc.chunks) {
      inputs.push({ refId: `${dc.slug}::${c.metadata.chunk_index}`, text: c.text })
    }
  }
  console.log(`[embed-content] 임베딩 호출 시작 (${inputs.length}건)`)
  const t0 = Date.now()
  const embeddings = await embedTexts(inputs)
  console.log(`[embed-content] 임베딩 완료 ${embeddings.length}건 (${Date.now() - t0}ms)`)

  // Task 9에서 DB 쓰기 추가
  console.log('[embed-content] DB 쓰기는 Task 9 구현 후 실행')
}

main().catch((err) => {
  console.error(formatSupabaseError(err))
  process.exit(1)
})
