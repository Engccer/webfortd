# Phase 4 — 위키·채팅 중심 IA 전면 리뉴얼 설계 문서

> 작성일: 2026-05-27
> 상태: 위원장 검토 대기 (구현 착수 금지)
> 이전 Phase: Phase 3 M3·M4·M5·M6 머지 완료 (master `9d71bb0`). Phase 3 M7(파일 첨부 + 음성)은 plan만 머지, 구현 병행 진행 중
> 짝 문서:
> - `webfortd/CLAUDE.md` §앱 정체성과 채팅의 역할
> - `docs/DIRECTION_2026.md` (Phase 4 entry 갱신 필요)
> - 자문 메모 `2026/260527_중부대협의_방향확정_업체제안.md`
> - 메모리 `project_app_identity_and_chat_role.md`, `project_collaboration_partners.md`, `feedback_early_processing_principle.md`

---

## 1. 개요

### 1.1 Phase 4 범위

Phase 4는 webfortd를 **게시판·랜딩 흔적이 남은 hybrid 사이트**에서 **위키·채팅 중심 본체**로 IA를 전면 재구성하는 단계다. 사용자의 첫 진입(`/`)을 위키로, 작년 PHP 사이트 풍 `(gov)` 그룹의 정적 안내는 `/legacy/*` 보조 시연 자산으로 보존하며, atomic 콘텐츠 라우트를 axis namespace로 정합화한다. 다운로드 자료실(`/library`)과 미디어 자료실(`/media`)을 신설해 *위키 중심이면서도 통문서 다운·시각 자료 탐색* 요구를 흡수한다.

### 1.2 비전

- 사용자가 webfortd 도메인 root에 진입하면 **즉시 위키 entry**가 보인다 — 검색·역할별 진입점·인기 페이지·채팅·자료실·미디어 카드.
- 정적 안내 페이지는 `/legacy/*`에 보존되어 *작년 사이트와의 비교 시연 자산*으로 작동한다.
- 정책 문서를 통째로 받고 싶은 사용자는 `/library`에서 PDF/HWPX 다운로드 가능.
- 카드뉴스·이미지 자료를 탐색하고 싶은 사용자는 `/media`에서 alt 텍스트 + 다운로드 옵션과 함께 시청.
- 위키 콘텐츠와 자료실·미디어가 *서로 연결*되어 — atomic 페이지 footer에 "원본 PDF/HWPX 다운로드" 링크가 자동 노출.

### 1.3 전략적 위치 (시나리오 A 활성화 후)

2026-05-27 중부대 합의로 webfortd가 *시범 모델*에서 *사업 본체*로 전환 트랙에 진입했다. Phase 4 IA 리뉴얼은 사업 본체 진입 직전에 **사이트 정체성을 위키·채팅으로 확정**하는 마일스톤이다. 작년 PHP 사이트와의 차별성을 라우트 트리 자체에서 드러내며, *개발 위탁 후보 업체*에게 *인계 가능한 깔끔한 IA*를 사전 준비한다.

### 1.4 의존성

| 의존성 | 현재 상태 | Phase 4 요구사항 |
|--------|----------|----------------|
| `(gov)` Route Group | 정적 안내 약 30개 페이지 + atomic resources 노출 라우트 2개 | `(gov)` 전체를 `(gov)/legacy/*`로 mv, atomic resources는 axis namespace로 분리 |
| `(wiki)` Route Group | `/wiki` entry + `/chat` 두 라우트. 헤더에 EntryToggle 노출 | `/` root entry 신설, 역할별 진입점 추가, EntryToggle 라벨·링크 갱신 |
| atomic 라우트 (6 axis) | 5개는 그룹 밖 flat, 'resources' axis만 `(gov)/resources/law,research/[slug]`에 종속 | 'resources'를 `(wiki)` 그룹 안 axis namespace로 통합 |
| `sourcePathToHref` (retrieval.ts) | `content/<path>.md` → `/<path>` 단순 변환 | atomic resources 콘텐츠 경로 재구성 결정 후 정합 갱신 |
| `next.config.ts` | `redirects()` 없음 | 기존 URL 영구 redirect 등록 (호환성) |
| Phase 3 M4·M5·M6 | 채팅 UI(AI Elements) + DB 히스토리 + UX 보완 5건 머지 완료 | Phase 4 작업과 file overlap 0건. 병행 가능 |
| Phase 3 M7 (파일 첨부 + 음성) | plan만 머지, 구현 병행 | 채팅 입력 영역 작업이라 Phase 4와 충돌 없음 |

### 1.5 콘텐츠 큐레이션 협업 영역 (위원장 단독 X)

다음은 *허유진 교수 협업 영역*이라 본 spec에서 placeholder로 박고 *M2 머지 후 별도 PR로 추가*:

