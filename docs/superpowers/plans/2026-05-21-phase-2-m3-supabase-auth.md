# Phase 2 M3 — Supabase Auth (이메일 매직링크) + `(wiki)` 그룹 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase Auth 이메일 매직링크 활성화 + Next.js 16 `proxy.ts` 세션 갱신 + AuthContext/AuthModal UI + RLS authenticated role 정합. M3 끝나면 위원장 및 조합원이 *이메일로 로그인*하여 향후 피드·챗봇 이력 기능에 사용할 인증 토대가 깔린다. 동시에 M2 codex-rescue carry-over 2건(M3-block) 처리.

**Architecture:** dodo-planet의 `src/lib/supabase/{client,middleware,server,service-role}.ts` + `AuthContext` 패턴을 webfortd로 이식. Next.js 16 `proxy.ts`(formerly middleware.ts)에서 세션 refresh. `(wiki)` 그룹의 *읽기*는 익명 허용, *쓰기 액션*은 로그인 요구 (M3 시점엔 쓰기 UI 0개 — 인프라만, Phase 3·4에서 실제 적용).

**Tech Stack:** `@supabase/ssr@^0.6.x`, `@supabase/supabase-js@^2.106` (이미 devDep), Next.js 16 proxy.ts (CVE-2025-29927 패치된 `next@16.0.11+`).

---

## 비개발자용 쉬운 설명 (위원장 보고용)

이 작업이 끝나면 무엇이 달라지나:

1. **이메일 로그인 화면이 생긴다** — 위원장님과 조합원이 이메일 주소 입력 → 받은 메일의 매직링크 클릭 → 로그인 완료. 비밀번호 X.
2. **로그인한 사용자는 위키 헤더 우측에 "로그아웃" 버튼이 보임** — 비로그인이면 "로그인" 버튼.
3. **M3 시점에 *실제 게이트되는 기능은 0개*** — 위키 페이지·챗봇 mock UI는 익명 그대로 작동. 다만 다음 단계(Phase 3 챗봇 이력 저장, Phase 4 피드)에서 즉시 로그인 게이트를 켤 수 있는 *인프라*가 완성된다.
4. **위원장 워크플로 영향**: 위원장님은 처음 로그인 1회만 하면 됨. 이후 세션이 자동 유지 (~1주, 설정값에 따라). 매번 로그인 안 함.

M3 carry-over 두 건도 함께 처리:
- **carry-over 1**: sync 스크립트가 535페이지보다 많아져도 안전하게 일치 검증 (페이징 가드)
- **carry-over 2**: 위키 페이지 본문의 wiki_links 컬럼과 backlinks 인덱스를 *완전 동일 추출 경로*로 통일 (현재는 두 경로가 미세하게 다름)

왜 한꺼번에? → 둘 다 *데이터 정합성* 영역이라 M3-block에서 처리하면 인증 작업과 분리 명확. 그 위에 인증 인프라를 얹는 게 순서.

---

## File Structure

| 경로 | 책임 | 신규/수정 |
|------|------|-----------|
| `scripts/sync-content-to-db.ts` | Task 1 (slugToId 페이징 가드) + Task 2 (wiki_links derivation 통일) | 수정 |
| `scripts/sync-content.ts` (또는 lib) | Task 2의 wiki_links 추출 유틸리티 export 추가 | 수정 |
| `tests/sync-content-to-db.test.ts` | Task 1·2 단위 테스트 추가 | 수정 |
| `src/lib/supabase/server.ts` | Server Component / Server Action용 client (cookies + SSR) | 신규 |
| `src/lib/supabase/middleware.ts` | session refresh 로직 (proxy.ts에서 호출) | 신규 |
| `src/lib/supabase/client.ts` | browser client에 SSR cookie 지원 추가 (createBrowserClient) | 수정 |
| `src/proxy.ts` | Next.js 16 proxy entry — session refresh 호출 | 신규 |
| `src/contexts/AuthContext.tsx` | `useUser()`, `useAuth()` 훅 — auth 상태 client-side | 신규 |
| `src/components/auth/AuthModal.tsx` | 이메일 입력 + 매직링크 발송 + 상태 표시 (접근성 ARIA 필수) | 신규 |
| `src/components/auth/SignInButton.tsx` | 위키 헤더 버튼 — 로그인/로그아웃 토글 | 신규 |
| `src/app/(wiki)/layout.tsx` 또는 `src/components/layout/WikiHeader.tsx` | SignInButton 통합 | 수정 |
| `src/app/auth/callback/route.ts` | 매직링크 콜백 처리 (code → session 교환) | 신규 |
| `supabase/migrations/0002_auth_setup.sql` | (옵션) email confirm template/redirect URL은 dashboard에서 → 마이그레이션 X 또는 minimal | 신규 (옵션) |
| `tests/auth/auth-flow.test.ts` | AuthContext + AuthModal 단위 테스트 (mocked) | 신규 |
| `.env.local.example` | `NEXT_PUBLIC_SITE_URL` placeholder (매직링크 redirect base) | 수정 |
| `package.json` | `@supabase/ssr` 추가 | 수정 |

