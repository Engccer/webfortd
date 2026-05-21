# Phase 2 M1 — Supabase 인프라 + 첫 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** webfortd-prod Supabase 프로젝트에 KB(지식베이스) 콘텐츠 인덱스용 첫 마이그레이션(`documents`·`document_chunks`·`wiki_backlinks`·`taxonomy_terms` + 인덱스 + RLS)을 작성·검증·적용한다.

**Architecture:** Phase 1에서 빌드된 `kb-index.generated.json`(535 atomic 페이지)을 Supabase Postgres에 동기화할 수 있는 *그릇*을 먼저 만든다. 마크다운 파일이 정본(source of truth)이고 DB는 파생 인덱스. M1은 **그릇만 만들고 데이터는 넣지 않는다** — 데이터 sync는 M2의 별도 plan.

**Tech Stack:** Supabase CLI v2.100.1 (brew tap), Postgres 17 + pgvector + pg_trgm, Supabase MCP plugin (`mcp__plugin_supabase_supabase__*` 도구), Vitest (마이그레이션 검증 통합 테스트).

---

## 비개발자용 쉬운 설명 (위원장 보고용)

이 작업이 끝나면 무엇이 달라지나:

1. **Supabase에 KB용 *빈 테이블*이 생긴다.**
   - `documents` — 535개 위키 페이지(인사관리 안내서·조례 비교 등) 메타데이터를 넣을 표
   - `document_chunks` — 챗봇이 검색할 수 있도록 본문을 잘게 쪼개서 *임베딩 숫자 배열*과 함께 저장하는 표
   - `wiki_backlinks` — 페이지 A가 페이지 B를 인용했는지 추적하는 표
   - `taxonomy_terms` — '시각/청각/지체' 같은 분류 항목 표
2. **아직 데이터는 0건.** 마크다운 파일을 DB로 옮기는 작업(M2)은 다음 plan에서 진행.
3. **외부에서 비로그인 사용자가 보면 모든 표가 비어보임** (RLS 정책이 `status='published'`만 노출하는데 데이터가 0건이라).
4. **위원장 입장에서 직접 변하는 건 없음** — 위키 페이지·챗봇 mock UI는 그대로. 단지 *다음 단계로 갈 수 있는 기반*이 깔린다.

왜 데이터를 한 번에 안 넣고 단계로 나누나? → SQL 실수(잘못 설계된 표)는 데이터를 다 넣고 나서 발견하면 되돌리기 어렵다. *빈 표만 먼저 만들어서 구조를 검증*하고, 데이터는 그 다음 단계에서.

---

## File Structure

| 경로 | 책임 | 신규/수정 |
|------|------|-----------|
| `supabase/config.toml` | Supabase CLI 프로젝트 설정 (Postgres 버전, port, auth/storage 토글 등) | 신규 (supabase init 산출물) |
| `supabase/migrations/0001_init_kb.sql` | KB 4개 테이블 + 인덱스 + RLS 정책 + extensions | 신규 |
| `supabase/seed.sql` | (M1 범위 외, 빈 파일로 유지) | 신규 (빈 파일) |
| `tests/migrations/0001_init_kb.test.ts` | 마이그레이션 적용 후 테이블 존재·인덱스 존재·RLS 동작 검증 | 신규 |
| `vitest.config.ts` | 통합 테스트 환경 (Supabase 클라이언트 활용) | 수정 (필요 시) |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가 (이미 있는 ACCESS_TOKEN·DB_PASSWORD는 유지) | 수정 |
| `.env.local.example` | 위 두 변수 placeholder 추가 | 수정 (없으면 신규) |
| `package.json` | `@supabase/supabase-js` devDependency 추가 (테스트용) | 수정 |
| `.gitignore` | `supabase/.temp/`, `supabase/.branches/` (이미 .env*은 차단됨) 확인 | 수정 (필요 시) |

---

## 설계 결정 (M1 시점에 박는 것)

### D1. `wiki_backlinks` PK = surrogate `id uuid`

KB_ARCHITECTURE.md §4의 PK `(source_doc_id, target_slug)`는 codex-rescue가 지적한 *동일 페이지가 같은 대상을 anchor/link_text 달리해 여러 번 링크하면 1행만 남는* 문제가 있다.