- 위키 entry 역할별 진입점 카드 5장의 추천 페이지·자료 선정
- 자료실(`/library`) 카테고리·자료 선정·메타데이터(요약·태그)
- 미디어 자료실(`/media`) 노출 자산·alt 텍스트 검수
- 위키 entry 인기 페이지 카드 (현재 4장)의 큐레이션 갱신

상세: 메모리 `project_collaboration_partners.md`

---

## 2. 결정 잠금 (D1~D7) — 변경 시 위원장 명시 결정 필요

| ID | 결정 | 위원장 신호 | 영향 |
|----|------|-----------|------|
| D1 | `(gov)` → `/legacy/*` 보존 (라우트만 mv, 콘텐츠 그대로). 흡수·폐기 X | 2026-05-27 | M1 디렉터리 mv, 호환성 redirect |
| D2 | 자료실 콘텐츠 = 현재 webfortd 보유 자산(`data/source-pdf/`, atomic 페이지 source frontmatter 등)만. PHP 게시판 자산은 중부대 인계 후 별도 마일스톤 | 2026-05-27 | M2 `/library` scope 제한 |
| D3 | 위키 entry IA = Hero(검색) + 역할별 진입점 5장(교원·관리자·교육청·정책입안자·학부모) + 인기 페이지 + 채팅 진입 + 자료실/미디어 진입 카드 | 2026-05-27 | M2 위키 entry 재설계 |
| D4 | atomic 라우팅 = axis namespace로 통합. 6개 axis 모두 `src/app/(wiki)/[axis]/[slug]/page.tsx` 패턴. 'resources' sub-axis(`law`, `research`)도 (wiki) 그룹 안으로 이동 | 2026-05-27 | M1 라우트 mv + sourcePathToHref 갱신 + 콘텐츠 경로 재구성 결정 |
| D5 | 마일스톤 분해 = 3개 큰 마일스톤. M1 라우팅·IA 기반 · M2 콘텐츠 기능 · M3 정리·접근성 | 2026-05-27 | 각 PR 단위 = 마일스톤 단위. codex-rescue 3회 + coderabbit 3회 |
| D6 | 큐레이션 콘텐츠 = 허유진 교수 협업 영역 placeholder, M2 머지 후 별도 PR | 2026-05-27 | M2 시드 데이터로 임시 큐레이션 노출. spec 검토 시 위원장이 임시 시드 5건 지정 |
| D7 | 호환성 = 기존 URL(`/about`, `/support`, `/rights`, `/stories`, `/participate`, `/resources/*`) 영구 redirect via `next.config.ts redirects()`. atomic resources도 axis 경로 변경 시 redirect | spec default | M1 호환성 게이트 |
| D8 | 구현 단계는 **Agent Teams로 병렬 실행** (writing-plans는 단독, executing-plans부터 발동). M1 시범 발동 → M2·M3 동일 패턴. 팀 리더 + 팀원 A/B/C + 내부 Reviewer 미배치 (over-fix 회피). 상세 §7.5 | 2026-05-27 | M1·M2·M3 구현 단계 |

---

## 3. 신규 라우트 트리 (M1 완료 후)

```
/                                  → (wiki) 위키 entry (Hero + 역할별 진입점 + 인기 페이지 + 채팅·자료실·미디어 진입)
/wiki                              → / 영구 redirect (또는 alias)
/chat                              → RAG 채팅 (Phase 3 M4 완료, M7 진행 중)
/library                           → 자료실 (M2 신설) — PDF/HWPX 다운로드 카드
/library/[category]                → 자료실 카테고리 (M2 확장 — 카테고리는 D6 협업 결정)
/media                             → 미디어 자료실 (M2 신설) — 카드뉴스·이미지 갤러리
/media/[slug]                      → 미디어 상세 (alt 텍스트 + 다운로드)
/disability-types/[slug]           → atomic ((wiki) 그룹으로 이동)
/policies/[slug]                   → atomic ((wiki) 그룹으로 이동)
/agreements/[slug]                 → atomic ((wiki) 그룹으로 이동)
/domains/[slug]                    → atomic ((wiki) 그룹으로 이동)
/regions/[slug]                    → atomic ((wiki) 그룹으로 이동)
/resources/law/[slug]              → atomic ((wiki) 그룹으로 이동) — D4
/resources/research/[slug]         → atomic ((wiki) 그룹으로 이동) — D4
/uncategorized/[slug]              → atomic ((wiki) 그룹으로 이동)
/legacy                            → (gov) 랜딩 (이전 /)
/legacy/about/*                    → (gov) 정적 안내
/legacy/support/*
/legacy/rights/*
/legacy/stories/*
/legacy/participate/*
/legacy/resources                  → (gov) 자료실 인덱스 (정적 안내)
/legacy/resources/policy           → 정책 제안 정적 안내
/legacy/resources/statistics       → 통계 정적 안내
/legacy/resources/law-guide        → 법령 안내 인덱스 (atomic /resources/law/[slug]와 URL 분리)
/legacy/resources/research-guide   → 연구 안내 인덱스 (atomic /resources/research/[slug]와 URL 분리)
/auth/callback                     → 그대로
/api/chat                          → 그대로 (Phase 3 M4 완료)
```