**파일 크기**: 대부분 100~200 lines. AuthModal이 가장 클 수 있음 (300 lines, 접근성 ARIA 보강 시).

---

## 설계 결정 (M3 시점에 박는 것)

### D1. 이메일 매직링크 only (Phase 2 결정 그대로)

비밀번호 없음, OTP 없음, OAuth 없음. 이메일 입력 → 발송 → 클릭으로 로그인. 위원장 시각장애 + 접근성 우선 + 비밀번호 관리 부담 0.

향후 Google OAuth는 Phase 4 이후 위원장 결정으로 추가 가능.

### D2. 세션 유지 = `cookieOptions.maxAge` 1주 (Supabase 기본 사용)

기본값 사용. 1주 후 재로그인 필요. 위원장 워크플로 부담 적당.

### D3. `(wiki)` 그룹의 *쓰기 액션*만 로그인 게이트 (M3 시점엔 쓰기 0개)

M3는 인프라만 — UI에 게이트 적용은 Phase 3·4에서. 예시:
- Phase 3 챗봇 이력 저장: 로그인 사용자만
- Phase 4 피드 작성·댓글·좋아요: 로그인 사용자만

M3 시점 *RLS write 정책*도 추가하지 않음 (Phase 3·4 진입 시 도입). 현재 anon read-published 정책 유지.

### D4. 매직링크 redirect = `NEXT_PUBLIC_SITE_URL/auth/callback`

환경변수 `NEXT_PUBLIC_SITE_URL` 필요 (개발: localhost:3000, 프로덕션: webfortd.vercel.app). callback route가 code → session 교환.

### D5. Supabase Auth Email Provider = Supabase default SMTP

별도 ESP (Resend 등) 설정 안 함. Supabase default SMTP rate limit ~4/hour. 장교조 조합원 규모(~수십명)라 충분.

대량 발송 (Phase 4 피드 알림 등) 도입 시 Resend Marketplace 전환 검토.

### D6. M3-block (M2 carry-over) 처리 순서

Task 1 (slugToId 페이징 가드) → Task 2 (wiki_links derivation 통일) → Task 3 (Auth 활성화) → ... 순서. carry-over가 *데이터 정합성*이므로 인증 본체 *전*에 처리.

### D7. dodo-planet 패턴 직접 이식 + Next.js 16 변환

dodo-planet의 `src/lib/supabase/{client,middleware,server,service-role}.ts` + `AuthContext.tsx` 패턴 참고. webfortd는 Next.js 16이라:
- `middleware.ts` → `src/proxy.ts`
- `cookies()` → `await cookies()` (Next.js 16 async)
- `Request.url` → `request.nextUrl`
- `service-role.ts` 이름 → `admin.ts` (webfortd 컨벤션)

### D8. 접근성 (협상 불가)

AuthModal은 `aria-modal="true"`, `role="dialog"`, focus trap, Esc 키 닫기, 이메일 입력 `type="email"` + `inputmode="email"`. SignInButton은 명확한 label ("로그인" / "로그아웃 (이메일주소)"). 매직링크 발송 후 상태 변경은 `aria-live="polite"`.

### D9. 재 sync (Task 2 후속)

Task 2의 wiki_links derivation 변경 후 *535 페이지 재 sync* 필요 (`npm run kb:sync`). 운영 DB의 documents.wiki_links 컬럼이 새 derivation 결과로 갱신. user-facing 영향 0 (모두 draft).

