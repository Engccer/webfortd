# Phase 3 RAG 챗봇 — 설계 문서

> 작성일: 2026-05-23
> 상태: 위원장 검토 대기 (구현 착수 금지)
> 이전 Phase: Phase 2 전 완료 (master cb8597f, PR #19)
> 짝 문서: docs/DIRECTION_2026.md §4

---

## 1. 개요

### 1.1 Phase 3 범위

Phase 3는 webfortd의 **정책 지식베이스를 대화형 인터페이스로 연결**하는 단계다. 535개 atomic 마크다운 페이지에 임베딩을 부여하고, 사용자 질의에 대해 관련 청크를 검색한 뒤 Gemini 3.5 Flash로 한국어 응답을 생성한다. 응답에는 원문 atomic 페이지 링크가 인용 카드로 첨부된다.

현재 `/chat` 라우트에는 하드코드 mock 응답(ChatMockUI)이 있다. Phase 3는 이를 실제 RAG 파이프라인으로 교체한다.

### 1.2 비전

장애인교원이 "육아휴직 복직 후 편의지원 신청 절차가 어떻게 되나요?"라고 물으면, 챗봇이 관련 정책 페이지 3~5개를 검색해 핵심 내용을 요약하고 원문 링크를 첨부한다. 사용자는 답변을 신뢰하고, 필요 시 원문 페이지로 이동해 전체 내용을 확인할 수 있다.

### 1.3 의존성

| 의존성 | 현재 상태 | Phase 3 요구사항 |
|--------|----------|-----------------|
| `document_chunks` 테이블 | 0001 마이그레이션에서 정의됨, `embedding vector(1536)` 컬럼 있음, 데이터 없음 | 0005 마이그레이션으로 ivfflat 인덱스 재튜닝 + 청크 채우기 |
| `documents` 테이블 | 535 rows (status='draft') | RAG는 status='draft'도 검색 가능해야 함 — 별도 RLS 결정 필요 |
| Supabase Auth | Phase 2 M3 완료 | 비로그인 챗봇 허용(V1), 히스토리 저장 시 로그인 분기 |
| Vercel AI SDK | `package.json`에 미포함 | M3에서 신규 추가 |
| Google Generative AI | `package.json`에 미포함 (`@anthropic-ai/sdk`는 devDependencies에 있음) | M1(임베딩) · M3(응답) 신규 추가 |

### 1.4 전략적 위치 (시범 → 중부대 이관 트랙)

Phase 3 RAG 챗봇은 webfortd의 **핵심 설득 자산**이다. 작년 PHP 사이트와 가장 극명하게 차별화되는 기능이며, 중부대·교육부 회의에서 "AI 기반 정책 안내"를 실연할 수 있는 유일한 요소다. 이관 시 임베딩 데이터(pgvector)와 대화 히스토리(chat_threads/chat_messages)는 Supabase 덤프로 일체 이관 가능하다.

---

## 2. 결정 Snapshot (변경 금지)

아래 7건은 위원장이 2026-05-22 brainstorming에서 확정한 결정이다. 이 설계 문서 내에서 재논의하지 않는다.

| 변수 | 결정 |
|------|------|
| V1: 임베딩 모델 | `gemini-embedding-2` (Google AI), `output_dimensionality=1536`, Matryoshka truncation, Batch API 50% 할인 |
| V2: 응답 모델 | `gemini-3.5-flash` (GA stable, 2026-05), $1.50/$9.00 per 1M tokens, 1M context window |
| V3: AI Gateway | Vercel AI Gateway (Phase 3부터), AI SDK 표준 인터페이스, 옵저버빌리티·비용추적 |
| V4: History — 비로그인 허용 | 비로그인도 챗봇 사용 가능 (V1) |
| V5: History — 저장소 | sessionStorage (탭 닫으면 소멸, reload 유지) |
| V6: History — thread 모델 | 다중 thread (정책별 대화 분리), 90일 자동 삭제(PIPA), 개별 메시지·thread 삭제·export 권한 |
| V7: History — 컨텍스트 | 최근 N턴(5~10) + retrieved chunks, 익명→로그인 전환 시 history 이관 안 함 |
| V8: 출처 인용 | atomic 페이지 링크 필수 (`disability-types/[slug]`, `policies/[slug]` 등) |
| V9: 검색 | pgvector dense embedding only (BM25 hybrid 미도입) |
| V10: 접근성 | `aria-live` 스트리밍 응답 알림, WCAG 2.1 AA |

---

## 3. 데이터 모델

### 3.1 기존 스키마 정합 확인

0001 마이그레이션(`document_chunks`)이 이미 올바른 구조를 갖추고 있다:

```sql
-- 0001_init_kb.sql (기존)
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_text text not null,
  chunk_index int not null,
  section text,
  char_start int,
  char_end int,
  embedding vector(1536),   -- gemini-embedding-2 output_dimensionality=1536과 정합
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);
-- ivfflat 인덱스 (lists=100)도 이미 정의됨
```

`vector(1536)` 치수는 `gemini-embedding-2`의 `output_dimensionality=1536`과 정확히 일치한다. 스키마 변경 없이 임베딩 파이프라인을 그대로 투입할 수 있다.

### 3.2 0005 마이그레이션 후보 — 청크 RAG 인프라 강화

0005는 스키마를 추가하지 않고 **인덱스 최적화와 RLS 정책 명확화**에 집중한다.

```sql
-- 0005_rag_infrastructure.sql (후보)
-- 1. ivfflat → hnsw 평가 (M1 캐리오버: 0001의 ivfflat lists=100은 삽입 후 REINDEX 필요)
--    535 docs × 평균 N청크 = 총 K벡터. K < 10만 이면 hnsw가 recall·속도 모두 우위.
--    결정: M1 실측 후 선택. 이 마이그레이션에서 교체 또는 REINDEX 명령 실행.
drop index if exists idx_chunks_embedding;
-- hnsw 채택 시:
create index idx_chunks_embedding_hnsw on document_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
-- ivfflat 유지 + REINDEX 시 (lists 재조정):
-- reindex index idx_chunks_embedding;

-- 2. document_chunks RLS — draft 문서도 RAG API에서 검색 가능하도록 별도 정책
--    현재 0001의 "anon read chunks of published documents"는 status='published' 게이트.
--    Phase 3 RAG API는 service_role로 호출 → RLS 우회. 그러나 향후 authenticated
--    사용자 직접 pgvector 호출 경로를 열 경우 draft 노출 위험. 명시적 service_role 한정.
--    실용 결정: RAG Route Handler는 항상 service_role 사용 → 현재 RLS 정책 유지.
--    이 마이그레이션에서는 주석으로 결정 기록만 박음.

-- 3. search_path 가드 — 향후 Phase 3에서 추가될 트리거 함수 템플릿
--    (0003 패턴 계승: 새 plpgsql 함수는 반드시 set search_path = '' 포함)
```

**핵심 결정**: 0005는 스키마 추가 없음. `embedding` 컬럼·`chunk_text`·`metadata`는 이미 존재한다. 0005의 주 역할은 (a) hnsw vs ivfflat 결정 실행, (b) 0003 search_path 가드 패턴을 Phase 3 함수에도 강제하는 lint 규칙 박기.

### 3.3 0006 마이그레이션 후보 — chat_threads + chat_messages

다중 thread 모델, RLS, soft delete, 90일 cron.

```sql
-- 0006_chat_history.sql (후보)

-- chat_threads — 대화 세션 단위
create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = 익명(세션 스토리지만)
  title text,                                                  -- 첫 질의에서 자동 생성
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                                       -- soft delete (PIPA 90일)
);

-- chat_messages — 개별 발화
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source_slugs text[] not null default '{}',   -- 인용된 atomic 페이지 slug 목록
  token_usage jsonb,                           -- {input_tokens, output_tokens} (비용 추적)
  created_at timestamptz not null default now(),
  deleted_at timestamptz                       -- soft delete (개별 메시지 삭제 권한)
);

-- 인덱스
create index idx_threads_user_id   on chat_threads(user_id);
create index idx_threads_updated   on chat_threads(updated_at desc) where deleted_at is null;
create index idx_messages_thread   on chat_messages(thread_id, created_at)
  where deleted_at is null;

-- RLS 활성화
alter table chat_threads  enable row level security;
alter table chat_messages enable row level security;

-- chat_threads RLS
-- 본인 thread만 읽기/쓰기/삭제
create policy "user owns thread"
  on chat_threads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- chat_messages RLS
-- 본인 thread의 메시지만 접근
create policy "user owns messages via thread"
  on chat_messages for all
  to authenticated
  using (exists (
    select 1 from chat_threads t
    where t.id = chat_messages.thread_id
      and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from chat_threads t
    where t.id = chat_messages.thread_id
      and t.user_id = auth.uid()
  ));

-- updated_at 트리거 (0003 search_path 가드 패턴 필수 적용)
create or replace function set_chat_thread_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger chat_threads_set_updated_at
  before update on chat_threads
  for each row execute function set_chat_thread_updated_at();

-- 90일 soft delete cron (Supabase pg_cron 사용)
-- 실행 주기: 매일 새벽 3시 (KST = UTC+9, 즉 UTC 18:00)
-- 주의: pg_cron은 Supabase dashboard에서 활성화 필요 (Free Plan 포함)
-- TODO(M5): pg_cron 활성화 확인 후 아래 cron job 등록
-- select cron.schedule(
--   'purge-old-chat-history',
--   '0 18 * * *',
--   $$
--     update chat_threads
--     set deleted_at = now()
--     where deleted_at is null
--       and created_at < now() - interval '90 days';
--   $$
-- );
```

**0006 설계 원칙**:
- `user_id = null`인 thread는 DB에 저장하지 않는다. 비로그인 대화는 sessionStorage에만 존재 — DB에 익명 row를 만들지 않음으로써 PIPA 노출 최소화.
- soft delete(`deleted_at`)는 즉시 삭제가 아닌 스케줄 정리를 위한 표지다. 90일 cron이 해당 row를 실제 DELETE.
- `source_slugs`는 `text[]`로 저장해 응답 생성 시 어떤 문서를 참조했는지 추적 가능하게 한다.
- `token_usage`는 비용 추적 목적. `{input_tokens, output_tokens}` JSONB 구조.
- 0002·0003·0004의 `editor_roles` 테이블과 `chat_threads`·`chat_messages`는 별개 도메인 — 교차 의존 없음.

---

## 4. 아키텍처 다이어그램

### 4.1 전체 RAG 흐름

```
[빌드 타임 파이프라인]

content/**/*.md
    │
    ▼
scripts/embed-content.ts (신규)
    │  마크다운 본문 → 섹션 분할 → 청크 배열
    │  gemini-embedding-2 Batch API (50% 할인)
    │  output_dimensionality=1536
    ▼
Supabase document_chunks
    (chunk_text, embedding vector(1536), metadata)
    (document_id → documents 참조)


[런타임 RAG 흐름]

사용자 질의 입력
    │
    ▼
(wiki)/chat/page.tsx (클라이언트 ChatUI)
    │  POST /api/chat
    ▼
app/api/chat/route.ts (Route Handler, 신규)
    │
    ├─ [1] 질의 임베딩
    │       gemini-embedding-2 (단일 호출)
    │       → query_vector: float32[1536]
    │
    ├─ [2] pgvector 검색 (Supabase service_role)
    │       SELECT id, chunk_text, document_id, metadata,
    │              1 - (embedding <=> query_vector) AS similarity
    │       FROM document_chunks
    │       WHERE status gate via JOIN documents
    │       ORDER BY similarity DESC
    │       LIMIT top-k (결정: §7)
    │       → retrieved_chunks[]
    │
    ├─ [3] 메타데이터 보강
    │       documents.slug, .title, .axis, .type
    │       → source_refs[] (인용 카드용)
    │
    ├─ [4] 프롬프트 조립
    │       시스템 프롬프트 (장교조 정책 전문가 역할, 면책 조항)
    │       + Context Caching (시스템 프롬프트 고정 부분)
    │       + retrieved_chunks 본문 (컨텍스트 주입)
    │       + 최근 N턴 히스토리 (sessionStorage 또는 DB)
    │       + 사용자 질의
    │
    ├─ [5] Vercel AI Gateway → gemini-3.5-flash
    │       streamText (AI SDK)
    │       → token_usage (비용 추적)
    │
    └─ [6] 스트리밍 응답 반환
            StreamingTextResponse + source_refs 헤더/데이터
                │
                ▼
        ChatUI (클라이언트)
            aria-live="polite" 영역에 토큰 append
            응답 완료 후 source_refs → 출처 인용 카드 렌더
            로그인 상태이면 chat_messages INSERT
```

### 4.2 AI Gateway 위치

```
app/api/chat/route.ts
    │
    ├─ createGoogleGenerativeAI() — Vercel AI SDK provider
    │   (AI_GATEWAY_URL 환경변수로 Gateway endpoint 지정)
    │
    └─ streamText({
           model: google('gemini-3.5-flash'),
           messages: [...],
       })
       │
       ▼
   Vercel AI Gateway
       │  옵저버빌리티 (latency, token usage, error rate)
       │  비용 추적 (per-request 기록)
       │  향후: Pro 모델 페일오버 라우팅 (gemini-3.5-flash → gemini-2.0-pro)
       ▼
   Google AI (gemini-3.5-flash)
```

### 4.3 인증 게이트 분기

```
사용자 요청 /chat
    │
    ├─ 비로그인 (V1 허용)
    │       ChatUI 정상 사용
    │       대화 내역 → sessionStorage only
    │       chat_threads/chat_messages INSERT 없음
    │       90일 PIPA 의무 없음 (DB 미저장)
    │
    └─ 로그인 (Supabase Auth, 이메일 매직링크)
            ChatUI 동일 사용
            대화 내역 → DB chat_threads + chat_messages
            thread 목록 사이드바 표시 (선택)
            Export/Delete UI 활성화
```

### 4.4 출처 인용 데이터 흐름

```
RAG retrieval 결과 retrieved_chunks[]
    │
    ▼
각 chunk의 document_id → documents 조인
    │  documents.slug, .title, .axis, .type
    ▼
source_refs = [
  { slug: "2023-hr-p-004", title: "장애인교원의 이해", axis: "disability-types" },
  { slug: "2023-hr-1", title: "1) 장애정도", axis: "policies" },
  ...
]
    │
    ▼ (스트리밍 완료 후 데이터 청크로 전송)
ChatUI
    │
    ▼
출처 인용 카드 렌더:
  <Link href="/{axis}/{slug}">
    📄 {title}
  </Link>
(기존 ChatMockUI의 sources 렌더 패턴 그대로 계승)
    │
    ▼ (로그인 상태)
chat_messages.source_slugs = ["2023-hr-p-004", "2023-hr-1", ...]
INSERT 시 기록
```

---

## 5. 마일스톤 분해

각 마일스톤은 독립 PR로 머지한다. **완료 기준**: (a) codex-rescue 통과, (b) 위원장 명시 신호, (c) 회귀 테스트 그린.

### M1: 청크 분해 + 임베딩 파이프라인

**목표**: 535개 마크다운 문서를 청크로 분해하고 `gemini-embedding-2` Batch API로 임베딩해 `document_chunks`를 채운다.

**신규 파일**:
- `scripts/embed-content.ts` — 메인 파이프라인 스크립트
- `scripts/lib/chunker.ts` — 마크다운 청크 분해 로직 (§6 청크 단위 결정 반영)
- `scripts/lib/gemini-embed.ts` — `gemini-embedding-2` Batch API 래퍼
- `supabase/migrations/0005_rag_infrastructure.sql` — hnsw/ivfflat 결정 실행
- `tests/scripts/embed-content.test.ts` — 청크 분해 단위 테스트

**수정 파일**:
- `package.json` — `kb:embed`, `kb:embed:dry-run` 스크립트 추가
- `package.json` — `@google/generative-ai` 또는 `@ai-sdk/google` 의존성 추가

**캐리오버 (Phase 2 M1 패턴)**:
- `loadDotEnvLocalOverrides()` 공유 (`scripts/lib/env-loader.ts` 재사용)
- `formatSupabaseError()` 공유 (`scripts/lib/error-format.ts` 재사용)
- service_role 사용 (sync 스크립트 패턴 동일)
- dry-run 모드 필수 (`--dry-run` explicit flag, M5 C1 사고 교훈)

**검증**:
- `node:test` 단위 테스트: 청크 분해 결과 shape, 중복 없음, chunk_index 연속성
- 통합 테스트: 10개 샘플 문서 임베딩 → DB insert → 코사인 유사도 조회 왕복
- 전체 실행: 535 docs 임베딩 완료 후 `document_chunks` row 수 검증

**codex-rescue 포커스**: 청크 중복 삽입 가드 / Batch API 할당량 초과 처리 / 0005 마이그레이션 hnsw 파라미터 적정성

---

### M2: pgvector 검색 + Retrieval API + 출처 인용 메타데이터

**목표**: 사용자 질의 → 임베딩 → pgvector cosine 검색 → 출처 메타데이터 보강 흐름을 독립 함수로 구현하고 테스트한다. Route Handler는 M3에서 추가 (AI Gateway 셋업과 묶음).

**신규 파일**:
- `src/lib/rag/retrieval.ts` — `retrieveChunks(queryText: string, topK: number)` 함수
- `src/lib/rag/types.ts` — `RetrievedChunk`, `SourceRef` 타입 정의
- `tests/rag/retrieval.test.ts` — 단위 테스트 (mock embedding, mock Supabase 응답)

**핵심 설계 결정**:
- `retrieval.ts`는 **서버 전용** (`import 'server-only'`) — embedding API key 노출 방지
- `getAdminClient()` 대신 `createClient(url, serviceKey)` 패턴 유지 (스크립트·Route Handler 공용)
- `source_slugs` 중복 제거 (같은 문서의 여러 청크가 검색되면 slug를 한 번만 인용)

**검증**:
- 단위 테스트: topK=5 기준 반환 배열 shape, slug 중복 제거
- smoke: 실제 Supabase에 sample 질의 → 유사도 점수 0.6 이상 청크 반환 확인

**codex-rescue 포커스**: `server-only` 가드 / RLS 우회 범위(service_role) / 출처 slug null 처리

---

### M3: AI Gateway 셋업 + Gemini 3.5 Flash 응답 인프라 + Context Caching

**목표**: Vercel AI Gateway 설정 + `app/api/chat/route.ts` Route Handler + `streamText` 스트리밍 응답. Context Caching으로 시스템 프롬프트 반복 비용 절감.

**신규 파일**:
- `app/api/chat/route.ts` — RAG Route Handler (임베딩 → 검색 → 응답 파이프라인)
- `src/lib/rag/prompt-builder.ts` — 시스템 프롬프트 + 컨텍스트 조립

**수정 파일**:
- `package.json` — `ai` (Vercel AI SDK), `@ai-sdk/google` 추가
- `.env.local` (로컬) / Vercel 환경변수 — `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_GATEWAY_URL`

**핵심 설계 결정**:
- Route Handler는 POST 전용. 요청 본문: `{ query: string, history: Message[], threadId?: string }`
- 스트리밍: `streamText` + `toDataStreamResponse()` (Vercel AI SDK 표준)
- Context Caching: 시스템 프롬프트 고정 부분(정책 전문가 역할 + 면책 조항 + 도메인 설명)을 캐시 eligible 위치에 배치. Gemini API의 explicit cache token 설정(캐시 히트 시 비용 75% 절감).
- source_refs 전달: AI SDK data stream의 커스텀 데이터 청크 (`streamText` `onFinish` 콜백에서 `appendDataPart`로 전송)
- 면책 조항: 시스템 프롬프트에 "본 답변은 참고용이며 법적 효력이 없습니다" 필수 삽입

**검증**:
- 단위 테스트: prompt builder 출력 shape, history 슬라이딩 윈도우(최근 N턴)
- smoke: 실제 Gemini 호출 → 스트리밍 토큰 수신 확인
- Vercel AI Gateway 대시보드: 요청 로그·비용 표시 확인

**codex-rescue 포커스**: API key 노출 경로(서버 전용 가드) / Context Cache 유효 시간 설정 / rate limit 처리

---

### M4: 챗봇 UI — Vercel AI Elements + aria-live + 출처 인용 표시

**목표**: `ChatMockUI`를 실제 RAG 연동 `ChatUI`로 교체. Vercel AI Elements 채팅 컴포넌트 적용. `aria-live` 스트리밍 응답 알림. 출처 인용 카드 렌더.

**수정 파일**:
- `src/app/(wiki)/chat/page.tsx` — `ChatMockUI` → `ChatUI` 교체
- `src/components/chat/ChatUI.tsx` — 신규 (기존 `ChatMockUI.tsx` 대체)
- `src/components/chat/SourceCitationCard.tsx` — 신규 (출처 인용 카드)
- `src/components/chat/ChatMockUI.tsx` — 삭제 (또는 dev 전용 보존)

**핵심 설계 결정**:
- `aria-live="polite"` 영역 유지 (기존 ChatMockUI 패턴 그대로 — 스트리밍 토큰 append 시 스크린리더 낭독)
- 추천 질문(SUGGESTIONS) 클릭 후 `inputRef.current?.focus()` 패턴 유지 (기존 accessibility fix 그대로)
- `useChat` hook (Vercel AI SDK) — `api: '/api/chat'` endpoint 연결
- 출처 인용 카드: 응답 완료 후 `data` 스트림에서 `source_refs` 추출 → `SourceCitationCard` 목록 렌더
- 로딩 상태: 스피너 + aria-busy 속성
- 에러 처리: 네트워크 오류·rate limit → 한국어 에러 메시지 + 재시도 버튼

**검증**:
- E2E smoke: 질의 입력 → 스트리밍 응답 수신 → 출처 카드 표시
- 접근성 smoke: 스크린리더(VoiceOver)로 응답 낭독 확인 (위원장 직접 검증)
- WCAG 2.1 AA: colour contrast ratio, focus indicator 확인

**codex-rescue 포커스**: aria-live 영역 중복 선언 / focus handoff 누락 / SourceCitationCard 링크 미동작

---

### M5: History 인프라 — chat_threads + chat_messages + RLS + 90일 soft delete cron

**목표**: DB 기반 대화 히스토리 저장. 로그인 사용자의 thread 목록 표시. 90일 cron 등록.

**신규 파일**:
- `supabase/migrations/0006_chat_history.sql` (§3.3 내용 실행)
- `src/lib/chat/history.ts` — `saveMessage()`, `getThreadHistory()`, `deleteThread()`, `exportThread()` 함수
- `tests/migrations/0006_chat_history.test.ts` — RLS 통합 테스트

**수정 파일**:
- `src/app/(wiki)/chat/page.tsx` — thread 목록 사이드바 추가 (로그인 상태)
- `app/api/chat/route.ts` — 응답 완료 후 `chat_messages` INSERT 추가

**codex-rescue 포커스**: soft delete + cron 경쟁 조건 / RLS thread 소유권 정합성 / export 데이터에 PII 포함 여부

---

### M6: 비로그인 sessionStorage + 익명/로그인 분기 + Export/Delete UI + PIPA 권한

**목표**: 비로그인 대화 sessionStorage 관리. 로그인 전환 시 이관 안 함(V7) UI 안내. PIPA 의무 이행 UI(삭제·export).

**신규 파일**:
- `src/lib/chat/session-storage.ts` — sessionStorage CRUD (탭 단위 비로그인 히스토리)
- `src/components/chat/HistoryDeleteButton.tsx`
- `src/components/chat/HistoryExportButton.tsx`
- `src/components/chat/AnonymousNotice.tsx` — "로그인하면 대화가 저장됩니다" 배너

**수정 파일**:
- `src/components/chat/ChatUI.tsx` — 비로그인/로그인 분기 로직 통합
- `src/app/(wiki)/chat/page.tsx` — PIPA 동의 안내 문구 추가

**핵심 결정 (V7)**:
익명→로그인 전환 시 sessionStorage 대화를 DB로 이관하지 않는다. 이관 시도는 PIPA의 "수집 목적 외 사용" 경계 문제를 야기한다. UI에서 명확히 안내: "로그인 전 대화는 저장되지 않습니다."

**codex-rescue 포커스**: sessionStorage key 충돌(멀티탭) / export JSON 형식 검증 / 삭제 확인 다이얼로그 접근성

---

## 6. 청크 단위 결정

### 6.1 535개 문서 크기 분포 분석

콘텐츠 샘플 분석 결과:

| 문서 유형 | 대표 예시 | 본문 크기 |
|-----------|----------|----------|
| 단협 조항 | `2020-ca-1.md` | ~50자 (1~2문장) |
| 안내서 개요 | `2023-hr-p-004.md` | ~100자 (목차형) |
| 정책 설명 | `2023-hr-1.md` | ~2,500자 (표·법령 포함) |
| 조례 분석 | 일부 policies | ~3,000자 이상 |

**결론**: 문서 크기 편차가 매우 크다. 단협 조항(50자)을 청크 분해하면 1 doc = 1 chunk. 정책 설명(2,500자)은 2~4 청크로 분해하는 것이 적정.

### 6.2 청크 단위 권장 결정

**결정: 섹션 단위 + 최대 800자 cap**

| 항목 | 결정 | 근거 |
|------|------|------|
| 기본 분할 단위 | H2 섹션 (`##` 헤딩) | 정책 문서의 의미 단위가 섹션과 일치 |
| 최대 청크 크기 | 800자 | gemini-3.5-flash context 비용 절감, 검색 정밀도 유지 |
| 최소 청크 크기 | 50자 | 단협 조항 등 짧은 문서는 전체 본문을 단일 청크로 |
| overlap | 없음 (clean split) | 섹션 경계가 명확해 overlap이 오히려 중복 검색 유발 |
| frontmatter 처리 | chunk에 포함하지 않음, metadata에 slug/title/axis/type 저장 | frontmatter는 메타데이터 — 응답 생성 컨텍스트에 불필요 |
| 백링크(`[[slug]]`) 처리 | 청크 텍스트에 그대로 포함 | RAG 컨텍스트에서 연관 문서 힌트로 활용 가능 |
| `<page_header>` 태그 | 청크 생성 전 strip | 렌더링 아티팩트, 의미 정보 없음 |

**예상 총 청크 수**:
- 단협 49개: ~1 chunk 각 → ~49 chunks
- disability-types ~200개: 평균 1.5 chunks → ~300 chunks
- policies ~300개: 평균 2 chunks → ~600 chunks
- 기타 ~86개: 평균 1.5 chunks → ~129 chunks
- **총 예상: ~1,100~1,500 chunks** (실제는 M1 실행 후 확정)

이 규모에서 hnsw 인덱스 (m=16, ef_construction=64)가 ivfflat lists=100 대비 recall·쿼리 레이턴시 모두 우위다 (pgvector 공식 문서 권장: 10만 벡터 미만은 hnsw).

### 6.3 `document_chunks.metadata` 스키마

```json
{
  "slug": "2023-hr-1",
  "title": "1) 장애정도",
  "axis": "policies",
  "type": "안내서",
  "section": "## 관련 페이지",
  "chunk_index": 2,
  "source_origin": "2023-hr-guide"
}
```

---

## 7. Top-k 검색 결정

### 7.1 Trade-off 분석

| top-k | 장점 | 단점 | 예상 비용 (per query) |
|-------|------|------|-----------------------|
| k=3 | context 토큰 최소, 응답 속도 빠름 | recall 낮음 (단협·정책 중복 질문 커버 미흡) | 입력 ~1,200자 |
| k=5 | recall·비용 균형점 | — | 입력 ~2,000자 |
| k=10 | recall 높음 | context 토큰 증가, 응답 품질 저하 가능 (정보 과부하) | 입력 ~4,000자 |

### 7.2 결정: 기본 k=5, 동적 조정 설계

**기본값 k=5**를 채택한다. 이유:
- gemini-3.5-flash의 1M context window에서 k=5는 전혀 부담이 아니나, 검색 정밀도 관점에서 top-5 청크가 top-10보다 일관되게 더 관련도가 높다 (dense embedding 특성).
- Context Caching이 적용되면 시스템 프롬프트 부분의 반복 비용이 제거되어 retrieved chunks 5개의 비용이 지배적이 됨.

**동적 조정 설계**: 향후 평가 단계에서 k를 쿼리 타입별로 조정하고 싶을 경우를 대비해 `retrieval.ts`의 `topK` 파라미터를 Route Handler에서 주입 가능하게 설계한다. 하드코드 금지.

### 7.3 RAG context 토큰 절감 전략

1. **Context Caching**: 시스템 프롬프트(역할 정의·면책 조항·사용 지침 ~500토큰)를 캐시 eligible 위치에 배치. Gemini 명시적 캐시 사용 시 해당 구간 비용 75% 절감.
2. **chunk_text 전처리**: DB 저장 시 연속 공백·빈 줄 정규화로 토큰 낭비 최소화.
3. **slug 기반 중복 제거**: 같은 document_id의 여러 청크가 top-k에 포함될 경우 상위 1개만 사용해 중복 컨텍스트 제거.
4. **히스토리 컨텍스트 슬라이딩 윈도우**: 최근 5~10턴만 포함. 오래된 대화는 잘라내어 context 폭발 방지.

---

## 8. 비용 시나리오

> framing 원칙 (project_strategic_intent.md): 예산·운영·법적 3축. 시범(장교조 부담)과 본격(중부대 부담) 단계를 분리 명시.

### 8.1 가격 기준 (2026-05-23 기준)

| 항목 | 단가 |
|------|------|
| gemini-embedding-2 Batch API | $0.004 per 1M tokens (standard 대비 50% 할인) |
| gemini-embedding-2 Standard API | $0.008 per 1M tokens |
| gemini-3.5-flash input | $1.50 per 1M tokens |
| gemini-3.5-flash output | $9.00 per 1M tokens |
| gemini-3.5-flash Context Caching (저장) | $0.19 per 1M tokens/hr |
| gemini-3.5-flash Context Caching (히트) | $0.38 per 1M tokens (input 75% 절감) |
| Supabase pgvector | Free Plan 포함 (쿼리 비용 별도 없음) |
| Vercel AI Gateway | 사용량 기반 (Vercel 요금제 포함 또는 별도) |

### 8.2 시범 단계 (장교조 부담, 일 100 질의 기준)

**일회성 빌드 임베딩 비용 (M1 실행 시)**:

- 535 docs × 평균 청크당 600자 ≈ 600자 × 1.5 chunks/doc = 900자/doc
- 총 535 × 900 = 약 48만 자 = 약 15만 tokens (한국어 1자 ≈ 0.3~0.5 tokens 기준)
- Batch API: 15만 tokens × $0.004/1M = **약 $0.0006 (1원 미만)**
- 재임베딩 비용: 모델 교체 시 동일 계산 반복. 현재 모델 유지 기간 동안 0.

**런타임 일일 비용 (일 100 질의, k=5, Context Caching 적용)**:

| 항목 | 계산 | 비용 |
|------|------|------|
| 질의 임베딩 | 100 × 50tokens × $0.008/1M | $0.00004 |
| RAG 검색 | Supabase 포함, 추가 없음 | $0 |
| Context Cache 저장 | 500tokens × 24hrs × $0.19/1M/hr | $0.0023/일 |
| LLM input (cache 히트, 청크만) | 100 × 1,000tokens × $0.38/1M | $0.038 |
| LLM output | 100 × 300tokens × $9.00/1M | $0.27 |
| **일 합계** | | **약 $0.31/일 (약 450원)** |
| **월 합계** | | **약 $9.3/월 (약 13,500원)** |

**시범 단계 총 월 비용**: Supabase Free Plan + Vercel Hobby 포함 + Google AI ~$9.3 = **월 약 1~2만 원** (장교조 자체 부담 가능 수준).

### 8.3 본격 단계 (중부대 부담 후, 일 1,000 질의 기준)

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Google AI (LLM + 임베딩) | 약 $93/월 (약 13만 원) | 일 100 → 1,000 질의 10배 선형 확장 |
| Supabase Pro Plan | $25/월 | pg_cron + 더 큰 DB 용량 |
| Vercel Pro Plan | $20/월 | AI Gateway 포함 + 더 많은 서버리스 실행 |
| **월 합계** | **약 $138/월 (약 20만 원)** | 중부대 인프라 예산 항목 필요 |

**중부대 이관 시 인프라 명의 이전 방법**:
1. Google Cloud Project → 중부대 GCP 조직으로 이전 (API key 재발급)
2. Supabase 프로젝트 → khudt@khudt.net에서 중부대 계정으로 소유권 이전
3. Vercel 프로젝트 → 중부대 팀 계정으로 이전
4. pgvector 임베딩 데이터 → Supabase 프로젝트 통째 이전으로 보존

---

## 9. 접근성 Spec

> "접근성은 협상 불가 원칙" — webfortd CLAUDE.md

### 9.1 aria-live 스트리밍 응답

```tsx
// ChatUI 구현 요구사항
<div
  aria-live="polite"         // "assertive" 아님 — 스트리밍 중 낭독 빈도 조절
  aria-label="대화 내역"
  aria-atomic="false"         // 토큰 단위 append 허용 (atomic=true이면 전체 재낭독)
  role="log"                  // ARIA role="log" — 시계열 발화에 적합
>
  {messages.map(...)}
</div>
```

**기존 `ChatMockUI`의 `aria-live="polite"` 패턴을 그대로 계승**한다. `role="log"` 추가가 유일한 변경점.

### 9.2 Focus 관리

| 이벤트 | Focus 이동 대상 | 근거 |
|--------|----------------|------|
| 추천 질문 클릭 | input 요소 | 기존 ChatMockUI 패턴 (`inputRef.current?.focus()`) — 그대로 유지 |
| 메시지 전송 | 스크롤 위치 유지, focus input 유지 | 연속 입력 플로우 |
| 스트리밍 응답 완료 | focus 이동 없음 (aria-live가 낭독 트리거) | 불필요한 focus 이동 회피 |
| 출처 카드 렌더 | focus 이동 없음 | 카드 렌더는 부가 정보 |
| 에러 발생 | 에러 메시지 영역으로 focus | WCAG 2.4.3 |
| thread 삭제 확인 다이얼로그 | 다이얼로그 첫 번째 focusable 요소 | WCAG 2.4.3 |

### 9.3 키보드 Navigation

| 조작 | 구현 |
|------|------|
| Tab 순서 | 입력 → 전송 버튼 → 출처 카드 링크 목록 순 |
| Enter | 폼 전송 (현재 ChatMockUI 패턴 유지) |
| Escape | 열린 다이얼로그 닫기 (Radix Dialog 기본 처리) |
| Alt+3 | 검색으로 이동 (AccessibilityToolbar 기존 단축키) — 챗봇 페이지에서도 동일 적용 |

### 9.4 AccessibilityToolbar 정합

`(wiki)/layout.tsx`에 `AccessibilityToolbar`가 이미 있다. 챗봇 UI가 추가돼도:
- `fontSize` CSS 변수 변경 → 챗봇 텍스트 크기에 자동 적용 (Tailwind `text-sm` 등 비율 기반이므로)
- `reduceMotion` → 스트리밍 토큰 append 애니메이션 없음 (`framer-motion` 사용 시 `AnimatePresence` 조건 처리)
- `contrast` CSS 변수 → 챗봇 버블 배경색에 적용 (shadcn/ui CSS variable 사용 시 자동)

### 9.5 시각장애 사용자 검증 절차

M4 완료 후 위원장 직접 검증 필수:
1. VoiceOver(macOS) + Safari로 챗봇 페이지 접근
2. 질의 입력 → 전송 → 스트리밍 응답 낭독 확인
3. 출처 카드 링크 Tab 이동 및 활성화 확인
4. 에러 케이스: 네트워크 오류 시 에러 메시지 낭독 확인
5. AccessibilityToolbar 글자크기 200% 적용 후 레이아웃 깨짐 없음 확인

---

## 10. 리스크 및 미해결 변수

### 10.1 기술 리스크

| 리스크 | 심각도 | 대응 전략 |
|--------|--------|----------|
| `gemini-embedding-2` quota/rate limit | 중 | Batch API 사용으로 rate limit 회피. M1 dry-run으로 실행 전 추정량 확인. 초과 시 지수 백오프 재시도. |
| `gemini-3.5-flash` latency 실측 미확인 | 중 | M3 smoke 테스트에서 P50/P99 측정. 3초 초과 시 로딩 상태 UI 필수. |
| Context Caching 효과 | 낮 | 시스템 프롬프트 ~500 tokens는 최소 캐시 단위(32K tokens) 미달 가능성 있음. M3에서 실측 후 적용 여부 결정. 미적용 시 비용 예측값 약 1.5배로 상향 조정. |
| 임베딩 재생성 비용 (모델 교체) | 낮 | `gemini-embedding-2` 교체 시 535 docs 전체 재임베딩 필요. 현재 $0.0006이므로 비용 무관, 시간(Batch API 처리 시간) 주의. |
| hnsw vs ivfflat 결정 지연 | 낮 | M1에서 실측 후 0005에서 결정. 총 청크 수 1,500 미만이면 hnsw 사실상 확정. |

### 10.2 법적 미해결 변수

| 변수 | 현재 상태 | 필요 조치 |
|------|----------|----------|
| AI 응답 면책 조항 UI | 시스템 프롬프트 + 챗봇 하단 고정 문구로 처리 예정 | M4 UI에서 "본 답변은 정보 제공 목적이며 법적 효력이 없습니다" 상시 표시. 위원장 문구 검토 필요. |
| PIPA 개인정보 처리방침 | 현재 webfortd에 없음 | M6 이전(로그인 사용자 chat_messages 저장 시점)에 개인정보 처리방침 페이지 작성 필요. 위원장이 주체. |
| PIPA 수집 목적 동의 | 미구현 | 로그인 첫 사용 시 "대화 내용은 서비스 개선 목적으로 저장됩니다. 90일 후 자동 삭제됩니다" 동의 UI 필요. |
| 국외 이전 고지 (Google Singapore region) | 미처리 | Google AI API는 데이터가 Singapore 데이터센터에서 처리될 수 있음. PIPA 제17조 국외 이전 고지 의무. 처리방침에 명시 필요. |

### 10.3 미해결 설계 변수 (위원장 결정 필요)

1. **시스템 프롬프트 상세 문구**: 역할("장교조 정책 안내 AI"), 응답 스타일(격식체/반말), 질의 범위 제한("장애인교원 관련 질문만 답변") 문구 위원장 확정 필요.
2. **thread title 자동 생성**: 첫 질의를 그대로 사용 vs Gemini 호출로 요약 생성. (후자는 추가 비용)
3. **Context Caching 적용 여부**: M3 실측 후 결정. 최소 캐시 토큰 요건 충족 시 적용.
4. **M5 pg_cron 활성화 절차**: Supabase Free Plan에서 pg_cron 활성화 방법 dashboard에서 확인 필요 (SQL Editor → extensions).
5. **출처 인용 카드 접근성 레이블**: "📄" 이모지를 aria에서 숨기고 별도 sr-only 텍스트 제공 필요 여부.

---

## 11. Phase 4 (소셜 피드) 의존성 영향

### 11.1 chat history 패턴 → feed 패턴 유사성

Phase 3의 `chat_threads`/`chat_messages` RLS 패턴은 Phase 4 `feed_posts`/`feed_comments`의 RLS 설계 템플릿이 된다. 두 도메인 모두:
- `user_id = auth.uid()` 소유권 게이트
- soft delete (`deleted_at`) 패턴
- 0003 search_path 가드 적용 함수
- `updated_at` 트리거 (동일 함수 패턴)

### 11.2 재사용 가능 자산

| Phase 3 자산 | Phase 4 재사용 방법 |
|-------------|-------------------|
| `src/lib/chat/history.ts` 패턴 | `src/lib/feed/posts.ts` 동일 구조 |
| 0006 RLS 정책 템플릿 | 0007 feed RLS에 그대로 적용 |
| `AuthProvider` + `useAuth()` | Phase 4도 동일 hook 사용 (이미 (wiki) layout에 있음) |
| `SourceCitationCard.tsx` | feed post에서 관련 정책 페이지 인용 카드로 재사용 가능 |

### 11.3 Phase 4 진입 시 주의사항

- `editor_roles` 테이블이 Phase 4 피드 모더레이션 권한으로 확장될 예정 (0004 주석에 명시됨). Phase 3 완료 후 `editor_roles.role` CHECK constraint를 `('editor', 'moderator')` 등으로 확장하는 0007 마이그레이션 설계 필요.
- 소셜 피드의 실시간 요구사항(Supabase Realtime) 여부는 Phase 4 spec에서 별도 결정. Phase 3 chat은 실시간 불필요(단방향 스트리밍이면 충분).

---

## 12. 검증 절차

### 12.1 테스트 계층

Phase 1~2 패턴을 그대로 계승한다.

| 계층 | 도구 | 범위 |
|------|------|------|
| 단위 테스트 | `node:test` runner (기존) | chunker, embedding 래퍼 mock, prompt builder, RLS 게이트 단위 |
| 통합 테스트 | `node:test` + 실 Supabase (`test:integration`) | 0005·0006 마이그레이션 왕복, chat_messages RLS 소유권 |
| smoke 테스트 | 수동 + 스크립트 | 실 Gemini API 호출, pgvector similarity 점수, 스트리밍 응답 수신 |
| 접근성 검증 | 위원장 VoiceOver 직접 테스트 | aria-live 낭독, focus 이동, 키보드 navigation |

### 12.2 회귀 게이트

각 마일스톤 PR 전:
- 기존 테스트 전수 그린 (현재 125 unit + 20 integration)
- `next build` 성공 (567 정적 페이지 유지)
- `kb:publish:dry-run` baseline 변동 없음 (535/8/527)

### 12.3 codex-rescue 포커스 (cross-cutting invariant gap 위주)

Phase 3 마일스톤 완료 직전 codex-rescue 재실행 시 다음 영역에 집중:

1. **서버 전용 가드**: `GOOGLE_GENERATIVE_AI_API_KEY`·`SUPABASE_SECRET_KEY`가 클라이언트 번들에 노출되는 경로 없음 확인 (`import 'server-only'` 누락 여부)
2. **RLS 소유권 정합성**: `chat_threads.user_id = auth.uid()` 게이트가 모든 CRUD에서 일관되게 적용되는지
3. **dry-run 플래그 안전성**: `kb:embed` 스크립트의 `--dry-run` 명시 가드 (M5 C1 사고 패턴 재발 방지)
4. **0003 search_path 가드 계승**: 0005·0006에서 신규 정의되는 모든 plpgsql 함수에 `set search_path = ''` 포함 여부
5. **PIPA 수집 최소화**: `chat_messages.content`에 개인식별정보(이름·학교·주민번호 등)가 저장될 경우 처리방침 고지 선행 여부
6. **Context Caching 유효 시간**: 캐시 TTL 만료 후 재비용 발생 경로 처리 여부
7. **출처 slug 유효성**: `source_slugs`에 저장된 slug가 실제 `content/**/*.md`에 존재하는 slug인지 build-time 검증 여부 (broken source link 방지)

### 12.4 마일스톤별 위원장 명시 신호 게이트

| 게이트 | 조건 |
|--------|------|
| M1 착수 | Phase 3 RAG design 검토 완료 + 위원장 명시 승인 |
| M2 착수 | M1 PR 머지 + codex-rescue 통과 |
| M3 착수 | M2 PR 머지 + 위원장 명시 신호 |
| M4 착수 | M3 PR 머지 + AI Gateway 대시보드 연결 확인 |
| M5 착수 | M4 PR 머지 + 위원장 접근성 smoke 검증 완료 |
| M6 착수 | M5 PR 머지 + PIPA 처리방침 페이지 초안 위원장 작성 완료 |

---

## 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-23 | 초기 작성 — Phase 3 brainstorming 7건 결정사항 기반 RAG 챗봇 설계 문서 |
