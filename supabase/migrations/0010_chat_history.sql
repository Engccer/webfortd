-- 0010_chat_history.sql
-- Phase 3 M5 — 채팅 대화 DB 히스토리.
--
-- 정책:
--   - DB write는 service_role 전용 (Phase 2 Finding 1 옵션 B). anon/authenticated
--     직접 INSERT는 RLS 차단. 모든 write는 0011 RPC를 통한 service_role 경로.
--   - SELECT는 본인 thread만 (auth.uid() 매칭).
--   - soft delete = deleted_at 타임스탬프. cron(/api/cron/cleanup-chats)이 hard delete로 정리.
--   - chat_threads.updated_at는 chat_messages INSERT 시 자동 bump (trigger).

begin;

-- 1. chat_threads
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz  -- soft delete 표지. cron이 hard delete로 정리.
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
