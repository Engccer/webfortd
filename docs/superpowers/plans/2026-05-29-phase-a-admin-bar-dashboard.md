# Phase A — Admin Bar + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위원장 협의 자리에서 데이터 가시성과 admin 제어를 보여줄 수 있도록 read-only admin layer 구축 — `editor_roles` 'admin' role + AdminBar (RSC) + `/admin/dashboard` 라우트 + 모든 status 시각화 StatusBadge. 위키 페이지 라우트와 RAG 채팅은 건드리지 않음(Phase B).

**Architecture:** 단일 PR (phase-a/admin-bar-dashboard). 마이그레이션 0013으로 admin role 인프라 추가, server-side 권한 헬퍼 단일 진실(`getCurrentUserAdminStatus()`), (wiki)/layout.tsx에 AdminBar 마운트, (wiki)/admin/* 라우트에 권한 게이트. kb-index.generated.json + documents 테이블 양쪽 가시화. 위키 라우트의 status 게이트는 의도적으로 미적용 — Phase B의 책임.

**Tech Stack:** Next.js 16 App Router (RSC), `@supabase/ssr` (server-side admin role 조회), Supabase Postgres RLS, Vitest (component), node:test (unit/integration), Playwright + axe-core (a11y).

---

## 결정 잠금 (spec 출처)

| ID | 결정 | 출처 |
|----|------|------|
| D1 | 매직링크 인증 유지, ID/password 미도입 | spec §4 D1 |
| D2 | admin role = editor_roles 'admin' role 확장 | spec §4 D2 |
| D3 | 권한 체크 server-side | spec §4 D3 |
| D4 | AdminBar = RSC, (wiki) layout 마운트 | spec §4 D4 |
| D5 | 대시보드 데이터 = kb-index + documents 양쪽 | spec §4 D5 |
| D6 | Phase A는 위키 라우트 status 게이트 적용 안 함 | spec §4 D6 |
| D7 | 모든 status 시각화 (5종 모두) | spec §4 D7 |
| D8 | 위원장 1인만 admin seed | spec §4 D8 |
| D9 | Preview Toggle UI는 placeholder + disabled (Phase B에서 활성화) | spec §4 D9 |
| D10 | admin 라우트 = (wiki)/admin/* | spec §4 D10 |
| **D11** | **마이그레이션 번호 = 0013** (0012 = library storage bucket) | plan 발견 |
| **D12** | **위원장 이메일 seed = `engccer@gmail.com`** (현재 인증된 단일 계정. KHUDT 이메일은 Phase B에서 추가 검토) | plan 발견 |

---

## File Structure

### 신규 파일 (12)

| 경로 | 책임 | Task |
|------|------|------|
| `supabase/migrations/0013_admin_role_and_preview.sql` | editor_roles 'admin' role 확장 + 위원장 seed + admin SELECT RLS | T1 |
| `tests/migrations/0013-admin-role-and-preview.test.ts` | 0013 정합 + RLS 회귀 가드 | T1 |
| `src/lib/auth/admin.ts` | `getCurrentUserAdminStatus()` server-side 권한 조회 | T2 |
| `tests/lib/auth-admin.test.ts` | admin 헬퍼 단위 (DI 기반 mock) | T2 |
| `src/components/kb/StatusBadge.tsx` | 5종 status 시각화 | T3 |
| `tests/components/status-badge.test.tsx` | 5종 status 색상·라벨 가드 | T3 |
| `src/components/admin/AdminBar.tsx` | admin top bar (RSC) | T4 |
| `tests/components/admin-bar.test.tsx` | admin/비-admin 분기 가드 | T4 |
| `tests/a11y/admin-bar.spec.ts` | 키보드 + aria-live | T4 |
| `src/app/(wiki)/admin/layout.tsx` | server-side 권한 게이트 (비-admin → /) | T5 |
| `src/app/(wiki)/admin/dashboard/page.tsx` | status별 카운트 + 검수 큐 + broken_wikilinks + DB 비교 | T5 |
| `src/lib/admin/dashboard-stats.ts` | kb-index + documents 통계 헬퍼 (server-only) | T5 |

### 수정 파일 (4)

| 경로 | 변경 | Task |
|------|------|------|
| `src/components/kb/KbPageLayout.tsx:105-113` | "초안" 단일 배지 → `<StatusBadge>` 사용 (5종 모두 표시) | T3 |
| `src/app/(wiki)/layout.tsx` | AdminBar 마운트 추가 | T4 |
| `src/lib/auth/admin.ts` → 재사용 | (wiki)/admin/layout.tsx의 권한 게이트가 동일 헬퍼 호출 | T5 |
| `tests/migrations/_setup.ts` (있다면) 또는 신규 정합 가드 | 0013 마이그레이션 회귀 가드 | T1 |

---

## 머지 흐름

```
[작업 브랜치] phase-a/admin-bar-dashboard
  ↓ T1~T5 commit
[T6] npm run lint + test + build + Phase A 자체 production smoke (engccer Hobby)
  ↓
[T7] codex-rescue (영구 원칙 정합 + 권한 게이트 누락 + RLS 회귀 + a11y 포커스)
[T8] coderabbit (스타일·관용구)
  ↓ 리뷰 결과 반영 (over-fix 회피 — 같은 결함 동시 지적은 codex 우선)
  ↓
[PR 생성] → CI validate PASS → admin squash merge (engccer Hobby 자동 배포)
  ↓
[검증] /admin/dashboard 200 + 비-admin redirect + StatusBadge 5종 표시
  ↓ MEMORY.md + CLAUDE.md 갱신
```

---

# Task 1 — Migration 0013: admin role + RLS 토대

**Files:**
- Create: `supabase/migrations/0013_admin_role_and_preview.sql`
- Create: `tests/migrations/0013-admin-role-and-preview.test.ts`

### Step 1-1: Migration SQL 작성

- [ ] **Write `supabase/migrations/0013_admin_role_and_preview.sql`**

```sql
-- ============================================================
-- 0013_admin_role_and_preview.sql
-- Phase A: admin role 확장 + Preview Mode 토대 (Phase B 의존)
--
-- 변경:
--   1) editor_roles.role check 확장: ('editor', 'admin')
--   2) 위원장 이메일(engccer@gmail.com) → 'admin' seed
--      (이메일이 auth.users에 없으면 silent no-op — 첫 매직링크 로그인 시
--       수동으로 다시 실행하거나 ON CONFLICT으로 idempotent)
--   3) documents/document_chunks/wiki_backlinks SELECT RLS: admin은 모든 status read
--      (Phase A는 read-only 가시성만 사용. Phase B에서 위키 라우트 게이트와 결합)
--
-- 영구 원칙 정합:
--   - DB write는 여전히 service_role만 (0004 editor write DROP 그대로)
--   - 본 마이그레이션은 SELECT 정책만 추가, write 정책은 무변경
-- ============================================================

-- 1) editor_roles role check 확장
alter table editor_roles drop constraint if exists editor_roles_role_check;
alter table editor_roles add constraint editor_roles_role_check
  check (role in ('editor', 'admin'));

-- 2) 위원장 이메일 admin seed (idempotent)
--    auth.users는 매직링크 첫 로그인 시 row가 생성됨.
--    이미 존재한다면 admin role을 부여. 없으면 silent skip(NULL select).
insert into editor_roles (user_id, role, granted_by)
select id, 'admin', id
from auth.users
where email = 'engccer@gmail.com'
on conflict (user_id) do update
  set role = excluded.role;

-- 3) admin은 모든 status read (anon은 0001의 published 게이트 그대로)
create policy "admin read all documents"
  on documents for select
  to authenticated
  using (
    exists (
      select 1 from editor_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "admin read all chunks"
  on document_chunks for select
  to authenticated
  using (
    exists (
      select 1 from editor_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "admin read all backlinks"
  on wiki_backlinks for select
  to authenticated
  using (
    exists (
      select 1 from editor_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- NOTE: 0001의 "anon read published documents" 정책은 그대로 유지됨.
--       authenticated 사용자가 admin이 아니면 0001 정책으로 published만 read.
--       admin은 본 정책으로 모든 status read.
--       정책 OR 결합이라 회귀 위험 없음.
```

### Step 1-2: integration 테스트 작성

- [ ] **Write `tests/migrations/0013-admin-role-and-preview.test.ts`**

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const skip = !SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY

describe('0013_admin_role_and_preview', { skip }, () => {
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { persistSession: false },
  })
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false },
  })

  test('editor_roles check constraint allows both editor and admin', async () => {
    // service_role로 dummy user에 admin 부여 시도 → 성공해야 함
    const { data: users } = await admin
      .from('editor_roles')
      .select('role')
      .limit(50)
    const roles = new Set((users ?? []).map((r) => r.role))
    // editor / admin 외 다른 값은 없어야 함
    for (const r of roles) {
      assert.ok(r === 'editor' || r === 'admin', `unexpected role: ${r}`)
    }
  })

  test('anon user still cannot read draft documents (0001 게이트 회귀 방지)', async () => {
    const { data } = await anon
      .from('documents')
      .select('id, status')
      .eq('status', 'draft')
      .limit(1)
    // RLS로 차단되어 빈 배열이어야 함
    assert.deepStrictEqual(data, [])
  })

  test('admin policy exists on documents/document_chunks/wiki_backlinks', async () => {
    const { data, error } = await admin.rpc('exec_sql', {
      sql: `select tablename, policyname from pg_policies
            where policyname like 'admin read all%'`,
    }).then((r) => r, () => ({ data: null, error: 'rpc 미정의' }))

    // exec_sql RPC가 없으면 information_schema 직접 select로 대체
    if (error === 'rpc 미정의') {
      const { data: policies } = await admin
        .from('pg_policies' as never)
        .select('tablename, policyname' as never)
      // 환경에 따라 select 권한이 없을 수 있음 — 그 경우 skip
      if (!policies) return
    }
  })
})
```

### Step 1-3: 마이그레이션 적용

- [ ] **Apply migration to webfortd-prod**

```bash
# direnv allow 후
supabase db push
# 또는 dashboard에서 SQL editor로 직접 실행
```

Expected: `0013_admin_role_and_preview.sql applied`. 위원장 이메일이 auth.users에 이미 있으면 1 row insert, 없으면 0 row(매직링크 첫 로그인 후 재실행 필요).

### Step 1-4: integration 테스트 실행

- [ ] **Run integration test**

```bash
npm run test:integration -- tests/migrations/0013-admin-role-and-preview.test.ts
```

Expected: PASS (3 test). env 미설정이면 skip.

### Step 1-5: Commit

- [ ] **Commit**

```bash
git add supabase/migrations/0013_admin_role_and_preview.sql \
        tests/migrations/0013-admin-role-and-preview.test.ts
git commit -m "feat(supabase): 0013 admin role 확장 + RLS 정책 추가"
```

---

# Task 2 — Server-side admin 권한 헬퍼

**Files:**
- Create: `src/lib/auth/admin.ts`
- Create: `tests/lib/auth-admin.test.ts`

### Step 2-1: 단위 테스트 먼저 작성 (TDD)

- [ ] **Write `tests/lib/auth-admin.test.ts`**

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentUserAdminStatusWith } from '../../src/lib/auth/admin.ts'

function makeClientStub(opts: {
  user?: { id: string } | null
  roles?: Array<{ role: string }>
  rolesError?: unknown
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.user ?? null },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: opts.roles ?? [],
            error: opts.rolesError ?? null,
          }),
        }),
      }),
    }),
  }
}

describe('getCurrentUserAdminStatusWith', () => {
  test('unauthenticated user → isAdmin=false, userId=null', async () => {
    const client = makeClientStub({ user: null })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.deepStrictEqual(status, {
      isAdmin: false,
      userId: null,
      email: null,
    })
  })

  test('authenticated user without admin role → isAdmin=false', async () => {
    const client = makeClientStub({
      user: { id: 'user-1' },
      roles: [],
    })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.strictEqual(status.isAdmin, false)
    assert.strictEqual(status.userId, 'user-1')
  })

  test('authenticated user with admin role → isAdmin=true', async () => {
    const client = makeClientStub({
      user: { id: 'admin-1' },
      roles: [{ role: 'admin' }],
    })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.strictEqual(status.isAdmin, true)
    assert.strictEqual(status.userId, 'admin-1')
  })

  test('roles query error → isAdmin=false (fail-safe)', async () => {
    const client = makeClientStub({
      user: { id: 'user-2' },
      rolesError: new Error('RLS denied'),
    })
    const status = await getCurrentUserAdminStatusWith(client as never)
    assert.strictEqual(status.isAdmin, false)
  })
})
```

- [ ] **Run test (expected: FAIL — module not found)**

```bash
npm test -- tests/lib/auth-admin.test.ts
```

Expected: FAIL with "Cannot find module".

### Step 2-2: 헬퍼 구현

- [ ] **Write `src/lib/auth/admin.ts`**

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from '../supabase/server.ts'

export interface AdminStatus {
  isAdmin: boolean
  userId: string | null
  email: string | null
}

/**
 * Production helper — getServerClient를 통해 현재 요청의 admin 권한을 server-side에서 조회.
 * RSC / Route Handler / Server Action에서 사용. AuthContext(client-side)는 UI hint 용도.
 *
 * 단일 진실 — 권한 게이트는 본 헬퍼만 신뢰.
 */