### 3.1 URL 충돌 해소 — `/legacy/resources/law` vs `/resources/law/[slug]`

(gov)의 `/resources/law` 정적 안내 페이지는 *atomic 라우트와 URL 차원에서 분리*. `/legacy/resources/law-guide`로 슬러그 변경 (M1 task 내 처리, 위험 매핑 §6 참조).

### 3.2 sourcePathToHref 정합 (D4 영향)

`src/lib/rag/retrieval.ts:171`의 `sourcePathToHref`는 `content/<path>.md` → `/<path>` 단순 변환. atomic resources 콘텐츠 경로(`content/resources/law/ordinance-comparison.md`)는 *그대로 유지* + URL도 `/resources/law/ordinance-comparison` *그대로 유지*. 라우트만 `(gov)/resources/law/[slug]` → `(wiki)/resources/law/[slug]`로 mv. 따라서 sourcePathToHref 로직 *변경 0*. 콘텐츠 경로와 라우트 경로의 1:1 정합 보존.

### 3.3 ordinance-comparison 등 위키 인기 페이지 URL

`src/lib/wiki-popular.ts:12`의 `/resources/law/ordinance-comparison`도 변경 0 (라우트 mv만 했으므로 URL 그대로).

---

## 4. 마일스톤 분해

### M1 — 라우팅·IA 기반 (~ 1.5~2주, 약 10~14 tasks)

**목표**: 위키가 `/` 메인, (gov)가 `/legacy/*` 보존, atomic 라우트가 axis namespace 정합.

**주요 task** (writing-plans 단계에서 task별 spec 도출):

1. `(gov)/*` 전체 디렉터리 mv → `(gov)/legacy/*` (페이지 약 30개, 한 commit)
2. atomic resources 라우트 mv — `(gov)/resources/law/[slug]/`, `(gov)/resources/research/[slug]/` → `(wiki)/resources/law/[slug]/`, `(wiki)/resources/research/[slug]/`
3. 5개 atomic axis 라우트도 (wiki) 그룹으로 mv — `src/app/disability-types/[slug]/` 등 → `src/app/(wiki)/disability-types/[slug]/` 등 (Route Group 정합)
4. `(wiki)/page.tsx` 신설 — `/` root entry. 현재 `(wiki)/wiki/page.tsx` 내용 이동 + 베타 안내 문단 삭제
5. `(wiki)/wiki/page.tsx` 처리 — 삭제 (next.config redirect로 대체) 또는 redirect 페이지로 변경
6. 내부 링크 일괄 갱신:
   - `src/lib/navigation.ts` — 모든 항목 `/legacy/` prefix 추가
   - `src/lib/wiki-popular.ts` — 변경 0 (D4 §3.2 정합)
   - `src/components/layout/Header.tsx:54` — `/` → `/legacy`
   - `src/components/layout/Footer.tsx:54-60` — `/privacy`·`/terms`·`/sitemap` 그대로 (미구현, 별도 처리)
   - `src/components/wiki/EntryToggle.tsx` — `/` → `/legacy`, `/wiki` → `/`. 라벨 "기관용" → "이전 버전", 베타 라벨 제거 (단, EntryToggle 자체 노출 정책은 M3 정리에서 재검토 — 위키 본체화 후 토글이 여전히 필요한지)
   - `(wiki)/layout.tsx` 헤더 로고 + 네비 + 푸터 카피 갱신 (베타 라벨 제거, `/legacy` 링크 추가)
   - `(gov) → (gov)/legacy/*` 내부 자기-참조 링크 11개 파일 — `/legacy/` prefix 추가 (grep 결과)
7. `next.config.ts redirects()` 등록 — `/about/*` → `/legacy/about/*` 등. atomic resources URL은 변경 없으므로 redirect 불요
8. `src/app/layout.tsx` metadata 정합 — 위키가 본체임을 반영
9. (gov) `Header.tsx`의 EntryToggle 노출 정책 검토 — (gov)/legacy 헤더에 위키 진입 토글 유지
10. 빌드 검증 — `npm run build` (568+ 정적 페이지), `npm test`, `npm run test:integration`, RUN_SMOKE=1 (RAG 채팅), production preview 수동 점검
11. 호환성 검증 — `/about`, `/support` 등 외부 인용 가능 URL이 영구 redirect로 작동하는지 curl 검증
12. CLAUDE.md 변경 이력 entry + memory `project_phase_status.md` 갱신

