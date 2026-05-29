-- ============================================================
-- 0013_admin_role_and_preview.sql
-- Phase A: admin role 확장 + Preview Mode 토대 (Phase B 의존)
--
-- 변경:
--   1) editor_roles.role check 확장: ('editor', 'admin')
--   2) 위원장 이메일(engccer@gmail.com) → 'admin' seed
--      (이메일이 auth.users에 없으면 silent no-op — 첫 매직링크 로그인 시
--       이 SQL을 dashboard에서 재실행해 부여)
--   3) documents/document_chunks/wiki_backlinks SELECT RLS: admin은 모든 status read
--      Phase A는 read-only 가시성만 사용. Phase B에서 위키 라우트 게이트와 결합.
--
-- 영구 원칙 정합 (2026-05-22 PR #19):
--   - DB write는 여전히 service_role만 (0004 editor write DROP 그대로)
--   - 본 마이그레이션은 SELECT 정책만 추가, write 정책은 무변경
-- ============================================================

-- 1) editor_roles role check 확장
alter table editor_roles drop constraint if exists editor_roles_role_check;
alter table editor_roles add constraint editor_roles_role_check
  check (role in ('editor', 'admin'));

-- 2) 위원장 이메일 admin seed (idempotent)
--    auth.users는 매직링크 첫 로그인 시 row가 생성된다. 이미 존재하면 admin role 부여.
--    없으면 select가 0 row 반환 → silent skip. 첫 로그인 후 dashboard에서 본 SQL을
--    재실행하면 부여 완료.
insert into editor_roles (user_id, role, granted_by)
select id, 'admin', id
from auth.users
where email = 'engccer@gmail.com'
on conflict (user_id) do update
  set role = excluded.role;

-- 3) admin은 모든 status read (anon은 0001의 published 게이트 그대로 적용)
--    정책 OR 결합이라 0001의 anon 정책과 충돌 없음.
create policy "admin read all documents"
  on documents for select
  to authenticated
  using (
    exists (
      select 1 from editor_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "admin read all chunks"
  on document_chunks for select
  to authenticated
  using (
    exists (
      select 1 from editor_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "admin read all backlinks"
  on wiki_backlinks for select
  to authenticated
  using (
    exists (
      select 1 from editor_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );
