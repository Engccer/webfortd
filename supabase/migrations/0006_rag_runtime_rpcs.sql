-- 0006_rag_runtime_rpcs.sql
-- Phase 3 M2 — RAG runtime RPCs
--   1) replace_document_chunks: single-document atomic delete+insert
--      (M1 carry #2 — reader gap 차단, M3 Route Handler 진입 전 필수)
--   2) match_chunks: pgvector cosine 검색 + documents JOIN + status 필터
--      (M2 본체 retrieval 함수의 DB-side wrapper)
--
-- 두 함수 모두 service_role 전용. anon/authenticated grant 제거.
-- 0003·0004 패턴 계승: set search_path = '' 가드 적용.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) replace_document_chunks
-- ─────────────────────────────────────────────────────────────────────────
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

  -- documents row 존재 확인 (FK 미존재 시 INSERT가 실패하므로 사전 가드)
  if not exists (select 1 from public.documents where id = p_document_id) then
    raise exception 'replace_document_chunks: document_id % not found', p_document_id;
  end if;

  -- atomic delete (트랜잭션 안)
  delete from public.document_chunks
  where document_id = p_document_id;

  -- 빈 배열이면 delete만 수행
  if p_chunks is null or jsonb_array_length(p_chunks) = 0 then
    return 0;
  end if;

  -- jsonb array → row insert (vector cast는 array literal text)
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
    (chunk->'embedding')::text::public.vector(1536),
    coalesce(chunk->'metadata', '{}'::jsonb),
    chunk->>'section',
    nullif(chunk->>'char_start', '')::int,
    nullif(chunk->>'char_end', '')::int
  from jsonb_array_elements(p_chunks) chunk;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.replace_document_chunks(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_document_chunks(uuid, jsonb) to service_role;

comment on function public.replace_document_chunks(uuid, jsonb) is
  'Phase 3 M2 — single-document atomic delete+insert for chunks. service_role only.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2) match_chunks — pgvector cosine 검색
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.match_chunks(
  p_query_embedding float8[],
  p_top_k int default 5,
  p_min_similarity float default 0.0,
  p_include_drafts boolean default true
) returns table (
  chunk_id uuid,
  document_id uuid,
  chunk_text text,
  section text,
  chunk_index int,
  metadata jsonb,
  document_slug text,
  document_title text,
  document_axis text,
  document_type text,
  document_status text,
  similarity float
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query public.vector(1536) := p_query_embedding::public.vector(1536);
begin
  -- 50 = Gemini Flash 컨텍스트 블로우업 방어 상한. M3 Route Handler도 동일 cap 적용.
  if p_top_k is null or p_top_k < 1 or p_top_k > 50 then
    raise exception 'match_chunks: p_top_k must be 1..50, got %', p_top_k;
  end if;

  return query
  select
    c.id          as chunk_id,
    c.document_id,
    c.chunk_text,
    c.section,
    c.chunk_index,
    c.metadata,
    d.slug        as document_slug,
    d.title       as document_title,
    d.axis        as document_axis,
    d.type        as document_type,
    d.status      as document_status,
    (1 - (c.embedding <=> v_query))::float as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (p_include_drafts or d.status = 'published')
    and (1 - (c.embedding <=> v_query)) >= p_min_similarity
  order by c.embedding <=> v_query
  limit p_top_k;
end;
$$;

revoke all on function public.match_chunks(float8[], int, float, boolean) from public, anon, authenticated;
grant execute on function public.match_chunks(float8[], int, float, boolean) to service_role;

comment on function public.match_chunks(float8[], int, float, boolean) is
  'Phase 3 M2 — pgvector cosine kNN with documents metadata JOIN. service_role only.';

commit;