**검수 게이트**:
- spec compliance reviewer (task별)
- code-quality reviewer (task별)
- **codex-rescue** (cross-cutting invariant: 라우팅 정합·콘텐츠 경로·sourcePathToHref·내부 링크 일괄 갱신·호환성 redirect)
- **coderabbit** (스타일·관용구)
- 위원장 production preview 직접 검증 (`/`, `/wiki` redirect, `/legacy/about`, atomic 페이지 무작위 1건)

### M2 — 콘텐츠 기능 (~ 2주, 약 12~16 tasks)

**목표**: 위키 entry 재설계 + 자료실(`/library`) + 미디어 자료실(`/media`) 활성화.

**주요 task**:

1. 위키 entry (`(wiki)/page.tsx`) 재설계:
   - `<WikiHero>` 그대로 (검색)
   - `<RoleEntries />` 신설 — 역할별 진입점 5장 (교원·관리자·교육청·정책입안자·학부모). 데이터는 `src/lib/wiki-role-entries.ts` (시드 + D6 협업 영역 placeholder)
   - `<PopularPages>` 유지 (큐레이션은 D6 협업 영역)
   - `<ChatLibraryMediaEntries />` 신설 — 채팅·자료실·미디어 진입 카드 3개
2. 시드 데이터 작성 (D6 협업 가능 시점 전 임시):
   - `src/lib/wiki-role-entries.ts` — 위원장이 spec 검토 시 5장 임시 시드 지정. 허유진 교수 협업 결과 들어오면 별도 PR
   - `src/lib/library-categories.ts` — `data/source-pdf/` 자산 4건 단순 매핑
3. 자료실 (`/library`):
   - `src/app/(wiki)/library/page.tsx` — 카테고리 카드 + 자료 그리드
   - `src/app/(wiki)/library/[category]/page.tsx` — 카테고리 상세 (M2 후반)
   - `src/components/library/LibraryCard.tsx` — 카드 컴포넌트 (제목·연도·출처·요약·다운로드 버튼)
   - `src/components/library/LibrarySearch.tsx` — 검색 필터 (제목·태그)
   - `data/source-pdf/`의 PDF 파일 정적 서빙 결정 — `public/library/` 심링크 또는 Next.js Static Files API
4. 미디어 자료실 (`/media`):
   - `src/app/(wiki)/media/page.tsx` — 카드 그리드 + 검색 필터
   - `src/app/(wiki)/media/[slug]/page.tsx` — 상세 (alt 텍스트 + 다운로드 옵션 + 출처 콘텐츠 링크)
   - `src/components/media/MediaCard.tsx` — 카드 (썸네일·캡션·alt 미리보기)
   - 콘텐츠 출처: Phase 1.5b 매핑 완료 raster pool에서 *검증된 항목* (예: known_answer 7건 + 위원장 임시 큐레이션 1~2건). D6 협업 영역 placeholder
5. atomic 페이지 footer 다운로드 링크:
   - `src/components/kb/KbPageLayout.tsx` 또는 동등 위치에 "원본 PDF/HWPX 다운로드" 링크 박기
   - source frontmatter(예: `source: 2024-jbu-p-011`)에서 원본 파일 매핑 (`src/lib/atomic-source-map.ts` 신설)
6. 메타데이터 + sitemap — `/library`, `/media` 추가
7. 빌드 검증 — atomic 페이지·자료실·미디어 각 axis별 smoke
8. 통합 테스트 — `/library`, `/media` 200 응답 + 자료 다운로드 헤더(`Content-Disposition: attachment`) 검증
9. 접근성 검증 — 자료실 카드 키보드 navigation, 미디어 alt 텍스트 스크린 리더 검증, 다운로드 링크 aria-label
10. CLAUDE.md 변경 이력 entry + memory 갱신

**검수 게이트**: spec compliance + code-quality + **codex-rescue** + **coderabbit** + 위원장 VoiceOver 직접 검증

### M3 — 정리·접근성 (~ 1주, 약 8~10 tasks)

**목표**: 사이트 전반 정리 + 접근성 점검 + 문서 갱신.

**주요 task**:

1. 베타 라벨 잔재 정리 — M1에서 이미 EntryToggle·`(wiki)/layout.tsx` 헤더 제거 완료. M3는 *나머지 잔재* (위키 entry 본문 안내 문단·푸터·메타데이터 description·OG title 등) 점검·제거
2. 카피 통일 — 위키 = 본체 톤. "베타 단계입니다", "정식 메뉴는 우측 상단" 등 잔재 카피 정리. 푸터 카피 신규 작성
3. EntryToggle 정책 재검토 — 위키 본체화 후 토글이 여전히 의미 있는지. (a) 유지(시연 가치) (b) 헤더에서 제거 후 푸터에 "이전 사이트" 링크만 (c) 완전 제거 — 위원장 검토 후 spec/M3 plan에 반영
4. sitemap·OG·robots 갱신:
   - `src/app/sitemap.ts` 또는 동등 위치 — 위키 메인 + atomic + `/library` + `/media` + `/legacy/*` 노출 정책 결정 (legacy도 sitemap에 노출할지)
   - OpenGraph 메타데이터 — 위키 본체 정체성 반영
   - `robots.txt` — `/legacy/*` 크롤 정책 결정
