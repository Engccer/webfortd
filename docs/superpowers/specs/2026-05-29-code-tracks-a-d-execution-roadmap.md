# 코드 트랙 A~D 실행 로드맵 (2026-05-29 결정)

## 1. 배경

master(`82d9b44`, Phase B M1)까지 진행된 시점에서, 머지되지 못한 채 남은 코드 작업을 정리하고 순차 실행 전략을 박는다. 본 문서는 **새 기능 설계가 아니라 기존 설계(M7 plan · Phase B spec · Phase 4 M3 carry-over)를 묶는 마스터 실행 로드맵**이다.

위원장과 brainstorming(2026-05-29)을 통해 합의:

- **범위**: 코드 트랙 A~D만. 비코드 트랙(E: 콘텐츠 큐레이션 — 허유진 교수 협업, F: 이미지 검수 큐 79건 낭독 워크플로)은 별도 트랙으로 분리.
- **순서**: A(M7 머지) → B(Phase B M2) → C(Phase B M3) → D(PDF Storage) **순차**.
- **Agent Teams**: **발동 안 함**. 전부 단일 에이전트 + M단위 codex-rescue + 독립 서브작업만 subagent 병렬화. (근거: Phase B spec §7 — 순차 의존 + 흐릿한 인터페이스 → file lock 직렬화·merge 재작업 위험. M7·D도 선형 단일 워크트리 편집.)

## 2. 현황 스냅샷