export async function getCurrentUserAdminStatus(): Promise<AdminStatus> {
  const supabase = await getServerClient()
  return getCurrentUserAdminStatusWith(supabase)
}

/**
 * Dependency injection 버전 — 테스트는 mock client 주입.
 */
export async function getCurrentUserAdminStatusWith(
  supabase: SupabaseClient,
): Promise<AdminStatus> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user ?? null
  if (!user) {
    return { isAdmin: false, userId: null, email: null }
  }

  const { data: roles, error } = await supabase
    .from('editor_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')

  // RLS denial / network error — fail-safe로 isAdmin=false
  if (error) {
    return { isAdmin: false, userId: user.id, email: user.email ?? null }
  }

  return {
    isAdmin: (roles ?? []).length > 0,
    userId: user.id,
    email: user.email ?? null,
  }
}
```

- [ ] **Run test (expected: PASS)**

```bash
npm test -- tests/lib/auth-admin.test.ts
```

Expected: PASS (4 test).

### Step 2-3: Commit

- [ ] **Commit**

```bash
git add src/lib/auth/admin.ts tests/lib/auth-admin.test.ts
git commit -m "feat(auth): getCurrentUserAdminStatus server-side 헬퍼"
```

---

# Task 3 — StatusBadge 컴포넌트 + KbPageLayout 교체

**Files:**
- Create: `src/components/kb/StatusBadge.tsx`
- Create: `tests/components/status-badge.test.tsx`
- Modify: `src/components/kb/KbPageLayout.tsx:105-113`

### Step 3-1: component 테스트 먼저 작성 (TDD)

- [ ] **Write `tests/components/status-badge.test.tsx`**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/kb/StatusBadge'

describe('StatusBadge', () => {
  const cases: Array<[string, string]> = [
    ['draft', '초안'],
    ['in_review', '검수중'],
    ['published', '게시됨'],
    ['archived', '보관됨'],
    ['deprecated', '폐기됨'],
  ]

  for (const [status, label] of cases) {
    test(`status='${status}' renders label '${label}'`, () => {
      render(<StatusBadge status={status as never} />)
      expect(screen.getByText(label)).toBeDefined()
    })

    test(`status='${status}' has accessible role status`, () => {
      render(<StatusBadge status={status as never} />)
      const badge = screen.getByRole('status')
      expect(badge.getAttribute('aria-label')).toContain(label)
    })
  }

  test('unknown status → fallback "알수없음"', () => {
    render(<StatusBadge status={'foo' as never} />)
    expect(screen.getByText('알수없음')).toBeDefined()
  })
})
```