5. 접근성 점검:
   - WCAG 2.1 AA — 색대비·키보드·focus 관리
   - 모바일 터치 타깃 44×44px
   - iOS VoiceOver + Android TalkBack 동작 검증
   - 자료실·미디어·역할별 진입점 카드 모두 위원장 직접 청취 검증
6. README·DIRECTION_2026·CLAUDE.md 갱신:
   - Phase 4 완료 entry
   - 시나리오 A 트랙 정합 framing
   - Phase 5(소셜 피드)로 밀린 기존 Phase 4 framing 갱신
7. 외부 인용 URL 호환성 최종 검증 — 중부대 회의 자료에 적힌 URL이 모두 정상 작동하는지 curl 일괄 점검
8. Phase 4 완료 PR commit message 작성 (CHANGELOG 형태)

**검수 게이트**: spec compliance + code-quality + **codex-rescue** + **coderabbit** + 위원장 VoiceOver 최종 검증

---

## 5. 영향 받는 파일·시스템 (사전 인벤토리)

### 5.1 라우트 mv (M1) — 디렉터리는 통째로 mv, 인덱스 page.tsx 단독 mv는 (file) 명시

| 현재 | M1 후 |
|------|-------|
| `src/app/(gov)/page.tsx` (file) | `src/app/(gov)/legacy/page.tsx` |
| `src/app/(gov)/about/` | `src/app/(gov)/legacy/about/` |
| `src/app/(gov)/support/` | `src/app/(gov)/legacy/support/` |
| `src/app/(gov)/rights/` | `src/app/(gov)/legacy/rights/` |
| `src/app/(gov)/stories/` | `src/app/(gov)/legacy/stories/` |
| `src/app/(gov)/participate/` | `src/app/(gov)/legacy/participate/` |
| `src/app/(gov)/resources/page.tsx` (file) | `src/app/(gov)/legacy/resources/page.tsx` |
| `src/app/(gov)/resources/policy/` | `src/app/(gov)/legacy/resources/policy/` |
| `src/app/(gov)/resources/statistics/` | `src/app/(gov)/legacy/resources/statistics/` |
| `src/app/(gov)/resources/law/page.tsx` (file, 인덱스 정적 안내) | `src/app/(gov)/legacy/resources/law-guide/page.tsx` (slug 변경) |
| `src/app/(gov)/resources/research/page.tsx` (file, 인덱스 정적 안내) | `src/app/(gov)/legacy/resources/research-guide/page.tsx` (slug 변경) |
| `src/app/(gov)/resources/law/[slug]/` (atomic) | `src/app/(wiki)/resources/law/[slug]/` |
| `src/app/(gov)/resources/research/[slug]/` (atomic) | `src/app/(wiki)/resources/research/[slug]/` |
| `src/app/disability-types/[slug]/` | `src/app/(wiki)/disability-types/[slug]/` |
| `src/app/policies/[slug]/` | `src/app/(wiki)/policies/[slug]/` |
| `src/app/agreements/[slug]/` | `src/app/(wiki)/agreements/[slug]/` |
| `src/app/domains/[slug]/` | `src/app/(wiki)/domains/[slug]/` |
| `src/app/regions/[slug]/` | `src/app/(wiki)/regions/[slug]/` |
| `src/app/uncategorized/[slug]/` | `src/app/(wiki)/uncategorized/[slug]/` |

### 5.2 신규 파일 (M2)

| 경로 | 책임 |
|------|------|
| `src/app/(wiki)/page.tsx` | `/` root entry — 위키 entry |
| `src/app/(wiki)/library/page.tsx` | 자료실 |
| `src/app/(wiki)/library/[category]/page.tsx` | 자료실 카테고리 상세 |
| `src/app/(wiki)/media/page.tsx` | 미디어 자료실 |
| `src/app/(wiki)/media/[slug]/page.tsx` | 미디어 상세 |
| `src/components/wiki/RoleEntries.tsx` | 역할별 진입점 5장 |
| `src/components/wiki/ChatLibraryMediaEntries.tsx` | 채팅·자료실·미디어 진입 카드 |
| `src/components/library/LibraryCard.tsx` | 자료 카드 |
| `src/components/library/LibrarySearch.tsx` | 자료실 검색 필터 |
| `src/components/media/MediaCard.tsx` | 미디어 카드 |
| `src/components/media/MediaDetail.tsx` | 미디어 상세 (alt + 다운로드) |
| `src/lib/wiki-role-entries.ts` | 역할별 진입점 시드 (D6 placeholder) |
| `src/lib/library-categories.ts` | 자료실 카테고리·자료 매핑 (D6 placeholder) |
| `src/lib/media-curation.ts` | 미디어 노출 자산 (D6 placeholder) |
| `src/lib/atomic-source-map.ts` | atomic 페이지 source frontmatter → 원본 파일 매핑 |