**결정:** `id uuid primary key default gen_random_uuid()` + `(source_doc_id, target_slug)` 일반 인덱스. 다중 행 허용 → `kb-index.generated.json`의 `wiki_backlinks: Record<string, Backlink[]>` 배열 구조와 1:1 매핑.

**근거:** `scripts/sync-content.ts:48-68, 317-321`과 `tests/sync-content.test.ts:205-244`가 anchor/link_text 보존 로직과 fixture를 갖추고 있어 미래 데이터에서 anchor/link_text 다중 행이 발생할 수 있다. 현재 corpus(`src/lib/kb-index.generated.json`의 1040 backlinks)에는 anchor/link_text/line이 모두 0건이지만, composite PK는 미래 데이터에서 silent data loss를 일으킬 수 있어 surrogate PK로 박아둠 (forward-compatible).

### D2. 모든 테이블은 `documents.status`로 RLS 게이트

anon(비로그인)은 `documents.status = 'published'` 행만 SELECT 가능. `document_chunks`·`wiki_backlinks`는 부모 `documents`의 status를 join으로 확인. M1 시점에는 데이터 0건이라 노출 0건.

### D3. authenticated 사용자도 M1에는 anon과 동일 권한

`editor_roles` 테이블·검수자 게이트는 M4(검수 자동화)에서 추가. M1은 *기본 RLS만* 깔고, M4에서 editor 정책 확장.

### D4. taxonomy_terms 시드는 M1 범위 외

KB_ARCHITECTURE.md §2의 disability_types/domains/regions/doc_types 시드는 별도 마이그레이션(0002 또는 seed.sql)에서 처리. M1은 빈 표만.

### D5. 임베딩 차원 = 1536 (OpenAI text-embedding-3-small 기준)

KB_ARCH §4 그대로. Gemini로 임베딩 모델 변경 시 마이그레이션 0003에서 컬럼 ALTER + 재임베딩. 변경 비용 작음.

### D6. Vercel Marketplace 통합은 채택하지 않음

Vercel docs는 `vercel integration add supabase` 경로를 권장하지만, 이 경로는 결제·소유권이 Vercel 계정(engccer)에 묶인다. webfortd CLAUDE.md "사업 협상 중 주의사항 §3 — 장교조 명의로 인프라 셋업"에 정면 위배.

**결정:** 이미 2026-05-21 셋업된 khudt 계정 직접 소유 webfortd-prod 그대로 사용. 환경변수(`NEXT_PUBLIC_SUPABASE_URL` 등)는 Vercel CLI 또는 dashboard에서 *수동* 추가. `@supabase/ssr`(M3 auth용) 도입 시점에 동일 원칙 유지.

---

## Task 1: `supabase init` 실행 + scaffold 검증

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/seed.sql`
- Create: `supabase/migrations/` (디렉터리)

- [ ] **Step 1.1: webfortd 디렉터리에서 supabase init 실행**

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
supabase init
```

Expected: `Generated supabase/config.toml` + `supabase/seed.sql` 빈 파일 + `supabase/migrations/` 디렉터리 생성. `Generate VS Code workspace settings? [y/N]` 프롬프트는 `N` 응답 (별도 IDE 설정 불요).

- [ ] **Step 1.2: 스캐폴드 결과 확인**

```bash
ls -la supabase/
cat supabase/config.toml | head -20
```

Expected:
- `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/`, `supabase/.temp/`(기존) 존재.
- `config.toml` 첫 줄 `project_id = "webfortd"` (또는 디렉터리명 기반).

- [ ] **Step 1.3: config.toml의 `project_id`가 디렉터리명과 일치하는지 확인. 다르면 수정**

`supabase/config.toml`에서 `project_id`를 `"webfortd"`로 통일.

- [ ] **Step 1.4: .gitignore에 `supabase/.temp/` 추가 (이미 있으면 skip)**

```bash
grep -q "^supabase/\.temp" .gitignore || echo "supabase/.temp/" >> .gitignore
grep -q "^supabase/\.branches" .gitignore || echo "supabase/.branches/" >> .gitignore
```

- [ ] **Step 1.5: 변경 commit (마이그레이션 전 단계 분리)**

```bash
git add supabase/config.toml supabase/seed.sql .gitignore
git commit -m "feat(supabase): init scaffold for webfortd-prod"
```