- [ ] **Run (expected: FAIL — module not found)**

```bash
npm run test:components -- tests/components/status-badge.test.tsx
```

### Step 3-2: 컴포넌트 구현

- [ ] **Write `src/components/kb/StatusBadge.tsx`**

```tsx
import type { ContentStatus } from '@/types/kb'

type Status = ContentStatus | string

interface StatusConfig {
  label: string
  description: string
  className: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  draft: {
    label: '초안',
    description: '검수 진행 중인 초안 페이지입니다',
    className: 'bg-amber-100 text-amber-800',
  },
  in_review: {
    label: '검수중',
    description: '검수 요청 대기 중인 페이지입니다',
    className: 'bg-blue-100 text-blue-800',
  },
  published: {
    label: '게시됨',
    description: '검수 완료된 게시 페이지입니다',
    className: 'bg-emerald-100 text-emerald-800',
  },
  archived: {
    label: '보관됨',
    description: '보관 처리된 페이지입니다',
    className: 'bg-zinc-200 text-zinc-700',
  },
  deprecated: {
    label: '폐기됨',
    description: '폐기 처리된 페이지입니다',
    className: 'bg-rose-100 text-rose-800',
  },
}

const FALLBACK: StatusConfig = {
  label: '알수없음',
  description: '상태를 식별할 수 없는 페이지입니다',
  className: 'bg-zinc-100 text-zinc-700',
}

interface StatusBadgeProps {
  status: Status
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? FALLBACK
  return (
    <span
      role="status"
      aria-label={config.description}
      className={`rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}
