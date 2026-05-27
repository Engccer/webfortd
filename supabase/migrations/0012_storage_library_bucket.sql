-- Phase 4 M3 PR A — public/library PDF Supabase Storage 마이그레이션
-- 버킷: library (public read, service_role only write)
-- spec: docs/superpowers/specs/2026-05-28-phase-4-m3-cleanup-accessibility-design.md §5 T1 (D7)

-- 1) 버킷 생성 (idempotent)
insert into storage.buckets (id, name, public)
values ('library', 'library', true)
on conflict (id) do update set public = excluded.public;

-- 2) 익명 SELECT (다운로드) 허용
drop policy if exists "library: public read" on storage.objects;
create policy "library: public read"
on storage.objects for select
to public
using (bucket_id = 'library');

-- 3) anon/authenticated INSERT 명시 차단
drop policy if exists "library: anon insert blocked" on storage.objects;
create policy "library: anon insert blocked"
on storage.objects for insert
to anon, authenticated
with check (bucket_id != 'library');

-- 4) anon/authenticated UPDATE 명시 차단
drop policy if exists "library: anon update blocked" on storage.objects;
create policy "library: anon update blocked"
on storage.objects for update
to anon, authenticated
using (bucket_id != 'library');

-- 5) anon/authenticated DELETE 명시 차단
drop policy if exists "library: anon delete blocked" on storage.objects;
create policy "library: anon delete blocked"
on storage.objects for delete
to anon, authenticated
using (bucket_id != 'library');

-- service_role은 RLS bypass — 별도 정책 불요