---

## Task 1: M3-block-1 — `slugToId` 페이징 가드

**Files:**
- Modify: `scripts/sync-content-to-db.ts` (slug → id fetch 부분)
- Modify: `tests/sync-content-to-db.test.ts` (단위 테스트 1건 추가)

**Codex-rescue concern**: 현재 `client.from('documents').select('id, slug')`가 Supabase JS의 기본 1000 row cap을 활용. 535 < 1000 안전. 미래 1000+ documents 시 silent truncation → backlinks insert에서 일부 source 누락.

### Step 1.1: 실패 테스트 추가

`tests/sync-content-to-db.test.ts`의 기존 describe 블록 끝에 추가:

```typescript
describe('main() slugToId fetch — paging guard (mocked)', () => {
  test('idRows.length < expectedCount → throw', () => {
    // simulating a future state where DB has 1500 rows but PostgREST default limit=1000
    // 직접 main()을 호출하는 대신 가드 로직만 단위로 검증
    const expectedCount = 1500
    const idRows = Array.from({ length: 1000 }, (_, i) => ({
      id: `id-${i}`,
      slug: `s-${i}`,
    }))
    // 가드 직접 호출 — main 안의 inline 어설션을 helper로 분리하면 테스트 가능
    assert.throws(() => assertIdRowsComplete(idRows, expectedCount), /slug→id fetch 누락/)
  })

  test('idRows.length === expectedCount → no throw', () => {
    const expectedCount = 1500
    const idRows = Array.from({ length: 1500 }, (_, i) => ({
      id: `id-${i}`,
      slug: `s-${i}`,
    }))
    assert.doesNotThrow(() => assertIdRowsComplete(idRows, expectedCount))
  })
})
```

import 보강: `assertIdRowsComplete` from `../scripts/sync-content-to-db.ts`.

### Step 1.2: 실행 → FAIL (`assertIdRowsComplete is not a function`)

### Step 1.3: 구현 — `scripts/sync-content-to-db.ts`에 helper 추가 + main 통합

helper 함수 (기존 import 영역 다음에 export):

```typescript
export function assertIdRowsComplete(
  idRows: { id: string; slug: string }[] | null,
  expectedCount: number,
): void {
  const actual = idRows?.length ?? 0
  if (actual < expectedCount) {
    throw new Error(
      `slug→id fetch 누락: ${expectedCount} upserted but ${actual} returned. Supabase default limit 1000 의심 — .range(0, expectedCount-1) 또는 페이징 필요.`,
    )
  }
}
```

main 함수의 slug fetch 영역 (기존):
```typescript
const { data: idRows, error: fetchError } = await client
  .from('documents')
  .select('id, slug')
```

다음으로 *교체* (.range + 어설션):
```typescript
const { data: idRows, error: fetchError } = await client
  .from('documents')
  .select('id, slug')
  .range(0, rows.length + 100) // generous ceiling (rows.length + 여유 100)
if (fetchError) {
  throw new Error(`documents id fetch 실패: ${fetchError.message}`)
}
assertIdRowsComplete(idRows, rows.length)
```

### Step 1.4: 테스트 PASS + 회귀

```bash
node --import tsx --test tests/sync-content-to-db.test.ts 2>&1 | tail -10
npm run test 2>&1 | tail -10
```

Expected: 11 + 2 = 13 sync tests + 89 unit = 102 PASS.

### Step 1.5: dry-run 검증

```bash
npm run kb:sync:dry-run
```

Expected: 변동 없음 (`535 documents transform OK`).

### Step 1.6: 실 운영 재 sync (idempotent)

```bash
npm run kb:sync
```

Expected: 535 documents 그대로, backlinks 1040 그대로 (delete + re-insert).

### Step 1.7: 통합 테스트

```bash
npm run test:integration
```

Expected: 12/12 PASS 유지.

### Step 1.8: commit

```bash
git add scripts/sync-content-to-db.ts tests/sync-content-to-db.test.ts
git commit -m "fix(sync): add slugToId paging guard (.range + length assertion) — M2 codex-rescue carry-over

M3-block-1: Supabase JS 기본 1000 row cap이 미래 1000+ docs 시 silent truncation.
assertIdRowsComplete helper + .range(0, rows.length+100) ceiling으로 신호."
```