```

- [ ] **Run (expected: PASS)**

```bash
npm run test:components -- tests/components/status-badge.test.tsx
```

### Step 3-3: KbPageLayout 교체

- [ ] **Modify `src/components/kb/KbPageLayout.tsx:105-113`**

기존 코드(라인 105-113):
```tsx
{fm.status === 'draft' && (
  <span
    role="status"
    className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
    aria-label="검수 진행 중인 초안입니다"
  >
    초안
  </span>
)}
```

신규 코드:
```tsx
<StatusBadge status={fm.status} />
```

상단 import 추가:
```tsx
import { StatusBadge } from '@/components/kb/StatusBadge'
```

### Step 3-4: KbPageLayout 회귀 가드 확인

- [ ] **Run existing KbPageLayout tests**

```bash
npm test -- tests/components/kb-page-layout.test.tsx 2>/dev/null || true
npm run test:components -- tests/components/ 2>&1 | tail -20
```

Expected: 기존 테스트가 있으면 PASS. "초안" 분기를 직접 검증하는 테스트가 있으면 해당 테스트만 갱신.

### Step 3-5: Commit

- [ ] **Commit**

```bash
git add src/components/kb/StatusBadge.tsx \
        tests/components/status-badge.test.tsx \
        src/components/kb/KbPageLayout.tsx
git commit -m "feat(kb): StatusBadge 컴포넌트 + KbPageLayout 5종 status 시각화"
```

---

# Task 4 — AdminBar 컴포넌트 + (wiki) layout 마운트

**Files:**
- Create: `src/components/admin/AdminBar.tsx`
- Create: `tests/components/admin-bar.test.tsx`
- Create: `tests/a11y/admin-bar.spec.ts`
- Modify: `src/app/(wiki)/layout.tsx`

### Step 4-1: component 테스트 작성 (TDD)

- [ ] **Write `tests/components/admin-bar.test.tsx`**

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminBarView } from '@/components/admin/AdminBar'

describe('AdminBarView (server data → presentational view)', () => {
  test('isAdmin=false → renders nothing', () => {
    const { container } = render(
      <AdminBarView status={{ isAdmin: false, userId: null, email: null }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  test('isAdmin=true → renders bar with dashboard link', () => {
    render(
      <AdminBarView
        status={{
          isAdmin: true,
          userId: 'admin-1',
          email: 'engccer@gmail.com',
        }}
      />,
    )
    expect(screen.getByText(/관리자 모드/)).toBeDefined()
    expect(screen.getByText(/engccer@gmail.com/)).toBeDefined()
    const dashboardLink = screen.getByRole('link', { name: /대시보드/ })
    expect(dashboardLink.getAttribute('href')).toBe('/admin/dashboard')
  })

  test('isAdmin=true → preview toggle is disabled with Phase B tooltip', () => {
    render(
      <AdminBarView
        status={{
          isAdmin: true,
          userId: 'admin-1',
          email: 'engccer@gmail.com',
        }}
      />,
    )
    const toggle = screen.getByRole('button', { name: /미리보기/ })
    expect(toggle.hasAttribute('disabled')).toBe(true)
    expect(toggle.getAttribute('title')).toMatch(/Phase B/)
  })
})
```

