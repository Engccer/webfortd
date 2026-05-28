# Admin Preview & Publish 설계

**작성일**: 2026-05-29
**상태**: Phase A 구현 착수
**관련 메모리**: `project_admin_preview_and_edit_policy.md`

## 1. 배경과 동기

위원장이 협의 자리(중부대 + 후보 개발 업체)에서 데이터 가시성 + admin 제어를 더 보여주고 싶다는 요구. 동시에 별도 ID/password 로그인은 만들지 않고 기존 매직링크 인증을 그대로 유지하기로 결정(2026-05-29 위원장).

## 2. 발견된 미정합 (영구 원칙 vs 현재 구현)

| 영역 | 영구 원칙 | 현재 구현 | 정합? |
|------|----------|-----------|-------|
| 마크다운 → DB sync | DB는 파생 인덱스 | `scripts/sync-content.ts` + `kb-index.generated.json` | ✅ 정합 |
| RAG retrieval | `published`만 인용 (KB_ARCHITECTURE §"검수 안 된 콘텐츠는 SQL 레벨에서 RAG 결과에 포함되지 않음") | `DEFAULT_INCLUDE_DRAFTS = true` (`retrieval.ts:43`) | ⚠️ **미정합** (시범 단계 임시) |
| 위키 페이지 라우트 | `published` 게이트가 라우트 단에 적용 | `fs.readFileSync` 기반 SSG. 모든 535 페이지가 URL 직접 접근 가능 | ⚠️ **미정합** (시범 단계 임시) |
| 카탈로그 (`/library`, `/media`) | RLS `status='published'` 게이트로 차단 | seed JSON 기반(`wiki-library-catalog`, `wiki-media-curation`) — DB RLS 미경유 | ⚠️ **미정합** (시범 단계 임시) |

세 미정합은 모두 "시범 단계라 published 콘텐츠가 0~8건이라서 빈 사이트가 되는 우려" 때문에 임시 보류된 상태. 본 설계로 미정합을 단계적으로 해소한다.

## 3. 단계적 접근

### Phase A — 가시성 강화 (당장)

**원칙**: 위키 라우트는 건드리지 않는다. read-only 가시성만 추가 → 영구 원칙 충돌 0.

**산출물**:
1. `editor_roles` 테이블에 `'admin'` role 확장. 위원장 이메일 seed.
2. `documents`/`document_chunks`/`wiki_backlinks` SELECT RLS에 admin은 모든 status read 허용(Phase B의 토대 — 본 Phase에서는 read-only 가시성만 사용).
3. AdminBar (RSC) — admin이면 fixed top bar로 마운트, 일반 사용자에게는 null. 표시:
   - "관리자 모드 — 위원장(`engccer@gmail.com`)"
   - 대시보드 링크 (`/admin/dashboard`)
   - Preview Toggle placeholder (Phase B에서 활성화. Phase A는 disabled + "Phase B에서 활성화" 안내 tooltip)
4. StatusBadge (component) — draft/in_review/published/archived/deprecated 시각화. 색상 대비 WCAG AA 통과. 기존 KbPageLayout의 "초안" 단일 배지 교체.
5. `/admin/dashboard` 라우트:
   - status별 카운트 (kb-index 기반)
   - axis별 분포
   - 검수 큐 (reviewed_by 비어있는 페이지 목록 + slug + 마지막 수정일)
   - broken_wikilinks (kb-index의 `broken_wikilinks` 필드 가시화)
   - DB documents 테이블 카운트와 kb-index 카운트 비교 (정합 검증)
6. 권한 게이트: `(wiki)/admin/layout.tsx`에서 server-side admin 체크, 미인증/일반 사용자는 `/` redirect.

**범위 명시 (Phase A 안 함)**:
- 위키 페이지 라우트의 status 게이트 (Phase B)
- RAG 채팅의 `includeDrafts` 분기 (Phase B)
- 위키 페이지 in-place 편집 (Phase C — 메모리에 보류)
- 일괄 publish 워크플로 (Phase B)

### Phase B — Preview Mode + 일괄 publish (다음 PR)

**원칙**: 위키 라우트에 status 게이트를 추가하되, admin Draft Mode 토글로 우회 가능. RAG 채팅도 동일 분기.

**산출물 (요약)**:
1. `(wiki)/[axis]/[slug]/page.tsx` 라우트에 status 게이트: 일반 사용자는 `status='published'`만 접근, 그 외는 "이 페이지는 검수 중입니다" 안내 페이지(404가 아니라 검수 상태 명시).
2. Next.js `draftMode()` + `/api/admin/preview/[enable|disable]` 라우트. admin이 토글하면 cookie set → 위키 라우트와 RAG 채팅이 includeDrafts=true.
3. `/api/chat` Route Handler가 `draftMode().isEnabled && isAdmin`이면 `includeDrafts=true`, 아니면 `false`로 전달.
4. `scripts/publish-content.ts`에 `--bootstrap` 모드 추가. 위원장 명시 ack(`--ack-bootstrap-reviewer="위원장 1차 검토(bootstrap)"`)로 reviewed_by에 placeholder 일괄 부여 후 published 전환. audit trail 보존.
5. 카탈로그 라우트(`/library`, `/media`)도 동일 분기: 일반은 published만, admin Draft Mode면 draft 포함.

