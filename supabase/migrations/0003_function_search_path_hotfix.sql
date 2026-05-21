-- ============================================================
-- 0003_function_search_path_hotfix.sql
-- Phase 2 Cleanup: 트리거 함수 2건에 search_path = '' 가드 추가
--
-- 배경: 0001 set_updated_at + 0002 guard_documents_status_transition 두 함수가
-- search_path를 명시하지 않아 function hijacking 잠재 위협 (supabase advisor 표준 경고).
-- 공격자가 같은 이름의 함수를 사용자 schema에 만들고 search_path를 조작하면
-- 트리거가 변조 가능. SET search_path = ''로 빈 path를 명시해 모든 호출을 fully qualified 강제.
--
-- runtime 영향: 0.
--   - auth.role() — schema prefix 'auth'가 박혀 있어 search_path 무관.
--   - now() — pg_catalog에 정의된 built-in, search_path 무관.
--   - raise exception — SQL 키워드, search_path 무관.
--
-- 마이그레이션 패턴: CREATE OR REPLACE FUNCTION (idempotent). 트리거 자체는 reference만
-- 보유하므로 재생성 불요.
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function guard_documents_status_transition()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if OLD.status is distinct from NEW.status then
    if coalesce(auth.role(), '') != 'service_role' then
      raise exception 'documents.status 전이는 service_role에서만 허용 (M5 publish 워크플로). 현재 role: %', coalesce(auth.role(), 'null');
    end if;
  end if;
  return NEW;
end;
$$;