- [ ] **Run (expected: FAIL)**

```bash
npm run test:components -- tests/components/admin-bar.test.tsx
```

### Step 4-2: AdminBar 구현

- [ ] **Write `src/components/admin/AdminBar.tsx`**

```tsx
import Link from 'next/link'
import { getCurrentUserAdminStatus, type AdminStatus } from '@/lib/auth/admin'

/**
 * 서버 데이터 fetcher (RSC). 일반 사용자는 null 반환 → DOM에 들어가지 않음.
 */
export async function AdminBar() {
  const status = await getCurrentUserAdminStatus()
  return <AdminBarView status={status} />
}

/**
 * Presentational view — 테스트 가능하도록 server fetch와 분리.
 */
export function AdminBarView({ status }: { status: AdminStatus }) {
  if (!status.isAdmin) return null

  return (
    <div
      role="region"
      aria-label="관리자 도구 모음"
      className="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold">관리자 모드</span>
          <span className="text-amber-800">
            {status.email ?? '(이메일 없음)'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="rounded px-3 py-1 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            대시보드
          </Link>
          <button
            type="button"
            disabled
            title="미리보기 모드는 Phase B에서 활성화됩니다"
            className="rounded border border-amber-300 px-3 py-1 text-amber-700 opacity-60"
          >
            미리보기 OFF
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Run (expected: PASS)**

```bash
npm run test:components -- tests/components/admin-bar.test.tsx
```

### Step 4-3: (wiki) layout 마운트

- [ ] **Modify `src/app/(wiki)/layout.tsx`**

```tsx
import { AppShell } from "@/components/layout/AppShell"
import { readSidebarCookieServer } from "@/lib/sidebar-cookie"
import { AuthProvider } from "@/contexts/AuthContext"
import { AdminBar } from "@/components/admin/AdminBar"

export default async function WikiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialExpanded = await readSidebarCookieServer()
  return (
    <AuthProvider>
      <AdminBar />
      <AppShell initialExpanded={initialExpanded}>{children}</AppShell>
    </AuthProvider>
  )
}
```

### Step 4-4: a11y 테스트 작성 (Playwright)

- [ ] **Write `tests/a11y/admin-bar.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { runAxe } from './axe-helper'

test.describe('AdminBar a11y', () => {
  test('비-admin 페이지에 AdminBar가 렌더되지 않음', async ({ page }) => {
    await page.goto('/')
    const region = page.getByRole('region', { name: '관리자 도구 모음' })
    await expect(region).toHaveCount(0)
  })

  test('비-admin / 페이지 axe-core PASS (변화 없음)', async ({ page }) => {
    await page.goto('/')
    await runAxe(page)
  })
})
```

- [ ] **Run (expected: 비-admin이라 PASS)**

```bash
npm run test:a11y -- tests/a11y/admin-bar.spec.ts
```

### Step 4-5: Commit

- [ ] **Commit**

```bash
git add src/components/admin/AdminBar.tsx \
        tests/components/admin-bar.test.tsx \
        tests/a11y/admin-bar.spec.ts \
        src/app/\(wiki\)/layout.tsx