---

## Task 2: M3-block-2 — `wiki_links` derivation 통일

**Files:**
- Modify: `scripts/sync-content-to-db.ts` (transformDocumentRow에서 extractWikiLinks 대신 kb-index의 wikilink_adjacency 사용)
- Modify: `tests/sync-content-to-db.test.ts` (테스트 fixture 업데이트 + 새 케이스)

**Codex-rescue concern**: `sync-content.ts`의 wiki_backlinks는 code-block 마스킹 적용. `sync-content-to-db.ts`의 transform 함수는 raw 마크다운에서 정규식 추출 (마스킹 X). 결과 divergence: 코드블록 안 `[[fake-slug]]`가 `documents.wiki_links`에는 들어가지만 `wiki_backlinks` 인덱스엔 없음.

해결: kb-index가 이미 `wikilink_adjacency: Record<sourceSlug, targetSlug[]>`를 가지고 있음 (`src/lib/kb.ts:55`). transform에서 *이 값을 그대로 사용*. 단일 source of truth.

### Step 2.1: 실패 테스트 추가

기존 transform 테스트에 wiki_links 케이스 추가:

```typescript
test('wiki_links는 kb-index의 wikilink_adjacency를 source로 사용 (code-block 마스킹 적용된 값)', () => {
  const doc = {
    slug: 'test-wiki-links',
    axis: 'agreements' as const,
    filePath: 'content/agreements/test-wiki-links.md',
    frontmatter: { /* ... 기존 fixture와 동일, 생략 */ },
    body_excerpt: '',
  }
  const contentMd = '본문에 [[real-link]] 있고 ```js\n[[fake-link]]\n``` 코드블록도 있다'
  // wikilink_adjacency 입력 (sync-content.ts가 마스킹 후 'real-link'만 남김)
  const adjacency = ['real-link']
  const row = transformDocumentRow(doc, contentMd, adjacency)
  // 코드블록 안 fake-link는 *없어야* 함
  assert.deepEqual(row.wiki_links, ['real-link'])
})
```

기존 테스트 3건 fixture에 `adjacency` 빈 배열 인자 추가 (signature 변경).

### Step 2.2: 실행 → FAIL (시그니처 변경)

### Step 2.3: 구현 — `transformDocumentRow` 시그니처 변경

기존:
```typescript
export function transformDocumentRow(
  doc: KBDocumentSummary,
  contentMd: string,
): DocumentRow {
  // ...
  wiki_links: extractWikiLinks(contentMd),
  // ...
}
```

다음으로 변경:
```typescript
export function transformDocumentRow(
  doc: KBDocumentSummary,
  contentMd: string,
  wikiLinksFromAdjacency: string[],
): DocumentRow {
  // ...
  wiki_links: wikiLinksFromAdjacency,
  // ...
}
```

`extractWikiLinks` 함수 *삭제* (또는 deprecated 주석 + unused export 명시).

### Step 2.4: main() 함수에서 adjacency 추출 + 전달

기존 transform 루프:
```typescript
for (const doc of documents) {
  const body = loadBody(doc.filePath)
  rows.push(transformDocumentRow(doc, body))
}
```

다음으로 변경:
```typescript
const adjacency = (kbIndex as unknown as { wikilink_adjacency: Record<string, string[]> }).wikilink_adjacency
for (const doc of documents) {
  const body = loadBody(doc.filePath)
  const links = adjacency[doc.slug] ?? []
  rows.push(transformDocumentRow(doc, body, links))
}
```

### Step 2.5: 테스트 PASS + 회귀

기존 3 transform 테스트는 `adjacency` 인자에 `[]` 또는 적절한 값 추가해 통과시킴.

```bash
npm run test 2>&1 | tail -10
```

Expected: 102 + 1 (새 wiki_links 케이스) = 103 PASS.

### Step 2.6: dry-run 검증

```bash
npm run kb:sync:dry-run
```

Expected: 535 documents transform OK. wiki_links는 adjacency에서 derive.

### Step 2.7: 실 운영 재 sync

```bash
npm run kb:sync
```

Expected: documents 535 + backlinks 1040 (변동 없음). wiki_links 컬럼 값만 *마스킹 적용된 결과로 갱신*.

