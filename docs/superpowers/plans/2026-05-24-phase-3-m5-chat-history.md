# Phase 3 M5 Chat History (DB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자의 채팅 대화를 `chat_threads`/`chat_messages` 테이블에 저장하고 좌측 drawer로 thread를 전환할 수 있게 한다. 90일 soft delete + 추가 30일 hard delete를 Vercel cron으로 자동화한다. 비로그인은 M4 그대로(useState 휘발 + 안내 배너). PR B 단독 범위 — M4 impl 머지 후 진행.

**Architecture:** 두 마이그레이션(0010 테이블+RLS+트리거, 0011 atomic RPC) + Route Handler 확장(`onFinish` DB 분기, M3 helper 재사용) + 신규 `/api/chat/threads` GET + 신규 `/api/cron/cleanup-chats` GET (Bearer 인증) + `ThreadDrawer` 컴포넌트(shadcn Sheet) + SWR. DB write는 Phase 2 Finding 1 옵션 B 정합 — 모든 INSERT/UPDATE는 service_role RPC 통해서만, anon/authenticated 직접 INSERT는 RLS 차단.

**Tech Stack:** Supabase Postgres (RLS + plpgsql `security definer + search_path = ''` 가드) · Next.js 16 Route Handlers (`runtime='nodejs'`, `getServerClient`) · `@supabase/ssr` (cookies 기반 SSR auth, 이미 사용 중) · `getAdminClient` (service_role, `src/lib/supabase/admin.ts` 기존) · SWR 2.x (신규 — `mutate('/api/chat/threads')` 갱신) · Vercel Cron Jobs (`vercel.json` `crons` + `CRON_SECRET` Bearer) · shadcn Sheet (M4 install 완료) · `node:test` (RLS 통합 — 기존 패턴)

---

## 0. Context (zero-context 엔지니어용 짧은 브리핑)

**webfortd 정체성**: 장교조의 장애인교원 정책 지식베이스 + RAG 채팅 Next.js 풀스택. 위원장 시각장애. 시범 모델이지만 교육부-중부대 사업 자문 근거 자산. 접근성 협상 불가.

**M4까지 완료 (impl PR #31 머지 가정)**:
- M1: 535 docs / 1606 청크 임베딩
- M2: server-only `retrieveChunks(query, opts)` + `sourcePathToHref` helper
- M3: `/api/chat` Route Handler (streamText + toUIMessageStreamResponse + messageMetadata.sourceRefs)
- M4: `ChatUI` (useChat v6 + AI Elements MessageResponse markdown + SourceCard 미니멀 칩) — 비로그인 useState 휘발 모드

**M5의 역할**: 로그인 사용자의 대화를 DB에 저장해 새로고침·재방문 시 살아있게 + thread 전환 UI + PIPA 90일 자동 삭제 cron. 비로그인은 M4 그대로(M6에서 sessionStorage 정교화).

**설계 문서**: `docs/superpowers/specs/2026-05-24-phase-3-m4-m5-chat-ui-history-design.md` (PR #29, master `824d015`)
- §3 데이터 모델 (0010 + 0011 SQL 본체)
- §5.1 `onFinish` 분기
- §5.2 `/api/chat/threads` route
- §5.3 `/api/cron/cleanup-chats` + `vercel.json`
- §6 접근성 spec + §6.3 위원장 톤 검수 게이트
- §8.2 PR B scope
- §9.3~9.6 리스크
- §10 codex-rescue 포커스 (PR B 7건)

**중요 invariant** (M5에서도 유지):
- `kb:publish:dry-run` baseline `535 / 8 / 527` 변동 0 (M5는 KB 데이터 layer 무관)
- `next build` 568 정적 페이지 + `/api/chat` ƒ + 신규 `/api/chat/threads` ƒ + `/api/cron/cleanup-chats` ƒ (4 ƒ 예상)
- M4 impl baseline (PR #31 머지 후) unit/components/integration 그린 유지
- 모든 신규 plpgsql 함수는 `security definer + set search_path = ''` 가드 (0003·0006·0007·0009 패턴)
- DB write는 service_role RPC만 — anon/authenticated 직접 INSERT는 RLS 차단 (Phase 2 Finding 1 옵션 B)
- 비로그인 사용자에게 thread drawer / DB 저장 분기 미노출 — `getServerClient().auth.getUser()` cookies 가드
- PIPA: user query 본문은 로그 X (M3 정합), `formatSupabaseError`로 error.message 마스킹

**선행 작업 (위원장 명시 액션)**:
- M4 impl PR #31 squash 머지 → master 반영
- Vercel 환경변수 `CRON_SECRET` 추가 (Task 8 진입 직전, 위원장 직접 수행)

---

## 1. File Structure

### 신규 파일

| 파일 | 책임 |
|------|------|
| `supabase/migrations/0010_chat_history.sql` | `chat_threads` + `chat_messages` 테이블 + 인덱스 + RLS + `set_updated_at` 트리거 + `bump_thread_updated_at` 트리거 (chat_messages INSERT 시) |
| `supabase/migrations/0011_chat_history_rpcs.sql` | `create_thread_with_messages` + `append_messages` plpgsql RPC (security definer + search_path = '' + service_role only) |
| `tests/migrations/0010_chat_history.test.ts` | RLS 6 시나리오 통합 테스트 (실 Supabase 호출, `.env.local` 필요) |
| `src/components/chat/ThreadDrawer.tsx` | shadcn Sheet 기반 좌측 drawer + SWR. 로그인 시만 렌더. |
| `src/app/api/chat/threads/route.ts` | GET — 본인 thread 최신 20개 목록 (RLS 자동 필터) |
| `src/app/api/cron/cleanup-chats/route.ts` | GET — Vercel cron Bearer 검증 + soft delete 90일 + hard delete 추가 30일 |
| `vercel.json` (없으면 신규) | `crons` 항목: `/api/cron/cleanup-chats` daily 03:00 UTC |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/app/api/chat/route.ts` | (a) `getServerClient` + `.auth.getUser()` 추가로 로그인 검증. (b) body shape에 `threadId` 추가. (c) `onFinish`에서 로그인 사용자만 `create_thread_with_messages` / `append_messages` RPC 호출. (d) `messageMetadata` 콜백에 `threadId` 첨부(신규 thread만). |
| `src/components/chat/ChatUI.tsx` | (a) `useAuth` hook으로 user 감지. (b) `useChat` transport body에 `{ threadId, userId }` 동봉. (c) `useState<string | undefined>(initialThreadId)`로 threadId 관리. (d) `onFinish`에서 `message.metadata.threadId` 받아 state 동기화 + `mutate('/api/chat/threads')`. (e) 로그인 사용자만 `<ThreadDrawer>` 렌더. (f) drawer thread 클릭 시 ChatUI에 thread 전환 (현재 PR에서는 unmount/remount로 간단히 처리). |
| `package.json` | `swr` deps 추가 (Task 6에서 첫 사용) |
| `package-lock.json` | npm install 결과 |
| `.env.local` (로컬, 위원장 명시) | `CRON_SECRET` 추가 |
| Vercel env (위원장 명시) | `CRON_SECRET` 추가 (production + preview) |

### 검증 명령 표

| 명령 | 목적 | 기대 baseline |
|------|------|---------------|
| `npm run test` | unit (node:test, M4 impl 머지 후 baseline) | 184 PASS / 1 skipped / 0 fail |
| `npm run test:components` | Vitest (components) | 4 PASS (M4 impl) |
| `npm run test:integration` | integration (migrations) | 28 PASS + 6 신규(0010 RLS 시나리오) — 단, 환경 의존(M3 baseline 1건 fail 그대로) |
| `npm run test:all` | chained 3개 | 위 |
| `npm run build` | next build | 568 정적 페이지 + `/api/chat` ƒ + `/api/chat/threads` ƒ + `/api/cron/cleanup-chats` ƒ |
| `npm run lint` | ESLint | 신규 파일 0 error/warning |
| `npm run kb:publish:dry-run` | KB baseline 회귀 가드 | `535 / 8 / 527` (변동 0) |
| 수동 `curl` cron endpoint | Bearer 검증 + 응답 shape | `{ softDeleted: 0, hardDeleted: 0 }` (초기 빈 DB) |
| 수동 dev server + 위원장 검수 | 시나리오 2·3·4 + spec §6.3 | 위원장 명시 OK |

---

## 2. Task Decomposition

총 10개 task. Task 1~3은 DB 인프라(마이그레이션 + RLS 테스트), Task 4~7은 backend/UI 연결, Task 8은 cron, Task 9~10은 검증·머지. Task 9 위원장 수동 검수 게이트.

### Task 1: 0010 마이그레이션 — chat_threads + chat_messages + RLS + 트리거

**Files:**
- Create: `supabase/migrations/0010_chat_history.sql`

- [ ] **Step 1: 0010 SQL 작성**

Create `supabase/migrations/0010_chat_history.sql`:

```sql
-- 0010_chat_history.sql
-- Phase 3 M5 — 채팅 대화 DB 히스토리.
--
-- 정책:
--   - DB write는 service_role 전용 (Phase 2 Finding 1 옵션 B). anon/authenticated
--     직접 INSERT는 RLS 차단. 모든 write는 0011 RPC를 통한 service_role 경로.
--   - SELECT는 본인 thread만 (auth.uid() 매칭).
--   - soft delete = deleted_at 타임스탬프. 0011 cron이 hard delete로 정리.
--   - chat_threads.updated_at는 chat_messages INSERT 시 자동 bump (trigger).

begin;

-- 1. chat_threads
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz  -- soft delete 표지. 본 cron이 hard delete로 정리.
);

create index chat_threads_user_id_updated_at_idx
  on public.chat_threads (user_id, updated_at desc)
  where deleted_at is null;

-- 2. chat_messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 50000),  -- assistant 응답 안전 cap
  source_refs jsonb not null default '[]'::jsonb,  -- assistant만 채움. user는 []
  token_usage jsonb,  -- { inputTokens, outputTokens } (assistant만, null 허용)
  created_at timestamptz not null default now()
);