Expected: commit 성공. `supabase/.temp/`는 .gitignore로 제외됨.

---

## Task 2: 0001 마이그레이션 SQL 작성

**Files:**
- Create: `supabase/migrations/0001_init_kb.sql`

- [ ] **Step 2.1: 마이그레이션 파일 생성 + 전체 SQL 작성**

`supabase/migrations/0001_init_kb.sql` 파일 내용 전체:

```sql
-- ============================================================
-- 0001_init_kb.sql
-- Phase 2 M1: KB(지식베이스) 콘텐츠 인덱스 초기 스키마
-- 정본: content/**/*.md (git). 본 DB는 파생 인덱스.
-- ============================================================

-- 1. Extensions
-- Note: pgvector의 Postgres extension 이름은 'vector' (Supabase docs 확인)
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
```

- [ ] **Step 2.2: SQL 문법 검증 (로컬 lint, Docker 미가동 시 skip)**

```bash
supabase db lint --schema public 2>&1 | head -30
```

Expected: lint warning이 있어도 OK. fatal error만 fix. (Docker 미가동이면 skip — Task 4의 원격 적용에서 검증).

- [ ] **Step 2.3: 마이그레이션 파일 commit (적용 전 분리)**

```bash
git add supabase/migrations/0001_init_kb.sql
git commit -m "feat(supabase): add 0001_init_kb migration (documents/chunks/backlinks/taxonomy + RLS)"
```

---

## Task 3: 통합 테스트 작성 (적용 전 → 실패 → 적용 후 → 통과)

**Files:**
- Create: `tests/migrations/0001_init_kb.test.ts`

- [ ] **Step 3.1: @supabase/supabase-js 설치 (devDependency)**

```bash
npm install --save-dev @supabase/supabase-js
```

Expected: package.json에 `"@supabase/supabase-js": "^2.x"` 추가 + lockfile 갱신.

- [ ] **Step 3.2: .env.local에 NEXT_PUBLIC_SUPABASE_URL + ANON_KEY 추가**

Supabase MCP 도구로 키 조회:

```
mcp__plugin_supabase_supabase__get_project_url(project_id="djaeeqdxkynjxngwvzyn")
mcp__plugin_supabase_supabase__get_publishable_keys(project_id="djaeeqdxkynjxngwvzyn")
```

`.env.local`에 다음 2줄 추가 (기존 ACCESS_TOKEN·DB_PASSWORD 유지):

```
NEXT_PUBLIC_SUPABASE_URL=https://djaeeqdxkynjxngwvzyn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key 값>
```

`.env.local`은 .gitignore에 이미 등록됨 — commit 안 됨.

- [ ] **Step 3.3: `.env.local.example`에 placeholder 추가**

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

이건 commit됨.

- [ ] **Step 3.4: 테스트 파일 작성 — `tests/migrations/0001_init_kb.test.ts`**

> **Implementation note (2026-05-21):** 본 Task의 실제 구현은 vitest가 아닌 Node 내장 test runner(`node:test`)를 사용. Phase 1의 89-test baseline이 모두 같은 runner라 일관성 유지. 코드 블록 참조 시 `describe`/`test`/`assert.equal`은 vitest API가 아니라 `node:test` + `node:assert/strict` 형식으로 해석.

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