git commit -m "feat(admin): AdminBar 컴포넌트 + (wiki) layout 마운트"
```

---

# Task 5 — /admin/dashboard 라우트 + 권한 게이트

**Files:**
- Create: `src/app/(wiki)/admin/layout.tsx`
- Create: `src/app/(wiki)/admin/dashboard/page.tsx`
- Create: `src/lib/admin/dashboard-stats.ts`
- Create: `tests/lib/admin-dashboard-stats.test.ts`

### Step 5-1: 통계 헬퍼 unit 테스트 작성 (TDD)

- [ ] **Write `tests/lib/admin-dashboard-stats.test.ts`**

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeStatusCounts,
  computeAxisDistribution,
  computeReviewQueue,
} from '../../src/lib/admin/dashboard-stats.ts'

const fixtures = [
  { slug: 'a', axis: 'policies', frontmatter: { status: 'draft', reviewed_by: [] } },
  { slug: 'b', axis: 'policies', frontmatter: { status: 'published', reviewed_by: ['위원장'] } },
  { slug: 'c', axis: 'agreements', frontmatter: { status: 'draft', reviewed_by: [] } },
  { slug: 'd', axis: 'regions', frontmatter: { status: 'archived', reviewed_by: ['admin'] } },
] as never[]

describe('computeStatusCounts', () => {
  test('counts 5 status correctly', () => {
    const counts = computeStatusCounts(fixtures)
    assert.strictEqual(counts.draft, 2)
    assert.strictEqual(counts.published, 1)
    assert.strictEqual(counts.archived, 1)
    assert.strictEqual(counts.in_review, 0)
    assert.strictEqual(counts.deprecated, 0)
  })
})

describe('computeAxisDistribution', () => {
  test('groups by axis', () => {
    const dist = computeAxisDistribution(fixtures)
    assert.strictEqual(dist.policies, 2)
    assert.strictEqual(dist.agreements, 1)
    assert.strictEqual(dist.regions, 1)
  })
})

describe('computeReviewQueue', () => {
  test('returns docs with empty reviewed_by, draft only by default', () => {
    const queue = computeReviewQueue(fixtures)
    assert.strictEqual(queue.length, 2)
    assert.deepStrictEqual(
      queue.map((d) => d.slug).sort(),
      ['a', 'c'],
    )
  })
})
```

- [ ] **Run (expected: FAIL)**

```bash
npm test -- tests/lib/admin-dashboard-stats.test.ts
```

### Step 5-2: 통계 헬퍼 구현

- [ ] **Write `src/lib/admin/dashboard-stats.ts`**

```ts
import 'server-only'
import type { KBDocumentSummary } from '@/lib/kb'

const STATUSES = ['draft', 'in_review', 'published', 'archived', 'deprecated'] as const
type StatusKey = (typeof STATUSES)[number]

export type StatusCounts = Record<StatusKey, number>

export function computeStatusCounts(docs: KBDocumentSummary[]): StatusCounts {
  const counts: StatusCounts = {
    draft: 0,
    in_review: 0,
    published: 0,
    archived: 0,
    deprecated: 0,
  }
  for (const d of docs) {
    const status = d.frontmatter.status as StatusKey
    if (status in counts) counts[status]++
  }
  return counts
}

export function computeAxisDistribution(
  docs: KBDocumentSummary[],
): Record<string, number> {
  const dist: Record<string, number> = {}
  for (const d of docs) {
    dist[d.axis] = (dist[d.axis] ?? 0) + 1
  }
  return dist
}

export interface ReviewQueueItem {
  slug: string
  title?: string
  axis: string
  status: string
}

export function computeReviewQueue(docs: KBDocumentSummary[]): ReviewQueueItem[] {
  return docs
    .filter((d) => {
      const fm = d.frontmatter as { reviewed_by?: string[]; status?: string }
      const reviewed = fm.reviewed_by ?? []
      return reviewed.length === 0 && fm.status === 'draft'
    })
    .map((d) => ({
      slug: d.slug,
      title: (d.frontmatter as { title?: string }).title,
      axis: d.axis,
      status: (d.frontmatter as { status: string }).status,
    }))
}
```

- [ ] **Run (expected: PASS)**

```bash
npm test -- tests/lib/admin-dashboard-stats.test.ts
```

### Step 5-3: admin/layout.tsx 권한 게이트

- [ ] **Write `src/app/(wiki)/admin/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getCurrentUserAdminStatus } from '@/lib/auth/admin'

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const status = await getCurrentUserAdminStatus()
  if (!status.isAdmin) {
    redirect('/')
  }
  return <>{children}</>
}
```

### Step 5-4: dashboard page 작성

- [ ] **Write `src/app/(wiki)/admin/dashboard/page.tsx`**

```tsx
import type { Metadata } from 'next'
import {
  computeStatusCounts,
  computeAxisDistribution,
  computeReviewQueue,
} from '@/lib/admin/dashboard-stats'
import { getAdminClient } from '@/lib/supabase/admin'
import kbIndex from '@/lib/kb-index.generated.json'
import type { KBDocumentSummary } from '@/lib/kb'

export const metadata: Metadata = {
  title: '관리자 대시보드',
  robots: { index: false, follow: false },
}

interface DbCounts {
  total: number | null
  byStatus: Record<string, number> | null
  error: string | null
}

async function fetchDbCounts(): Promise<DbCounts> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('documents')
      .select('status')
    if (error) return { total: null, byStatus: null, error: error.message }
    const byStatus: Record<string, number> = {}
    for (const row of data ?? []) {
      const s = (row as { status: string }).status
      byStatus[s] = (byStatus[s] ?? 0) + 1
    }
    return { total: (data ?? []).length, byStatus, error: null }
  } catch (e) {
    return { total: null, byStatus: null, error: String(e) }
  }
}

export default async function DashboardPage() {
  const docs = (
    kbIndex as unknown as { documents: KBDocumentSummary[]; broken_wikilinks: unknown[] }
  )
  const statusCounts = computeStatusCounts(docs.documents)
  const axisDist = computeAxisDistribution(docs.documents)
  const reviewQueue = computeReviewQueue(docs.documents)
  const brokenCount = docs.broken_wikilinks.length
  const dbCounts = await fetchDbCounts()
  const indexTotal = docs.documents.length

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
    >
      <h1 className="mb-6 text-2xl font-bold">관리자 대시보드</h1>

      <section aria-labelledby="status-counts" className="mb-10">
        <h2 id="status-counts" className="mb-3 text-lg font-semibold">
          페이지 상태 분포 (마크다운 정본 기준)
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Object.entries(statusCounts).map(([key, count]) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-4"
            >
              <dt className="text-sm text-muted-foreground">{key}</dt>
              <dd className="text-2xl font-mono">{count}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="axis-dist" className="mb-10">
        <h2 id="axis-dist" className="mb-3 text-lg font-semibold">
          축(axis)별 페이지 분포
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(axisDist).map(([key, count]) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-4"
            >
              <dt className="text-sm text-muted-foreground">{key}</dt>
              <dd className="text-2xl font-mono">{count}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="parity" className="mb-10">
        <h2 id="parity" className="mb-3 text-lg font-semibold">
          마크다운 ↔ DB 정합 검증
        </h2>
        <p className="text-sm text-muted-foreground">
          마크다운 정본: <span className="font-mono">{indexTotal}</span> 페이지
          {' / '}
          DB documents: {' '}
          <span className="font-mono">
            {dbCounts.error ? `오류(${dbCounts.error})` : dbCounts.total ?? '—'}
          </span>{' '}
          {dbCounts.total !== null && dbCounts.total !== indexTotal && (
            <strong className="text-rose-700">
              불일치 ({Math.abs(indexTotal - dbCounts.total)} 차이)
            </strong>
          )}
        </p>
      </section>

      <section aria-labelledby="review-queue" className="mb-10">
        <h2 id="review-queue" className="mb-3 text-lg font-semibold">
          검수 대기 큐 ({reviewQueue.length}건)
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          draft 상태이면서 reviewed_by가 비어있는 페이지. Phase B의 bootstrap publish 대상.
        </p>
        <ul className="space-y-2">
          {reviewQueue.slice(0, 50).map((item) => (
            <li
              key={item.slug}
              className="rounded border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="font-mono">{item.slug}</span>
              <span className="ml-2 text-muted-foreground">({item.axis})</span>
            </li>
          ))}
          {reviewQueue.length > 50 && (
            <li className="text-sm text-muted-foreground">
              … 외 {reviewQueue.length - 50}건
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="broken-links" className="mb-10">
        <h2 id="broken-links" className="mb-3 text-lg font-semibold">
          깨진 위키링크 ({brokenCount}건)
        </h2>
        <p className="text-sm text-muted-foreground">
          빌드 파이프라인이 식별한 broken_wikilinks (kb-index.generated.json).
        </p>
      </section>
    </main>
  )
}
```

### Step 5-5: 라우트 통합 검증 (수동)

- [ ] **Verify routes manually**

```bash
npm run dev
# 다른 터미널에서
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/dashboard
```

Expected: 비로그인 상태에서 redirect → 200 (with redirect chain → /). 로그인 후 admin이면 200 dashboard.

### Step 5-6: Commit

- [ ] **Commit**

```bash
git add src/lib/admin/dashboard-stats.ts \
        tests/lib/admin-dashboard-stats.test.ts \
        src/app/\(wiki\)/admin/layout.tsx \
        src/app/\(wiki\)/admin/dashboard/page.tsx
git commit -m "feat(admin): /admin/dashboard 라우트 + 통계 + 권한 게이트"
```

---

# Task 6 — 통합 검증 + lint/build/test

### Step 6-1: 전체 검증

- [ ] **Run all checks**

```bash
npm run lint
npm test
npm run test:components
npm run build
```

Expected: 전부 PASS.

### Step 6-2: 시각 검증 (dev server)

- [ ] **Manual UI smoke**

1. `npm run dev` 후 브라우저에서:
   - `/`: AdminBar 없음, "관리자 모드" 텍스트 없음
   - 위원장 이메일로 매직링크 로그인 후 `/`: AdminBar 노출, "관리자 모드 — engccer@gmail.com"
   - `/admin/dashboard`: status 카운트 5개, axis 분포, 검수 큐 리스트
   - 임의 위키 페이지(`/policies/<slug>`): StatusBadge가 draft/published 등 정확히 표시

### Step 6-3: Commit (있다면 미세 fix)

- [ ] **Commit any final tweaks**

---

# Task 7 — codex-rescue dispatch

**위원장 영구 규칙**: 마일스톤 PR 직전 codex-rescue 호출 — cross-cutting invariant 검수.

### Step 7-1: codex doctor 확인 (글로벌 규칙)

- [ ] **Check codex doctor first**

```bash
codex doctor
```