create index chat_messages_thread_id_created_at_idx
  on public.chat_messages (thread_id, created_at asc);

-- 3. updated_at 자동 갱신 트리거 (0001 set_updated_at 재사용)
create trigger chat_threads_set_updated_at
  before update on public.chat_threads
  for each row execute function public.set_updated_at();

-- 4. chat_messages INSERT 시 chat_threads.updated_at bump
-- 의도: thread의 "마지막 활동 시점"을 메시지 추가 시점으로 갱신.
-- 동작: bump_thread_updated_at의 UPDATE가 set_updated_at trigger를 다시 발동시켜
--   updated_at = now() override. 결과적으로 같은 효과 (idempotent now()=now()).
create or replace function public.bump_thread_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_threads
     set updated_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

create trigger chat_messages_bump_thread
  after insert on public.chat_messages
  for each row execute function public.bump_thread_updated_at();

-- 5. RLS — 본인 thread만 SELECT/UPDATE(soft delete). INSERT는 service_role RPC만.
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "users select own threads"
  on public.chat_threads for select
  using (auth.uid() = user_id and deleted_at is null);

-- soft delete UI는 M6에서 도입. 정책은 미리 정의 (스키마 안정성).
create policy "users soft-delete own threads"
  on public.chat_threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users select own messages"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.user_id = auth.uid()
        and t.deleted_at is null
    )
  );

commit;
```

- [ ] **Step 2: SQL syntax 검증 (Supabase migration push 또는 local apply)**

Run (Supabase 원격 직접):
```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
supabase migration up 0010 --linked 2>&1 | tail -20
```

또는 local stack을 띄워 있다면:
```bash
supabase db reset 2>&1 | tail -20
```

Expected: migration apply 성공, 에러 0건. `chat_threads`/`chat_messages` 테이블이 webfortd-prod에 생성됨.

> Phase 2~3 패턴: 위원장은 webfortd-prod에 직접 apply. local stack 미운영. `supabase migration up --linked`가 표준 명령.

- [ ] **Step 3: 테이블 존재 + RLS 활성 확인**

Run:
```bash
supabase db execute "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('chat_threads','chat_messages');" 2>&1 | tail -10
```

Expected: 2 rows / rowsecurity=true.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0010_chat_history.sql
git commit -m "$(cat <<'EOF'
feat(phase-3-m5): 0010 chat_threads + chat_messages + RLS + 트리거

Phase 3 M5 채팅 히스토리 인프라 1/2:
- chat_threads (id, user_id, title, created_at, updated_at, deleted_at) +
  user_id_updated_at_idx (deleted_at is null partial)
- chat_messages (id, thread_id, role, content, source_refs, token_usage, created_at) +
  thread_id_created_at_idx
- RLS: 본인 thread만 SELECT/UPDATE(soft delete). INSERT는 service_role RPC 전용
  (Phase 2 Finding 1 옵션 B 정합 — anon/authenticated 직접 INSERT 차단).
- 트리거: set_updated_at (BEFORE UPDATE), bump_thread_updated_at
  (AFTER INSERT on chat_messages, security definer + search_path = '' 가드).

soft delete UPDATE 정책은 M6 UI 도입까지 사용처 없지만 스키마 안정성 위해 정의.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 0011 마이그레이션 — atomic RPC 2개

**Files:**
- Create: `supabase/migrations/0011_chat_history_rpcs.sql`

- [ ] **Step 1: 0011 SQL 작성**

Create `supabase/migrations/0011_chat_history_rpcs.sql`:

```sql
-- 0011_chat_history_rpcs.sql
-- Phase 3 M5 — 채팅 히스토리 atomic RPC.
--
-- 의도: route handler가 thread/메시지 INSERT를 multi-step await로 처리하면
--   partial state 발생(thread만 생성, 메시지는 실패). 단일 RPC로 atomic 보장.
-- 정책: security definer + search_path = '' + service_role only grant
--   (0003·0006·0007 패턴 정합).

