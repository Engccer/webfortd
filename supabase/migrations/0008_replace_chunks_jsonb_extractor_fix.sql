-- 0008_replace_chunks_jsonb_extractor_fix.sql
-- Phase 3 M2 hotfix #2 — replace_document_chunks의 embedding cast 강화.
--
-- 원인: Supabase JS가 vector(1536) 컬럼을 string '[-0.036,...]'로 직렬화.
--   호출자가 string을 jsonb payload에 직접 넣으면 chunk->'embedding'은 jsonb string
--   value ("[-0.036,...]" 큰따옴표 포함)이 되고, ::text cast가 큰따옴표를 보존하여
--   vector(1536) cast가 실패한다.
--
-- 해결: '->' (jsonb 값 그대로) 대신 '->>' (text extractor)를 사용.
--   '->> '는 jsonb string이면 큰따옴표 제거 후 raw text 반환, jsonb array면
--   '[-0.036,...]' standard literal. 두 형식 모두 vector(1536) cast 통과.

begin;

create or replace function public.replace_document_chunks(
  p_document_id uuid,
  p_chunks jsonb
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int := 0;
begin
  if p_document_id is null then
    raise exception 'replace_document_chunks: p_document_id is required';
  end if;

  if not exists (select 1 from public.documents where id = p_document_id) then
    raise exception 'replace_document_chunks: document_id % not found', p_document_id;
  end if;

  delete from public.document_chunks
  where document_id = p_document_id;

  if p_chunks is null or jsonb_array_length(p_chunks) = 0 then
    return 0;
  end if;

  insert into public.document_chunks (
    document_id,
    chunk_index,
    chunk_text,
    embedding,
    metadata,
    section,
    char_start,
    char_end
  )
  select
    p_document_id,
    (chunk->>'chunk_index')::int,
    chunk->>'chunk_text',
    -- '->>' (text extractor) — Supabase JS string 직렬화·array 직렬화 둘 다 cast 통과.
    (chunk->>'embedding')::public.vector(1536),
    coalesce(chunk->'metadata', '{}'::jsonb),
    chunk->>'section',
    nullif(chunk->>'char_start', '')::int,
    nullif(chunk->>'char_end', '')::int
  from jsonb_array_elements(p_chunks) chunk;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

commit;