### 5.3 갱신 파일 (M1+M2+M3)

| 파일 | 변경 |
|------|------|
| `next.config.ts` | `redirects()` 등록 (M1) |
| `src/app/layout.tsx` | metadata 정합 (M3) |
| `src/lib/navigation.ts` | 모든 href `/legacy/` prefix (M1) |
| `src/lib/wiki-popular.ts` | 변경 0 (atomic URL 보존) |
| `src/components/layout/Header.tsx` | `/` 링크 → `/legacy`, EntryToggle 정책 (M1+M3) |
| `src/components/layout/Footer.tsx` | 그대로 (M1), 카피 정리 (M3) |
| `src/components/wiki/EntryToggle.tsx` | 라벨·링크·베타 라벨 (M1) |
| `src/app/(wiki)/layout.tsx` | 헤더 로고·네비·푸터 카피 (M1+M3) |
| `src/app/(wiki)/wiki/page.tsx` | 삭제 또는 redirect (M1) |
| `src/components/kb/KbPageLayout.tsx` (또는 동등) | 원본 다운로드 링크 footer 추가 (M2) |
| `src/app/(gov)/legacy/**/page.tsx` (11 파일) | 내부 링크 `/legacy/` prefix (M1) |
| `src/lib/rag/retrieval.ts` `sourcePathToHref` | 변경 0 (콘텐츠 경로·URL 보존) |
| `src/app/sitemap.ts` | `/library`·`/media`·`/legacy` 정책 (M3) |
| `CLAUDE.md` (gitignored, Edit/Write만) | 변경 이력 (M1+M2+M3 각각) |
| `docs/DIRECTION_2026.md` | Phase 4 entry 갱신 (M3) |
| `README.md` | Phase 표 갱신 (M3) |

### 5.4 변경 0 (보존)

- `src/lib/rag/retrieval.ts` 로직 (sourcePathToHref 포함)
- `src/lib/rag/embed-query.ts`, `types.ts`, `prompt-builder.ts`
- `src/app/api/chat/route.ts`
- `content/**/*.md` (콘텐츠 정본)
- `data/source-pdf/`, `data/source-md/` (원본 자산)
- `supabase/migrations/*` (스키마)
- Phase 3 M4·M5·M6 채팅 UI·히스토리 코드
- Phase 3 M7 진행 중인 파일 첨부·음성 작업

---

## 6. 위험 매핑 + Carry-over

| ID | 위험 | 가능성 | 영향 | 대응 |
|----|------|--------|------|------|
| R1 | atomic resources 라우트 mv 시 RAG 채팅 출처 링크 404 | 낮 | 중 | sourcePathToHref 변경 0 + RUN_SMOKE=1 검증 + 통합 테스트 추가. URL 보존 결정으로 위험 자체 차단 |
| R2 | `/legacy/resources/law` (정적) vs `/resources/law/[slug]` (atomic) URL 충돌 | 중 | 중 | 정적 안내 인덱스 slug 변경 (`/legacy/resources/law-guide`) — M1 task 4 |
| R3 | 외부 인용·중부대 회의 자료 URL 호환성 | 중 | 중 | 영구 redirect (`next.config.ts redirects()`) + curl 검증 |
| R4 | 큐레이션 placeholder 빈 카드 노출 | 중 | 중 | 위원장 임시 시드 5건 + Phase 1.5b 검증된 raster 7건. 허유진 교수 협업 결과 들어오면 별도 PR |
| R5 | 디렉터리 mv 한 commit이 너무 큼 (git history 가독성) | 중 | 낮 | `git mv` per 디렉터리로 task 분리. 디렉터리당 1 commit |
| R6 | Phase 3 M7 진행 중 file overlap | 낮 | 중 | M7는 채팅 입력 영역, Phase 4는 라우팅·entry·자료실·미디어. file overlap 0건. 그러나 master sha 분기 회피 위해 M7 머지 대기 후 Phase 4 진입 또는 rebase 전략 |
| R7 | Vercel KHUDT Pro 결제 락(케이스 `01ZB5aczzV9bxDOo`) — 임시 회귀 중 production에 영향 | 중 | 중 | M1·M2·M3 머지는 engccer Hobby에서도 빌드 가능. KHUDT 복귀 시 코드 무변경 회귀 |
| R8 | EntryToggle 정책 (유지 vs 제거)이 M1에 박힘 → M3에서 재검토 | 낮 | 낮 | M1은 라벨·링크 갱신만, 제거 결정은 M3 정리 단계 |
| R9 | sitemap·OG·robots에서 `/legacy/*` 노출 정책 미결 | 중 | 중 | M3 task 4에서 결정. 시안: legacy는 noindex (검색 노출 X) + sitemap 미포함 + robots disallow |
| R10 | 콘텐츠 경로 재구성을 *미루는* 위원장 원칙 위반 가능성 (D4가 *유지* 결정) | 낮 | 낮 | D4 §3.2 정합 — 라우트 mv만 했고 콘텐츠 경로·URL 보존. *재구성*은 본 spec 범위 밖. Phase 5+에서 별도 검토 |
| R11 | Agent Teams 베타 제약 — `/resume` 미지원·작업 상태 지연·동작 변경 가능 | 중 | 중 | 처음 호출 전 https://code.claude.com/docs/en/agent-teams 확인. 세션 끊기면 *팀 리더가 단독 fallback*으로 잔여 task 처리. 마일스톤 안 task별 commit 자주(체크포인트 효과). 디스플레이 모드는 tmux(터미널 가시성) 우선 |
| R12 | Agent Teams 팀원 file lock — 동일 파일 편집 시 직렬화 | 중 | 중 | M1·M2·M3 spec의 §5 파일 인벤토리에서 *팀원별 file scope를 사전 분리*. 팀 리더가 dispatch 시 각 팀원 prompt에 *내 scope 외 파일 편집 금지* 박음. M2의 wiki entry는 *팀 리더 단독* 또는 *마지막 통합 task*로 격리 |