begin;

-- 1. 신규 thread + 첫 user/assistant 메시지 한 번에 생성
create or replace function public.create_thread_with_messages(
  p_user_id uuid,
  p_title text,
  p_user_content text,
  p_assistant_content text,
  p_source_refs jsonb,
  p_token_usage jsonb
)
returns uuid  -- thread_id
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread_id uuid;
begin
  if p_user_id is null then
    raise exception 'create_thread_with_messages: user_id is required';
  end if;

  insert into public.chat_threads (user_id, title)
    values (p_user_id, p_title)
    returning id into v_thread_id;

  insert into public.chat_messages (thread_id, role, content, source_refs, token_usage)
    values
      (v_thread_id, 'user', p_user_content, '[]'::jsonb, null),
      (v_thread_id, 'assistant', p_assistant_content, p_source_refs, p_token_usage);

  return v_thread_id;
end;
$$;

revoke all on function public.create_thread_with_messages(uuid, text, text, text, jsonb, jsonb) from public;
grant execute on function public.create_thread_with_messages(uuid, text, text, text, jsonb, jsonb) to service_role;

-- 2. 기존 thread에 user+assistant 메시지 한 쌍 추가
create or replace function public.append_messages(
  p_thread_id uuid,
  p_user_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_source_refs jsonb,
  p_token_usage jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- thread 소유권 검증 — route handler 신뢰 X. DB가 최종 가드.
  if not exists (
    select 1 from public.chat_threads
     where id = p_thread_id
       and user_id = p_user_id
       and deleted_at is null
  ) then
    raise exception 'append_messages: thread not found or not owned by user';
  end if;

  insert into public.chat_messages (thread_id, role, content, source_refs, token_usage)
    values
      (p_thread_id, 'user', p_user_content, '[]'::jsonb, null),
      (p_thread_id, 'assistant', p_assistant_content, p_source_refs, p_token_usage);
end;
$$;

revoke all on function public.append_messages(uuid, uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.append_messages(uuid, uuid, text, text, jsonb, jsonb) to service_role;

commit;
```

- [ ] **Step 2: apply + 함수 존재 검증**

Run:
```bash
supabase migration up 0011 --linked 2>&1 | tail -10
supabase db execute "select proname, prosecdef from pg_proc where proname in ('create_thread_with_messages','append_messages');" 2>&1 | tail -10
```

Expected: 2 functions / prosecdef=true (security definer).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_chat_history_rpcs.sql
git commit -m "$(cat <<'EOF'
feat(phase-3-m5): 0011 create_thread_with_messages + append_messages RPC

Phase 3 M5 채팅 히스토리 인프라 2/2:
- create_thread_with_messages — 신규 thread + 2 메시지 atomic (partial state 차단)
- append_messages — 기존 thread + 2 메시지 추가, user_id 소유권 DB 검증
  (route handler 신뢰 X)
- security definer + set search_path = '' (0003·0006·0007 패턴 정합)
- revoke all from public + grant execute to service_role (anon 직접 호출 차단)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 0010+0011 RLS 통합 테스트 (TDD)

**Files:**
- Create: `tests/migrations/0010_chat_history.test.ts`

- [ ] **Step 1: 통합 테스트 작성**

Create `tests/migrations/0010_chat_history.test.ts`:

```ts
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

/**
 * Phase 3 M5 — chat_threads / chat_messages RLS + RPC 통합 시나리오.
 *
 * 환경: .env.local (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SUPABASE_SERVICE_ROLE_KEY).
 * 실 webfortd-prod 호출 — 테스트 후 cleanup으로 생성된 row 모두 삭제.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.warn('[0010 test] .env.local 미설정 — skip')
  process.exit(0)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

// 테스트 전용 사용자 2명 (UUID 직접 fabricate — auth.users에 실 존재 X. user_id FK는
// auth.users(id) ON DELETE CASCADE라 admin이 insert 시도 시 FK 위반 발생.
// 대안: admin client로 auth.admin.createUser() 2개 생성 → 본 테스트 종료 시 delete).
let userA: { id: string; email: string }
let userB: { id: string; email: string }
const cleanupThreadIds: string[] = []

describe('0010 chat_threads + 0011 RPC RLS 시나리오', () => {
  before(async () => {
    const ts = Date.now()
    const a = await admin.auth.admin.createUser({
      email: `test-a-${ts}@webfortd.test`,
      email_confirm: true,
      password: 'test-pw-' + ts,
    })
    const b = await admin.auth.admin.createUser({
      email: `test-b-${ts}@webfortd.test`,
      email_confirm: true,
      password: 'test-pw-' + ts,
    })
    if (a.error || b.error) throw new Error(`createUser failed: ${a.error?.message ?? b.error?.message}`)
    userA = { id: a.data.user!.id, email: a.data.user!.email! }
    userB = { id: b.data.user!.id, email: b.data.user!.email! }
  })

  after(async () => {
    // thread cleanup (CASCADE로 messages 자동 삭제)
    for (const id of cleanupThreadIds) {
      await admin.from('chat_threads').delete().eq('id', id)
    }
    // user cleanup
    if (userA?.id) await admin.auth.admin.deleteUser(userA.id)
    if (userB?.id) await admin.auth.admin.deleteUser(userB.id)
  })

  test('1. service_role RPC create_thread_with_messages — 정상 INSERT + thread_id 반환', async () => {
    const { data, error } = await admin.rpc('create_thread_with_messages', {
      p_user_id: userA.id,
      p_title: '첫 대화',
      p_user_content: '질문 1',
      p_assistant_content: '답변 1',
      p_source_refs: JSON.stringify([{ slug: 's1', title: 't1', axis: 'a', type: 'u', href: '/a/s1' }]),
      p_token_usage: JSON.stringify({ inputTokens: 10, outputTokens: 20 }),
    })
    assert.equal(error, null, `unexpected error: ${error?.message}`)
    assert.ok(typeof data === 'string', 'thread_id uuid string 반환')
    cleanupThreadIds.push(data as string)

    // 메시지 2개 확인 (service_role select)
    const { data: msgs } = await admin
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', data)
      .order('created_at', { ascending: true })
    assert.equal(msgs?.length, 2)
    assert.equal(msgs?.[0].role, 'user')
    assert.equal(msgs?.[1].role, 'assistant')
  })

  test('2. service_role RPC append_messages — user_id 일치 시 INSERT', async () => {
    const threadId = cleanupThreadIds[0]
    const { error } = await admin.rpc('append_messages', {
      p_thread_id: threadId,
      p_user_id: userA.id,
      p_user_content: '질문 2',
      p_assistant_content: '답변 2',
      p_source_refs: '[]',
      p_token_usage: null,
    })
    assert.equal(error, null)

    const { data: msgs } = await admin
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
    assert.equal(msgs?.length, 4)  // 1 라운드 + 1 라운드 = 4 메시지
  })

  test('3. service_role RPC append_messages — user_id 불일치 시 exception', async () => {
    const threadId = cleanupThreadIds[0]
    const { error } = await admin.rpc('append_messages', {
      p_thread_id: threadId,
      p_user_id: userB.id,  // userA의 thread에 userB가 시도
      p_user_content: 'x',
      p_assistant_content: 'y',
      p_source_refs: '[]',
      p_token_usage: null,
    })
    assert.notEqual(error, null, 'exception 발생 기대')
    assert.match(error!.message, /not found or not owned/)
  })

  test('4. anon client — chat_threads 직접 INSERT 시도 → 42501 RLS 거부', async () => {
    const { error } = await anon.from('chat_threads').insert({
      user_id: userA.id,
      title: 'anon 시도',
    })
    assert.notEqual(error, null)
    assert.equal(error!.code, '42501')
  })

  test('5. anon client — chat_messages 직접 INSERT 시도 → 42501 RLS 거부', async () => {
    const { error } = await anon.from('chat_messages').insert({
      thread_id: cleanupThreadIds[0],
      role: 'user',
      content: 'anon 시도',
    })
    assert.notEqual(error, null)
    assert.equal(error!.code, '42501')
  })

  test('6. authenticated user A — 본인 thread SELECT OK, userB의 thread 시도 → 빈 결과', async () => {
    // userA로 새 client 생성 (sign in)
    const userAClient = createClient(SUPABASE_URL, ANON_KEY)
    const signA = await userAClient.auth.signInWithPassword({
      email: userA.email,
      password: (await admin.auth.admin.getUserById(userA.id)).data.user!.email!,  // 비번은 createUser 시점 값 — 별도 저장 필요 시 before에서 박을 것
    })
    // password 보관용 단순화 — Step 1에서 'test-pw-' + ts로 fixed
    // (실 구현 시 before 블록에서 password 변수에 저장)

    // 본인 thread SELECT — RLS 통과
    const { data: ownThreads } = await userAClient
      .from('chat_threads')
      .select('id, title')
      .eq('id', cleanupThreadIds[0])
    assert.equal(ownThreads?.length, 1)

    // userB로 sign in해서 userA thread SELECT → 빈 결과
    const userBClient = createClient(SUPABASE_URL, ANON_KEY)
    await userBClient.auth.signInWithPassword({
      email: userB.email,
      password: 'test-pw-...',  // 위 주석과 동일
    })
    const { data: otherThreads } = await userBClient
      .from('chat_threads')
      .select('id')
      .eq('id', cleanupThreadIds[0])
    assert.equal(otherThreads?.length, 0)
  })
})
```

> 위 테스트는 패스워드 관리가 살짝 어색하다. 실 구현 시 `before` 블록에서 `password` 변수를 모듈 스코프로 박고 두 client 모두 동일 password로 sign in. 위 의사 코드는 의도 전달용 — 실 구현 시 정리.

- [ ] **Step 2: 통합 테스트 실행 (M4 impl 머지 후 master에서)**

Run:
```bash
npm run test:integration -- --test-name-pattern="0010"
```

Expected: 6 tests PASS / 0 fail.

> M3 baseline 1건(`replace_document_chunks 빈 chunks`)은 master 상속 — 우리 0010 테스트와 무관.

- [ ] **Step 3: 전체 회귀 확인**

Run:
```bash
npm run test:all
```

Expected: unit 184 + components 4 + integration 28 (M3 baseline) + 6 (신규 0010) = 222 — M3 baseline fail 1건만(M5와 무관).

- [ ] **Step 4: Commit**

```bash
git add tests/migrations/0010_chat_history.test.ts
git commit -m "$(cat <<'EOF'
test(phase-3-m5): 0010 + 0011 RLS 6 시나리오 통합

- service_role RPC: create / append (정상 + user_id 불일치 exception)
- anon client: chat_threads / chat_messages 직접 INSERT → 42501 차단
- authenticated user A/B: 본인 thread만 SELECT (RLS 분리 검증)

테스트 전 admin.auth.admin.createUser로 fixture 2명 생성, after에서
delete (CASCADE로 chat_threads/messages 자동 정리).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: route.ts onFinish 분기 — DB 저장

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: 기존 route.ts에서 onFinish 분기 추가**

Modify `src/app/api/chat/route.ts` — `onFinish` 콜백 안에 DB 저장 분기 + body shape 확장.

핵심 변경 (의사 패치):

```ts
import { getServerClient } from '@/lib/supabase/server'  // 신규
import { getAdminClient } from '@/lib/supabase/admin'    // 신규

interface ChatRequestBody {
  messages?: unknown
  threadId?: string  // 신규 — 클라이언트가 기존 thread 이어가기 시
}

export async function POST(req: Request): Promise<Response> {
  // ... 기존 body parse + validateUIMessages + clampHistory + extractUserText + retrieval

  // 신규: 서버측 user 검증 (cookies 기반, 클라이언트 hint 신뢰 X)
  const supabaseSSR = await getServerClient()
  const { data: { user } } = await supabaseSSR.auth.getUser()

  // newThreadId 클로저 변수 — route handler stateless, onFinish set → messageMetadata read
  let newThreadId: string | null = null

  const result = streamText({
    model: gateway('google/gemini-3.5-flash'),
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ usage, text }) => {
      // 기존 PIPA 로그 (그대로)
      console.log('[chat] finish', { /* ... */ })

      // 신규: 로그인 사용자만 DB 저장
      if (!user) return

      const admin = getAdminClient()
      const userQueryText = queryText
      const sourceRefsJson = JSON.stringify(retrieval.sources)
      const tokenUsageJson = JSON.stringify({
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
      })

      try {
        if (!body.threadId) {
          // 신규 thread
          const title = userQueryText.slice(0, 30)
          const { data, error } = await admin.rpc('create_thread_with_messages', {
            p_user_id: user.id,
            p_title: title,
            p_user_content: userQueryText,
            p_assistant_content: text,
            p_source_refs: sourceRefsJson,
            p_token_usage: tokenUsageJson,
          })
          if (error) throw error
          newThreadId = data as string
        } else {
          // 기존 thread에 append
          const { error } = await admin.rpc('append_messages', {
            p_thread_id: body.threadId,
            p_user_id: user.id,
            p_user_content: userQueryText,
            p_assistant_content: text,
            p_source_refs: sourceRefsJson,
            p_token_usage: tokenUsageJson,
          })
          if (error) throw error
        }
      } catch (err) {
        // PIPA: error.message에 user 본문 마스킹 (formatSupabaseError 패턴)
        const masked = err instanceof Error ? err.message : String(err)
        console.error('[chat] history save failed:', masked)
        // 사용자 응답은 이미 streaming 완료 — silent (M6에서 retry UI 검토)
      }
    },
  })

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return {
          sourceRefs: retrieval.sources,
          ...(newThreadId ? { threadId: newThreadId } : {}),
        }
      }
      return undefined
    },
  })
}
```

> 정확한 위치 + import 추가는 본 plan을 받은 엔지니어가 기존 route.ts를 읽고 patch. spec §5.1과 정합.

- [ ] **Step 2: TypeScript + lint 검증**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "api/chat/route" | head -5
npm run lint 2>&1 | grep "api/chat/route" | head -5
```