describe('0001_init_kb migration', () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    if (!url || !anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 미설정')
    }
    supabase = createClient(url, anonKey)
  })

  it('documents 테이블이 존재하고 anon select 가능 (published 0건)', async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, slug, status')
      .limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('document_chunks 테이블이 존재하고 anon select 가능', async () => {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id')
      .limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('wiki_backlinks 테이블이 존재하고 anon select 가능', async () => {
    const { data, error } = await supabase
      .from('wiki_backlinks')
      .select('id')
      .limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('taxonomy_terms 테이블이 존재하고 anon select 가능 (RLS true)', async () => {
    const { data, error } = await supabase
      .from('taxonomy_terms')
      .select('id')
      .limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('RLS: anon은 draft documents를 직접 insert 불가', async () => {
    const { error } = await supabase.from('documents').insert({
      slug: 'rls-test-' + Date.now(),
      title: 'RLS test',
      type: '기타',
      year: 2026,
      source: { organization: 'test', citation: 'test' },
      axis: 'uncategorized',
    })
    expect(error).not.toBeNull()
    expect(error?.code).toMatch(/42501|PGRST/) // permission denied or RLS rejection
  })
})
```

- [ ] **Step 3.5: 테스트 실행 → 적용 전이라 *연결은 되지만 테이블 없음* 에러 발생**

```bash
npm run test:run -- tests/migrations/0001_init_kb.test.ts
```

Expected: FAIL — error 메시지에 `relation "public.documents" does not exist` 또는 PGRST 코드. 적용 후 다시 실행 예정.

> 만약 `test:run` 스크립트가 vitest를 호출하지 않으면 `package.json` scripts 확인 후 적절한 명령으로 교체. (현 baseline은 84 tests 그린이라 vitest 셋업 존재 확정)

- [ ] **Step 3.6: 테스트 파일 commit (실패 상태로)**

```bash
git add tests/migrations/0001_init_kb.test.ts package.json package-lock.json .env.local.example
git commit -m "test(migrations): add 0001_init_kb integration test (failing — pre-apply)"
```

---

## Task 4: webfortd-prod 원격 적용

**Files:**
- (DB 변경) `webfortd-prod` (ref `djaeeqdxkynjxngwvzyn`) Postgres

- [ ] **Step 4.1: 사전 link 상태 확인**

```bash
cat supabase/.temp/project-ref
```

Expected: `djaeeqdxkynjxngwvzyn`. (다르면 `supabase link --project-ref djaeeqdxkynjxngwvzyn`)

- [ ] **Step 4.2: dry-run으로 push 대상 변경 확인**

```bash
supabase db push --dry-run
```

Expected: `0001_init_kb.sql`만 push 대상으로 표시. 다른 마이그레이션이 끌려 들어가지 않는지 확인.

- [ ] **Step 4.3: 원격 적용**

```bash
supabase db push
```

Expected: `Applying migration 0001_init_kb.sql... Finished.` 메시지. 에러 시 stop + 분석.

> CLI가 DB_PASSWORD 프롬프트를 요구하면 `.env.local`의 `SUPABASE_DB_PASSWORD`가 direnv로 export됐는지 확인. 못 받으면 `--password "$SUPABASE_DB_PASSWORD"` 명시.

- [ ] **Step 4.4: Supabase MCP로 테이블 존재 검증**

```
mcp__plugin_supabase_supabase__list_tables(
  project_id="djaeeqdxkynjxngwvzyn",
  schemas=["public"]
)
```

Expected: documents, document_chunks, wiki_backlinks, taxonomy_terms 4개 테이블 모두 반환. RLS enabled=true.

- [ ] **Step 4.5: MCP로 extensions 확인**

```
mcp__plugin_supabase_supabase__list_extensions(project_id="djaeeqdxkynjxngwvzyn")
```

Expected: vector(pgvector), pg_trgm 활성. (uuid-ossp는 gen_random_uuid가 pgcrypto에서 제공되므로 별도 불요 — Postgres 14+ 기본 포함)

---

## Task 5: 통합 테스트 재실행 → 통과

- [ ] **Step 5.1: 같은 테스트 다시 실행**

```bash
npm run test:run -- tests/migrations/0001_init_kb.test.ts
```

Expected: 5 PASS. RLS 거부 테스트도 PASS.

- [ ] **Step 5.2: 전체 테스트 회귀 확인 (baseline 84 → 89 또는 그 이상)**

```bash
npm run test:run
```

Expected: ALL PASS. 새 테스트 5개 추가됨.

- [ ] **Step 5.3: 빌드 회귀 확인**

```bash
npm run build
```

Expected: 564개 정적 페이지 생성. 빌드 에러 0.

---

## Task 6: get_advisors 보안 점검

- [ ] **Step 6.1: Supabase MCP get_advisors 호출 (security)**

```
mcp__plugin_supabase_supabase__get_advisors(
  project_id="djaeeqdxkynjxngwvzyn",
  type="security"
)
```

Expected:
- RLS 비활성 테이블 경고 없음 (4개 테이블 모두 enable).
- WARN/ERROR 항목이 있으면 분석 후 plan에 fix step 추가 또는 follow-up 메모.

- [ ] **Step 6.2: get_advisors (performance)**

```
mcp__plugin_supabase_supabase__get_advisors(
  project_id="djaeeqdxkynjxngwvzyn",
  type="performance"
)
```

Expected: 인덱스 누락 경고 0. 있으면 분석 후 0002 마이그레이션 후속 처리 메모.

---

## Task 7: codex-rescue 마일스톤 리뷰

> 글로벌 CLAUDE.md "마일스톤 단위 codex-rescue dispatch" 규칙 준수.

- [ ] **Step 7.1: codex-rescue 서브에이전트 dispatch**

리뷰 포커스를 명시해서 호출:

```
Agent(
  subagent_type="codex:codex-rescue",
  description="Phase 2 M1 마일스톤 리뷰",
  prompt="""
webfortd Phase 2 M1 마일스톤 리뷰. 변경 범위:
- supabase/config.toml, supabase/migrations/0001_init_kb.sql (신규)
- tests/migrations/0001_init_kb.test.ts (신규)
- .env.local.example, package.json (수정)
- webfortd-prod (ref djaeeqdxkynjxngwvzyn) 원격 적용 완료

리뷰 포커스 (cross-cutting invariant 위주):
1. **SQL 마이그레이션 정합성**: KB_ARCHITECTURE.md §4 SQL과의 일치도. 누락 컬럼/인덱스/제약 여부.
2. **RLS 정책 게이트 누수**: anon이 draft documents를 직접 read할 가능성. document_chunks/wiki_backlinks의 부모 status join 정책이 published가 아닌 행을 노출할 가능성.
3. **wiki_backlinks PK 결정(D1)의 정당성**: kb-index.generated.json의 `wiki_backlinks: Record<string, Backlink[]>` 구조와 surrogate PK + 다중 행 허용 매핑이 정합한지.
4. **타입 일관성**: vector(1536) 차원이 Phase 3 임베딩 모델 선택과 정합한지 (text-embedding-3-small 가정).
5. **마이그레이션 적용 후 회귀**: 564개 정적 페이지 빌드·기존 84 tests 그린 유지.
6. **environment 노출**: .env.local.example에 실제 키가 들어가지 않았는지.

CLAUDE.md 행동 규칙: 동일 계층 반복 지적 시 계층 선택 자체 의심. 즉시 지엽 패치 금지.
스타일·관용구 코멘트는 후속 coderabbit에 양보 — 도메인 invariant 위주로 리뷰.
"""
)
```

- [ ] **Step 7.2: codex-rescue 결과 분석 + 처리**

판정별 처리:
- **OK**: Task 8 진행.
- **CONCERN**: 항목별 fix 패치 step 추가 후 재실행 → 다시 codex-rescue 또는 사용자 보고 결정.
- **BLOCK**: 머지 중단. 위원장 보고 후 plan 수정.

---

## Task 8: PR 작성 + 위원장 보고

- [ ] **Step 8.1: 변경 사항 push + PR 생성**

```bash
git push -u origin phase-2-m1-supabase-init
gh pr create --title "Phase 2 M1: Supabase 인프라 + 첫 마이그레이션" --body "$(cat <<'EOF'
## Summary

- `supabase init` 스캐폴드 + `0001_init_kb.sql` (documents/chunks/backlinks/taxonomy + RLS) 작성
- webfortd-prod (ref `djaeeqdxkynjxngwvzyn`) 원격 적용 완료
- 통합 테스트 5건 추가 (89 tests 그린)
- KB_ARCHITECTURE.md §4 SQL 기준. wiki_backlinks PK는 surrogate uuid + 다중 행 허용으로 결정 (D1)

## 다음 단계 (M2)

빌드 인덱스(`kb-index.generated.json`)와 마크다운 정본을 Supabase에 동기화하는 스크립트 (`scripts/sync-content-to-db.ts`). 별도 plan으로 작성 예정.

## Test plan

- [x] `npm run test:run` 89+ tests 그린
- [x] `npm run build` 564 페이지
- [x] `supabase db push` 원격 적용 성공
- [x] `mcp list_tables` 4개 테이블 + RLS enabled 확인
- [x] codex-rescue 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL 반환. 본문은 비개발자(위원장)도 이해 가능하게 작성.

> 브랜치명 `phase-2-m1-supabase-init`은 master에서 분기. M1 시작 시점에 `git checkout -b phase-2-m1-supabase-init` 선행 필요 — Task 1 Step 1.1 직전에.

- [ ] **Step 8.2: 위원장 보고 메시지 작성 (TTS 요약 포함)**

`~/.claude/tts-summary.txt`에 비개발자용 결과 요약 작성:
- 무엇이 끝났는지
- 다음 단계 (M2)
- 위원장 입장에서 직접 변하는 건 없음을 명시

- [ ] **Step 8.3: 메모리 갱신**

`~/.claude/projects/-Users-hunyongkim-Mac-Projects-webfortd/memory/project_phase_status.md`에 M1 완료 + PR 번호 + 적용 시점 추가.

`~/.claude/projects/-Users-hunyongkim-Mac-Projects-webfortd/memory/MEMORY.md`의 Quick Reference에 webfortd-prod 테이블 4개 적용 완료 한 줄 추가.

---

## Branch Strategy

```bash
# Task 1 시작 직전
git checkout master
git pull origin master
git checkout -b phase-2-m1-supabase-init
```

이후 모든 commit은 이 브랜치에. PR 머지 후 master 동기화.

---

## M2 Carry-over 작업 항목 (codex-rescue 결과 반영)

M2 implementation plan 작성 시 다음 항목을 반드시 spec에 포함:

| 항목 | 내용 | 출처 |
|------|------|------|
| `wiki_backlinks.line` 직렬화 결정 | sync-content.ts는 broken link에만 line 저장. valid backlink push 시 line을 함께 저장할지 / DB 컬럼을 future-reserved로 남길지 결정 | codex-rescue concern 2 |
| ivfflat REINDEX | M2 sync 후 535 페이지 × 청크 일괄 upsert + 임베딩 들어가면 `reindex index idx_chunks_embedding` 실행. 또는 hnsw 인덱스로 마이그레이션 평가 | codex-rescue concern 4 |
| RLS 통합 테스트 fixture 확장 | 현재 5건은 빈 테이블 smoke. 실 데이터로 draft/published × documents/chunks/backlinks 4경로 양성/음성 검증 추가 | codex-rescue 후속 |
| `wiki_backlinks` target-side 게이트 검토 | 현재 RLS는 source documents 기준. published 문서가 draft slug 링크 시 target_slug 노출 가능. draft slug 자체가 비밀 invariant라면 target_doc_id FK + target-status join 추가 | codex-rescue 아키텍처 관찰 3 |

---

## 후속 plan 예고 (M2~M5)

M1 완료 후 작성할 별도 plan들:

| 마일스톤 | 범위 | 예상 plan 파일명 |
|---------|------|------------------|
| M2 | 빌드 인덱스 → DB sync 스크립트 (`scripts/sync-content-to-db.ts`) + 535 페이지 일괄 upsert | `2026-05-2x-phase-2-m2-sync-content.md` |
| M3 | Supabase Auth (이메일 매직링크) + `(wiki)` 그룹 *쓰기 액션*에만 게이트 | `2026-05-2x-phase-2-m3-auth-magic-link.md` |
| M4 | draft → published 검수 자동화 스크립트 + 가드 + editor_roles RLS 확장 | `2026-05-2x-phase-2-m4-publish-workflow.md` |
| M5 | (Phase 3 도입부) Phase 3 RAG 챗봇 spec | `2026-05-2x-phase-3-rag-spec.md` |

---

## Self-Review 체크리스트

- [x] 모든 task에 정확한 파일 경로
- [x] 모든 step에 실행 가능한 코드 또는 명령
- [x] TDD 흐름: 테스트 작성 → 실패 확인 → 적용 → 통과 확인
- [x] 빈번한 commit (Task 1·2·3·8에 각 commit 단계)
- [x] codex-rescue가 마지막 단계로 박혀 있음 (글로벌 CLAUDE.md 규칙 준수)
- [x] 비개발자용 설명 섹션 포함 (위원장 요청 반영)
- [x] 후속 plan 예고로 전체 Phase 2 흐름 명시
- [x] 위험 시점에 사용자 확인 step (Task 4 원격 적용 전 dry-run)

## Plan 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-21 | 초기 작성 — Phase 2 M1 (Supabase 인프라 + 첫 마이그레이션) |