### Step 2.8: 통합 테스트

```bash
npm run test:integration
```

Expected: 12/12 PASS.

### Step 2.9: commit

```bash
git add scripts/sync-content-to-db.ts tests/sync-content-to-db.test.ts
git commit -m "fix(sync): wiki_links derivation을 wikilink_adjacency single source로 통일 — M2 codex-rescue carry-over

M3-block-2: transformDocumentRow가 wiki_links를 raw extractWikiLinks 대신
kb-index의 wikilink_adjacency에서 받음. 코드블록 마스킹된 결과 단일 source.
documents.wiki_links와 wiki_backlinks invert가 동일 추출 경로 보장."
```

---

## Task 3: Supabase Auth 활성화 (dashboard 설정)

**Files**: 없음 (Supabase dashboard 작업)

⚠️ Auth 설정은 Supabase MCP가 권한 막혀있으므로 *위원장 수동* 또는 *CLI* 또는 *Chrome 자동화*로 처리.

### Step 3.1: Supabase dashboard에서 Email Provider 확인

URL: https://supabase.com/dashboard/project/djaeeqdxkynjxngwvzyn/auth/providers

기본적으로 Email Provider는 *활성화됨*. 확인만:
- Email Provider = ON
- Confirm email = ON 또는 OFF (위원장 결정 — 매직링크는 본질적으로 email 확인)
- Secure email change = ON

`Magic Link`는 Email Provider의 sub-feature. 별도 설정 X.

### Step 3.2: Site URL 설정

URL: https://supabase.com/dashboard/project/djaeeqdxkynjxngwvzyn/auth/url-configuration

- **Site URL**: `https://webfortd.vercel.app`
- **Redirect URLs**: 
  - `http://localhost:3000/**`
  - `https://webfortd.vercel.app/**`
  - (preview 도메인 — Vercel preview deployment 시 추가 필요)

### Step 3.3: Email Template (옵션, default 사용 권장)

Magic Link template은 Supabase default 그대로 사용. 한국어 번역은 향후 옵션.

### Step 3.4: 검증

dashboard 또는 API로 Email Provider 활성 확인. 별도 commit 없음.

---

## Task 4: @supabase/ssr 설치 + server.ts + middleware.ts + proxy.ts

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Modify: `src/lib/supabase/client.ts` (createBrowserClient로 변경)
- Create: `src/proxy.ts`
- Create: `src/app/auth/callback/route.ts`
- Modify: `.env.local.example` (`NEXT_PUBLIC_SITE_URL`)
- Modify: `package.json` (@supabase/ssr)

dodo-planet의 동일 파일 4개를 참고해 webfortd로 이식. Next.js 16 변환:
- `middleware.ts` → `src/proxy.ts`
- async `cookies()` 처리
- `NextResponse` import 동일

### Step 4.1: @supabase/ssr 설치

```bash
npm install @supabase/ssr
```

### Step 4.2: `src/lib/supabase/client.ts` 갱신 (createBrowserClient)

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getBrowserClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error('Supabase env 미설정')
    }
    _client = createBrowserClient(url, anonKey)
  }
  return _client
}

// 기존 getAnonClient는 backward-compat alias
export const getAnonClient = getBrowserClient
```

### Step 4.3: `src/lib/supabase/server.ts` 신규

```typescript
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies() // Next.js 16 async
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase env 미설정')

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Component에서 호출 시 set 불가 — 무시 (proxy.ts가 처리)
        }
      },
    },
  })
}
```

### Step 4.4: `src/lib/supabase/middleware.ts` 신규

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // 세션 refresh (필수 — getUser 호출이 cookie 갱신 트리거)
  await supabase.auth.getUser()

  return response
}
```

### Step 4.5: `src/proxy.ts` 신규 (Next.js 16)