Expected: 0 error.

- [ ] **Step 3: 빌드 회귀**

Run:
```bash
npm run build 2>&1 | grep -E "Compiled|/api/chat|Error" | head -5
```

Expected: 568 정적 페이지 + `/api/chat` ƒ + 신규 라우트는 Task 5·8 후.

- [ ] **Step 4: 회귀 unit/components**

Run:
```bash
npm run test && npm run test:components
```

Expected: 184 unit + 4 components 그대로 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "$(cat <<'EOF'
feat(phase-3-m5): /api/chat onFinish DB history 분기 — RPC atomic 저장

- getServerClient + .auth.getUser cookies 기반 로그인 검증 (클라이언트 hint 신뢰 X)
- body shape 확장: threadId 신규 (클라이언트가 기존 thread 이어가기)
- onFinish:
  - 비로그인: 기존 PIPA 로그만 (그대로)
  - 로그인 + threadId 없음 → create_thread_with_messages (신규 thread 생성)
  - 로그인 + threadId 있음 → append_messages (기존 thread 추가)
  - 에러: formatSupabaseError 패턴으로 마스킹 + silent (응답 streaming 완료
    상태에서 저장 실패 — M6 retry UI 검토)
- messageMetadata: 신규 threadId가 있으면 클로저 변수에서 read해 클라이언트 전달
  (route handler stateless — newThreadId let 변수)