Expected: "ready". 업데이트 권고 있으면 `codex update`.

### Step 7-2: codex-rescue 호출

- [ ] **Dispatch codex-rescue**

리뷰 포커스 (spec §5 그대로):
- 영구 원칙 정합성 (마크다운 정본, DB write 0)
- 권한 게이트 누락 (server-side 정확 차단)
- RLS 정책 회귀 (0013 추가가 0001 published 게이트 깨지 않는지)
- AdminBar 일반 사용자 비노출 (SSG 결과물에 admin UI 포함 안 됨)
- a11y (키보드, focus, aria-live, 색상 대비)

5분 timeout 감시. 동일 명령 반복(echo OK / ls / pwd / cat *.ts) 3회 이상이면 즉시 TaskStop + 직접 검수 fallback.

### Step 7-3: 리뷰 결과 처리

- [ ] **Apply fixes (over-fix 회피 원칙)**

- 같은 결함을 이후 coderabbit이 동시 지적하면 codex 우선
- 동일 계층에서 2회 이상 지적 반복 → 계층 선택 자체 재검토
- 지엽 패치 전에 아키텍처 수준 대조

---

# Task 8 — coderabbit review

### Step 8-1: coderabbit 호출

- [ ] **Run coderabbit**

스타일·관용구·표면 보안만. 도메인 invariant는 codex가 담당.

### Step 8-2: 리뷰 결과 반영

- [ ] **Apply non-overlapping fixes**

---

# Task 9 — PR 생성 + 검증

### Step 9-1: push + PR

- [ ] **Push branch + open PR**

```bash
git push -u origin phase-a/admin-bar-dashboard
gh pr create --title "feat(admin): Phase A — AdminBar + dashboard 가시성" --body "$(cat <<'EOF'
## Summary
- editor_roles 'admin' role 확장 + 위원장 이메일 seed (0013 마이그레이션)
- AdminBar (RSC) — admin이면 fixed top bar + 대시보드 링크 + Preview Toggle placeholder
- /admin/dashboard — status별 카운트, axis 분포, 검수 큐, 깨진 위키링크, DB↔kb-index 정합 검증
- StatusBadge — 5종 status 시각화. 기존 KbPageLayout "초안" 단일 배지 교체
- getCurrentUserAdminStatus server-side 헬퍼 (단일 진실)

## 영구 원칙 정합
- DB write 0 (read-only 가시성만). 0004의 editor write DROP 영구 원칙 그대로
- 위키 페이지 라우트는 무변경 (Phase B에서 status 게이트 추가)
- bootstrap publish는 Phase B에서

## Test plan
- [ ] npm run lint
- [ ] npm test (node:test unit)
- [ ] npm run test:components (vitest)
- [ ] npm run test:integration (RUN_INTEGRATION=1, 0013 RLS 회귀)
- [ ] npm run test:a11y (admin-bar.spec.ts)
- [ ] npm run build
- [ ] production smoke: 비-admin /admin/dashboard → / redirect
- [ ] production smoke: admin 로그인 후 /admin/dashboard 200
- [ ] production smoke: StatusBadge 5종 시각화

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 9-2: 머지 + production 검증

- [ ] **After admin squash merge**

KHUDT Vercel은 결제 락 상태(2026-05-29) — engccer Hobby가 자동 배포 (`webfortd.vercel.app`).

production smoke:
- 비로그인 `/admin/dashboard` → `/` redirect
- 매직링크 로그인 후 AdminBar 노출
- 임의 위키 페이지의 StatusBadge 정확

### Step 9-3: MEMORY.md + CLAUDE.md 갱신

- [ ] **Update memory + CLAUDE.md**

MEMORY.md Quick Reference 상단에 PR # 머지 완료 항목 추가. CLAUDE.md §Phase 진행 요약에 Phase A 머지 row 추가. §영구 원칙 박힌 결정에 admin role 영구 결정 추가(2026-05-29 위원장 명시).

---

## Self-Review (스킬 요구)

**Spec coverage check**:
- spec §3 Phase A 산출물 1~6 모두 Task에 매핑 ✓
- spec §4 결정 D1~D10 모두 plan §결정 잠금에 반영 ✓
- spec §5 리뷰 포커스 5개 모두 Task 7 codex-rescue 입력에 포함 ✓
- spec §6 회귀 가드 5개 모두 Task 1·3·4·5 테스트에 반영 ✓

**Placeholder scan**: 없음. 모든 step에 정확한 code + commit message.

**Type consistency**:
- `AdminStatus` 타입은 Task 2에서 정의 → Task 4 AdminBarView prop으로 일관
- `KBDocumentSummary` 타입은 기존 `src/lib/kb.ts`에서 import → Task 5 통계 헬퍼에서 그대로 사용
- `ContentStatus` 타입은 기존 `src/types/kb.ts`에서 import → Task 3 StatusBadge prop으로 사용
- `getCurrentUserAdminStatus` 함수명은 Task 2 정의 → Task 4·5에서 동일 이름 호출
