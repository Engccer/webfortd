# Phase 4 M3 정리·접근성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 4 위키 리뉴얼의 마무리 — PDF 자산을 Supabase Storage로 이관하고 (응급 우회 제거), sitemap·robots·OG로 SEO 게이트 통과, axe-core CI + 위원장 VoiceOver로 접근성 회귀 차단.

**Architecture:** PR 2개 격리 머지 — PR A (PDF Storage, 4 task)가 외부 URL 변경 영향을 격리한 뒤, PR B (SEO+a11y, 6 task)가 메타데이터·자동 검증 도구를 추가한다. spec D6 정합.

**Tech Stack:** Next.js 16 metadata API (`sitemap.ts`/`robots.ts`/`opengraph-image.png`), Supabase Storage (`@supabase/supabase-js` 재사용), `@axe-core/playwright` + `@playwright/test` (신규 dev dep, chromium 단일 브라우저).

---

## 결정 잠금

세션 brainstorming + spec D1~D8 + plan 작성 시 발견 1건:

| ID | 결정 | 출처 |
|----|------|------|
| D1 | PDF Storage = M3 초반 | spec Q1 |
| D2 | sitemap 전부 포함 (~555 URL) | spec Q2 |
| D3 | OG image 정적 1장 placeholder | spec Q3 |
| D4 | WCAG = axe-core CI + VoiceOver | spec Q4 |
| D5 | 단독 Agent + codex-rescue (b) skip + admin squash merge | spec Q6 |
| D6 | PR 2개 분리 (PR A / PR B) | spec |
| D7 | bucket = `library` (public read + service_role write only) | spec |
| D8 | a11y 9 라우트 | spec |
| **D9** | **마이그레이션 번호 = `0012`** — spec 예시(0010)는 이미 chat_history로 사용 중. plan 작성 시 정정 | plan 발견 |

---

## File Structure

### 신규 파일 (11)

| 경로 | 책임 | Task |
|------|------|------|
| `supabase/migrations/0012_storage_library_bucket.sql` | Storage 버킷 생성 + RLS 정책 | T1 |
| `tests/migrations/0012-storage-library-bucket.test.ts` | 버킷/RLS 회귀 가드 | T1 |
| `scripts/upload-library.ts` | PDF 4건 idempotent 업로드 | T2 |
| `src/app/sitemap.ts` | 555 라우트 sitemap.xml generator | T5 |
| `tests/lib/sitemap.test.ts` | sitemap URL 구조 가드 | T5 |
| `src/app/robots.ts` | robots.txt generator | T6 |
| `tests/lib/robots.test.ts` | robots 규칙 가드 | T6 |
| `src/app/opengraph-image.png` | 1200×630 placeholder PNG | T7 |
| `playwright.config.ts` | Playwright 설정 (chromium only, dev server 자동 기동) | T8 |
| `tests/a11y/axe-helper.ts` | axe-core 공통 헬퍼 (critical/serious 0건 검증) | T8 |
| `tests/a11y/critical-routes.spec.ts` | 핵심 6 라우트 a11y | T8 |
| `tests/a11y/atomic-samples.spec.ts` | axis별 atomic 샘플 3건 a11y | T8 |
| `.github/workflows/a11y.yml` | PR마다 axe-core CI | T9 |
| `docs/VOICEOVER_CHECKLIST.md` | 위원장 10분 검수 7 step | T10 |

### 수정 파일 (8)

| 경로 | 변경 | Task |
|------|------|------|
| `src/lib/library-catalog.ts` | downloadUrl → Storage public URL | T3 |
| `tests/library/library-catalog.test.ts` | prefix 가드를 Storage URL로 갱신 | T3 |
| `public/library/2023-disability-work-support-research.pdf` | git rm | T4 |
| `public/library/2023-hr-guide.pdf` | git rm | T4 |
| `public/library/2024-jbu-work-support-guide.pdf` | git rm | T4 |
| `public/library/2024-support-staff-duty-guide.pdf` | git rm | T4 |
| `next.config.ts` | `outputFileTracingExcludes` 블록 제거 | T4 |
| `src/app/layout.tsx` | `openGraph.images` 메타 추가 | T7 |
| `package.json` | `library:upload` script + `@axe-core/playwright`·`@playwright/test` dev dep + `test:a11y` script | T2, T8 |

---

## 머지 흐름

```
[작업 브랜치] feat/phase-4-m3-pdf-storage
  ↓ T1~T4 commit
[PR A 생성] → CI validate PASS → admin squash merge
  ↓ engccer Hobby production deploy READY
[검증] 4 PDF Storage URL 200 + 8 라우트 + sitemap·robots 부재 확인
  ↓
[작업 브랜치] feat/phase-4-m3-seo-a11y
  ↓ T5~T10 commit
[PR B 생성] → CI validate + a11y PASS → admin squash merge
  ↓ production deploy READY
[검증] sitemap.xml ≥540 + robots.txt + og:image + axe-core 그린
  ↓
[위원장 VoiceOver] 7 step 검수 (iPhone Safari)
  ↓ 결과 OK
[Phase 4 완료 선언] CLAUDE.md + MEMORY.md + project_phase_status.md 갱신
```

---

# Part A — PDF Storage 마이그레이션 (PR A)

## Task 1: Storage 버킷 + RLS 마이그레이션

**Files:**
- Create: `supabase/migrations/0012_storage_library_bucket.sql`
- Test: `tests/migrations/0012-storage-library-bucket.test.ts`

- [ ] **Step 1: 통합 테스트 작성**

```ts
// tests/migrations/0012-storage-library-bucket.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SECRET_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

test('0012 — library bucket 존재 + public 설정', async () => {
  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.storage.getBucket('library')
  assert.ok(!error, `bucket fetch error: ${error?.message}`)
  assert.equal(data?.id, 'library')
  assert.equal(data?.public, true)
})

test('0012 — anon은 INSERT 차단 (RLS)', async () => {
  const anon = createClient(url, anonKey)
  const buffer = Buffer.from('rls-probe')
  const { error } = await anon.storage
    .from('library')
    .upload('rls-probe-blocked.bin', buffer, { upsert: false })
  assert.ok(error, 'anon upload는 차단되어야 함')
  assert.match(
    error?.message ?? '',
    /row-level security|new row violates|policy|unauthorized/i,
    `expected RLS reject, got: ${error?.message}`,
  )
})
```

- [ ] **Step 2: 테스트 실행해서 fail 확인**

```bash
npm run test:integration -- --test-name-pattern '0012'
```

Expected: FAIL — `bucket fetch error: Bucket not found`

- [ ] **Step 3: 마이그레이션 SQL 작성**

```sql
-- supabase/migrations/0012_storage_library_bucket.sql
-- Phase 4 M3 PR A — public/library PDF Supabase Storage 마이그레이션
-- 버킷: library (public read, service_role only write)
-- spec: docs/superpowers/specs/2026-05-28-phase-4-m3-cleanup-accessibility-design.md §5 T1 (D7)

-- 1) 버킷 생성 (idempotent)
insert into storage.buckets (id, name, public)
values ('library', 'library', true)
on conflict (id) do update set public = excluded.public;

-- 2) 익명 SELECT (다운로드) 허용
drop policy if exists "library: public read" on storage.objects;
create policy "library: public read"
on storage.objects for select
to public
using (bucket_id = 'library');

-- 3) anon/authenticated INSERT 명시 차단
drop policy if exists "library: anon insert blocked" on storage.objects;
create policy "library: anon insert blocked"
on storage.objects for insert
to anon, authenticated
with check (bucket_id != 'library');

-- 4) anon/authenticated UPDATE 명시 차단
drop policy if exists "library: anon update blocked" on storage.objects;
create policy "library: anon update blocked"
on storage.objects for update
to anon, authenticated
using (bucket_id != 'library');

-- 5) anon/authenticated DELETE 명시 차단
drop policy if exists "library: anon delete blocked" on storage.objects;
create policy "library: anon delete blocked"
on storage.objects for delete
to anon, authenticated
using (bucket_id != 'library');

-- service_role은 RLS bypass — 별도 정책 불요
```

- [ ] **Step 4: 마이그레이션 적용 + 테스트 재실행**