검증: tsc 0 error + lint 0 + build /api/chat ƒ + 184/4 회귀.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: /api/chat/threads — 사이드바 목록 API

**Files:**
- Create: `src/app/api/chat/threads/route.ts`

- [ ] **Step 1: route 작성**

Create `src/app/api/chat/threads/route.ts`:

```ts
/**
 * Phase 3 M5 — 로그인 사용자의 chat_threads 목록.
 *
 * GET only. RLS가 본인 thread만 반환 보장.
 * 비로그인: 빈 배열 + 200 (UI가 분기 없이 안전하게 사용 가능).
 */
import { getServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ threads: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20)  // spec §2 D6

  if (error) {
    return new Response(
      JSON.stringify({ error: '대화 목록을 불러오지 못했어요.' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    )
  }

  return new Response(JSON.stringify({ threads: data ?? [] }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
```

- [ ] **Step 2: 빌드 회귀 — 신규 ƒ 등록**

Run:
```bash
npm run build 2>&1 | grep -E "/api/chat" | head -3
```

Expected:
```
├ ƒ /api/chat
├ ƒ /api/chat/threads
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/threads/route.ts
git commit -m "$(cat <<'EOF'
feat(phase-3-m5): /api/chat/threads GET — 본인 thread 최신 20개

- runtime='nodejs', cookies 기반 SSR auth (getServerClient)
- 비로그인 → { threads: [] } + 200 (UI가 분기 없이 사용)
- 로그인 → RLS가 본인 thread만 반환 (auth.uid() 필터)
- .order(updated_at desc).limit(20) — spec §2 D6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: ThreadDrawer 컴포넌트 + SWR install

**Files:**
- Modify: `package.json`, `package-lock.json` (swr 추가)
- Create: `src/components/chat/ThreadDrawer.tsx`

- [ ] **Step 1: SWR install**

Run:
```bash
npm install swr@^2.4.1
```

Expected: `package.json` deps에 `swr ^2.4.1` 추가.

- [ ] **Step 2: ThreadDrawer 작성**

Create `src/components/chat/ThreadDrawer.tsx`:

```tsx
'use client'

/**
 * Phase 3 M5 — 로그인 사용자의 채팅 thread 사이드바.
 *
 * shadcn Sheet 기반 — 데스크탑 sticky drawer + 모바일 햄버거 (M4 install).
 * SWR로 /api/chat/threads 조회 + 신규 thread 생성 후 mutate로 즉시 갱신.
 *
 * 접근성:
 *   - Sheet 자체에 focus trap + Esc close (shadcn 기본)
 *   - aria-current="true"로 활성 thread 표시
 *   - 햄버거 trigger aria-label="대화 목록 열기"
 */

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import useSWR from 'swr'

interface ThreadSummary {
  id: string
  title: string
  updated_at: string
}

interface ThreadDrawerProps {
  currentThreadId?: string
  onSelect: (threadId: string) => void
}

async function fetcher(url: string): Promise<{ threads: ThreadSummary[] }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('대화 목록 fetch 실패')
  return res.json()
}