**전제**:
- Phase A 머지 완료
- 위원장이 bootstrap publish 시점 결정

### Phase C — In-place 편집 (Phase 5+, 메모리에 보류)

상세는 `project_admin_preview_and_edit_policy.md` 참조. git-backed 어댑터(Decap CMS / GitHub web editor / Tiptap → MD → PR) 후보 중 위원장 + 허유진 교수 협업 시점에 결정.

## 4. 결정 잠금 (Phase A)

| 결정 | 선택 | 이유 |
|------|------|------|
| D1 인증 패러다임 | 매직링크 그대로, ID/password 미도입 | 공격면 최소화 + 위원장 이메일은 이미 인증됨 |
| D2 admin role 부여 방식 | `editor_roles` 테이블 + `role='admin'` | 기존 인프라(PR #17) 재사용 |
| D3 admin 권한 체크 위치 | server-side (`createServerClient` + RLS SELECT) | AuthContext(client-side)는 UI hint 용도. 진정한 권한 게이트는 server-side |
| D4 AdminBar 구현 | RSC + (wiki) layout에 마운트 | 일반 사용자에게는 null 반환 → JS payload 0 |
| D5 대시보드 데이터 소스 | kb-index.generated.json + documents 테이블 양쪽 | 마크다운 정본과 DB 파생 인덱스 둘 다 가시화 → 정합 검증 가능 |
| D6 status 게이트 | Phase A에서 위키 라우트에는 적용 안 함 | 시범 단계 빈 사이트 방지. Phase B에서 일괄 publish와 함께 적용 |
| D7 위키 페이지 status 표시 | 모든 status 시각화(draft 외에도) | 협의 자리에서 검수 상태를 명확히 보여주기 위함 |
| D8 admin 권한 확장성 | 'admin' role 단일 + 위원장만 seed | 위원장 외 admin 추가는 추후 위원장 ack 후 service_role 마이그레이션으로 |
| D9 Phase B Preview Toggle | Phase A는 placeholder + disabled tooltip | UI 자리는 미리 잡아두고 Phase B에서 활성화 |
| D10 admin route 위치 | `(wiki)/admin/*` (별도 라우트 그룹 아님) | 사이드바·헤더 일관성. `(wiki)/admin/layout.tsx`에 권한 게이트 |

## 5. 리뷰 포커스 (codex-rescue 시)

- **영구 원칙 정합성**: Phase A가 "마크다운이 정본" 원칙을 깨지 않는지. DB write 0건 보장(read-only).
- **권한 게이트 누락**: admin 라우트가 server-side에서 정확히 차단되는지(client-side 우회 불가).
- **RLS 정책 회귀**: 0013에 추가하는 admin SELECT 정책이 0001/0009의 `published` 게이트를 의도치 않게 깨지 않는지.
- **AdminBar 일반 사용자 노출**: 빌드 시점 또는 SSG 결과물에 admin UI가 포함되어 노출되지 않는지(RSC라 정상이지만 한 번 더 확인).
- **a11y**: 키보드 접근, focus order, `aria-live` 알림(admin bar 진입 시), 색상 대비 AA.

## 6. 의존 / 영향 / 회귀

**의존**: PR #17 (`editor_roles` 인프라), PR #19 (editor write DROP), `@supabase/ssr` 매직링크 인증.

**영향**:
- `(wiki)/layout.tsx`에 AdminBar 마운트 추가 → 일반 사용자 UI 변화 없음(null 반환).
- `KbPageLayout`의 "초안" 분기가 `StatusBadge`로 교체 → 시각 변화 있음. 일반 사용자에게도 status 5종 모두 노출.

**회귀 가드 (필수)**:
- AdminBar가 비-admin에게 null 반환 (component test)
- StatusBadge가 5종 status 모두 정확히 렌더 (component test)
- /admin/dashboard 비-admin 접근 시 / redirect (integration test)
- 0013 마이그레이션 후 anon role은 여전히 published만 read (integration test, 0001 게이트 회귀 방지)
- 키보드 only로 admin bar 모든 기능 접근 가능 (playwright a11y test)

## 7. 참고 자료

- `docs/KB_ARCHITECTURE.md` §"검수 안 된 콘텐츠 게이트"
- `supabase/migrations/0002_editor_roles_and_publish.sql` (editor_roles 토대)
- `supabase/migrations/0004_drop_editor_write_documents.sql` (write DROP 영구 원칙)
- `supabase/migrations/0009_match_chunks_status_whitelist.sql` (RAG status 화이트리스트)
- 메모리: `project_admin_preview_and_edit_policy.md`
