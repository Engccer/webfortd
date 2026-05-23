#!/usr/bin/env tsx
// Phase 3 M1 — 청크 분해 + 임베딩 파이프라인 CLI
// 마크다운 정본 → 청크 분해 → gemini-embedding-2 임베딩 → document_chunks upsert.

import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import matter from 'gray-matter'
import { loadDotEnvLocalOverrides } from './lib/env-loader.ts'
import { chunkDocument } from './lib/chunker.ts'
import { embedTexts, getEmbedModel, getEmbedDim, type EmbeddingInput } from './lib/gemini-embed.ts'
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

interface ChunkInsertRow {
  document_id: string
  chunk_text: string
  chunk_index: number
  section: string | null
  embedding: number[]
  metadata: Record<string, unknown>
}

async function deleteExistingChunks(client: SupabaseClient, documentIds: string[]): Promise<number> {
  if (documentIds.length === 0) return 0
  const { error, count } = await client
    .from('document_chunks')
    .delete({ count: 'exact' })
    .in('document_id', documentIds)
  if (error) throw new Error(`기존 청크 삭제 실패: ${formatSupabaseError(error)}`)
  return count ?? 0
}

async function insertChunks(client: SupabaseClient, rows: ChunkInsertRow[]): Promise<void> {
  if (rows.length === 0) return
  // PostgREST 1 request payload 한도 회피용 500건 분할 (sync-content-to-db.ts 패턴 동일)
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await client.from('document_chunks').insert(batch)
    if (error) throw new Error(`청크 insert 실패 (batch ${i}): ${formatSupabaseError(error)}`)
  }
}

async function fetchSlugToIdMap(client: SupabaseClient, slugs: string[]): Promise<Map<string, string>> {
  const { data, error } = await client
    .from('documents')
    .select('id, slug')
    .in('slug', slugs)
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
    // axis는 content/<axis>/... 디렉토리 첫 segment에서 derive (frontmatter 키 아님)
    const relativeFromContent = path.relative(CONTENT_ROOT, filePath)
    const axisFromPath = relativeFromContent.split(path.sep)[0] ?? 'uncategorized'
    docs.push({
      filePath,
      raw,
      frontmatter: data,
      slug,
      title: (data.title as string) ?? slug,
      axis: (data.axis as string) ?? axisFromPath,
      type: (data.type as string) ?? 'unknown',
      sourceOrigin: (data.source_origin as string) ?? null,
    })
  }
  return docs
}

async function main(): Promise<void> {
  console.log(dryRun ? '=== DRY-RUN MODE ===' : '=== APPLY MODE ===')
  console.log(`모델: ${getEmbedModel()} / dim: ${getEmbedDim()}`)
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

  // 3. DB 쓰기
  const supabase = createCliAdminClient()
  const slugs = docChunks.map((dc) => dc.slug)
  const slugToId = await fetchSlugToIdMap(supabase, slugs)

  // embedding 결과를 refId 기준 lookup
  const embedMap = new Map(embeddings.map((e) => [e.refId, e.embedding]))

  const insertRows: ChunkInsertRow[] = []
  const skippedSlugs: string[] = []
  for (const dc of docChunks) {
    const documentId = slugToId.get(dc.slug)
    if (!documentId) {
      console.warn(`[embed-content] slug ${dc.slug} document_id 없음 — skip`)
      skippedSlugs.push(dc.slug)
      continue
    }
    for (const c of dc.chunks) {
      const embedding = embedMap.get(`${dc.slug}::${c.metadata.chunk_index}`)
      if (!embedding) throw new Error(`임베딩 결과 누락: ${dc.slug}::${c.metadata.chunk_index}`)
      insertRows.push({
        document_id: documentId,
        chunk_text: c.text,
        chunk_index: c.metadata.chunk_index,
        section: c.metadata.section,
        embedding,
        metadata: c.metadata as unknown as Record<string, unknown>,
      })
    }
  }

  const targetDocIds = Array.from(new Set(insertRows.map((r) => r.document_id)))
  const deleted = await deleteExistingChunks(supabase, targetDocIds)
  console.log(`[embed-content] 기존 청크 ${deleted}건 삭제`)
  await insertChunks(supabase, insertRows)
  console.log(`[embed-content] 신규 청크 ${insertRows.length}건 삽입`)

  console.log('')
  console.log('=== 임베딩 보고서 ===')
  console.log(`모델: ${getEmbedModel()} / dim: ${getEmbedDim()}`)
  console.log(`문서 ${docs.length}개 / 청크 ${insertRows.length}개`)
  console.log(`삭제: ${deleted}건, 삽입: ${insertRows.length}건`)
  if (skippedSlugs.length > 0) {
    console.log(`slug 미매핑 skip: ${skippedSlugs.length}건 (kb:sync 누락 의심)`)
    console.log(`  ${skippedSlugs.slice(0, 5).join(', ')}${skippedSlugs.length > 5 ? ' …' : ''}`)
  }
  const docsByAxis = new Map<string, number>()
  for (const d of docs) docsByAxis.set(d.axis, (docsByAxis.get(d.axis) ?? 0) + 1)
  const chunksByAxis = new Map<string, number>()
  for (const r of insertRows) {
    const axis = (r.metadata as { axis?: string }).axis ?? 'uncategorized'
    chunksByAxis.set(axis, (chunksByAxis.get(axis) ?? 0) + 1)
  }
  for (const [axis, n] of [...docsByAxis.entries()].sort()) {
    const c = chunksByAxis.get(axis) ?? 0
    console.log(`  ${axis}: ${n}개 문서 / ${c}개 청크`)
  }
}

main().catch((err) => {
  console.error(formatSupabaseError(err))
  process.exit(1)
})