### Carry-over (Phase 5+ 후보)

- atomic 콘텐츠 경로 재구성 — `content/resources/law/*.md`을 axis 일관성 따라 `content/resources/*.md` flat 또는 새 패턴으로 (URL도 함께 변경, redirect 필요)
- 위키 entry의 *장애유형별 큐레이션 페이지* (`/wiki/by-disability` 등) — 다중 axis 큐레이션
- 자료실의 *PDF 메타데이터 자동 추출* — `data/source-pdf/`에서 제목·연도·태그 OCR/parse
- 미디어 자료실의 *멀티모달 임베딩* (장기 과제 §장기 과제와 정합)
- 모바일 PWA 강화 (장기 과제와 정합)

---

## 7. 검수 게이트 (마일스톤별)

각 마일스톤은 다음 4단계 검수를 거친다 (CLAUDE.md "마일스톤 단위 codex-rescue dispatch" 행동 규칙 정합):

| 단계 | 시점 | scope |
|------|------|------|
| (1) spec compliance reviewer | task별 implementer 완료 직후 | 본 spec과의 정합 검증 |
| (2) code-quality reviewer | task별 spec compliance 통과 후 | 라인 단위 품질 |
| (3) **codex-rescue** | 마일스톤 완료 직전 (PR 생성 전) | cross-cutting invariant, 아키텍처, 도메인 규칙. 본 spec의 §6 위험 매핑 + D1~D7 결정 정합 확인 |
| (4) **coderabbit** | PR 생성 후 | 스타일·관용구·일반 안티패턴 |
| (5) 위원장 직접 검증 | M1: production preview 라우팅 / M2: VoiceOver entry·자료실·미디어 / M3: 최종 접근성 | 시각장애인 사용자 직접 검증 (JSDOM·Playwright로 대체 불가) |

3중 리뷰 over-fix 방지 원칙 (CLAUDE.md §Agent Teams 3중 리뷰 over-fix 방지 정합):
- codex-rescue와 coderabbit이 *같은 결함*을 지적하면 codex-rescue 우선
- 같은 영역에 같은 종류 패치가 *2라운드 이상 반복*되면 즉시 멈추고 계층 선택 재검토

---

## 7.5 Agent Teams 운영 (D8)

CLAUDE.md §Agent Teams 자동 호출 판단 행동 규칙 정합. Phase 4는 *경계선 케이스*(DB·외부 API 변경 없음, 단 다중 신규 기능 동시 도입)지만 작업 단위 트리거 (a)(b) 충족으로 발동.

### 7.5.1 발동 시점

- **writing-plans 단계 = 단독** (팀 리더 1명, plan 1개 문서)
- **executing-plans 단계 = Agent Teams 발동** (task별 독립 구현)
- **마일스톤 마무리 검수 = 단독** (codex-rescue + coderabbit + 위원장 직접 검증)

### 7.5.2 팀 구성 (M1·M2·M3 공통 패턴)

