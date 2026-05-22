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

  let totalChunks = 0
  for (const doc of docs) {
    const chunks = chunkDocument(doc.raw, {
      slug: doc.slug,
      title: doc.title,
      axis: doc.axis,
      type: doc.type,
      source_origin: doc.sourceOrigin,
    })
    totalChunks += chunks.length
  }
  console.log(`[embed-content] 청크 총 ${totalChunks}개`)

  if (dryRun) {
    console.log('[embed-content] dry-run — 임베딩 호출/DB 쓰기 skip (Task 8+에서 본 흐름)')
    return
  }

  console.log('[embed-content] APPLY 모드 — 임베딩/DB 쓰기는 Task 8/Task 9 구현 후 실행')
}

main().catch((err) => {
  console.error(formatSupabaseError(err))
  process.exit(1)
})
