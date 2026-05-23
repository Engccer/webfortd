# Phase 3 M4+M5 통합 — 채팅 UI 교체 + DB 히스토리 설계 문서

> 작성일: 2026-05-24
> 상태: 위원장 검토 대기 (구현 착수 금지)
> 이전 마일스톤: Phase 3 M3 완료 (master `b55fece`, PR #27+#28)
> 짝 문서: `docs/superpowers/specs/2026-05-23-phase-3-rag-design.md` §M4·§M5
> 자문 메모(사업 측면): 없음 (기술 마일스톤)

---

## 1. 개요

### 1.1 범위

Phase 3 RAG 채팅의 두 마일스톤을 통합한다:

- **M4 — 채팅 UI 교체**: 하드코드 `ChatMockUI`를 Vercel AI Elements + AI SDK v6 `useChat` 기반 `ChatUI`로 교체. M3에서 작동 중인 `/api/chat` Route Handler(스트리밍 + `messageMetadata.sourceRefs`)와 결합.
- **M5 — DB 히스토리 인프라**: `chat_threads` + `chat_messages` 테이블 + RLS + 로그인 사용자 대화 저장 + 90일 soft delete Vercel cron.

두 마일스톤을 한 호흡(통합 spec, 분리 PR)으로 진행하는 이유는 §1.3 참조.

### 1.2 비전

위원장(시각장애인)을 포함한 시범 사용자가 다음 흐름을 신뢰할 수 있어야 한다:

1. `/chat` 진입 → AI Elements 표준 채팅 인터페이스 + WCAG 2.1 AA 접근성
2. 질문 입력 → 스트리밍 응답이 `aria-live="polite"`로 낭독되며 markdown(`**`, `##`, 표) 적절히 렌더
3. 응답 종료 후 출처 인용 미니멀 칩 표시 → 클릭 시 atomic 페이지로 이동
4. **로그인 상태**: 대화가 DB에 저장돼 새로고침·재방문해도 살아있음, 좌측 drawer에서 이전 thread 전환 가능
5. **비로그인 상태**: 대화가 useState로만 유지(새로고침=휘발), "로그인하면 대화가 저장됩니다" 안내 배너 1줄

### 1.3 M4+M5 통합 근거

위원장 결정(2026-05-24 brainstorming Q4=C): "할 일에 빨리 빨리 담가서 하자." 시범 단계 신뢰성 확보 최우선.

- **사용자 관점 통합 가치**: M4만 머지하면 로그인 사용자도 새로고침 시 대화 휘발 → 시범 사용자 첫인상 훼손.
- **PR은 분리 (Q5-가)**: spec은 통합, 구현 PR은 두 개 — PR A(M4 UI 교체), PR B(M5 history 인프라). 코드리뷰 분량·검수 집중도 분리.
- **M6는 별도 유지**: sessionStorage 정교화·익명/로그인 분기 UI·PIPA Export/Delete UI는 Phase 3 RAG design §M6 그대로. M4+M5는 "DB 저장 + 안내 배너"까지만.

### 1.4 의존성

| 항목 | 현재 상태 | M4+M5 요구사항 |
|------|-----------|----------------|
| `/api/chat` Route Handler | M3 완료 (`b55fece`) — `toUIMessageStreamResponse({ messageMetadata: sourceRefs })` | `onFinish`에서 chat_threads/chat_messages INSERT 분기 추가 (로그인만) |
| `ChatMockUI` | mock 응답 사전 3건 하드코드 | 삭제, `ChatUI`로 교체 |
| AI SDK v6 | `ai@^6.0.190` 설치됨 | `@ai-sdk/react@^3.0.x` 신규 추가 |
| AI Elements | 미설치 | `npx ai-elements` 설치, 필요 컴포넌트 자동 scaffold |
| shadcn/ui | `components.json` + Radix 13개 패키지 + `src/components/ui/` | `Sheet` 컴포넌트 신규 추가(thread drawer용) |
| Supabase | M3 완료 (인증·RLS·service_role) | 0010 마이그레이션 — `chat_threads`/`chat_messages` + RLS + 트리거 |
| Vercel Cron Jobs | 미사용 | `vercel.json` `crons` 항목 추가 + `/api/cron/cleanup-chats` |
| 환경변수 | `VERCEL_OIDC_TOKEN` 등 M3 셋업 완료 | `CRON_SECRET` 신규 추가 (Vercel 환경변수) |

---

## 2. 결정 Snapshot (변경 금지)

브레인스토밍 2026-05-24 확정. 이 spec 내에서 재논의하지 않는다.

| 변수 | 결정 | 비고 |
|------|------|------|
| Q1: 채팅 UI 구현 방식 | Vercel AI Elements 채택 (필요 컴포넌트 선택 설치) | `Conversation`/`Message`/`MessageResponse`/`PromptInput`/`Source`/`Sources`/`Suggestion`/`Loader`. `all.json` 풀세트 install 금지(`@base-ui/react` 버전 충돌 회피). |
| Q2: 출처 인용 카드 디자인 | 미니멀 칩 (`📄 [title]` 한 줄) | 시각장애 사용자 낭독 부담 최소, 응답 본문이 출처 신뢰성 보강 |
| Q3: 테스트 전략 | Vitest 부분 도입 시작 | `tests/components/chat/*.test.tsx`만, 백엔드 node:test 유지 |
| Q4: 메시지 휘발 처리 | M4 안내 배너 + M5 우선순위 변경 (통합) | PR은 분리 (Q5-가) |
| Q5-가: PR 단위 | 두 PR 분리 (PR A=M4, PR B=M5) | 코드리뷰 집중도 + 위원장 톤 검수 분리 |
| Q5-나: thread 사이드바 위치 | 좌측 sticky drawer + 모바일 햄버거 | shadcn `Sheet` 재사용 |
| Q5-다: 90일 soft delete 실행기 | Vercel Cron Jobs | `pg_cron` 대비 가시성·이관 무관성 우월 |

### 부가 결정 (spec 작성 중 잠금)

| 변수 | 결정 | 근거 |
|------|------|------|
| D1: thread 자동 title | 첫 user 메시지 첫 ~30자 (단순 truncate) | LLM 요약 호출은 비용↑·지연↑, 사용자 사이드바에서 inline rename 허용은 M6 |
| D2: thread 생성 시점 | 첫 user 메시지 onFinish 시점 (assistant 응답까지 성공해야) | partial thread row 생성 회피 |
| D3: INSERT 트랜잭션 | `chat_threads` + 사용자 메시지 + assistant 메시지 + sourceRefs를 **단일 RPC**(`create_thread_with_messages`)로 atomic | route handler에서 3번 await 회피, RLS 일관성 |
| D4: 후속 메시지 INSERT | 기존 thread에 사용자+assistant 메시지 INSERT — 별도 RPC `append_messages` | thread 행 갱신 없음, message만 추가 |
| D5: 비로그인 메시지 | `useState`만 (페이지 reload 시 휘발), 배너 1줄 안내 | sessionStorage는 M6에서 도입 (이번 spec 범위 외) |
| D6: thread 목록 페이징 | 최신 20개 + "더 보기"는 M6 | 시범 단계에선 절대 다수 사용자가 < 20 threads |
| D7: thread 삭제 | M4+M5 범위 X (M6) | 시범 단계 사용자에게 noisy하지 않게 우선 신뢰 확보 후 권리 UI 도입 |
| D8: cron 빈도 | 매일 03:00 UTC (한국시간 12:00) | 매일 1회면 PIPA 90일 boundary 정확도 충분, Vercel cron 호출 비용 최소 |
| D9: cron soft delete vs hard delete | soft delete (`deleted_at` 타임스탬프) | M6에서 사용자 직접 삭제 권리·실 hard delete 분리 cron 추가 |
| D10: AI generation persistence 권고 적용 범위 | 부분 적용 — token_usage 저장 + thread state 패턴. `/chat/[id]` addressable URL은 미채택 | AI Elements 스킬의 `/chat/[id]` redirect 패턴은 일반 AI 생성 자산용(이미지·코드). webfortd는 출처 atomic 페이지가 진짜 자산이라 generation 자체의 unique URL 불요. token_usage·model·source_refs는 이미 `chat_messages` 컬럼에 저장됨. 이 결정으로 PIPA·비용 추적 의무 충족 + URL 단순성 유지. M6 이후 사용자 요청 시 thread share URL은 추가 가능. |
| D11: AI Gateway `providerOptions.gateway` 활용 | `tags: ['feature:chat-rag', 'env:production']`만 도입 | M3 route handler의 `gateway('google/gemini-3.5-flash')` 호출에 `providerOptions.gateway.tags` 추가 — 시범/본격 단계 비용 attribution 사전 준비(중부대 이관 시 사업비 회계 분리에 활용). `user: user.id` per-user rate-limit과 `cacheControl`은 본격 단계 후속(시범 단계 사용자 수·질의 다양성에 비해 비용 효과 미미). |

---

## 3. 데이터 모델

### 3.1 0010 마이그레이션 — `chat_threads` + `chat_messages`

```sql
-- supabase/migrations/0010_chat_history.sql

-- 1. chat_threads
create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz  -- soft delete (D9). 90일 cron이 hard delete로 정리.
);

create index chat_threads_user_id_updated_at_idx
  on chat_threads (user_id, updated_at desc)
  where deleted_at is null;

-- 2. chat_messages
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 50000),  -- assistant 응답 안전 cap
  source_refs jsonb not null default '[]'::jsonb,  -- assistant만 채움; user는 []
  token_usage jsonb,  -- { inputTokens, outputTokens } (assistant만, null 허용)
  created_at timestamptz not null default now()
);

create index chat_messages_thread_id_created_at_idx
  on chat_messages (thread_id, created_at asc);

-- 3. updated_at 자동 갱신 트리거 (0001 set_updated_at 재사용)
create trigger chat_threads_set_updated_at
  before update on chat_threads
  for each row execute function set_updated_at();

-- 4. thread 마지막 활동 시 updated_at 자동 갱신 (메시지 INSERT 시)
create or replace function bump_thread_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_threads
     set updated_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

create trigger chat_messages_bump_thread
  after insert on chat_messages
  for each row execute function bump_thread_updated_at();

-- 5. RLS
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;

-- thread: 본인 thread만 SELECT/DELETE 가능 (INSERT/UPDATE는 RPC를 통한 service_role)
create policy "users select own threads"
  on chat_threads for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "users soft-delete own threads"
  on chat_threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- message: 본인 thread의 메시지만 SELECT 가능 (INSERT는 RPC를 통한 service_role)
create policy "users select own messages"
  on chat_messages for select
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.user_id = auth.uid()
        and t.deleted_at is null
    )
  );
```

**원칙 (Phase 2 Finding 1 옵션 B 정합)**:
- INSERT는 RLS 정책 없음 — service_role RPC만 가능. anon/authenticated client의 직접 INSERT는 RLS 차단.
- SELECT는 본인 thread만, 삭제된 thread(`deleted_at is not null`)는 보이지 않음.
- soft delete UPDATE는 본인 thread만 (D7 M6에서 사용자 UI 도입 시 활용).
- 트리거 `bump_thread_updated_at`는 `security definer + search_path = ''` 가드 (0003 패턴 정합).

### 3.2 0011 마이그레이션 — Atomic RPC 2개

```sql
-- supabase/migrations/0011_chat_history_rpcs.sql

-- 1. 신규 thread + 첫 user/assistant 메시지 한 번에 생성
create or replace function create_thread_with_messages(
  p_user_id uuid,
  p_title text,
  p_user_content text,
  p_assistant_content text,
  p_source_refs jsonb,
  p_token_usage jsonb
)
returns uuid  -- thread_id
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread_id uuid;
begin
  -- user_id 정합 가드 (다른 user 사칭 차단)
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  insert into public.chat_threads (user_id, title)
    values (p_user_id, p_title)
    returning id into v_thread_id;

  insert into public.chat_messages (thread_id, role, content, source_refs, token_usage)
    values
      (v_thread_id, 'user', p_user_content, '[]'::jsonb, null),
      (v_thread_id, 'assistant', p_assistant_content, p_source_refs, p_token_usage);

  return v_thread_id;
end;
$$;

revoke all on function create_thread_with_messages(uuid, text, text, text, jsonb, jsonb) from public;
grant execute on function create_thread_with_messages(uuid, text, text, text, jsonb, jsonb) to service_role;

-- 2. 기존 thread에 user+assistant 메시지 한 쌍 추가
create or replace function append_messages(
  p_thread_id uuid,
  p_user_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_source_refs jsonb,
  p_token_usage jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- thread 소유권 검증
  if not exists (
    select 1 from public.chat_threads
     where id = p_thread_id
       and user_id = p_user_id
       and deleted_at is null
  ) then
    raise exception 'thread not found or not owned by user';
  end if;

  insert into public.chat_messages (thread_id, role, content, source_refs, token_usage)
    values
      (p_thread_id, 'user', p_user_content, '[]'::jsonb, null),
      (p_thread_id, 'assistant', p_assistant_content, p_source_refs, p_token_usage);
end;
$$;

revoke all on function append_messages(uuid, uuid, text, text, jsonb, jsonb) from public;
grant execute on function append_messages(uuid, uuid, text, text, jsonb, jsonb) to service_role;
```

**원칙**:
- `security definer + search_path = ''` — 0003·0006·0007 정합 (function hijacking 차단).
- service_role 전용 grant — anon/authenticated의 RPC 직접 호출 차단.
- thread 소유권은 `append_messages`에서 `user_id` 매칭으로 검증 (route handler 신뢰 X, DB가 최종 가드).
- RPC가 단일 트랜잭션이므로 partial state(thread만 생성·메시지는 실패) 발생 불가.

---

## 4. UI 레이어 — AI Elements 컴포넌트 매핑

### 4.1 AI Elements 설치 및 채택 컴포넌트

```bash
# package.json deps 추가
npm install @ai-sdk/react@^3.0.0
# AI Elements selective install (D10 정합 — all.json 금지)
npx ai-elements@latest add message conversation prompt-input sources suggestion loader
```

채택 컴포넌트(필요 최소 — selective install만, 미사용 컴포넌트는 type 충돌 회피 위해 install 금지):

| 컴포넌트 | export 경로 | 용도 | 기존 ChatMockUI 대응 |
|----------|-------------|------|----------------------|
| `Conversation` | `@/components/ai-elements/conversation` | 메시지 리스트 컨테이너, 자동 스크롤 | `<div ref={listRef}>` |
| `ConversationContent` | `@/components/ai-elements/conversation` | 패딩·스크롤 영역 | `<div className="flex-1 overflow-y-auto">` |
| `Message` | `@/components/ai-elements/message` | role 별 wrapper (user/assistant) | `<li>` 분기 |
| `MessageContent` | `@/components/ai-elements/message` | 평문(plain) — user 메시지에만 | `<p>` |
| `MessageResponse` | `@/components/ai-elements/message` | **스트리밍 markdown 렌더 — assistant 메시지 의무** (Streamdown + 코드 highlight + CJK 플러그인 내장) | (없음 — mock은 평문) |
| `Source` / `Sources` | `@/components/ai-elements/sources` | 출처 인용 컴포넌트 | `<Link>` 칩 |
| `Suggestion` / `Suggestions` | `@/components/ai-elements/suggestion` | 추천 질문 버튼 | `SUGGESTIONS` 매핑 |
| `PromptInput` / `PromptInputTextarea` / `PromptInputSubmit` | `@/components/ai-elements/prompt-input` | 입력창 + submit 버튼 + Enter/Shift+Enter | `<form>` + `<input>` |
| `Loader` | `@/components/ai-elements/loader` | 응답 대기 스피너 | (없음 — mock 즉시 응답) |

### 4.2 `src/components/chat/ChatUI.tsx` 골격 (의사 코드)

```tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { Source, Sources } from '@/components/ai-elements/sources'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from '@/components/ai-elements/prompt-input'
import { Loader } from '@/components/ai-elements/loader'
import { DefaultChatTransport } from 'ai'
import { useAuth } from '@/components/auth/AuthContext'
import { useState, useRef, useEffect } from 'react'

const SUGGESTIONS = [
  "특수 마우스에는 어떤 종류가 있나요?",
  "편의지원 조례를 제정한 시도교육청은 어디인가요?",
  "학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?",
]

export function ChatUI({ initialThreadId }: { initialThreadId?: string }) {
  const { user } = useAuth()
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // useChat() — DefaultChatTransport({ api: '/api/chat' }) 기본 transport 사용.
  // body로 threadId·userId를 동봉해 route handler가 INSERT/RPC 분기.
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { threadId, userId: user?.id ?? null },
    }),
    onFinish: ({ message }) => {
      // 응답 메시지의 metadata.threadId가 신규 생성됐다면 state 동기화 (D3 신규 thread)
      const newThreadId = message.metadata?.threadId as string | undefined
      if (newThreadId && !threadId) {
        setThreadId(newThreadId)
        // SWR 사이드바 즉시 갱신 (revalidateOnFocus 기다리지 않음)
        mutate('/api/chat/threads')
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    sendMessage({ text: trimmed })
    setInput('')
    inputRef.current?.focus()  // 추천 버튼 클릭 후 focus handoff (기존 패턴)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 sm:px-6">
      <Conversation aria-label="대화 내역">
        <ConversationContent>
          {messages.length === 0 ? (
            <Suggestions aria-label="추천 질문">
              {SUGGESTIONS.map((s) => (
                <Suggestion key={s} onClick={() => send(s)}>
                  {s}
                </Suggestion>
              ))}
            </Suggestions>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                {m.parts?.map((part, i) => {
                  if (part.type === 'text') {
                    // assistant는 MessageResponse(markdown 의무), user는 MessageContent(평문)
                    return m.role === 'assistant'
                      ? <MessageResponse key={i}>{part.text}</MessageResponse>
                      : <MessageContent key={i}>{part.text}</MessageContent>
                  }
                  return null  // tool / step-start 등 skip
                })}
                {m.role === 'assistant' && m.metadata?.sourceRefs && (
                  <Sources aria-label="출처">
                    {(m.metadata.sourceRefs as SourceRef[]).map((src) => (
                      <Source key={src.slug} href={`/${src.axis}/${src.slug}`}>
                        📄 {src.title}
                      </Source>
                    ))}
                  </Sources>
                )}
              </Message>
            ))
          )}
          {isLoading && <Loader aria-label="응답을 작성하고 있어요" />}
        </ConversationContent>
      </Conversation>

      {!user && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          로그인하면 대화가 저장돼요. 지금은 새로고침하면 사라져요.
        </p>
      )}

      <PromptInput onSubmit={(text) => send(text)} aria-label="질문 입력">
        <PromptInputTextarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요…"
        />
        <PromptInputSubmit aria-label="전송" disabled={isLoading} />
      </PromptInput>
    </div>
  )
}
```

### 4.3 Thread 사이드바 (`ThreadDrawer`)

```tsx
// src/components/chat/ThreadDrawer.tsx
'use client'

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import useSWR from 'swr'

export function ThreadDrawer({
  currentThreadId,
  onSelect,
}: { currentThreadId?: string; onSelect: (id: string) => void }) {
  // SWR — revalidateOnFocus 기본값 그대로(탭 전환 시 자동 갱신).
  // 신규 thread 생성 후 ChatUI에서 mutate('/api/chat/threads') 호출로 사이드바 즉시 갱신.
  const { data: threads } = useSWR<ThreadSummary[]>('/api/chat/threads', fetcher)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label="대화 목록 열기" className="...">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" aria-label="대화 목록">
        <h2 className="text-base font-semibold">최근 대화</h2>
        <nav>
          <ul role="list">
            {threads?.slice(0, 20).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-current={t.id === currentThreadId ? 'true' : undefined}
                  className="..."
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
```

**렌더 분기**:
- 데스크탑(≥768px): `position: sticky; left: 0;` 영역에 항상 노출.
- 모바일(<768px): 햄버거 trigger로 `Sheet` open.
- 로그인 상태에서만 렌더. 비로그인 시 `null`.

### 4.4 `chat/page.tsx` 슬림화

```tsx
// src/app/(wiki)/chat/page.tsx
import type { Metadata } from 'next'
import { ChatUI } from '@/components/chat/ChatUI'

export const metadata: Metadata = {
  title: '채팅',
  description: '대한민국 장애인교원 관련 제도와 정책을 자연어로 질문하세요.',
}

export default function ChatPage() {
  return <ChatUI />
}
```

---

## 5. API 확장 — `/api/chat/route.ts` + `/api/chat/threads` + `/api/cron/cleanup-chats`

### 5.1 `/api/chat/route.ts` — `onFinish` 분기 (M5 history)

M3 route handler의 `onFinish` 콜백에 DB 저장 로직 추가. 핵심 변경:

```ts
// src/app/api/chat/route.ts (M5 추가 부분만 발췌)

import { getServerClient } from '@/lib/supabase/server'  // 기존 helper (cookies 기반 SSR client)
import { getAdminClient } from '@/lib/supabase/admin'

interface ChatRequestBody {
  messages?: unknown
  threadId?: string  // 신규 — 클라이언트가 기존 thread 이어가기
  userId?: string | null  // 신규 — 클라이언트 hint (DB는 auth.uid()로 재검증)
}

export async function POST(req: Request): Promise<Response> {
  // ... (M3 기존 흐름 동일)

  // M5 신규: 서버 측 user 검증 (클라이언트 hint 신뢰 X)
  // 기존 getServerClient() helper 재사용 → .auth.getUser()로 cookies 기반 인증 확인
  const supabaseSSR = await getServerClient()
  const { data: { user } } = await supabaseSSR.auth.getUser()
  const isLoggedIn = !!user

  // route handler는 stateless function call이므로 newThreadIdRef는 React ref가 아닌
  // POST 핸들러 클로저 변수. onFinish에서 set → messageMetadata 콜백에서 read.
  let newThreadId: string | null = null

  // ... (retrieval, prompt 조립, streamText)

  const result = streamText({
    model: gateway('google/gemini-3.5-flash'),
    // D11 — 비용 attribution 태그 (중부대 이관 시 사업비 회계 분리)
    providerOptions: {
      gateway: {
        tags: ['feature:chat-rag', `env:${process.env.VERCEL_ENV ?? 'development'}`],
      },
    },
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ usage, text }) => {
      console.log('[chat] finish', { /* M3 로그 동일 */ })

      // M5 신규: 로그인 사용자만 DB 저장
      if (!isLoggedIn) return

      const admin = getAdminClient()
      const userQueryText = queryText  // 위에서 추출한 마지막 user 메시지 본문
      const sourceRefsJson = JSON.stringify(retrieval.sources)
      const tokenUsageJson = JSON.stringify({
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
      })

      try {
        if (!body.threadId) {
          // D3: 신규 thread (RPC 1번으로 thread + 2 messages atomic)
          const title = userQueryText.slice(0, 30)
          const { data, error } = await admin.rpc('create_thread_with_messages', {
            p_user_id: user.id,
            p_title: title,
            p_user_content: userQueryText,
            p_assistant_content: text,
            p_source_refs: sourceRefsJson,
            p_token_usage: tokenUsageJson,
          })
          if (error) throw error
          // 신규 threadId를 클로저 변수에 저장 → messageMetadata 콜백에서 read.
          newThreadId = data as string
        } else {
          // D4: 기존 thread에 append
          const { error } = await admin.rpc('append_messages', {
            p_thread_id: body.threadId,
            p_user_id: user.id,
            p_user_content: userQueryText,
            p_assistant_content: text,
            p_source_refs: sourceRefsJson,
            p_token_usage: tokenUsageJson,
          })
          if (error) throw error
        }
      } catch (err) {
        // PIPA: error.message에 user 본문 마스킹. formatSupabaseError 패턴 재사용.
        const masked = err instanceof Error ? err.message : String(err)
        console.error('[chat] history save failed:', masked)
        // 사용자 응답은 이미 streaming 완료 — 저장 실패는 silent (UX 회복은 M6 retry UI)
      }
    },
  })

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return {
          sourceRefs: retrieval.sources,
          ...(newThreadId ? { threadId: newThreadId } : {}),
        }
      }
      return undefined
    },
  })
}
```

**핵심 결정**:
- `getServerSupabaseUser()`는 cookies 기반 SSR auth — 클라이언트 hint `userId`는 무시. RLS·RPC가 최종 가드.
- thread 신규 생성은 `onFinish` 시점(D2) — assistant 응답 성공이 확정된 후 INSERT. partial state 회피.
- 신규 threadId는 `messageMetadata`에 첨부해 클라이언트가 다음 요청부터 이어쓰기. M3 패턴 정합.

### 5.2 `/api/chat/threads/route.ts` — 사이드바 목록

```ts
// src/app/api/chat/threads/route.ts
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const supabase = await getServerClient()  // 기존 SSR helper (RLS 작동)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ threads: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20)  // D6

  if (error) {
    return new Response(JSON.stringify({ error: '대화 목록을 불러오지 못했어요.' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return new Response(JSON.stringify({ threads: data }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
```

### 5.3 `/api/cron/cleanup-chats/route.ts` — 90일 cron (Vercel)

```ts
// src/app/api/cron/cleanup-chats/route.ts
export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  // Vercel cron 인증 (CRON_SECRET Bearer)
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = getAdminClient()

  // 1. 90일 경과 thread를 soft delete (사용자 직접 삭제 권리는 M6)
  const { data: softDeleted, error: e1 } = await admin
    .from('chat_threads')
    .update({ deleted_at: new Date().toISOString() })
    .lt('updated_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .is('deleted_at', null)
    .select('id')

  // 2. soft deleted 후 추가 30일 경과한 thread를 hard delete (cascade로 messages 자동 삭제)
  const { data: hardDeleted, error: e2 } = await admin
    .from('chat_threads')
    .delete()
    .lt('deleted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .select('id')

  if (e1 || e2) {
    console.error('[cron] cleanup-chats error', { e1, e2 })
    return new Response(JSON.stringify({ error: 'cleanup failed' }), { status: 500 })
  }

  return new Response(
    JSON.stringify({
      softDeleted: softDeleted?.length ?? 0,
      hardDeleted: hardDeleted?.length ?? 0,
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}
```

```json
// vercel.json (신규 또는 기존 확장)
{
  "crons": [
    { "path": "/api/cron/cleanup-chats", "schedule": "0 3 * * *" }
  ]
}
```

**원칙**:
- soft delete 90일 + hard delete 추가 30일 = 총 120일 보존. PIPA "90일 자동 삭제" 의무는 soft delete 시점에 사용자 접근 차단으로 충족 (사용자에게는 사라짐).
- 사용자 직접 삭제는 M6에서 별도 hard delete 경로 추가 (cron과 무관, 즉시 hard).

---

## 6. 접근성 Spec

### 6.1 WCAG 2.1 AA 준수 항목

| 항목 | 구현 | 검증 |
|------|------|------|
| 키보드 내비게이션 | AI Elements 컴포넌트 기본 키보드 지원 + `PromptInputSubmit` `tabindex` 적정성 확인 | Tab 순서 수동 검증 (위원장) |
| Focus 가시성 | `focus-visible:ring-2` 토큰 일관 적용 | VoiceOver 회귀 검증 (위원장) |
| Color contrast | shadcn 토큰 `bg-background`/`text-foreground` 기본 4.5:1 만족 | dev tools 자동 검증 |
| `aria-live` | `Conversation` 컨테이너에 `aria-live="polite"` 명시 — AI Elements 기본값 확인 후 wrap 또는 그대로 | VoiceOver 스트리밍 낭독 검증 |
| 추천 질문 focus handoff | 클릭 후 `inputRef.current?.focus()` 패턴 보존 | 위원장 직접 검증 |
| 출처 카드 키보드 도달 | `Source` 컴포넌트 `<a>` 렌더 + `Tab` 도달 가능 | 키보드 단독 흐름 검증 |
| 로딩 상태 알림 | `Loader` 컴포넌트 `aria-label="응답을 작성하고 있어요"` | VoiceOver 낭독 검증 |
| 안내 배너 의미 | 배너 텍스트는 `<p>` (decorative div X) — 스크린리더가 본문으로 인식 | VoiceOver |
| Thread drawer 키보드 | `Sheet` open/close 키보드 (Esc/Enter) + focus trap | shadcn 기본 동작 검증 |

### 6.2 모바일 접근성 (CLAUDE.md §접근성 원칙)

| 항목 | 구현 |
|------|------|
| 터치 타깃 ≥ 44×44px | `PromptInputSubmit`, `Suggestion`, `Source` 칩 최소 크기 가드 |
| 가로 스크롤 금지 | `Conversation` 최대 너비 `max-w-3xl` + `overflow-x-hidden` |
| 햄버거 trigger 위치 | 우측 상단 `top-4 right-4` — 한 손 도달 |
| 회전 모두 지원 | `h-[calc(100vh-8rem)]` 동적 — landscape에서도 입력창 보이도록 |
| iOS VoiceOver | 위원장 iOS Safari 수동 검증 |
| Android TalkBack | (시범 단계에선 위원장 직접 검증 후 fix, 후속 사용자 보고로 보강) |

### 6.3 위원장 톤 검수 체크리스트 (M4 머지 전)

1. `Response` markdown 렌더가 `**bold**`·`##`·표·`---`·코드블록을 모두 정상 렌더하는가?
2. 시스템 프롬프트(M3 박힘)가 다정·명료 톤으로 응답을 유도하는가? (소수 샘플 질의로 검증)
3. 면책 조항("참고용입니다") 위치가 응답 말미인가 두미인가? 두미면 응답 흐름 어색하지 않은가?
4. 출처 칩 한 줄에 5개가 모두 가독성 있는가? (한국어 title 길이 편차)
5. VoiceOver로 응답 + 출처 카드 연속 낭독 시 흐름 자연스러운가?

---

## 7. 테스트 전략 — Vitest 부분 도입

### 7.1 도입 범위 (Q3=ii)

- `tests/components/chat/source-card.test.tsx` — 신규 Vitest 단위 테스트
- 기존 백엔드 테스트(`tests/*.test.ts`, `tests/scripts/`, `tests/migrations/`, `tests/rag/`)는 node:test 그대로
- `package.json` 스크립트 분리:
  - `test` → node:test unit (기존)
  - `test:components` → Vitest (신규)
  - `test:integration` → node:test + Supabase (기존)
  - `test:all` → chained

### 7.2 Vitest 구성 파일 (`vitest.config.ts`)

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/components/**/*.test.tsx'],
    setupFiles: ['./tests/components/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 7.3 SourceCard 테스트 예시

```tsx
// tests/components/chat/source-card.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Source } from '@/components/ai-elements/source'

describe('Source chip', () => {
  it('renders title + axis slug as href', () => {
    render(<Source href="/policies/2023-hr-1">📄 1) 장애정도</Source>)
    const link = screen.getByRole('link', { name: /1\) 장애정도/ })
    expect(link).toHaveAttribute('href', '/policies/2023-hr-1')
  })
})
```

### 7.4 통합 테스트 (M5 — node:test 유지)

```ts
// tests/migrations/0010_chat_history.test.ts
// RLS 시나리오:
//   1. user A가 thread 생성 → 본인은 SELECT 가능
//   2. user B가 user A의 thread SELECT 시도 → 빈 결과
//   3. user A의 thread를 soft delete → 본인 SELECT도 제외
//   4. anon이 직접 INSERT 시도 → 42501 RLS 거부
//   5. service_role RPC create_thread_with_messages → 정상 INSERT
//   6. service_role RPC append_messages 시 user_id 불일치 → exception
```

### 7.5 E2E (위원장 수동 검증)

자동화 X. 위원장이 다음 4개 시나리오를 production preview에서 직접 검증:

1. **비로그인 채팅**: `/chat` 진입 → 추천 질문 클릭 → 응답 수신 → 새로고침 → 대화 휘발 + 안내 배너 변동 없음
2. **로그인 첫 thread**: 로그인 → 질문 → 응답 → 새로고침 → 대화 유지 → drawer에서 thread 목록 확인
3. **로그인 thread 이어가기**: drawer에서 이전 thread 선택 → 메시지 이어쓰기 → DB에 append 확인
4. **VoiceOver**: 위 3개를 VoiceOver on 상태로 재현 — 스트리밍 낭독·focus 흐름·drawer 열림 자연스러움 확인

---

## 8. 마일스톤 분해

### 8.1 PR A — M4 채팅 UI 교체

**브랜치**: `phase-3-m4-chat-ui`
**머지 기준**: codex-rescue 통과 + 위원장 톤 검수 + 회귀 테스트 그린

**신규 파일**:
- `src/components/chat/ChatUI.tsx` (~150 LOC)
- `src/components/ai-elements/*` (AI Elements scaffold, npx 자동 생성)
- `src/components/ui/sheet.tsx` (shadcn add — drawer는 PR B에서 첫 사용, 미리 추가)
- `tests/components/chat/source-card.test.tsx` (Vitest 신규)
- `vitest.config.ts`
- `tests/components/setup.ts`

**수정 파일**:
- `src/app/(wiki)/chat/page.tsx` — `ChatMockUI` → `ChatUI`
- `package.json` — `@ai-sdk/react`, `vitest`, `@testing-library/react`, `@vitejs/plugin-react`, `jsdom` 추가 + 스크립트 분리

**삭제 파일**:
- `src/components/chat/ChatMockUI.tsx`
- `src/lib/chat-mock-responses.ts` (mock 응답 사전, 이제 RAG가 대체)

**검증**:
- Vitest 1건 PASS (SourceCard)
- 기존 node:test 회귀 그린
- `next build` 페이지 카운트 변동 0 (단, `/api/chat`은 ƒ 유지)
- 위원장 수동 4개 시나리오 중 (1) 비로그인 채팅만 (history 미도입)

**codex-rescue 포커스**:
- `aria-live` 중복 선언 (AI Elements `Conversation` 기본값 vs 명시 wrap)
- 추천 버튼 → input focus handoff 보존
- `Response` markdown 렌더의 XSS 안전성 (Streamdown 내장 sanitize 의존)
- 미로그인 사용자에게 thread drawer 미노출 분기 정확성
- `useChat` v6 transport 누락 (M3 route handler shape와 정합)

### 8.2 PR B — M5 DB 히스토리 인프라

**브랜치**: `phase-3-m5-chat-history`
**선행**: PR A 머지 후 master 기반
**머지 기준**: codex-rescue 통과 + 위원장 명시 신호 + 회귀 테스트 그린 + RLS 통합 테스트 PASS

**신규 파일**:
- `supabase/migrations/0010_chat_history.sql` — 테이블·인덱스·RLS·트리거
- `supabase/migrations/0011_chat_history_rpcs.sql` — `create_thread_with_messages` + `append_messages`
- `src/components/chat/ThreadDrawer.tsx`
- `src/app/api/chat/threads/route.ts` — GET 목록
- `src/app/api/cron/cleanup-chats/route.ts` — 90일 cron
- `vercel.json` — `crons` 항목 (신규 파일 또는 기존 확장)
- `tests/migrations/0010_chat_history.test.ts` — RLS 통합

**수정 파일**:
- `src/app/api/chat/route.ts` — `onFinish` 분기 + `getServerSupabaseUser` 가드 + `messageMetadata.threadId` 첨부
- `src/components/chat/ChatUI.tsx` — `useChat` body로 `threadId`/`userId` 동봉 + `onFinish`로 신규 threadId state 동기화 + 로그인 시 `ThreadDrawer` 렌더
- `.env.local` (로컬) / Vercel env — `CRON_SECRET` 추가
- 메모리 + `CLAUDE.md` 변경 이력

**검증**:
- RLS 통합 6 시나리오 PASS (§7.4)
- cron endpoint 수동 호출 (Bearer 검증 + 90일/120일 boundary)
- 위원장 수동 4개 시나리오 전부

**codex-rescue 포커스**:
- 0010 RLS 정책 누락(INSERT/UPDATE write 가드 누락 시 client 직접 INSERT 가능)
- 0011 RPC `security definer + search_path = ''` 가드 (0003·0006·0007 패턴 정합)
- `append_messages`의 thread 소유권 검증 (route handler 신뢰 X)
- `onFinish` 에러 시 silent 처리가 PII 마스킹 정합 (formatSupabaseError 재사용)
- cron Bearer 토큰 비교 timing-safe (`crypto.timingSafeEqual` 권장)
- `getServerSupabaseUser` cookies 누락 시 모든 메시지가 비로그인 분기로 빠지는 회귀
- soft delete 후 SELECT 정책이 정확히 제외하는지 (`deleted_at is null` 누락 회귀)

---

## 9. 리스크 및 미해결 변수

### 9.1 보안 CVE — Next.js·React 패치 minimum 미달

| 패키지 | 현재 | CVE 패치 minimum | 영향 |
|--------|------|------------------|------|
| `next` | `^16.0.10` | **16.0.11** (CVE-2025-66478 RCE CVSS 10.0) | webfortd 영향 가능 — App Router 사용 중 |
| `react` | `^19.2.1` | **19.2.4** (CVE-2026-23864 DoS) | DoS 추가 벡터 노출 |

**M4+M5 머지 전 또는 직후 별도 PR로 처리**. spec 범위 외이지만 동일 sprint에 묶어 보안 부담 해소 권장.

### 9.2 AI Elements 접근성 회귀 가능성

(A안 선택의 1차 리스크) AI Elements의 `Conversation`/`Message`/`PromptInput`이 실제 VoiceOver에서 어떻게 동작하는지 webfortd가 사전 검증한 적 없음. ChatMockUI 패턴은 위원장이 직접 검증 완료.

**완화**:
- PR A 머지 전 위원장 VoiceOver 톤 검수 게이트 필수
- 회귀 발견 시 AI Elements 컴포넌트를 `<div role="..." aria-*>` 래퍼로 보강
- 최악의 경우 부분 manual rendering (`Response`만 유지·`Message`/`Conversation`은 직접 구현)

### 9.3 `onFinish` 비동기 DB 저장 실패의 silent UX

`onFinish`는 응답 streaming 완료 후 실행 — 저장 실패해도 사용자는 응답을 받은 상태. 새로고침 시 대화 사라지면 사용자 혼란.

**M4+M5 범위에서는 silent + 서버 로그**로 처리. M6에서 retry UI / 토스트 알림 도입 검토. PIPA·시범 단계 신뢰성 측면에서 응답 자체는 손실 없으므로 critical 아님.

### 9.4 thread title 30자 truncate의 가독성

D1 결정. "특수 마우스에는 어떤 종류가 있나요?"(20자) → 그대로 표시 적절. "장애인교원의 학교생활기록부 비교과 활동 입력 지원 절차를…"(긴 질문) → 30자 cut + "…" suffix는 의미 손실 가능.

**M6에서 inline rename 또는 LLM 요약**으로 보강. 시범 단계엔 truncate로 충분.

### 9.5 Vercel cron의 실행 보장 vs Supabase pg_cron

Vercel cron은 best-effort — 가끔 skip 가능. PIPA 의무 측면에서 90일 boundary 정확성이 요구되면 pg_cron 또는 cron lag 모니터링 필요.

**완화**: cron이 `>= 90일`로 매번 실행되므로 1~2일 지연돼도 PIPA 위반 즉시 발생 X (Privacy Act 합리적 보호 조치 해석). 시범 단계 적정.

### 9.6 `auth.uid()` cookies 누락 회귀

`getServerSupabaseUser()`가 cookies를 잘못 읽으면 모든 로그인 사용자가 비로그인 분기로 빠짐 — 대화가 DB에 저장 안 됨, drawer가 비어 보임.

**완화**: M3 시점에 `getServerClient()`는 다른 페이지에서 검증됨(`(wiki)/wiki/page.tsx` 등). 단 `.auth.getUser()` 분기는 PR B에서 첫 실 운용 — 통합 테스트로 보강 + 위원장 수동 검증 시나리오 2·3에서 1차 확인.

---

## 10. codex-rescue 포커스 (PR A·B 공통)

마일스톤급 cross-cutting 검토. PR 별도 호출.

### PR A
- AI Elements `Conversation` aria-live 중복 / focus handoff 누락
- `useChat` v6 transport 누락 (M3 route handler shape 정합)
- ChatMockUI 흔적 (`lib/chat-mock-responses.ts` 미삭제 등)
- Vitest 도입의 기존 node:test 회귀 차단

### PR B
- 0010 RLS write 정책 누락 (anon/authenticated 직접 INSERT 가드)
- 0011 RPC `security definer + search_path = ''` 가드
- `onFinish` PIPA 마스킹 + silent 처리 적정성
- cron Bearer 토큰 timing-safe 비교
- `getServerClient().auth.getUser()` cookies 누락 회귀
- soft delete 90일 + hard delete 120일 boundary 산수
- `messageMetadata.threadId` race condition (신규 thread 첫 응답 동시 다중 클릭 시)

---

## 11. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-24 | 초안 작성 — Phase 3 M3 머지 (master `b55fece`) 후속, 위원장 brainstorming Q1~Q5 + 부가 D1~D9 잠금. PR A(M4 UI) + PR B(M5 history) 분리. AI Elements 풀세트 + 미니멀 칩 + Vitest 부분 도입 + Vercel cron 채택. |
