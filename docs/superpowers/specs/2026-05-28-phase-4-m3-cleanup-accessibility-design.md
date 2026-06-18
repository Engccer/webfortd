# Phase 4 M3 — 정리·접근성 설계 (2026-05-28)

> **상위 문서**: `docs/DIRECTION_2026.md` · `docs/superpowers/specs/2026-05-27-phase-4-wiki-renewal-design.md`
> **선행 마일스톤**: M1 라우팅·IA 기반 (PR #45 `ef0b3ed`) · M2 콘텐츠 기능 (PR #47 `31ffbca`) · PR #48 `function_size_exceeded` 응급 fix (`597767a`)
> **본 마일스톤 종료 조건**: PR A·B 모두 머지 + production deploy 검증 + 위원장 VoiceOver 검수 완료 → Phase 4 완료 선언

---

## 1. 개요·목표

Phase 4 위키 리뉴얼의 **마무리 마일스톤**. 신규 기능 0건, 외부 의존성 추가 2건(`@supabase/storage-js` 재사용 + `@axe-core/playwright` 신규 dev dep + Playwright 신규 dev dep).

**3대 목표**:
1. **SEO 가시성** — sitemap·robots·OG로 검색 엔진과 SNS가 위키 리뉴얼된 IA를 색인하도록 게이트 통과.
2. **접근성 게이트** — axe-core CI(자동) + 위원장 VoiceOver(수동) 분담으로 WCAG 2.1 AA 회귀 차단.
3. **자산 근본 정리** — `public/library/` PDF 4건(41MB)을 Supabase Storage로 이관, `outputFileTracingExcludes` 응급 우회 제거.

**Phase 4 정체성 정합**: 본 마일스톤은 *기존 자산 정리* — 위키 IA(M1) + 콘텐츠 진입점(M2)이 *시연 가능한 상태*에 도달했으므로, 외부 노출 게이트(SEO·SNS·접근성)와 인프라 근본 해결을 동시에 끝낸다. M2까지의 "코드 무변경 시드 교체 가능" 협업 영역(D6)은 본 마일스톤에서 건드리지 않는다.

---

## 2. 사업 맥락 정합

- **시나리오 A 1차 트랙**(2026-05-27 중부대 합의): 본 마일스톤이 완료되면 webfortd가 *시범 모델 + 접근성 게이트 통과 + 검색 가시성*까지 갖춰진 상태로 알리의 접근성 연구소·에스앤씨랩 견적 검증 자료가 된다.
- **에스앤씨랩 평가 사전 준비**: axe-core CI는 *자체 자동 회귀 가드*이지 *정식 평가의 대체*가 아니다. 정식 평가는 에스앤씨랩이 외부 기준으로 수행. 본 axe-core는 *개발 중 회귀 조기 차단*용.
- **모바일 접근성 (CLAUDE.md §접근성 원칙)**: 위원장 VoiceOver 검수는 iOS 모바일 환경에서 수행 — 모바일 1차 시민 원칙 정합.

---

## 3. 결정 잠금 (D1~D8)

세션 brainstorming Q1~Q6에서 결정됨.

| ID | 결정 | 근거 |
|----|------|------|
| **D1** | PDF Supabase Storage 마이그레이션 = **M3 초반** | "이른 단계에 처리" 원칙 (memory: feedback_early_processing_principle). carry-over 무한 미루기 방지 |
| **D2** | sitemap 범위 = **전부 포함** ((wiki) entry 4 + atomic 535 + library 5 + media 2 + (gov)/legacy/*) | 검색 엔진이 atomic 직접 색인 → RAG 외 검색 유입 확보 |
| **D3** | OG image = **정적 1장 placeholder** (`app/opengraph-image.png` 1200×630) | 시범 단계 적정 비용. 정식 디자인은 별도 PR (위원장 ↔ 디자이너), 코드 무변경 교체 |
| **D4** | WCAG 검증 = **axe-core CI + 위원장 VoiceOver** | 자동(회귀 차단) + 수동(실제 사용자 경험) 분담. axe-core는 critical/serious 0건, moderate/minor는 향후 큐 |
| **D5** | 운영 패턴 = **단독 Agent (Agent Teams 미발동) + codex-rescue (b) skip + admin squash merge** | M1·M2 패턴 정합. task별 단순성 + cross-cutting invariant 낮음 |
| **D6** | PR 분리 = **2개** (PR A = PDF Storage / PR B = SEO+a11y) | URL 변경의 외부 영향 격리. A 머지 후 deploy 검증 → B 시작 |
| **D7** | Storage bucket = **`library`** (RLS: public read + service_role write only) | 익명 다운로드 OK + 익명 upload 차단 |
| **D8** | a11y 테스트 라우트 = **6 + atomic 샘플 3** (`/` · `/chat` · `/library` · `/media` · `/library/2023-hr-guide` · `/legacy/about` + axis별 atomic 1건 무작위) | 핵심 흐름 cover + atomic 535 회귀 샘플링. CI 시간 +1~2분 cap |

---

## 4. 아키텍처

### 4.1 작업 영역 6종

| # | 영역 | 산출물 | 의존성 |
|---|------|--------|--------|
| 1 | PDF 외부 저장 | Supabase Storage `library` 버킷 + `scripts/upload-library.ts` | Supabase admin client (`src/lib/supabase/admin.ts` 재사용) |
| 2 | URL 갱신 | `src/lib/library-catalog.ts` downloadUrl → Storage public URL | NEXT_PUBLIC_SUPABASE_URL 환경변수 |
| 3 | 응급 우회 제거 | `public/library/*.pdf` git rm + `next.config.ts` excludes 제거 | A1~A2 머지 후 |
| 4 | SEO | `src/app/sitemap.ts` + `src/app/robots.ts` | `kb-index.generated.json` (atomic 535) + `library-catalog.ts` + `media-curation.ts` |
| 5 | OG | `src/app/opengraph-image.png` + 메타 정합 (root layout openGraph 필드) | placeholder 디자인 |
| 6 | 접근성 | `@axe-core/playwright` + Playwright + `tests/a11y/*.spec.ts` + `.github/workflows/a11y.yml` + `docs/VOICEOVER_CHECKLIST.md` | dev server 기동 (CI playwright 기본 패턴) |

### 4.2 스택

- **Next.js 16 metadata API**: `sitemap.ts`, `robots.ts`, `opengraph-image.png` 모두 file-based convention. 빌드 시 정적 자산으로 변환.
- **Supabase Storage**: 이미 운영 중인 webfortd-prod 프로젝트 활용. `@supabase/storage-js`는 `@supabase/supabase-js`에 포함 — 신규 dependency 0.
- **axe-core**: `@axe-core/playwright` + `@playwright/test` 두 패키지 신규 dev dep. Playwright 브라우저 바이너리는 npm install 시 자동 설치되지 않음 — 로컬·CI 모두 `npx playwright install chromium` 1회 명시 실행 필요 (약 170MB chromium만, firefox/webkit 제외).

### 4.3 데이터 흐름

**PR A (PDF Storage)**:
```
public/library/*.pdf (4 files, 41MB)
  ↓ npm run library:upload (service_role)
Supabase Storage bucket "library"
  ↓ public URL
${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/library/*.pdf
  ↓ library-catalog.ts downloadUrl
LibraryGrid/LibraryDetail/atomic footer (KbSourceFooter)
  ↓ user click
Supabase Storage CDN (외부 다운로드)
```

**PR B (SEO+a11y)**:
```
kb-index.generated.json (535 atomic)
  + library-catalog.ts (4 PDF)
  + media-curation.ts (1 media)
  + (wiki)/(gov) static routes (~14)
  ↓ app/sitemap.ts
/sitemap.xml (≥540 URLs)
  ↓ Google Search Console·Bing Webmaster

app/robots.ts → /robots.txt → Sitemap 참조
app/opengraph-image.png → og:image 메타 → SNS 카드 미리보기

tests/a11y/*.spec.ts (Playwright + axe-core)
  ↓ GitHub Actions
.github/workflows/a11y.yml (PR마다 실행)
  ↓ 결과
PR comment: critical/serious 0건 ✓
```

---

## 5. PR 분리·작업 순서

### PR A — PDF Storage 마이그레이션

| T | 작업 | 산출물 | 검증 |
|---|------|--------|------|
| A1 | Supabase Storage 버킷 `library` 생성 + RLS 정책 (마이그레이션 SQL) | `supabase/migrations/0010_storage_library_bucket.sql` | dashboard storage 탭 확인 + `select * from storage.buckets where id='library'` |
| A2 | 업로드 스크립트 작성 (idempotent — 해시 비교 후 skip) | `scripts/upload-library.ts` + `package.json` `library:upload` script | `npm run library:upload` → 4 file 업로드 완료 + 재실행 시 4건 skip |
| A3 | `library-catalog.ts` downloadUrl 갱신 (Storage public URL) + 기존 prefix 가드 테스트 수정 | `src/lib/library-catalog.ts` + `tests/library/library-catalog.test.ts` | unit test PASS (`/library/` prefix → Storage URL prefix 검증으로 갱신) |
| A4 | `public/library/*.pdf` git rm (`.gitkeep` 유지) + `next.config.ts` `outputFileTracingExcludes` 블록 제거 | git diff: -4 PDF + next.config.ts -3줄 | `curl -I` 4 PDF URL 200 + Content-Type=application/pdf + production deploy READY |

**A의 위험·검증 포인트**:
- A1 RLS는 마이그레이션 SQL로 박는다 (`storage.objects` policies). dashboard 수동 클릭 금지 — 재현 불가 차단.
- A2는 service_role key 사용 (다른 환경에서 재실행 시 동일 동작 보장).
- A3 테스트는 *prefix 검증을 Storage URL 패턴으로 갱신* (예: `${url}.startsWith(`${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/library/`)`).
- A4 머지 후 첫 production deploy는 PDF 파일이 함수 bundle 트레이싱에서 빠졌는지 확인 (`vercel inspect` deploy log).

### PR B — SEO·접근성 게이트

| T | 작업 | 산출물 | 검증 |
|---|------|--------|------|
| B1 | `src/app/sitemap.ts` — 모든 라우트 동적 생성 | atomic 535 + library 5 + media 2 + (wiki) entry 4 + (gov)/legacy 9 ≈ 555 URL | production `/sitemap.xml` URL count ≥ 540 |
| B2 | `src/app/robots.ts` — `Allow: /` + Sitemap 참조 | `/robots.txt` 한 줄 generation | 정합 텍스트 fetch |
| B3 | `src/app/opengraph-image.png` + root layout `openGraph` metadata 정합 | 1200×630 PNG (placeholder, 단순 배경 + 서비스명 + 로고 텍스트) | production HTML head `<meta property="og:image">` fetch + 이미지 URL 200 응답 |
| B4 | `@axe-core/playwright` + `@playwright/test` dev dep + `tests/a11y/*.spec.ts` (D8 9 라우트) | `tests/a11y/critical-routes.spec.ts` + `tests/a11y/atomic-samples.spec.ts` | `npx playwright test --project=chromium` → critical/serious 0건 |
| B5 | `.github/workflows/a11y.yml` — PR마다 axe-core 실행 | workflow 파일 + Playwright 캐시 설정 | CI 그린, 시간 +1~2분 |
| B6 | `docs/VOICEOVER_CHECKLIST.md` — 위원장 10분 검수 체크리스트 | markdown 7 step (skip-link → 헤더 nav → 위키 hero → 자료실 → atomic → 채팅 → 모바일 회전) | 위원장 검수 후 결과 메모 |

**B의 위험·검증 포인트**:
- B1 sitemap 생성 비용은 Next.js 16 빌드 시 1회만 — 런타임 0 (정적 자산화). 빌드 시간 +5~10초 가능.
- B3 placeholder는 디자인 평가가 아닌 *메타데이터 정합 검증*용. 정식 디자인은 별도 PR로 PNG 파일만 교체 (코드 무변경).
- B4 axe-core 실패 시 — *critical/serious 발견 = M3 머지 차단 사유*. 위원장에게 보고 후 fix 분기.
- B5 GitHub Actions는 PR마다 dev server 기동 (`npm run build && npm run start`) → axe-core 실행. 시간 cap을 위해 `--project=chromium`만 (firefox/webkit 미설치).
- B6 VoiceOver 검수 결과는 git commit으로 남기지 않고 자문 디렉터리(`2026/`)에 보관.

### 작업 dependency

```
A1 → A2 → A3 → A4 (직렬)
B1 · B2 · B3 (병렬)
B4 → B5
B6 (독립)
PR A 머지 + production deploy 검증 → PR B 시작
```

---

## 6. 영향 파일 인벤토리

### 6.1 신규 파일

- `supabase/migrations/0010_storage_library_bucket.sql` (A1)
- `scripts/upload-library.ts` (A2)
- `src/app/sitemap.ts` (B1)
- `src/app/robots.ts` (B2)
- `src/app/opengraph-image.png` (B3, placeholder)
- `tests/a11y/critical-routes.spec.ts` (B4)
- `tests/a11y/atomic-samples.spec.ts` (B4)
- `tests/a11y/axe-helper.ts` (B4, 공통 헬퍼)
- `playwright.config.ts` (B4)
- `.github/workflows/a11y.yml` (B5)
- `docs/VOICEOVER_CHECKLIST.md` (B6)

### 6.2 수정 파일

- `src/lib/library-catalog.ts` (A3, downloadUrl 갱신)
- `tests/library/library-catalog.test.ts` (A3, prefix 가드 갱신)
- `public/library/*.pdf` git rm (A4, 4건)
- `public/library/.gitkeep` 유지 (A4)
- `next.config.ts` (A4, `outputFileTracingExcludes` 블록 제거)
- `src/app/layout.tsx` (B3, root metadata `openGraph` 필드 정합)
- `package.json` (A2 script + B4 dev dep + B4 test script)
- `package-lock.json` (B4)

### 6.3 부수 갱신

- `CLAUDE.md` — Phase 4 M3 머지 entry 추가 (gitignored, Edit/Write만)
- `MEMORY.md` — Quick Reference에 M3 + Phase 4 완료 선언 추가
- `memory/project_phase_status.md` — Phase 4 종료 entry 추가

---

## 7. 위험 매핑 (R1~R6)

| R | 위험 | 가능성 | 영향 | 대응 |
|---|------|--------|------|------|
| **R1** | Storage bucket 권한 오설정 — 익명 write 허용 | 낮음 | 높음 (데이터 무결성) | A1 마이그레이션 SQL로 RLS 명시 (`policy ... using (false)` for INSERT/UPDATE/DELETE except service_role). dashboard 수동 클릭 금지 |
| **R2** | 기존 `/library/*.pdf` 외부 백링크 깨짐 | 매우 낮음 (시범 단계) | 중간 (외부 인용 시) | A4 머지 직전 외부 인용 확인 (`webfortd.vercel.app/library/` Google 검색). 0건이면 무대응, 발견 시 `next.config.ts` `redirects()` 추가 |
| **R3** | sitemap 535건 동적 생성 비용 | 매우 낮음 | 매우 낮음 | Next.js 16 빌드 시 1회 정적 — 런타임 0. 빌드 시간 +5~10초 가능 |
| **R4** | OG placeholder 품질 낮음 | 확정 (의도) | 낮음 (시범) | D3 컨센서스. 정식 디자인 별도 PR (위원장 ↔ 디자이너), 코드 무변경 |
| **R5** | axe-core CI 시간 +1~2분 | 확정 | 낮음 | D8 라우트 9개 cap. 추가 라우트는 sampling. CI 캐시(Playwright browser binaries) 적극 활용 |
| **R6** | VoiceOver 검수 위원장 시간 부담 | 중간 | 낮음 | 체크리스트 10분 cap. iPhone/iPad 1대만 검수. 결과 메모 자유 형식 |

### 추가 운영 위험

- **R-OP1**: KHUDT Vercel 결제 락 동안 production deploy 검증은 engccer Hobby scope로 (M1·M2 패턴 정합). KHUDT 복귀 시 5~15분 내 재배포 가능. PR A에 *engccer scope 자동 배포 → readyState=READY 확인* 단계 박음.
- **R-OP2**: codex-rescue (b) skip → cross-cutting invariant 누락 가능성. 본 마일스톤은 작업 isolated이므로 위험 낮지만, *위원장 VoiceOver 검수가 사실상 final gate* 역할 — 검수 결과 P0 발견 시 별도 PR fix.

---

## 8. 테스트 전략

### 8.1 자동 (CI)

| 영역 | 도구 | 통과 기준 |
|------|------|----------|
| Unit | `node:test` (기존) | 230 unit (M2 baseline) + 신규 (sitemap·robots 함수 unit 4건 예상) |
| Integration | `node:test` migrations (기존) | 35 integration baseline 유지 |
| Routing | `tests/routing/wiki-renewal-routes.test.ts` (기존) + a11y spec 라우트 도달 가드 | 신규 라우트 존재 확인 |
| a11y | `@axe-core/playwright` (신규) | D8 9 라우트 critical/serious 0건 |
| Build | `next build` | 정적 페이지 ≥ 577 (M2 baseline 유지) + sitemap.xml 빌드 산출물 존재 |

### 8.2 수동 (위원장)

- VoiceOver 체크리스트 7 step (iPhone Safari):
  1. `/` 진입 → skip-link Tab 1회 → main-content 점프
  2. 헤더 nav 키보드 순회 (Tab/Shift+Tab)
  3. 위키 entry hero · RoleEntries 5장 카드 → 각 카드 aria-label 의미 명확
  4. `/library` → 카드 4장 + 검색 input 키보드
  5. `/library/2023-hr-guide` → atomic footer "원본 자료" 다운로드 링크 도달
  6. `/chat` → 입력창 focus + 추천 버튼 키보드 + 응답 카드 aria-live
  7. 모바일 회전 (세로 → 가로) → 레이아웃 깨짐 X

### 8.3 production 검증

- 8 라우트 200 + sitemap.xml URL count ≥ 540 + robots.txt 정합 + 4 PDF Storage URL 200 + og:image 메타 정합 + axe-core CI 그린

---

## 9. 운영 (D5 정합)

### 9.1 Agent Teams

**미발동**. M3 task별 단순성 (sitemap·robots·OG·axe-core 모두 isolated, cross-cutting invariant 낮음) + M1·M2 패턴 정합. 단독 진행.

### 9.2 codex-rescue

**(b) skip + 직접 검수 대체**. 글로벌 `~/.claude/CLAUDE.md` §"codex-rescue 무한 루프 회피" 학습 정합. 직접 검수 = D8 a11y 라우트 9건 + 위원장 VoiceOver + production 8 라우트 + sitemap.xml URL count + og:image 메타 = invariant 5축 모두 자체 확인.

### 9.3 CI 우회

KHUDT Vercel 결제 락 동안 — admin squash merge (`gh pr merge <N> --admin --squash --delete-branch`). engccer Hobby scope 자동 배포 trigger. KHUDT 복귀 시 케이스 `01ZB5aczzV9bxDOo` 회신 + 5~15분 재배포.

### 9.4 머지 순서

1. PR A 작성 → CI validate PASS → admin squash merge (Vercel FAIL = 결제 락 이슈, 무시) → engccer Hobby production deploy 확인 → 8 라우트 + 4 PDF Storage URL 200 검증
2. (검증 통과) → PR B 작성 → CI validate PASS + axe-core CI 그린 → admin squash merge → production deploy 확인 → sitemap.xml + robots.txt + og:image + a11y 5축 검증
3. 위원장 VoiceOver 검수 (iPhone, 10분) → 결과 메모 → **Phase 4 완료 선언**

---

## 10. Phase 4 종료 조건

| 조건 | 검증 |
|------|------|
| PR A 머지 + production deploy READY | `vercel ls --prod` + `curl -I` 4 PDF Storage URL |
| PR B 머지 + production deploy READY | `vercel ls --prod` + `curl -I` 8 라우트 + sitemap.xml + robots.txt |
| `outputFileTracingExcludes` 응급 우회 제거 완료 | `next.config.ts` diff 확인 |
| axe-core CI 그린 (PR B 이후 모든 PR에서) | `.github/workflows/a11y.yml` 실행 결과 |
| 위원장 VoiceOver 7 step 통과 | 자문 디렉터리 |

위 5건 모두 충족 → Phase 4 완료. 다음 단계는 위원장 명시 신호 후 Phase 5 (TTS·이미지 alt 자동생성) 또는 사업 진척에 따른 우선순위 재정의.

---

## 11. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-28 | 초기 작성 — brainstorming Q1~Q6 결정 잠금 + PR 2개 분리 + 위험 매핑 + 운영 정합 |
