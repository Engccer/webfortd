-- ============================================================
-- 0001_init_kb.sql
-- Phase 2 M1: KB(지식베이스) 콘텐츠 인덱스 초기 스키마
-- 정본: content/**/*.md (git). 본 DB는 파생 인덱스.
-- ============================================================

-- 1. Extensions
-- Note: pgvector의 Postgres extension 이름은 'vector' (https://supabase.com/docs/guides/database/extensions/pgvector)
create extension if not exists vector;
create extension if not exists pg_trgm;       -- 한국어 fuzzy 검색

-- ============================================================
-- 2. documents — 페이지 단위 메타데이터 + 본문 캐시
-- ============================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,

  -- Taxonomy (5축)
  type text not null,
  disability_types text[] not null default '{}',
  domains text[] not null default '{}',
  regions text[] not null default '{}',
  year int not null,
  effective_date date,

  -- Source / references (references는 SQL reserved word → references_data)
  source jsonb not null,
  references_data jsonb not null default '[]'::jsonb,

  -- Governance
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'archived', 'deprecated')),
  authors text[] not null default '{}',
  reviewed_by text[] not null default '{}',
  reviewed_at timestamptz,
  reviewer_notes text,

  -- Accessibility
  accessibility jsonb not null default '{
    "alt_text_complete": false,
    "captions_available": false,
    "reading_level": "standard",
    "audio_tts_ready": false
  }'::jsonb,

  -- Content (마크다운 정본의 캐시)
  content_md text not null default '',
  source_path text not null default '',
  wiki_links text[] not null default '{}',
  embedded_media jsonb not null default '[]'::jsonb,
  parent_headings text[] not null default '{}',

  -- 파생 인덱스 추적
  source_origin text,         -- kb-index.generated.json의 source_origin 필드
  axis text not null,          -- 'agreements' | 'disability-types' | ...

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_documents_status              on documents(status);
create index idx_documents_type                on documents(type);
create index idx_documents_year                on documents(year);
create index idx_documents_axis                on documents(axis);
create index idx_documents_disability_types    on documents using gin(disability_types);
create index idx_documents_domains             on documents using gin(domains);
create index idx_documents_regions             on documents using gin(regions);
create index idx_documents_title_trgm          on documents using gin(title gin_trgm_ops);

-- ============================================================
-- 3. document_chunks — 본문 청크 + 벡터 임베딩 (Phase 3 RAG용)
-- ============================================================
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_text text not null,
  chunk_index int not null,
  section text,
  char_start int,
  char_end int,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (document_id, chunk_index)
);

create index idx_chunks_document  on document_chunks(document_id);
create index idx_chunks_embedding on document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- 4. wiki_backlinks — 페이지 간 링크 그래프
-- D1: surrogate PK + 다중 행 허용 (anchor/link_text 보존)
-- ============================================================
create table wiki_backlinks (
  id uuid primary key default gen_random_uuid(),
  source_doc_id uuid not null references documents(id) on delete cascade,
  target_slug text not null,
  anchor text,
  link_text text,
  line int,
  created_at timestamptz default now()
);

create index idx_backlinks_source  on wiki_backlinks(source_doc_id);
create index idx_backlinks_target  on wiki_backlinks(target_slug);
create index idx_backlinks_pair    on wiki_backlinks(source_doc_id, target_slug);

-- ============================================================
-- 5. taxonomy_terms — 분류 항목 reference (시드는 별도)
-- ============================================================
create table taxonomy_terms (
  id text primary key,
  axis text not null
    check (axis in ('disability_types', 'domains', 'regions', 'doc_types')),
  label_ko text not null,
  label_en text,
  description text,
  parent_id text references taxonomy_terms(id),
  display_order int default 0,
  created_at timestamptz default now()
);

create index idx_taxonomy_axis on taxonomy_terms(axis);

-- ============================================================
-- 6. RLS — published만 anon read
-- M4에서 editor_roles 정책 추가 예정
-- ============================================================
alter table documents       enable row level security;
alter table document_chunks enable row level security;
alter table wiki_backlinks  enable row level security;
alter table taxonomy_terms  enable row level security;

create policy "anon read published documents"
  on documents for select
  to anon, authenticated
  using (status = 'published');

create policy "anon read chunks of published documents"
  on document_chunks for select
  to anon, authenticated
  using (exists (
    select 1 from documents d
    where d.id = document_chunks.document_id and d.status = 'published'
  ));

create policy "anon read backlinks of published documents"
  on wiki_backlinks for select
  to anon, authenticated
  using (exists (
    select 1 from documents d
    where d.id = wiki_backlinks.source_doc_id and d.status = 'published'
  ));

create policy "anon read taxonomy"
  on taxonomy_terms for select
  to anon, authenticated
  using (true);

-- ============================================================
-- 7. updated_at 자동 갱신 트리거 (documents 한정)
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();