| 역할 | 책임 | scope (file 단위로 사전 분리) |
|------|------|---------------------------|
| **팀 리더** (위원장 sponsor + 인터페이스 verifier 겸임) | (a) baseline initial commit 단독 수행 (예: M1 디렉터리 mv) (b) 팀원 dispatch + scope 명시 (c) 팀원 결과 통합·인터페이스 정합성 verify (d) 마일스톤 마무리 codex-rescue+coderabbit 직접 진행 | baseline file + 통합 file (마지막) |
| 팀원 A | 라우팅·라우트 그룹 핵심 (예: M1 atomic axis 통합 + (wiki) root entry 신설) | `src/app/(wiki)/**`, `src/app/[axis]/**` |
| 팀원 B | UI 카피·내부 링크·layout (예: M1 navigation·Header·EntryToggle·11개 페이지 내부 링크) | `src/components/**`, `src/lib/navigation.ts`, `(gov)/legacy/**/page.tsx` |
| 팀원 C | 인프라·검증·문서 (예: M1 next.config.ts redirects + 빌드·smoke 검증 + 통합 테스트 + CLAUDE.md 변경 이력) | `next.config.ts`, `tests/**`, `CLAUDE.md`, `docs/**` |
| (내부 Reviewer **미배치**) | over-fix 회피 (CLAUDE.md §Agent Teams 3중 리뷰 over-fix 방지). 팀 리더가 인터페이스 verifier 겸임 | — |

### 7.5.3 file scope 사전 분리 — 동일 파일 편집 회피

각 마일스톤 plan(writing-plans 산출물)에 *팀원별 file scope 표*를 박는다. 팀 리더 dispatch 시 각 팀원 prompt에 *내 scope 외 파일 편집 금지* 명시. *통합 file*(예: M2 위키 entry 페이지가 RoleEntries·ChatLibraryMediaEntries·PopularPages 등 다 import)은 *팀 리더가 마지막 task로 단독 작성*하여 file lock 충돌 차단.

### 7.5.4 팀 리더 prompt 원칙

- *scope 한정 명시*: "팀원 A scope = src/app/(wiki)/**. 다른 파일 편집 금지. 결과는 commit으로 push 후 리포트."
- *내부 Reviewer 금지 명시*: "라인 스타일·도메인 invariant·보안 코멘트 하지 말 것. 인터페이스 정합성만."
- *베타 제약 대비*: 각 팀원 task는 *체크포인트 commit 단위* 짧게. 세션 끊기면 팀 리더가 fallback 가능.

### 7.5.5 마일스톤 마무리

- 팀원 작업 통합 후 *팀 리더 단독*으로 codex-rescue 호출 (background `codex:codex-rescue` subagent)
- codex-rescue critical fix 처리 후 PR 생성
- PR에 coderabbit 자동 review
- coderabbit critical fix 처리
- 위원장 직접 검증 (M1: production preview / M2: VoiceOver entry·자료실·미디어 / M3: 최종 접근성)

### 7.5.6 활성화 전 확인사항

처음 호출 전 다음 확인:

- 환경변수 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 설정
- 디스플레이 모드 = `tmux` (터미널 가시성 우선)
- https://code.claude.com/docs/en/agent-teams 최신 문서 확인 (베타 단계 동작 변경 가능)
- 위원장에게 알려진 제약 고지 (`/resume` 미지원·작업 상태 지연)

---

## 8. 다음 단계

1. **위원장 spec 검토** — 본 문서 검토 + (a) D1~D7 결정 잠금 ack (b) 임시 시드 5건 지정 (역할별 진입점 카드) (c) EntryToggle 정책 (M3에서 재검토) 의견
2. **spec PR 생성** — `docs/phase-4-wiki-renewal-spec` 브랜치 → master 머지
3. **writing-plans 스킬 invoke** — M1 plan 작성 (첫 마일스톤만)
4. **M1 plan 위원장 검토 + 머지**
5. **Agent Teams 사전 확인** — 환경변수·디스플레이 모드·최신 docs 점검 (§7.5.6)
6. **executing-plans + Agent Teams 발동**으로 M1 구현 진입 (팀 리더 + 팀원 A/B/C, 내부 Reviewer 미배치)
7. M1 머지 후 M2 plan → 구현. M2 머지 후 M3 plan → 구현. 각 마일스톤마다 codex-rescue + coderabbit + 위원장 직접 검증
7. Phase 4 전체 완료 후 위원장 자문 의견서 재발행 (시나리오 A 본격 진입 자료)

---

## 9. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-27 | 초안 — 위원장 brainstorming 결과 (D1~D7) 결정 잠금 + 마일스톤 분해 + 라우트 트리 + 위험 매핑 |
| 2026-05-27 | Agent Teams 운영 섹션 추가 — D8 결정 잠금, §7.5 신설(팀 구성·file scope 분리·팀 리더 prompt 원칙·활성화 전 확인), R11·R12 위험 추가, §8 다음 단계 갱신 |
