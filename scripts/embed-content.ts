#!/usr/bin/env tsx
// Phase 3 M1 — 청크 분해 + 임베딩 파이프라인 CLI
// 마크다운 정본을 입력으로 청크 분해 → gemini-embedding-2 임베딩 → document_chunks upsert.

import { loadDotEnvLocalOverrides } from './lib/env-loader.ts'

loadDotEnvLocalOverrides()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

console.log(dryRun ? '=== DRY-RUN MODE ===' : '=== APPLY MODE ===')
console.log('[embed-content] M1 skeleton — Task 4부터 본 로직 채움')

process.exit(0)