export function ThreadDrawer({ currentThreadId, onSelect }: ThreadDrawerProps) {
  // revalidateOnFocus 기본값 그대로(탭 전환 시 자동 갱신).
  // ChatUI가 신규 thread 생성 후 mutate('/api/chat/threads') 호출로 즉시 갱신.
  const { data } = useSWR('/api/chat/threads', fetcher)
  const threads = data?.threads ?? []

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="대화 목록 열기"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" aria-label="대화 목록">
        <SheetTitle className="text-base font-semibold">최근 대화</SheetTitle>
        {threads.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            아직 저장된 대화가 없어요.
          </p>
        ) : (
          <nav className="mt-4">
            <ul role="list" className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    aria-current={t.id === currentThreadId ? 'true' : undefined}
                    className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring aria-[current=true]:bg-accent aria-[current=true]:font-medium"
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: TypeScript + lint**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "ThreadDrawer" | head -5
npm run lint 2>&1 | grep "ThreadDrawer" | head -5
```

Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/chat/ThreadDrawer.tsx
git commit -m "$(cat <<'EOF'
feat(phase-3-m5): ThreadDrawer 신규 — shadcn Sheet + SWR

- shadcn Sheet (M4 install) 좌측 drawer — side="left"
- 햄버거 trigger 44×44px 터치 타깃 (h-11 w-11)
- aria-label="대화 목록 열기" + SheetContent aria-label="대화 목록"
- aria-current="true"로 활성 thread 시각·청각 표시
- SWR /api/chat/threads — revalidateOnFocus 기본값 + ChatUI에서
  신규 thread 생성 후 mutate로 즉시 갱신
- 빈 목록 메시지 "아직 저장된 대화가 없어요"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: ChatUI 통합 — threadId + body + ThreadDrawer 렌더

**Files:**
- Modify: `src/components/chat/ChatUI.tsx`

- [ ] **Step 1: ChatUI 확장**

`src/components/chat/ChatUI.tsx`에 다음 변경:

1. `useAuth` import (기존 `src/components/auth/AuthContext` 또는 동급)
2. `threadId` state + `useChat` body로 동봉
3. `onFinish`에서 신규 threadId 받아 state 갱신 + SWR mutate
4. 로그인 시 좌측 `ThreadDrawer` 렌더 (간단히 ChatUI 컴포넌트 mount 외부 또는 sibling)
5. drawer thread 선택 시 ChatUI 메시지 reset (`messages` clear + `threadId` set) — 가장 단순한 방식은 ChatUI를 thread별 key로 unmount/remount

핵심 패치 (의사 코드):

```tsx
import { useAuth } from '@/components/auth/AuthContext'
import { ThreadDrawer } from '@/components/chat/ThreadDrawer'
import { mutate } from 'swr'

export function ChatUI() {
  const { user } = useAuth()
  const [threadId, setThreadId] = useState<string | undefined>(undefined)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { threadId },  // useChat가 매 요청에 동봉
    }),
    onFinish: ({ message }) => {
      const meta = message.metadata as { threadId?: string } | undefined
      if (meta?.threadId && !threadId) {
        setThreadId(meta.threadId)
        // 사이드바 즉시 갱신
        mutate('/api/chat/threads')
      }
    },
  })

  // drawer에서 thread 선택 시: threadId 변경 + 메시지 reset
  // 가장 단순한 패턴은 ChatUI를 wrap하는 parent에서 key로 remount.
  // 본 PR에서는 ChatUI 내부에서 threadId 변경 시 page reload 안 시키고
  // useChat의 messages를 외부에서 clear할 방법이 v6에 명시 안 됨 →
  // window.location 새로고침 또는 chat hook recreate.
  // 단순화: 본 PR에서는 drawer thread 선택 시 router.push(`/chat?thread=${id}`) +
  // page.tsx에서 query를 initial threadId로 사용. ChatUI에 initialThreadId prop 추가.
  //
  // → 본 plan 작업자에게: page.tsx + ChatUI의 prop 인터페이스를 함께 변경하라.

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {user && (
        <div className="md:sticky md:top-0 md:h-full">
          <ThreadDrawer
            currentThreadId={threadId}
            onSelect={(id) => {
              // Router push 또는 unmount/remount
              window.location.href = `/chat?thread=${id}`
            }}
          />
        </div>
      )}
      <div className="mx-auto flex max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {/* 기존 Conversation/MessageContent/PromptInput 그대로 */}
      </div>
    </div>
  )
}
```

추가 변경: `page.tsx`에 `searchParams.thread`를 받아 ChatUI에 `initialThreadId`로 전달.

```tsx
// src/app/(wiki)/chat/page.tsx
import { ChatUI } from '@/components/chat/ChatUI'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>
}) {
  const params = await searchParams
  return <ChatUI initialThreadId={params.thread} />
}
```

ChatUI:
```tsx
export function ChatUI({ initialThreadId }: { initialThreadId?: string }) {
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  // ...
}
```

> drawer thread 선택 시 `window.location` 새로고침은 SPA 경험 손상이지만 단순함. 더 정교한 패턴(`router.replace` + `key` re-mount)은 M6에서 보강 권고.

- [ ] **Step 2: TypeScript + lint + build**

Run:
```bash
npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep -E "Compiled|/api/chat" | head -5
```

Expected: 0 error / 568 정적 + ƒ 3개 (/api/chat, /api/chat/threads).

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatUI.tsx src/app/\(wiki\)/chat/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase-3-m5): ChatUI threadId 통합 + ThreadDrawer 렌더 + page searchParams

ChatUI:
- initialThreadId prop 신규 (page.tsx → searchParams.thread)
- threadId useState로 관리, useChat body에 동봉
- onFinish 신규 threadId 받아 state 동기화 + mutate('/api/chat/threads')
- 로그인 사용자만 ThreadDrawer 좌측 렌더 (md:sticky)
- drawer thread 선택 → window.location 새로고침 (단순. 더 정교한
  router.replace + key remount는 M6 carry)

page.tsx:
- searchParams.thread를 ChatUI initialThreadId로 전달

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: /api/cron/cleanup-chats + vercel.json

**Files:**
- Create: `src/app/api/cron/cleanup-chats/route.ts`
- Create or Modify: `vercel.json`
- Modify: `.env.local` (위원장 명시 — CRON_SECRET 추가)

- [ ] **Step 1: 위원장에게 CRON_SECRET 환경변수 등록 요청**

위원장에게 명시 요청:
1. 32자 랜덤 secret 생성: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`
2. Vercel 환경변수 `CRON_SECRET` 추가 (production + preview + development)
3. `vercel env pull .env.local --yes`로 로컬 동기화

위원장이 OK 신호 후 Step 2 진입.

- [ ] **Step 2: cron route 작성**

Create `src/app/api/cron/cleanup-chats/route.ts`:

