-- 0005_rag_infrastructure.sql
-- Phase 3 M1 — pgvector 인덱스를 ivfflat → hnsw로 교체.
-- 0001에서 만든 ivfflat lists=100 인덱스는 빈 테이블에 생성되어 recall 저하 가능.
-- 청크 수 1606 (M1 실측, 10,000 미만) → hnsw가 recall·쿼리 레이턴시 모두 우위 (pgvector 권장).

begin;

-- 1. 기존 ivfflat 인덱스 제거
drop index if exists idx_chunks_embedding;

-- 2. hnsw 인덱스 생성 (cosine distance)
--    m=16, ef_construction=64 — pgvector 공식 권장 시작점
create index idx_chunks_embedding_hnsw
  on document_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 3. 결정 기록 — document_chunks RLS는 0001 정책 유지 (Phase 3 RAG Route Handler는
--    service_role로 호출 → RLS 우회. 향후 authenticated 직접 pgvector 호출 경로 열 경우
--    별도 마이그레이션에서 정책 재설계).

commit;
