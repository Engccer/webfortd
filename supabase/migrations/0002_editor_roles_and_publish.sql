-- ============================================================
-- 0002_editor_roles_and_publish.sql
-- Phase 2 M4+M5: 편집자 권한 + status 전이 보호
--
-- 정책 모델 (0001 보완):
--   - documents body update → editor_roles 멤버만 (authenticated)
--   - documents.status 전이  → service_role만 (트리거)
--   - editor_roles 자체 SELECT → 본인 행만
--   - editor_roles INSERT/UPDATE/DELETE → service_role만 (정책 미정의 = anon/authenticated 차단)
--
-- M4 시점 editor 멤버 0명. 위원장은 service_role로 작업하고, 향후 정책실/검수단을
-- editor_roles에 추가하면 draft body 편집은 가능하나 status 전이는 여전히 차단.
-- M5 publish 워크플로 스크립트는 service_role로 status='published' 전이를 수행한다.
-- ============================================================

-- ============================================================
-- 1. editor_roles 테이블
-- ============================================================
create table editor_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create index idx_editor_roles_role on editor_roles(role);

alter table editor_roles enable row level security;

-- editor_roles SELECT — 로그인 사용자가 자신의 role 확인 가능
-- (UI에서 편집 버튼 노출 여부 판단용. 다른 사용자의 role은 노출 X)
create policy "editor read own role"
  on editor_roles for select
  to authenticated
  using (user_id = auth.uid());

-- editor_roles INSERT/UPDATE/DELETE — service_role만 (정책 미정의 시 anon/authenticated 차단)

-- ============================================================
-- 2. documents write RLS — editor만 update
-- (status 전이는 트리거가 별도 차단 — 본 정책은 body 편집 게이트)
-- ============================================================
create policy "editor write documents"
  on documents for update
  to authenticated
  using (exists (select 1 from editor_roles where user_id = auth.uid()))
  with check (exists (select 1 from editor_roles where user_id = auth.uid()));

-- ============================================================
-- 3. status 전이 트리거 — service_role 외 차단
--
-- auth.role() semantics:
--   - service_role 키 사용 시 → 'service_role'
--   - anon 키 사용 시           → 'anon'
--   - authenticated session 시  → 'authenticated'
--   - 정의되지 않은 경우         → null (coalesce로 안전 처리)
-- ============================================================
create or replace function guard_documents_status_transition()
returns trigger language plpgsql as $$
begin
  if OLD.status is distinct from NEW.status then
    if coalesce(auth.role(), '') != 'service_role' then
      raise exception 'documents.status 전이는 service_role에서만 허용 (M5 publish 워크플로). 현재 role: %', coalesce(auth.role(), 'null');
    end if;
  end if;
  return NEW;
end;
$$;

create trigger documents_guard_status_transition
  before update on documents
  for each row execute function guard_documents_status_transition();