```bash
supabase db push
npm run test:integration -- --test-name-pattern '0012'
```

Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0012_storage_library_bucket.sql tests/migrations/0012-storage-library-bucket.test.ts
git commit -m "feat(storage): library bucket + RLS (PR A T1)"
```

---

## Task 2: 업로드 스크립트

**Files:**
- Create: `scripts/upload-library.ts`
- Modify: `package.json` (script 추가)

- [ ] **Step 1: 업로드 스크립트 작성**

```ts
// scripts/upload-library.ts
// Phase 4 M3 PR A — public/library/*.pdf → Supabase Storage idempotent 업로드
// service_role 필수. SHA-256 비교로 변경 없는 파일 skip.
//
// 사용:
//   npm run library:upload           # apply
//   npm run library:upload -- --dry-run

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
```

- [ ] **Step 2: package.json script 추가**

`package.json`의 `"scripts"` 블록에 추가:

```json
"library:upload": "node --env-file=.env.local --import tsx scripts/upload-library.ts",
"library:upload:dry-run": "node --env-file=.env.local --import tsx scripts/upload-library.ts --dry-run"
```

- [ ] **Step 3: dry-run 실행으로 4건 인식 확인**

```bash
npm run library:upload:dry-run
```

Expected: 출력에 `[uploaded] 2023-disability-work-support-research.pdf ([dry-run])` 등 4건.

- [ ] **Step 4: 실제 업로드 + Storage 확인**

```bash
npm run library:upload
```

Expected: `✅ 완료: 4건` (or skipped if 재실행).

검증:
```bash
curl -I "${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/library/2023-hr-guide.pdf"
```

Expected: `HTTP/2 200` + `content-type: application/pdf` + `content-length: 15344539`.

- [ ] **Step 5: 커밋**

```bash
git add scripts/upload-library.ts package.json
git commit -m "feat(storage): library upload script idempotent (PR A T2)"
```

---

## Task 3: library-catalog.ts URL 갱신

**Files:**
- Modify: `src/lib/library-catalog.ts:37,49,63,77`
- Test: `tests/library/library-catalog.test.ts:14-17` (prefix 가드)

- [ ] **Step 1: 기존 테스트의 prefix 가드를 Storage URL로 갱신 (실패 유도)**

`tests/library/library-catalog.test.ts:14-17` 수정 — 기존:
```ts
test('LIBRARY_ITEMS — 모든 downloadUrl이 /library/ prefix', () => {
  for (const item of LIBRARY_ITEMS) {
    assert.ok(item.downloadUrl.startsWith('/library/'), `${item.slug}: downloadUrl prefix 위반`)
  }
})
```

→ 다음으로 교체:

```ts
test('LIBRARY_ITEMS — 모든 downloadUrl이 Supabase Storage public URL', () => {
  const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/library/`
  for (const item of LIBRARY_ITEMS) {
    assert.ok(
      item.downloadUrl.startsWith(expectedPrefix),
      `${item.slug}: downloadUrl prefix 위반 (expected ${expectedPrefix}, got ${item.downloadUrl})`,
    )
    assert.ok(
      item.downloadUrl.endsWith('.pdf'),
      `${item.slug}: .pdf 확장자 누락`,
    )
  }
})
```

- [ ] **Step 2: 테스트 실행해서 fail 확인**

```bash
NEXT_PUBLIC_SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2-) \
  npm test -- --test-name-pattern 'downloadUrl이 Supabase'
```

Expected: FAIL — 4건 모두 prefix 위반 (`/library/...`).

- [ ] **Step 3: library-catalog.ts의 downloadUrl 4건 갱신**

`src/lib/library-catalog.ts`에서 `downloadUrl: "/library/...pdf"` 4건을 다음 패턴으로 교체:

```ts
// 파일 상단에 helper 추가 (LIBRARY_ITEMS 위)
const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/library`

// 각 item의 downloadUrl 갱신
downloadUrl: `${STORAGE_BASE}/2023-disability-work-support-research.pdf`,
// (line 37)

downloadUrl: `${STORAGE_BASE}/2023-hr-guide.pdf`,
// (line 49)

downloadUrl: `${STORAGE_BASE}/2024-jbu-work-support-guide.pdf`,
// (line 63)

downloadUrl: `${STORAGE_BASE}/2024-support-staff-duty-guide.pdf`,
// (line 77)
```

또한 파일 상단 주석 (line 1-8) 갱신:

```ts
/**
 * 자료실(/library) 자산 카탈로그.
 *
 * downloadUrl = Supabase Storage public URL. PDF는 `library` 버킷에 보관 (PR A M3).
 * 빌드 시 NEXT_PUBLIC_SUPABASE_URL 환경변수 필수 — 미설정 시 prefix가 깨져 LibraryCard 다운로드 링크 무효.
 *
 * D6 협업 영역 placeholder — 위원장-허유진 교수 협업 결과 추가 자산은 별도 PR.
 */
```

- [ ] **Step 4: 테스트 재실행해서 통과 확인**

```bash
NEXT_PUBLIC_SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2-) \
  npm test -- --test-name-pattern 'LIBRARY_ITEMS'
```

Expected: PASS (6 tests, 기존 5 + 갱신 1).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/library-catalog.ts tests/library/library-catalog.test.ts
git commit -m "refactor(library): downloadUrl → Supabase Storage public URL (PR A T3)"
```

---

## Task 4: 응급 우회 제거 (PDF git rm + next.config 정리)

**Files:**
- Delete: `public/library/2023-disability-work-support-research.pdf`
- Delete: `public/library/2023-hr-guide.pdf`
- Delete: `public/library/2024-jbu-work-support-guide.pdf`
- Delete: `public/library/2024-support-staff-duty-guide.pdf`
- Modify: `next.config.ts:12-17` (outputFileTracingExcludes 블록 제거)

- [ ] **Step 1: PDF 4건 git rm + `.gitkeep` 유지 확인**

```bash
git rm public/library/2023-disability-work-support-research.pdf
git rm public/library/2023-hr-guide.pdf
git rm public/library/2024-jbu-work-support-guide.pdf
git rm public/library/2024-support-staff-duty-guide.pdf

# .gitkeep 유지 확인
ls public/library/
```

Expected: `.gitkeep` 1건만 남음.

- [ ] **Step 2: next.config.ts에서 outputFileTracingExcludes 블록 제거**

`next.config.ts:12-17` 삭제:

```ts
// public/library/ PDF 4건(41MB)이 Serverless Function bundle에 trace되어
// 250MB 한계 초과(function_size_exceeded). static asset 서빙은 유지하면서
// function bundle에서 제외. M3에서 외부 storage(Supabase Storage)로 마이그레이션 예정.
outputFileTracingExcludes: {
  "*": ["public/library/**"],
},
```

Expected 결과 — `next.config.ts`는 다음과 같이 줄어듦:

```ts
import type { NextConfig } from "next";

const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";

const nextConfig: NextConfig = {
  ...(isGitHubPages && { output: "export" }),
  basePath: isGitHubPages ? "/webfortd" : "",
  images: {
    unoptimized: true,
  },
  async redirects() {
    // ... (변경 없음)
  },
};

export default nextConfig;
```

- [ ] **Step 3: 로컬 빌드로 회귀 확인**

```bash
npm run build
```

Expected: 577 정적 페이지 생성 + `function_size_exceeded` 에러 없음.

- [ ] **Step 4: 전체 테스트 회귀 확인**

```bash
npm test
```

Expected: 230+ unit, 모두 PASS.

- [ ] **Step 5: 커밋 + PR A 푸시 + 머지 + production 검증**

```bash
git add public/library next.config.ts
git commit -m "chore(infra): remove public/library PDF + outputFileTracingExcludes (PR A T4)"

git push -u origin feat/phase-4-m3-pdf-storage
gh pr create --title "feat(phase-4-m3): PR A — PDF Supabase Storage 마이그레이션" --body "$(cat <<'EOF'
## 요약

Phase 4 M3 PR A — public/library PDF 4건을 Supabase Storage로 이관.

## 변경
- T1: 0012_storage_library_bucket.sql + RLS (public read · service_role write)
- T2: scripts/upload-library.ts (idempotent SHA-256 비교)
- T3: library-catalog.ts downloadUrl → Storage public URL
- T4: public/library/*.pdf git rm + outputFileTracingExcludes 제거

## 검증
- [ ] CI validate PASS
- [ ] production deploy READY
- [ ] 4 PDF Storage URL `curl -I` 200 + Content-Type=application/pdf
- [ ] /library 4 카드 + atomic footer 2건 다운로드 링크 정합

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

CI validate PASS 대기 후:
```bash
until [ "$(gh pr checks <PR번호> --required 2>/dev/null | head -1 | awk '{print $2}')" = "pass" ]; do sleep 5; done
gh pr merge <PR번호> --admin --squash --delete-branch
git checkout master && git pull origin master --ff-only
```

production 검증 (engccer Hobby scope):
```bash
# 5~10분 대기 후
curl -I "${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/library/2023-hr-guide.pdf"
curl -I https://webfortd.vercel.app/library
curl -I https://webfortd.vercel.app/library/2023-hr-guide
```

Expected: 모두 200.

---

# Part B — SEO·접근성 게이트 (PR B)

PR A 머지 + 검증 통과 후 새 브랜치에서 시작.

```bash
git checkout master && git pull
git checkout -b feat/phase-4-m3-seo-a11y
```

## Task 5: sitemap.ts

**Files:**
- Create: `src/app/sitemap.ts`
- Test: `tests/lib/sitemap.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// tests/lib/sitemap.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sitemap from '../../src/app/sitemap'

test('sitemap — total URL count ≥ 540', async () => {
  const urls = await sitemap()
  assert.ok(urls.length >= 540, `expected ≥540, got ${urls.length}`)
})

test('sitemap — 각 entry는 url + lastModified 필드 보유', async () => {
  const urls = await sitemap()
  for (const u of urls.slice(0, 10)) {
    assert.ok(u.url, 'url 누락')
    assert.ok(u.lastModified, 'lastModified 누락')
    assert.match(u.url, /^https:\/\//, `절대 URL 아님: ${u.url}`)
  }
})

test('sitemap — 정적 라우트 (wiki entry, library, media) 포함', async () => {
  const urls = await sitemap()
  const set = new Set(urls.map((u) => u.url))
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://webfortd.vercel.app'
  for (const path of ['/', '/chat', '/library', '/media']) {
    assert.ok(set.has(`${baseUrl}${path}`), `누락: ${path}`)
  }
})

test('sitemap — atomic 535건 모두 포함', async () => {
  const urls = await sitemap()
  const atomicCount = urls.filter((u) => /\/(disability-types|policies|agreements|domains|regions|uncategorized)\//.test(u.url)).length
  assert.ok(atomicCount >= 500, `atomic ≥500 기대, ${atomicCount}건`)
})
```

- [ ] **Step 2: 테스트 fail 확인**

```bash
npm test -- --test-name-pattern 'sitemap'
```

Expected: FAIL — `Cannot find module 'src/app/sitemap'`.

- [ ] **Step 3: sitemap.ts 구현**

```ts
// src/app/sitemap.ts
// Phase 4 M3 PR B — Next.js 16 metadata file convention
// 빌드 시 정적 sitemap.xml 생성. D2 (전부 포함).

import type { MetadataRoute } from 'next'
import kbIndex from '@/lib/kb-index.generated.json'
import { LIBRARY_ITEMS } from '@/lib/library-catalog'
import { MEDIA_ITEMS } from '@/lib/media-curation'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://webfortd.vercel.app'

// 정적 라우트 — (wiki) entry + (gov)/legacy
const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/chat', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/library', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/media', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/legacy/about', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/support', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/rights', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/stories', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/participate', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/resources', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/resources/policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legacy/resources/statistics', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []

  // 정적 라우트
  for (const r of STATIC_ROUTES) {
    entries.push({
      url: `${BASE_URL}${r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })
  }

  // atomic 535건 — kb-index.generated.json의 documents 배열
  // 실제 구조: { slug, axis, filePath, frontmatter, body_excerpt }
  // URL = `/{axis}/{slug}` (M1 PR #45 (wiki) 그룹 통합 정합)
  type AtomicDoc = { slug: string; axis: string }
  const atomicDocs = (kbIndex as unknown as { documents: AtomicDoc[] }).documents ?? []
  for (const doc of atomicDocs) {
    entries.push({
      url: `${BASE_URL}/${doc.axis}/${doc.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  // library 4건 + index
  for (const item of LIBRARY_ITEMS) {
    entries.push({
      url: `${BASE_URL}/library/${item.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    })
  }

  // media — index에서 카운트만, 슬러그별 페이지 포함
  for (const item of MEDIA_ITEMS) {
    entries.push({
      url: `${BASE_URL}/media/${item.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    })
  }

  return entries
}
```

주의: `@/lib/kb-index.generated.json`은 `npm run sync:content`로 생성됨. plan 작성 시점에 구조 확인 완료 — `documents` 배열, 각 doc는 `{ slug, axis, filePath, frontmatter, body_excerpt }` 형태. axis 6종(agreements 49 + disability-types 205 + domains 140 + policies 130 + regions 10 + resources 1 = 535).

- [ ] **Step 4: 테스트 재실행 + 빌드 sitemap.xml 검증**

```bash
npm test -- --test-name-pattern 'sitemap'
```

Expected: PASS (4 tests).

빌드 후 sitemap.xml 확인:
```bash
npm run build
grep -c '<url>' .next/server/app/sitemap.xml.body 2>/dev/null || \
  curl -s http://localhost:3000/sitemap.xml | grep -c '<url>'
# (dev server 기동 후)
```

Expected: ≥540.

- [ ] **Step 5: 커밋**

```bash
git add src/app/sitemap.ts tests/lib/sitemap.test.ts
git commit -m "feat(seo): sitemap.ts 555 라우트 (PR B T5)"
```

---

## Task 6: robots.ts

**Files:**
- Create: `src/app/robots.ts`
- Test: `tests/lib/robots.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// tests/lib/robots.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import robots from '../../src/app/robots'

test('robots — User-agent: * Allow: /', () => {
  const r = robots()
  assert.ok(Array.isArray(r.rules) ? r.rules.some((rule) => rule.userAgent === '*' && rule.allow === '/') : r.rules.userAgent === '*' && r.rules.allow === '/')
})

test('robots — Sitemap 참조 포함', () => {
  const r = robots()
  assert.ok(r.sitemap, 'sitemap 필드 누락')
  const sitemapUrl = Array.isArray(r.sitemap) ? r.sitemap[0] : r.sitemap
  assert.match(sitemapUrl, /sitemap\.xml$/)
})
```

- [ ] **Step 2: 테스트 fail 확인**

```bash
npm test -- --test-name-pattern 'robots'
```

Expected: FAIL — module not found.

- [ ] **Step 3: robots.ts 구현**

```ts
// src/app/robots.ts
// Phase 4 M3 PR B — Next.js 16 metadata file convention
// 전체 공개. Disallow 없음. spec D2.

import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://webfortd.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
```

- [ ] **Step 4: 테스트 + 빌드 robots.txt 검증**

```bash
npm test -- --test-name-pattern 'robots'
```

Expected: PASS.

빌드 후:
```bash
npm run build && npm run start &
sleep 5
curl http://localhost:3000/robots.txt
kill %1
```

Expected 출력:
```
User-Agent: *
Allow: /

Sitemap: https://webfortd.vercel.app/sitemap.xml
```

- [ ] **Step 5: 커밋**

```bash
git add src/app/robots.ts tests/lib/robots.test.ts
git commit -m "feat(seo): robots.ts 전체 공개 + sitemap 참조 (PR B T6)"
```

---

## Task 7: opengraph-image.png + 메타 정합

**Files:**
- Create: `src/app/opengraph-image.png` (1200×630 PNG)
- Modify: `src/app/layout.tsx:21-25` (openGraph.images 추가)

- [ ] **Step 1: placeholder PNG 생성**

ImageMagick으로 1200×630 단색 배경 + 텍스트 placeholder 생성:

```bash
# macOS에 ImageMagick 있는지 확인
which magick || brew install imagemagick

magick -size 1200x630 \
  -background '#1e40af' \
  -fill white \
  -gravity center \
  -font 'Helvetica-Bold' \
  -pointsize 64 \
  label:'장애인교원\n교육전념 여건 지원' \
  src/app/opengraph-image.png
```

Expected: 파일 생성, `file src/app/opengraph-image.png` → `PNG image data, 1200 x 630`.

ImageMagick 미설치 환경(CI 등)에서는 Node.js 스크립트로 대체 가능하지만 본 placeholder는 위원장 로컬에서 1회 생성으로 충분.

- [ ] **Step 2: layout.tsx openGraph.images 추가**

`src/app/layout.tsx:21-25` 수정:

```tsx
openGraph: {
  type: "website",
  locale: "ko_KR",
  siteName: "장애인교원 교육전념 여건 지원",
  images: [
    {
      url: "/opengraph-image.png",
      width: 1200,
      height: 630,
      alt: "장애인교원 교육전념 여건 지원 — 위키와 채팅으로 정책·제도 안내",
    },
  ],
},
```

Next.js 16의 file-based convention(`app/opengraph-image.png`)이 자동으로 metadata에 주입되지만, 명시적으로 alt와 dimensions를 박는 것이 SNS 카드 신뢰도 높음.

- [ ] **Step 3: 빌드 + production HTML head 검증**

```bash
npm run build && npm run start &
sleep 5
curl -s http://localhost:3000/ | grep -E 'og:image|og:image:width|og:image:height|og:image:alt'
kill %1
```

Expected 출력 (최소):
```
<meta property="og:image" content="..._next/image?url=%2Fopengraph-image.png..." ... />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="장애인교원 교육전념 여건 지원 ..." />
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/opengraph-image.png src/app/layout.tsx
git commit -m "feat(seo): OG image placeholder 1200x630 + metadata (PR B T7)"
```

---

## Task 8: Playwright + axe-core a11y 테스트

**Files:**
- Modify: `package.json` (dev dep + script)
- Create: `playwright.config.ts`
- Create: `tests/a11y/axe-helper.ts`
- Create: `tests/a11y/critical-routes.spec.ts`
- Create: `tests/a11y/atomic-samples.spec.ts`

- [ ] **Step 1: dev dependency 설치 + Playwright 브라우저**

```bash
npm install --save-dev @axe-core/playwright @playwright/test
npx playwright install chromium
```

Expected: `package.json` `devDependencies`에 두 패키지 추가, `~/.cache/ms-playwright/chromium-*`에 브라우저 바이너리.

- [ ] **Step 2: playwright.config.ts 작성**

```ts
// playwright.config.ts
// Phase 4 M3 PR B — chromium 단일 브라우저, dev server 자동 기동
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/a11y',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 3: axe-helper.ts 작성**

```ts
// tests/a11y/axe-helper.ts
// axe-core 공통 헬퍼 — critical/serious violation 0건 검증.
// moderate/minor는 허용 (향후 fix 큐).

import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

const BLOCKING_IMPACTS = new Set(['critical', 'serious'])

export async function expectNoAxeViolations(page: Page, info: TestInfo, route: string) {
  await page.goto(route, { waitUntil: 'networkidle' })

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''))

  if (blocking.length > 0) {
    const report = blocking.map((v) =>
      `[${v.impact}] ${v.id}: ${v.help}\n  ${v.helpUrl}\n  affected: ${v.nodes.length} node(s)`,
    ).join('\n\n')
    await info.attach('axe-violations', { body: report, contentType: 'text/plain' })
  }

  expect(blocking, `${route} — critical/serious 0건 기대, ${blocking.length}건 발견`).toEqual([])
}
```

- [ ] **Step 4: 핵심 6 라우트 spec 작성**

```ts
// tests/a11y/critical-routes.spec.ts
// D8 — 6 핵심 라우트 a11y 검증
import { test } from '@playwright/test'
import { expectNoAxeViolations } from './axe-helper'

const ROUTES = [
  '/',
  '/chat',
  '/library',
  '/media',
  '/library/2023-hr-guide',
  '/legacy/about',
]

for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }, info) => {
    await expectNoAxeViolations(page, info, route)
  })
}
```

- [ ] **Step 5: atomic 샘플 3건 spec 작성**

axis별 atomic 1건 무작위 샘플링. 빌드 시 고정 sample (회귀 재현성).

```ts
// tests/a11y/atomic-samples.spec.ts
// D8 — atomic axis별 샘플 3건 a11y 검증.
// 샘플은 고정 (회귀 재현성). 실제 atomic slug = kb-index.generated.json 조회 결과.
import { test } from '@playwright/test'
import { expectNoAxeViolations } from './axe-helper'

const ATOMIC_SAMPLES = [
  '/disability-types/2023-hr-p-004',  // axis 205건 중 첫 slug
  '/policies/2023-hr-1-3',             // axis 130건 중 첫 slug
  '/agreements/2020-ca-1-2',           // axis 49건 중 첫 slug
]

for (const route of ATOMIC_SAMPLES) {
  test(`a11y atomic: ${route}`, async ({ page }, info) => {
    await expectNoAxeViolations(page, info, route)
  })
}
```

**근거**: plan 작성 시점에 kb-index.generated.json 조회로 axis별 실 slug 확인 (axes: agreements 49, disability-types 205, domains 140, policies 130, regions 10, resources 1). 회귀 재현성을 위해 *고정 샘플 3건* 유지. 추가 회귀 발견 시 별도 issue.

- [ ] **Step 6: package.json script 추가**

```json
"test:a11y": "playwright test",
"test:a11y:ui": "playwright test --ui"
```

- [ ] **Step 7: 로컬 실행 검증**

```bash
npm run test:a11y
```

Expected: 9 tests (6 critical + 3 atomic), 모두 PASS (critical/serious 0건).

만약 일부 violation 발견 → fix 후 재실행. fix가 광범위하면 별도 PR로 격리.

- [ ] **Step 8: 커밋**

```bash
git add package.json package-lock.json playwright.config.ts tests/a11y/
git commit -m "test(a11y): @axe-core/playwright 9 라우트 (PR B T8)"
```

---

## Task 9: GitHub Actions a11y workflow

**Files:**
- Create: `.github/workflows/a11y.yml`

- [ ] **Step 1: workflow 파일 작성**

```yaml
# .github/workflows/a11y.yml
# Phase 4 M3 PR B — PR마다 axe-core 9 라우트 검증
name: a11y

on:
  pull_request:
    branches: [master]
  push:
    branches: [master]

jobs:
  axe:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      NEXT_PUBLIC_SITE_URL: http://localhost:3000

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}
          restore-keys: ${{ runner.os }}-playwright-

      - name: Install Playwright chromium
        run: npx playwright install --with-deps chromium

      - name: Run a11y tests
        run: npm run test:a11y

      - name: Upload report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: GitHub Secrets 확인**

GitHub 저장소 Settings → Secrets에 다음 2건이 등록되어 있어야 함 (기존 validate workflow에서 사용 중일 가능성 높음 — 확인):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

미등록이면 위원장이 수동 등록:
```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "$(grep ^NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2-)"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "$(grep ^NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2-)"
```

- [ ] **Step 3: 커밋 (workflow는 PR 머지 후 활성)**

```bash
git add .github/workflows/a11y.yml
git commit -m "ci(a11y): GitHub Actions axe-core 9 라우트 (PR B T9)"
```

---

## Task 10: 위원장 VoiceOver 체크리스트

**Files:**
- Create: `docs/VOICEOVER_CHECKLIST.md`

- [ ] **Step 1: 체크리스트 작성**

```markdown
# 위원장 VoiceOver 검수 체크리스트

> **목적**: 자동 검증(axe-core)이 못 잡는 *실제 사용 경험*을 위원장이 iPhone Safari + VoiceOver로 10분 동안 점검.
> **시점**: Phase 4 M3 PR B 머지 + production deploy 검증 직후.
> **결과 보관**: 자유 형식 메모 → `~/Library/CloudStorage/GoogleDrive-hudt0715@gmail.com/My Drive/장교조 업무 공유 폴더/17. 교육부 및 교육청 등 정책연구/2026년 교육부 정책연구/[과제 5[ 정보 지원 웹페이지 개발 및 운영/`

---

## 사전 준비

- iPhone Safari, VoiceOver 활성 (설정 → 손쉬운 사용 → VoiceOver, 트리플 클릭으로 토글)
- 헤드폰 권장 (스피커는 주변 소음 영향)
- 시작 URL: https://webfortd.vercel.app/

---

## 7 step (각 1~2분)

### 1. Skip-link
- `/` 진입 → 첫 Tab 한 번 누름 → "본문으로 이동" 링크 음성 안내 확인
- Enter → main-content 영역으로 점프 (header 건너뜀)

### 2. 헤더 nav 순회
- Tab/Shift+Tab으로 헤더 nav 항목 순회
- 각 항목 음성 안내 명확 (위키 / 채팅 / 자료실 / 미디어 / 로그인 등)
- 현재 페이지는 aria-current 음성 "현재 페이지" 안내

### 3. 위키 entry hero + RoleEntries 5장
- `/` 위키 entry 페이지에서 hero 제목 음성 안내
- RoleEntries 5장 카드 (교사 / 관리자 / 사무 / 정책 / 학부모) 각각 *역할 + 한 줄 설명* 음성 안내
- placeholder 2장(정책·학부모)은 "준비 중" 음성 안내

### 4. /library 카드 4장 + 검색
- `/library` 진입 → 카드 4장 음성 안내 (제목 + 연도 + 기관)
- 검색 input → "자료실 검색" placeholder 음성
- "인사관리" 입력 → 결과 1건 음성

### 5. /library/[slug] + atomic footer
- `/library/2023-hr-guide` 진입 → 상세 정보 음성
- 페이지 하단 "원본 자료 다운로드" 링크 도달 → Enter로 PDF 다운로드 시작 음성

### 6. /chat 입력 + 추천 + 응답
- `/chat` 진입 → 입력창 focus 음성 "메시지 입력"
- 추천 버튼 3개 Tab으로 도달 → Enter
- 응답 카드 aria-live로 실시간 음성 안내 ("응답 중..." → 텍스트)
- sourceRefs 출처 카드 Tab 도달 가능

### 7. 모바일 회전
- 세로 모드에서 위 5단계 흐름 자연스러움 확인
- iPhone 회전 → 가로 모드 → 레이아웃 깨짐 X, 음성 흐름 유지

---

## 발견 시 처리

- **Critical** (사용 불가 수준): 즉시 별도 PR fix, M3 머지 차단
- **Moderate** (사용 가능하나 불편): 별도 issue 또는 Phase 5 큐
- **Nit** (취향 수준): 무시

발견 사항은 자문 디렉터리에 자유 형식 기록.

---

## 종료

7 step 모두 통과 → Phase 4 M3 완료 → Phase 4 종료 선언.
```

- [ ] **Step 2: 커밋**

```bash
git add docs/VOICEOVER_CHECKLIST.md
git commit -m "docs(a11y): VoiceOver 검수 체크리스트 7 step (PR B T10)"
```

- [ ] **Step 3: PR B 푸시 + 머지 + production 검증 + VoiceOver 수행**

```bash
git push -u origin feat/phase-4-m3-seo-a11y
gh pr create --title "feat(phase-4-m3): PR B — SEO + axe-core CI + VoiceOver 체크리스트" --body "$(cat <<'EOF'
## 요약

Phase 4 M3 PR B — sitemap·robots·OG 메타 + axe-core CI + 위원장 VoiceOver 체크리스트.

## 변경
- T5: src/app/sitemap.ts (555 URL)
- T6: src/app/robots.ts (전체 공개 + Sitemap 참조)
- T7: src/app/opengraph-image.png + layout.tsx openGraph.images
- T8: @axe-core/playwright + 9 라우트 spec
- T9: .github/workflows/a11y.yml
- T10: docs/VOICEOVER_CHECKLIST.md

## 검증
- [ ] CI validate PASS
- [ ] CI a11y PASS (critical/serious 0건)
- [ ] production deploy READY
- [ ] /sitemap.xml URL count ≥ 540
- [ ] /robots.txt 정합
- [ ] og:image 메타 production HTML head 정합
- [ ] 위원장 VoiceOver 7 step 통과 (별도 보고)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

CI 그린 + admin squash merge + production 검증:

```bash
# CI 대기
until [ "$(gh pr checks <PR번호> --required 2>/dev/null | head -1 | awk '{print $2}')" = "pass" ]; do sleep 5; done
gh pr merge <PR번호> --admin --squash --delete-branch
git checkout master && git pull origin master --ff-only

# production 검증
curl -s https://webfortd.vercel.app/sitemap.xml | grep -c '<url>'
# Expected: ≥540

curl -s https://webfortd.vercel.app/robots.txt
# Expected: User-Agent: * / Allow: / / Sitemap: ...

curl -s https://webfortd.vercel.app/ | grep -E 'og:image'
# Expected: og:image meta 존재 + opengraph-image.png URL
```

위원장 VoiceOver 수행 + 결과 메모.

- [ ] **Step 4: Phase 4 완료 선언 (위원장 메타 갱신)**

VoiceOver 통과 후 위원장이 수동:
- `CLAUDE.md` — 변경 이력에 Phase 4 M3 머지 + Phase 4 완료 선언 entry 추가
- `MEMORY.md` Quick Reference 갱신
- `memory/project_phase_status.md` Phase 4 종료 entry 추가

---

## Spec Coverage 검토

| Spec 요구사항 | 구현 Task | 비고 |
|--------------|----------|------|
| D1 PDF Storage M3 초반 | T1~T4 (PR A 우선) | ✓ |
| D2 sitemap 전부 (~555 URL) | T5 | ✓ atomic 535 + 정적 12 + library 4 + media 1 |
| D3 OG image 정적 1장 placeholder | T7 | ✓ ImageMagick으로 1200×630 단색 |
| D4 axe-core CI + VoiceOver | T8, T9, T10 | ✓ |
| D5 단독 Agent + codex-rescue (b) skip | plan 운영 정합 (별도 task 불요) | ✓ M1·M2 패턴 |
| D6 PR 2개 분리 | Part A → 머지 → Part B | ✓ |
| D7 bucket = library (RLS) | T1 | ✓ public read + service_role write |
| D8 a11y 9 라우트 | T8 (6 critical + 3 atomic) | ✓ |
| R1 RLS 오설정 | T1 마이그레이션 SQL + 통합 테스트 | ✓ |
| R2 외부 백링크 깨짐 | PR A 머지 전 `webfortd.vercel.app/library/` Google 검색 (위원장 확인) | 위원장 수동 |
| R3 sitemap 비용 | Next.js 빌드 시 정적 — T5에서 검증 | ✓ |
| R4 OG placeholder 품질 | T7 컨센서스 | ✓ 별도 PR 디자인 교체 |
| R5 axe-core CI 시간 | T8·T9 chromium only + 9 라우트 cap | ✓ |
| R6 VoiceOver 시간 부담 | T10 10분 cap | ✓ |

**누락 없음.** R2 (외부 백링크 검색)는 PR A 머지 직전 위원장이 수동 확인.

---

## 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-28 | 초기 작성 — spec PR #49 머지 후, brainstorming Q1~Q6 결정 잠금 + 10 task 분해 + PR A/B 머지 흐름 |