- master: `82d9b44` — Phase 3(RAG) → Phase 4(위키 리뉴얼) → Phase B M1(527페이지 공개)까지 완료.
- `phase-3-m7-impl`: M7(음성 받아쓰기 + 파일 첨부) 구현·codex-rescue·smoke 완료. **merge-base `509f489`(M7 plan PR #40, 5/24)에서 분기 → master가 그 후 25커밋 앞섬(stale)**.
- M7 순수 추가: 신규 파일 18개(+1493줄) — `/api/transcribe` route, `VoiceRecordButton`·`AttachmentButton`·`AttachmentChip`·`MicrophonePermissionPrompt`, hooks(`useVoiceRecorder`·`useMicrophonePermission`·`useSound`), `file-validation`·`upstage-parse` + 테스트. 기존 파일 수정은 `/api/chat`·ChatUI 통합부·test setup·npm test glob.
- `content/agreements/*.md` 526건이 M7 diff에 "수정"으로 보이는 것은 **Phase B M1이 master에서 frontmatter를 draft→published로 바꾼 것**이며 M7이 직접 건드린 게 아니다 → rebase 시 master(published) 우선 채택.

## 3. 트랙별 실행 계획

### 트랙 A — Phase 3 M7 머지 (음성 + 첨부) · 단일 에이전트

기존 설계: `docs/superpowers/plans/2026-05-24-phase-3-m7-attachment-voice.md`. **핵심 작업은 신규 개발이 아니라 안전한 rebase + 재검증.**

1. **A1. Rebase**: master 최신 기준 새 worktree에서 `phase-3-m7-impl`을 rebase. 충돌 예상 지점 — `src/app/api/chat/route.ts`(Phase 4/B 수정됨), ChatUI 통합부, `tests/components/setup.ts`. `content/agreements/*.md` 526건은 **master(published) 우선**.
2. **A2. 재검증**: `npm test`(master baseline + M7 신규 ~25) · `test:components` · `test:integration`(M5 baseline 변동 0) · `build`(신규 `ƒ /api/transcribe` 등록) · `lint` 0 · kb baseline 변동 0.
3. **A3. 리뷰 게이트**: codex-rescue(M7 diff 전체, 포커스 — rebase 후 `/api/chat` 파일 분기 정합 + PIPA 로그 본문 비기록) → coderabbit(CLI 비대화 환경이면 PR #61 패턴 skip) → PR → 머지.
4. **A4. 위원장 액션(코드와 분리)**: `DEEPGRAM_API_KEY` 발급 + Vercel 등록(Production+Preview) + `UPSTAGE_API_KEY` 재사용 → `vercel env pull` → production smoke 3건(음성/PDF/HWPX). 코드 머지는 env 없이 가능, smoke만 env 의존.

**리스크**: rebase 충돌. 완화 — 새 worktree 격리 + master 우선 전략 명시 + 충돌 후 전 검증 명령 재실행.

### 트랙 B — Phase B M2 (위키 게이트 + Preview Mode) · 단일 에이전트

기존 설계: `docs/superpowers/specs/2026-05-29-phase-b-preview-mode-publish-design.md` §3 M2. **A 머지 후 최신 master 기준 새 worktree**. `writing-plans`로 M2 plan 선작성 후 실행.

1. 위키 라우트 published 게이트: `status !== 'published'` → 일반 사용자에게 "검수 중" 안내 **200**(404 아님 — 결정 B5). admin Draft Mode면 모든 status 접근.
2. Next.js Draft Mode 인프라: `/api/admin/preview/enable`·`/disable` Route Handler(admin만, `draftMode().enable()`, cookie 기반).
3. Preview Toggle 활성화: AdminBarView의 disabled 버튼 → 실제 토글. **AdminBarView를 `'use client'` 컴포넌트로 분리**(결정 B6, `feedback_rsc_event_handler_gap` 교훈 — RSC onClick 금지). 토글 상태는 server `draftMode().isEnabled`로 표시.
4. aria-live 알림("관리자 미리보기를 켰습니다/껐습니다") + 회귀 가드.
5. **리뷰 게이트**: codex-rescue(포커스 — 게이트가 admin Draft Mode를 정확히 bypass + Draft Mode cookie가 일반 사용자에게 안 새는지 + RSC onClick 재발 방지) → coderabbit → PR.

### 트랙 C — Phase B M3 (RAG + 카탈로그 게이트) · 단일 에이전트

기존 설계: Phase B spec §3 M3. **B 머지 후 최신 master 기준**(C도 `/api/chat`을 건드리므로 A·B와의 충돌을 순서로 회피). `writing-plans`로 M3 plan 선작성.

1. RAG admin 분기: `/api/chat`가 `draftMode().isEnabled && isAdmin`이면 `includeDrafts=true`, 아니면 `false`. **`DEFAULT_INCLUDE_DRAFTS`를 `true`→`false`**로 변경(결정 B7 — KB_ARCHITECTURE "검수 안 된 콘텐츠 RAG 제외" 실현).
2. 카탈로그 게이트: `/library`·`/media`가 published seed만 노출(현재 seed JSON → status 필터). admin Draft Mode면 draft 포함.
3. 회귀 가드(익명 RAG 질의가 draft 청크 인용 안 함 + admin Draft Mode RAG가 draft 포함 + 카탈로그 published 필터).
4. **리뷰 게이트**: codex-rescue(포커스 — 기본 정책 변경이 익명 사용자에게 draft 인용 차단 + admin Draft Mode만 draft) → coderabbit → PR.

### 트랙 D — PDF Supabase Storage 마이그레이션 · 단일 에이전트

Phase 4 M3 carry-over. `supabase/migrations/0012_storage_library_bucket.sql`(storage bucket)이 이미 존재 → 활용. **C 머지 후 최신 master 기준**. `writing-plans`로 D plan.

1. `public/library/` 4 PDF(41MB) → Supabase Storage `library` bucket 업로드.
2. `/library/[slug]` 다운로드 링크를 Storage public URL로 전환.
3. `next.config.ts`의 `outputFileTracingExcludes: { "*": ["public/library/**"] }` **제거**(우회 정식화).
4. 회귀 가드(PDF 다운로드 정상 + 빌드 function size 정상) → codex-rescue → coderabbit → PR.

## 4. 결정 잠금

| ID | 결정 | 근거 |
|---|---|---|
| R1 | 범위는 코드 트랙 A~D만 | E·F는 협업·비코드 트랙, 별도 진행 |
| R2 | A→B→C→D 순차, 트랙당 독립 worktree·독립 PR | C·D가 `/api/chat`·카탈로그를 건드려 순서로 충돌 회피 |
| R3 | Agent Teams 비발동, 단일 에이전트 + M단위 codex-rescue | Phase B spec §7 + 글로벌 규칙(순차+흐릿한 인터페이스 = file lock 직렬화) |
| R4 | M7 rebase 시 `content/*`는 master(published) 우선 | Phase B M1 publish 정합 보존 |
| R5 | M7 env 등록·smoke는 위원장 액션, 코드 머지와 분리 | 코드 머지는 env 없이 가능, smoke만 외부 키 의존 |
| R6 | 매 트랙 codex-rescue → coderabbit(비대화면 skip) → PR | 글로벌 3중 리뷰 계층 분리 |

## 5. 공통 운영 원칙

- 각 트랙은 독립 worktree + 독립 PR, 순차 머지. C·D는 직전 트랙 머지 후 최신 master 재기준.
- 모든 게이트 변경은 영구 원칙 정합(read-only 가시성/게이트만, DB write 0) 점검.
- codex-rescue 멈춤 감지 시(5분 진전 없음 / 동일 명령 3회 반복) 즉시 TaskStop + 직접 invariant 검수 fallback(글로벌 규칙).
- 각 트랙 머지 후 MEMORY.md Quick Reference 한 줄 갱신.

## 6. 트랙별 리뷰 포커스 요약 (codex-rescue 방향)

- **A**: rebase 후 `/api/chat` file part 분기 정합 + PIPA(transcript/file 본문 비로그) + 신규 라우트 등록.
- **B**: 게이트 admin Draft Mode bypass 정확성 + cookie 누수 차단 + RSC onClick 재발 방지 + Preview Toggle 키보드/aria-live.
- **C**: RAG 기본 published-only 전환이 익명 draft 인용 차단 + admin만 draft + 카탈로그 status 필터.
- **D**: Storage URL 전환 후 PDF 서빙 정상 + 빌드 function size 정상 + exclude 제거 부작용 0.
