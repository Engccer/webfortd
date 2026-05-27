// Phase 4 M3 PR A — public/library/*.pdf → Supabase Storage idempotent 업로드
// service_role 필수. SHA-256 비교로 변경 없는 파일 skip.
//
// 사용:
//   npm run library:upload           # apply
//   npm run library:upload:dry-run

import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY 필요')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const repoRoot = process.cwd()
const libraryDir = join(repoRoot, 'public/library')

type Result = { file: string; action: 'uploaded' | 'skipped' | 'error'; reason?: string }

async function sha256(buf: Buffer): Promise<string> {
  return createHash('sha256').update(buf).digest('hex')
}

async function main() {
  const client = createClient(url!, serviceKey!)
  const entries = await readdir(libraryDir)
  const pdfs = entries.filter((f) => f.endsWith('.pdf'))

  if (pdfs.length === 0) {
    console.log('업로드 대상 PDF 없음 (public/library/)')
    return
  }

  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'APPLY'}`)
  console.log(`대상: ${pdfs.length} files`)

  const results: Result[] = []
  for (const file of pdfs) {
    const path = join(libraryDir, file)
    const buf = await readFile(path)
    const localHash = await sha256(buf)

    const { data: existing } = await client.storage.from('library').list('', { search: file })
    const remote = existing?.find((e) => e.name === file)

    if (remote && remote.metadata?.eTag) {
      const remoteEtag = String(remote.metadata.eTag).replace(/"/g, '')
      if (remoteEtag === localHash) {
        results.push({ file, action: 'skipped', reason: 'hash match' })
        continue
      }
    }

    if (isDryRun) {
      results.push({ file, action: 'uploaded', reason: '[dry-run]' })
      continue
    }

    const { error } = await client.storage
      .from('library')
      .upload(file, buf, { upsert: true, contentType: 'application/pdf' })

    if (error) {
      results.push({ file, action: 'error', reason: error.message })
    } else {
      results.push({ file, action: 'uploaded' })
    }
  }

  console.log('\n=== 결과 ===')
  for (const r of results) {
    console.log(`  [${r.action}] ${r.file}${r.reason ? ` (${r.reason})` : ''}`)
  }
  const errorCount = results.filter((r) => r.action === 'error').length
  if (errorCount > 0) {
    console.error(`\n❌ ${errorCount}건 에러`)
    process.exit(1)
  }
  console.log(`\n✅ 완료: ${results.length}건`)
}

main().catch((err) => {
  console.error('Unhandled:', err)
  process.exit(1)
})