```ts
/**
 * Phase 3 M5 — 90일 soft delete + 추가 30일 hard delete cron.
 *
 * Vercel cron이 매일 03:00 UTC (한국시간 12:00)에 호출.
 * Bearer 토큰 검증 (CRON_SECRET 환경변수).
 *
 * 정책 (spec §5.3):
 *   - soft delete 90일: updated_at < now() - 90 days 이고 deleted_at is null
 *     → deleted_at = now(). 사용자 SELECT에서 제외 (RLS 정책).
 *   - hard delete 추가 30일: deleted_at < now() - 30 days
 *     → 실 DELETE. cascade로 chat_messages 자동 삭제.
 *     PIPA "수집 목적 소멸 후 즉시 파기" 정합 (90일 + 30일 = 총 120일 보존
 *     중 90일 후 사용자 접근 차단).
 */
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: Request): Promise<Response> {
  // Vercel cron Bearer 검증 — timing-safe 비교 권고 (codex P0 회피)
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!auth || auth.length !== expected.length || auth !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }
  // 더 엄격한 timing-safe: crypto.timingSafeEqual on Buffer
  // (현재 length 일치 체크 후 string 비교는 V8 최적화로 거의 timing-safe하지만
  //  완전 보장을 위해서는 Buffer.compare 또는 timingSafeEqual 사용)

  const admin = getAdminClient()
  const softCutoff = new Date(Date.now() - 90 * DAY_MS).toISOString()
  const hardCutoff = new Date(Date.now() - 30 * DAY_MS).toISOString()

  // 1. soft delete 90일 경과 thread
  const { data: softDeleted, error: e1 } = await admin
    .from('chat_threads')
    .update({ deleted_at: new Date().toISOString() })
    .lt('updated_at', softCutoff)
    .is('deleted_at', null)
    .select('id')

  if (e1) {
    console.error('[cron] soft delete failed:', e1.message)
    return new Response(
      JSON.stringify({ error: 'soft delete failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  // 2. hard delete: deleted_at + 30일 경과
  const { data: hardDeleted, error: e2 } = await admin
    .from('chat_threads')
    .delete()
    .lt('deleted_at', hardCutoff)
    .select('id')

  if (e2) {
    console.error('[cron] hard delete failed:', e2.message)
    return new Response(
      JSON.stringify({ error: 'hard delete failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      softDeleted: softDeleted?.length ?? 0,
      hardDeleted: hardDeleted?.length ?? 0,
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  )
}
```

- [ ] **Step 3: vercel.json 작성 또는 확장**

Check existence:
```bash
ls /Users/hunyongkim/Mac-Projects/webfortd/vercel.json 2>&1
```

If not exists, create:
```json
{
  "crons": [
    { "path": "/api/cron/cleanup-chats", "schedule": "0 3 * * *" }
  ]
}
```

If exists, merge `crons` 배열 추가.

- [ ] **Step 4: 빌드 + 수동 cron 호출 검증**

Run:
```bash
npm run build 2>&1 | grep "/api/cron" | head -3
```

Expected: `/api/cron/cleanup-chats` ƒ 등록.

수동 호출 (Bearer 없이):
```bash
npm run dev &
sleep 5
curl -s http://localhost:3000/api/cron/cleanup-chats -w "\n%{http_code}\n"
```

Expected: `Unauthorized\n401`.

Bearer 포함:
```bash
curl -s -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3000/api/cron/cleanup-chats -w "\n%{http_code}\n"
```

Expected: `{"softDeleted":0,"hardDeleted":0}\n200` (DB에 90일 경과 thread 0건 가정).

종료:
```bash
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/cleanup-chats/route.ts vercel.json
git commit -m "$(cat <<'EOF'
feat(phase-3-m5): /api/cron/cleanup-chats + vercel.json daily cron

cron 정책 (spec §5.3):
- soft delete 90일: updated_at + 90d 후 deleted_at = now() (사용자 SELECT에서 제외)
- hard delete 추가 30일: deleted_at + 30d 후 실 DELETE (cascade로 chat_messages 자동 삭제)
- 총 120일 보존, 90일 후 PIPA 의무 충족(사용자 접근 차단)

Bearer 인증: CRON_SECRET 환경변수 + length 일치 + string ===
(Vercel cron 표준 패턴). 더 엄격한 timing-safe는 codex 권고 수용 시 보강.

vercel.json crons: 매일 03:00 UTC (한국시간 12:00).

수동 검증: Bearer 없이 → 401, 정상 Bearer → 200 + softDeleted/hardDeleted 카운트.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 회귀 검증 + 위원장 톤 검수 게이트

**Files:** 코드 변경 없음. 검증·수동 검수.

- [ ] **Step 1: 자동 회귀 (unit/components/integration/build/lint)**

Run:
```bash
npm run test:all 2>&1 | tail -20
npm run kb:publish:dry-run 2>&1 | grep -E "candidate|passing|blocked" | head -5
npm run build 2>&1 | grep -E "Generating|/api/" | head -10
npm run lint 2>&1 | tail -5
```

Expected:
- test: 184 unit + 4 components + 28+6 integration (M3 baseline 1건 fail 무관)
- kb: 535/8/527 (변동 0)
- build: 568 정적 + ƒ 3개 (/api/chat, /api/chat/threads, /api/cron/cleanup-chats)
- lint: 신규 파일 0 error/warning

- [ ] **Step 2: 위원장 수동 검수 — 시나리오 2, 3, 4 (production preview 또는 dev)**

위원장이 직접:

**시나리오 2 (로그인 첫 thread)**:
1. `/chat` 접속 → 로그인 (매직링크)
2. 추천 질문 클릭 → 응답 수신
3. **새로고침** → 대화 유지 확인
4. drawer 햄버거 클릭 → 첫 thread title("질문 첫 30자") 노출 확인
5. drawer thread 클릭 → 동일 thread reload

**시나리오 3 (로그인 thread 이어가기)**:
1. 시나리오 2의 thread에서 추가 질문
2. drawer thread 그대로 (새 thread 안 만들어짐)
3. DB에 새 메시지 쌍 append 확인 (위원장이 Supabase dashboard에서 확인 또는 새로고침 + 응답 history 유지)

**시나리오 4 (VoiceOver + 모바일)**:
1. iOS Safari VoiceOver on
2. 시나리오 2 재현 — 햄버거 trigger 도달 + drawer 열림 낭독 + thread 선택 흐름
3. 모바일 햄버거 44×44px 터치 가능 확인

위원장 OK 신호 후 Step 3.

- [ ] **Step 3: cron endpoint 실 운영 환경 확인**

Production preview에서 `curl` (Vercel env CRON_SECRET 사용):
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET_FROM_VERCEL" \
  https://webfortd-<preview-url>/api/cron/cleanup-chats -w "\n%{http_code}\n"
```

