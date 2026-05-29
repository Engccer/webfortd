# Phase B — Preview Mode + Publish 정합 설계

**작성일**: 2026-05-29
**상태**: 설계 (위원장 A+B 조합 승인)
**선행**: Phase A (PR #63·#64·#65 머지)
**관련 메모리**: `project_admin_preview_and_edit_policy.md`, `feedback_rsc_event_handler_gap.md`

## 1. 배경

Phase A 대시보드가 **정합 불일치**를 드러냄: 마크다운 정본 published 8 vs DB published 1.
- 원인: `sync-content-to-db.ts`가 D1 결정으로 status를 `draft` 강제(line 117), frontmatter 무시. published 전환은 `kb:publish --apply`로만.
- 위원장 결정(2026-05-29): 527건 draft 품질 OK → **A+B 조합**으로 일괄 공개.

## 2. 정합 해법의 핵심 (함정 회피)

**순진한 A+B의 함정**: DB를 bootstrap으로 published 만들어도 마크다운 frontmatter가 draft면 다음 sync에서 draft로 복귀(A가 frontmatter를 따르므로).

**진짜 해법**: bootstrap이 **마크다운 정본(.md frontmatter)을 published로 승격**한다. 정본이 진실이므로 sync가 그대로 DB에 반영. 완전 정합.

```
bootstrap: 527개 .md frontmatter (status: draft → published, reviewed_by += placeholder)
  → git commit (정본 변경 = 영구 자산)
  → sync-content (frontmatter status 반영 — D1 수정)
  → DB published 535 (8 기존 + 527 신규)
  → 위키 라우트 게이트가 published만 공개 → 535건 전부 공개
```

## 3. 마일스톤 분할

### M1 — 정합 기반 + 사이트 채움

1. **sync-content-to-db.ts D1 수정**: status를 frontmatter 값 그대로 반영(draft 강제 제거). frontmatter status가 진실.
2. **`kb:publish --bootstrap` 모드**: 527개 .md frontmatter를 `status: published` + `reviewed_by: ["위원장 1차 검토(bootstrap)"]`로 일괄 수정. explicit `--bootstrap` + `--ack` flag 강제(C1 사고 교훈). dry-run 기본.
3. **bootstrap 실행 + sync + 검증**: 535 published 정합. 대시보드에서 마크다운 535 = DB published 535 확인.

**산출물**: 527 .md 파일 frontmatter 수정(git diff) + sync 스크립트 수정 + bootstrap 스크립트. **위키 라우트는 아직 무게이트**(M2) — 이 시점엔 모든 페이지가 published라 게이트 적용해도 안전한 상태가 됨.

**위험**: 527 파일 일괄 수정은 큰 diff. reviewed_by placeholder가 "검수됨"으로 오인되지 않게 placeholder 명칭 명확("위원장 1차 검토(bootstrap)" — 정밀 검수와 구분). 향후 정밀 검수 시 placeholder를 실제 reviewer로 교체하는 점진 워크플로.

### M2 — 위키 라우트 게이트 + Preview Mode

1. **위키 라우트 published 게이트**: `KbPageLayout` 또는 라우트에서 `status !== 'published'`면 일반 사용자에게 "검수 중" 안내(404 아님). admin Draft Mode면 모든 status 접근.
2. **Next.js Draft Mode 인프라**: `/api/admin/preview/enable`·`/disable` Route Handler (admin만, `draftMode().enable()`). cookie 기반.
3. **Preview Toggle 활성화**: AdminBarView의 disabled 버튼 → 실제 토글. **AdminBarView를 `'use client'` 컴포넌트로 분리**(feedback_rsc_event_handler_gap 교훈 — RSC에 onClick 금지). 토글 상태는 server `draftMode().isEnabled`로 표시.
4. **aria-live 알림**: Preview Mode 전환 시 "관리자 미리보기를 켰습니다/껐습니다".

**산출물**: 위키 라우트 게이트 + preview Route Handler + AdminBar client 분리 + Draft Mode 분기.

### M3 — RAG + 카탈로그 게이트

1. **RAG 채팅 admin 분기**: `/api/chat`가 `draftMode().isEnabled && isAdmin`이면 `includeDrafts=true`, 아니면 `false`. (현재 `DEFAULT_INCLUDE_DRAFTS = true` → published-only 기본으로 변경, admin Draft Mode만 draft 포함)
2. **카탈로그 게이트**: `/library`·`/media`가 published seed만 노출(현재 seed JSON 기반 → status 필터). admin Draft Mode면 draft 포함.

**산출물**: RAG retrieval 기본 정책 변경 + 카탈로그 status 필터.

## 4. 결정 잠금

| ID | 결정 | 근거 |
|----|------|------|
| B1 | bootstrap = 마크다운 frontmatter 승격(정본 수정) | 함정 회피 — DB만 고치면 다음 sync에서 복귀 |
| B2 | sync가 frontmatter status 반영(D1 수정) | 영구 원칙 "마크다운 정본" 완전 정합 |
| B3 | reviewed_by placeholder = "위원장 1차 검토(bootstrap)" | 정밀 검수와 구분되는 audit trail |
| B4 | `--bootstrap` explicit flag + dry-run 기본 | C1 사고 교훈(positional 만으로 의도 외 전환 방지) |
| B5 | 위키 라우트 게이트는 "검수 중" 안내(404 아님) | 페이지 존재는 알리되 내용 비공개 — 접근성·정보 제공 |
| B6 | Preview Toggle = AdminBarView 'use client' 분리 | RSC onClick 금지(feedback_rsc_event_handler_gap) |
| B7 | RAG 기본 published-only, admin Draft Mode만 draft | KB_ARCHITECTURE "검수 안 된 콘텐츠 RAG 제외" 원칙 실현 |
| B8 | M1 먼저(사이트 채움) → M2 게이트(빈 사이트 방지) | 순서 정합 |

## 5. 리뷰 포커스 (codex-rescue, M별)

- **M1**: sync status 반영이 기존 idempotent sync 깨지 않는지. bootstrap이 frontmatter만 수정하고 본문 안 건드리는지. reviewed_by placeholder가 검수 게이트 우회로 오용 안 되는지. dry-run 기본 강제.
- **M2**: 게이트가 admin Draft Mode를 정확히 bypass하는지. Draft Mode cookie가 일반 사용자에게 안 새는지. Preview Toggle client 분리 후 server 상태 표시 정합. RSC onClick 재발 방지.
- **M3**: RAG 기본 정책 변경(published-only)이 익명 사용자에게 draft 인용 차단하는지. admin Draft Mode만 draft. 카탈로그 게이트.

## 6. 회귀 가드

- M1: sync 후 DB status = 마크다운 frontmatter status 1:1. bootstrap dry-run이 변경 0건. published 535 정합.
- M2: 비-admin이 draft 페이지 접근 시 "검수 중" 안내(200, 404 아님). admin Draft Mode면 draft 접근. Preview Toggle 키보드 동작 + aria-live.
- M3: 익명 RAG 질의가 draft 청크 인용 안 함. admin Draft Mode RAG가 draft 포함. 카탈로그 published 필터.

## 7. Agent Teams 판단

Phase B는 순차 의존 강함(M1 채움 → M2 게이트 → M3). cross-cutting cookie/게이트가 여러 라우트에 퍼져 인터페이스가 흐릿. **단일 에이전트 + M 단위 분할 + 각 M codex-rescue**가 정합(Agent Teams 비적용 신호: 순차 흐름 + 흐릿한 인터페이스). webfortd Phase 3·4 패턴과 동일.
