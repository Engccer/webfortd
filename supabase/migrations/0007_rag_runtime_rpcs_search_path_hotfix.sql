-- 0007_rag_runtime_rpcs_search_path_hotfix.sql
-- Phase 3 M2 hotfix — 0006 RPC가 search_path='' 환경에서 pgvector type·operator
-- namespace 해소 실패 (실측 42883: operator does not exist: public.vector <=> public.vector).
--
-- 원인: vector type은 0001의 unqualified `create extension if not exists vector`로
--   public schema에 install (Supabase가 자동으로 extensions로 옮기지 않은 케이스).
--   따라서 type 한정자는 그대로 'public.vector'가 맞음. 문제는 cosine distance
--   operator '<=>'. Postgres에서 operator는 type-bound이지만 lookup이 search_path
--   영향을 받음. set search_path='' 환경에서는 OPERATOR(public.<=>) 형태로 schema
--   한정자를 명시해야 함.
--
-- 0003 패턴(set search_path = '' 가드)는 그대로 유지. operator schema 한정자만 추가.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) replace_document_chunks — vector type을 extensions schema로 정정
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

-- grants는 0006에서 적용된 그대로 유지 (create or replace는 grants 보존).

-- ─────────────────────────────────────────────────────────────────────────
-- 2) match_chunks — vector type + cosine operator를 extensions schema로 정정
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
    (1 - (c.embedding operator(public.<=>) v_query))::float as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (p_include_drafts or d.status = 'published')
    and (1 - (c.embedding operator(public.<=>) v_query)) >= p_min_similarity
  order by c.embedding operator(public.<=>) v_query
  limit p_top_k;
end;
$$;

commit;