```typescript
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // _next, favicon, image optimization 등 제외
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Step 4.6: `src/app/auth/callback/route.ts` 신규

```typescript
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/wiki'

  if (code) {
    const supabase = await getServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

### Step 4.7: `.env.local.example` 갱신

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local`에도 직접 추가 (controller 또는 implementer가 수동).

### Step 4.8: 빌드 + 회귀 검증

```bash
npm run build
npm run test
```

Expected: 564~566 페이지 그린 + 103 unit tests 그린.

### Step 4.9: commit

```bash
git add src/lib/supabase/{server,middleware,client}.ts src/proxy.ts src/app/auth/callback/route.ts .env.local.example package.json package-lock.json
git commit -m "feat(auth): add @supabase/ssr + server.ts + middleware.ts + proxy.ts + callback route

Next.js 16 proxy.ts에서 session refresh. dodo-planet 패턴 이식 + async cookies() 변환."
```

---

## Task 5: AuthContext + AuthModal UI (접근성 ARIA 정합)

**Files:**
- Create: `src/contexts/AuthContext.tsx`
- Create: `src/components/auth/AuthModal.tsx`
- Create: `tests/auth/auth-flow.test.ts`

### Step 5.1: `src/contexts/AuthContext.tsx`

dodo-planet의 AuthContext 패턴 참고. 핵심:
- `useUser()` → 현재 user 또는 null
- `useAuth()` → `{ signInWithMagicLink(email), signOut() }`
- onAuthStateChange listener로 user 상태 동기화

```typescript
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getBrowserClient } from '@/lib/supabase/client'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  async function signInWithMagicLink(email: string) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    })
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
```

### Step 5.2: `src/components/auth/AuthModal.tsx` (접근성 ARIA)

shadcn/ui Dialog 패턴 + 이메일 입력 + 매직링크 발송 상태 표시. 키보드 navigation + focus trap (Radix Dialog 기본 제공).

```tsx
'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await signInWithMagicLink(email)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="auth-desc">
        <DialogHeader>
          <DialogTitle>이메일로 로그인</DialogTitle>
          <DialogDescription id="auth-desc">
            이메일 주소를 입력하시면 매직링크를 보내드립니다. 링크를 클릭하면 로그인됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="이메일 주소 입력"
            disabled={status === 'sending' || status === 'sent'}
          />
          <Button type="submit" disabled={status === 'sending' || status === 'sent'}>
            {status === 'sending' ? '발송 중...' : '매직링크 보내기'}
          </Button>
        </form>

        <div aria-live="polite" className="min-h-[1.5rem] text-sm">
          {status === 'sent' && '이메일을 확인해 주세요.'}
          {status === 'error' && `오류: ${errorMsg}`}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 5.3: 단위 테스트 — `tests/auth/auth-flow.test.ts`

mocked browser client로 AuthContext의 signInWithMagicLink + signOut 동작 검증 (2~3건).

### Step 5.4: 빌드 + 테스트

```bash
npm run build
npm run test
```

Expected: 빌드 그린 + 회귀 0 + 새 테스트 PASS.

### Step 5.5: commit

```bash
git add src/contexts/AuthContext.tsx src/components/auth/AuthModal.tsx tests/auth/auth-flow.test.ts
git commit -m "feat(auth): add AuthContext + AuthModal (이메일 매직링크, 접근성 ARIA 정합)"
```

---

## Task 6: 위키 헤더에 SignInButton 통합

**Files:**
- Create: `src/components/auth/SignInButton.tsx`
- Modify: `src/app/(wiki)/layout.tsx` 또는 헤더 컴포넌트 (AuthProvider 래핑 + SignInButton 배치)

### Step 6.1: `src/components/auth/SignInButton.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { AuthModal } from './AuthModal'

export function SignInButton() {
  const { user, loading, signOut } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) return <div aria-live="polite">로그인 상태 확인 중...</div>

  if (user) {
    return (
      <Button variant="outline" onClick={signOut} aria-label={`로그아웃 (${user.email})`}>
        로그아웃
      </Button>
    )
  }

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>로그인</Button>
      <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
```

### Step 6.2: AuthProvider를 `(wiki)/layout.tsx`에 래핑 + SignInButton 헤더에 통합

`src/app/(wiki)/layout.tsx` 또는 기존 헤더 컴포넌트에:

```tsx
import { AuthProvider } from '@/contexts/AuthContext'
import { SignInButton } from '@/components/auth/SignInButton'

