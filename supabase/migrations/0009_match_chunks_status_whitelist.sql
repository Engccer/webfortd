-- 0009_match_chunks_status_whitelist.sql
-- Phase 3 M2 critical hotfix — match_chunks가 의도하지 않은 status까지 반환.
--
-- 원인: 0006(+ 0007 hotfix)의 WHERE 절 `(p_include_drafts or d.status = 'published')`는
--   p_include_drafts=true 인 경우 모든 status 통과 — 0001 check constraint가 5개 허용
--   ('draft', 'in_review', 'published', 'archived', 'deprecated') — 따라서 in_review/
--   archived/deprecated 문서도 RAG 결과로 노출됨. 기본값 DEFAULT_INCLUDE_DRAFTS=true라
--   M3 Route Handler 기본 호출에서 즉시 문제 발생.
--
-- 해결: WHERE 절에 status 화이트리스트 명시. p_include_drafts 분기는 draft 추가 여부만 제어.
--   - published 는 항상 포함 (Phase 2 D1: 검수 완료 페이지 anon 노출 정책과 정합)
--   - draft 는 p_include_drafts=true일 때만 포함 (Phase 3 정책)
--   - in_review / archived / deprecated 는 절대 제외 (검수 진행 중 또는 deprecated 라이프사이클)
--
-- 부수: retrieval.ts의 documentStatus 캐스트 `as 'draft' | 'published'`가 이 fix 후에야 참.

begin;

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
  -- 화이트리스트: published 항상 + draft는 p_include_drafts=true일 때만.
  -- in_review / archived / deprecated 는 RAG 검색 결과에서 제외.
  where (d.status = 'published' or (p_include_drafts and d.status = 'draft'))
    and (1 - (c.embedding operator(public.<=>) v_query)) >= p_min_similarity
  order by c.embedding operator(public.<=>) v_query
  limit p_top_k;
end;
$$;

commit;
