-- 0011_chat_history_rpcs.sql
-- Phase 3 M5 — 채팅 히스토리 atomic RPC.
--
-- 의도: route handler가 thread/메시지 INSERT를 multi-step await로 처리하면
--   partial state 발생(thread만 생성, 메시지는 실패). 단일 RPC로 atomic 보장.
-- 정책: security definer + search_path = '' + service_role only grant
--   (0003·0006·0007·0009 패턴 정합).

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