export default function WikiLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <header className="...">
        {/* 기존 EntryToggle 등 */}
        <SignInButton />
      </header>
      {children}
    </AuthProvider>
  )
}
```

(gov) 그룹에는 *AuthProvider 래핑 X* — 익명 정부 사이트 유지. SignInButton도 (gov)에는 안 보임.

### Step 6.3: 빌드 + 접근성 시각 검증

```bash
npm run build
```

Expected: 빌드 그린. /wiki, /chat 등 (wiki) 라우트에 SignInButton 보임. /, /support 등 (gov) 라우트엔 X.

### Step 6.4: 위원장 수동 검증 (선택)

브라우저 + 낭독기로 `localhost:3000/wiki`:
- "로그인" 버튼 발음 정확
- 클릭 → AuthModal 열림, focus가 이메일 입력에
- 이메일 입력 + 제출 → "발송 중..." → "이메일을 확인해 주세요."
- 받은 매직링크 클릭 → /wiki 리다이렉트, 헤더에 "로그아웃" 버튼

### Step 6.5: commit

```bash
git add src/components/auth/SignInButton.tsx src/app/(wiki)/layout.tsx
git commit -m "feat(auth): integrate SignInButton in (wiki) header + AuthProvider 래핑"
```

---

## Task 7: codex-rescue 마일스톤 리뷰

> 글로벌 CLAUDE.md "마일스톤 단위 codex-rescue dispatch" 규칙.

### Step 7.1: dispatch

리뷰 포커스:
1. **M3-block-1 idempotency**: paging guard가 535 케이스 + 1500 가상 케이스에서 정확
2. **M3-block-2 wiki_links derivation**: 새 transform 시그니처가 backwards-compat 유지 + wiki_backlinks와 정합
3. **session refresh 정확성**: proxy.ts가 모든 요청에 cookie 갱신, RSC가 `await getServerClient()` 정확
4. **AuthModal 접근성**: focus trap, ARIA, 키보드 nav (screen reader simulation)
5. **(gov) 그룹 영향**: AuthProvider가 (gov)에 적용되지 않는지 — 익명 정부 사이트 유지
6. **Email Provider race**: signInWithOtp 호출 후 onAuthStateChange callback 동작
7. **Supabase Auth dashboard 설정과 코드 정합**: redirect URL, site URL, email provider 활성

### Step 7.2: 결과 처리

OK / CONCERN / BLOCK 판정에 따라.

---

## Task 8: PR + 메모리/CLAUDE.md 갱신

### Step 8.1: codex-rescue concern 반영 (있으면)

### Step 8.2: TTS 요약

### Step 8.3: 메모리 갱신

- `project_phase_status.md`에 "Phase 2 M3 완료" 섹션
- `MEMORY.md` Quick Reference
- `webfortd/CLAUDE.md` 변경 이력 + Phase 2 행 status 갱신

### Step 8.4: push + PR

```bash
git push -u origin phase-2-m3-supabase-auth
gh pr create --title "Phase 2 M3: Supabase Auth + (wiki) 게이트 인프라 + M2 carry-over fix" --body "..."
```

### Step 8.5: 위원장 머지 의사 확인

---

## Branch Strategy

```bash
git checkout master && git pull
git checkout -b phase-2-m3-supabase-auth
```

---

## 후속 plan 예고

| 마일스톤 | 범위 |
|---------|------|
| M4 | `editor_roles` 테이블 + write RLS 정책 확장 (검수자 권한) |
| M5 | draft → published 검수 자동화 + 가드 (reviewed_by, accessibility, source) |
| Phase 3 | 임베딩 파이프라인 + RAG 챗봇 + ivfflat REINDEX |
| Phase 4 | 소셜 피드 — 로그인 게이트 *실제 적용* |

---

## Self-Review

- [x] 모든 task에 파일 경로 + 코드 sample
- [x] M2 carry-over 2건이 Task 1·2로 박힘
- [x] TDD 흐름 (Task 1·2 unit tests)
- [x] codex-rescue 마지막 단계 (Task 7)
- [x] 비개발자 설명 (D1~D9 + Task 3 dashboard)
- [x] 접근성 ARIA (AuthModal Task 5)
- [x] dodo-planet 패턴 참조 명시
- [x] 환경 변수 NEXT_PUBLIC_SITE_URL 추가

## Plan 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-21 | 초기 작성 — Phase 2 M3 (Auth + carry-over) |