Expected: `{"softDeleted":0,"hardDeleted":0}` + 200.

- [ ] **Step 4: Commit (fix 있으면)**

위원장 피드백 fix 있으면 별도 commit. 없으면 skip.

---

### Task 10: PR 작성 + codex-rescue

**Files:** 코드 변경 없음.

- [ ] **Step 1: push**

```bash
git push -u origin phase-3-m5-impl
```

> Plan PR(본 plan)은 별도 brench `phase-3-m5-plan`. impl은 plan 머지 후 `phase-3-m5-impl`로 새로 만들 것.

- [ ] **Step 2: PR 작성**

```bash
gh pr create --title "feat(phase-3-m5): DB 채팅 히스토리 인프라 + ThreadDrawer + Vercel cron" --body "$(cat <<'EOF'
## 요약

Phase 3 M5 — 로그인 사용자의 채팅 대화를 chat_threads/chat_messages 테이블에 저장. 좌측 drawer로 thread 전환. 90일 soft + 추가 30일 hard delete Vercel cron.

## 짝 문서
- spec: docs/superpowers/specs/2026-05-24-phase-3-m4-m5-chat-ui-history-design.md
- plan: docs/superpowers/plans/2026-05-24-phase-3-m5-chat-history.md

## 10 commits 요약
1. 0010 chat_threads + chat_messages + RLS + 트리거
2. 0011 atomic RPC create_thread_with_messages + append_messages
3. RLS 6 시나리오 통합 테스트
4. /api/chat onFinish DB 분기 (RPC atomic 저장)
5. /api/chat/threads GET (본인 최신 20개)
6. ThreadDrawer (shadcn Sheet + SWR)
7. ChatUI threadId 통합 + page searchParams
8. /api/cron/cleanup-chats + vercel.json
9. (선택) 위원장 검수 피드백 fix
10. (선택) codex-rescue 피드백 fix

## 보안·아키텍처
- DB write = service_role RPC 전용 (Phase 2 Finding 1 옵션 B)
- security definer + search_path = '' (0003·0006·0007 패턴)
- thread 소유권은 DB 함수 내부에서 검증 (route handler 신뢰 X)
- PIPA: user query 본문 로그 X, error.message 마스킹 (formatSupabaseError)

## codex-rescue 포커스 (spec §10 PR B)
- 0010 RLS write 정책 누락 (anon/authenticated 직접 INSERT 가드)
- 0011 RPC security definer + search_path = '' 가드
- append_messages thread 소유권 DB 검증
- onFinish silent + PII 마스킹
- cron Bearer timing-safe
- getServerClient cookies 누락 회귀
- soft + hard delete boundary 산수
- messageMetadata.threadId race condition

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: codex-rescue dispatch**

```
Agent({
  description: "Phase 3 M5 impl PR codex-rescue",
  subagent_type: "codex:codex-rescue",
  prompt: "...본 plan의 spec §10 PR B 포커스 7건 + 본 PR diff 전체..."
})
```

- [ ] **Step 4: 결과 처리**

APPROVE / APPROVE_WITH_FOLLOWUP / CONCERN 판정 받고 위원장 머지 신호.

---

## 3. Self-Review

### Spec coverage 검증

spec §M5 + §3 + §5 + §8.2 항목별 매핑:

| spec 항목 | plan task |
|----------|----------|
| 0010 chat_threads + chat_messages + RLS + 트리거 | Task 1 |
| 0011 create_thread_with_messages + append_messages | Task 2 |
| RLS 통합 테스트 6 시나리오 | Task 3 |
| route.ts onFinish 분기 | Task 4 |
| /api/chat/threads GET | Task 5 |
| ThreadDrawer (shadcn Sheet) | Task 6 |
| ChatUI threadId/userId body + onFinish state 동기화 | Task 7 |
| /api/cron/cleanup-chats + vercel.json | Task 8 |
| 위원장 검수 시나리오 2·3·4 | Task 9 |
| codex-rescue 포커스 7건 | Task 10 |

**Gap 0건.**

### Placeholder scan

- "TBD", "TODO": 0건
- "implement later" / "add appropriate error handling": 0건
- 큰 implementation placeholder 있는 곳:
  - Task 3 Step 1 마지막 주석 — password 보관 방식 단순화 안내 ("실 구현 시 before 블록에서 password 변수에 저장"). 의사 코드 명시.
  - Task 4 Step 1 의사 패치 — 정확한 import 위치는 기존 route.ts 본 후 적용. plan의 의도 명확하므로 작업자 재량.
  - Task 7 Step 1 drawer thread 선택 → `window.location` 새로고침 (단순. router.replace + key remount는 M6 carry).

위 세 가지는 의도된 단순화 — 본 PR scope 명시 + M6 carry 권고로 처리.

### Type consistency

- `chat_threads.id` uuid, `chat_messages.thread_id` uuid FK — 일관
- `auth.users(id)` FK + `on delete cascade` — 사용자 삭제 시 자동 정리
- `role text check (in 'user'/'assistant')` — chat_messages 일관
- `source_refs jsonb default '[]'` + `token_usage jsonb (null 허용)` — 일관
- RPC 시그니처 `(uuid, text, text, text, jsonb, jsonb)` — Task 2 정의 = Task 4 호출 시그니처 일치
- `ThreadDrawer` `currentThreadId: string | undefined` = ChatUI threadId state 일치
- `useChat` v6 transport body `{ threadId }` = route.ts ChatRequestBody.threadId 일치

### Scope check

- 10 tasks, 각 task 4~5 step → bite-sized 유지
- TDD: Task 3에서 RLS 시나리오 통합 테스트 먼저 정의 → Task 4~7 구현은 시나리오 통과를 목표로
- 단일 plan으로 PR B 완결 (M6는 별도)

### Ambiguity check

- Task 3 password 보관: 단순화 안내로 처리 — 작업자 재량
- Task 4 정확한 import 위치: 작업자 기존 route.ts 읽고 patch
- Task 7 drawer 선택 시 reload 방식: `window.location` 단순 — M6 carry 권고 명시

**Self-review 완료 — 인라인 fix 0건.** Plan 그대로 실행 가능.

---

## 4. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-24 | 초안 작성 — M4 plan PR #30 머지 `4224e95` 후속, PR B (M5 DB 히스토리) 단독 plan. 10 tasks (0010 + 0011 + RLS 통합 + route onFinish + threads route + ThreadDrawer + ChatUI 통합 + cron + 검증 + PR). M4 impl PR #31 머지 후 진행. 보안 CVE는 별도 sprint. |
