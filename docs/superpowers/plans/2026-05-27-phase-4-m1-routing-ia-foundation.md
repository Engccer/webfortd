# Phase 4 M1 — 라우팅·IA 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: spec §7.5 정합 — `superpowers:executing-plans` + **Agent Teams** 발동(팀 리더 + 팀원 A/B/C, 내부 Reviewer 미배치). 일부 task는 *팀 리더 단독*(baseline mv), 나머지는 팀원 dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** webfortd 라우트 트리를 위키·채팅 중심 본체로 재구성한다 — atomic axis namespace 통합 + (gov) → /legacy/ 보존 + `(wiki)/page.tsx` root entry 신설 + 호환성 영구 redirect.

**Architecture:** Next.js 16 Route Groups를 이용해 단일 코드베이스 안에서 (wiki) = 본체, (gov)/legacy = 보조 시연 자산으로 분리. atomic 콘텐츠는 (wiki) 그룹 안 axis namespace에 정합. URL과 콘텐츠 경로(content/**/*.md)는 보존하여 RAG `sourcePathToHref` 변경 0. 기존 URL은 `next.config.ts redirects()`로 영구 redirect.

**Tech Stack:** Next.js 16 (App Router · Route Groups · redirects), React 19, TypeScript strict, node:test (`tsx`), Tailwind CSS 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-27-phase-4-wiki-renewal-design.md` (D1~D8 결정 잠금)

**File scope 사전 분리 (spec §7.5.3 정합 — Agent Teams file lock 회피)**:

| 팀원 | scope (편집 허용 파일) |
|------|---------------------|
| 팀 리더 | `src/app/(wiki)/page.tsx` (신설, 통합 file), `src/app/(wiki)/wiki/page.tsx` (삭제), baseline 디렉터리 mv 전부 |
| 팀원 A (라우팅) | `src/app/(wiki)/**` 신규 import path·layout 정합 검증 (mv 직후 빌드 통과 책임) |
| 팀원 B (UI 카피·링크) | `src/components/wiki/EntryToggle.tsx`, `src/components/layout/Header.tsx`, `src/app/(wiki)/layout.tsx`, `src/lib/navigation.ts`, `src/app/(gov)/legacy/**/page.tsx` 내부 자기-참조 링크 |
| 팀원 C (인프라·검증·문서) | `next.config.ts`, `tests/routing/**` (신규), `CLAUDE.md`, `docs/superpowers/plans/**` |

---

## File Structure

### 신규 파일

| 파일 | 책임 |
|------|------|
| `src/app/(wiki)/page.tsx` | `/` root entry — 위키 entry (현 `(wiki)/wiki/page.tsx` 내용 이동 + 베타 안내 문단 삭제). 통합 file이라 팀 리더 단독 |
| `tests/routing/legacy-redirects.test.ts` | next.config redirects() 회귀 가드 통합 테스트 |
| `tests/routing/atomic-routes.test.ts` | atomic axis 라우트 (wiki) 그룹 통합 후 build artifact 회귀 가드 |

### 디렉터리 mv (한 task당 한 commit)

| 현재 | 이동 후 | task |
|------|--------|------|
| `src/app/disability-types/[slug]/` | `src/app/(wiki)/disability-types/[slug]/` | T1 |
| `src/app/policies/[slug]/` | `src/app/(wiki)/policies/[slug]/` | T1 |
| `src/app/agreements/[slug]/` | `src/app/(wiki)/agreements/[slug]/` | T1 |
| `src/app/domains/[slug]/` | `src/app/(wiki)/domains/[slug]/` | T1 |
| `src/app/regions/[slug]/` | `src/app/(wiki)/regions/[slug]/` | T1 |
| `src/app/uncategorized/[slug]/` | `src/app/(wiki)/uncategorized/[slug]/` | T1 |
| `src/app/(gov)/resources/law/[slug]/` | `src/app/(wiki)/resources/law/[slug]/` | T2 |
| `src/app/(gov)/resources/research/[slug]/` | `src/app/(wiki)/resources/research/[slug]/` | T2 |
| `src/app/(gov)/page.tsx` (file) | `src/app/(gov)/legacy/page.tsx` | T3 |
| `src/app/(gov)/about/` | `src/app/(gov)/legacy/about/` | T3 |
| `src/app/(gov)/support/` | `src/app/(gov)/legacy/support/` | T3 |
| `src/app/(gov)/rights/` | `src/app/(gov)/legacy/rights/` | T3 |
| `src/app/(gov)/stories/` | `src/app/(gov)/legacy/stories/` | T3 |
| `src/app/(gov)/participate/` | `src/app/(gov)/legacy/participate/` | T3 |
| `src/app/(gov)/resources/page.tsx` (file) | `src/app/(gov)/legacy/resources/page.tsx` | T3 |
| `src/app/(gov)/resources/policy/` | `src/app/(gov)/legacy/resources/policy/` | T3 |
| `src/app/(gov)/resources/statistics/` | `src/app/(gov)/legacy/resources/statistics/` | T3 |
| `src/app/(gov)/resources/law/page.tsx` (file, 인덱스) | `src/app/(gov)/legacy/resources/law-guide/page.tsx` (slug 변경) | T4 |
| `src/app/(gov)/resources/research/page.tsx` (file, 인덱스) | `src/app/(gov)/legacy/resources/research-guide/page.tsx` (slug 변경) | T4 |

### 갱신 파일

| 파일 | 변경 | task |
|------|------|------|
| `src/app/(wiki)/wiki/page.tsx` | 삭제 (next.config redirect로 대체) | T5 |
| `next.config.ts` | `redirects()` 등록 — 11종 prefix redirect + 2종 slug 변경 redirect | T6 |
| `src/lib/navigation.ts` | 모든 href `/legacy/` prefix 추가 | T7 |
| `src/components/wiki/EntryToggle.tsx` | 라벨·링크 갱신 (`/` → `/legacy`, `/wiki` → `/`), 베타 라벨 제거, "기관용" → "이전 버전" | T8 |
| `src/app/(wiki)/layout.tsx` | 헤더 로고 `/wiki` → `/`, 네비 `/wiki` 항목 제거 (`/`로 가는 게 위키), 푸터 카피 갱신, 베타 라벨 제거 | T9 |
| `src/components/layout/Header.tsx` | `/` (로고 링크) → `/legacy` | T10 |
| `src/app/(gov)/legacy/**/page.tsx` (11개 파일) | 내부 자기-참조 링크 `/legacy/` prefix 추가 | T11 |
| `CLAUDE.md` | 변경 이력 entry (M1 머지 후) | T17 |

### 변경 0 (보존)

- `src/lib/rag/retrieval.ts` `sourcePathToHref` — spec §3.2 정합 (콘텐츠 경로·URL 보존)
- `src/lib/wiki-popular.ts` — URL 보존
- `src/components/layout/Footer.tsx` — `/privacy`·`/terms`·`/sitemap` 미구현 잔재, M3에서 별도 처리
- `content/**/*.md` — 콘텐츠 정본
- 모든 atomic 페이지 본문 — 라우트만 mv

---

## 사전 점검 (Task 0)

**Files:** —

- [ ] **Step 0.1: 현재 브랜치 + master sync 확인**

Run:
```bash
git status -s
git branch --show-current
git log --oneline master..HEAD
```
Expected: 현재 브랜치는 `docs/phase-4-m1-plan`(plan) 또는 새 구현 브랜치. master HEAD = `1a0d2c2`. clean.

- [ ] **Step 0.2: 회귀 baseline 측정**

Run:
```bash
npm test 2>&1 | tail -3
npm run test:integration 2>&1 | tail -3
npm run build 2>&1 | tail -5
```
Expected: 기존 baseline (185+ unit / 184+ pass + 29+ integration / 29+ pass + 568+ 정적 페이지). 신규 회귀 0건.

- [ ] **Step 0.3: 구현 브랜치 생성** (plan 머지 후)

Run:
```bash
git checkout master
git pull origin master
git checkout -b feat/phase-4-m1-impl
```
Expected: master HEAD = M1 plan 머지 sha. 새 브랜치 생성.

---

## Task 1: atomic 5개 axis (wiki) 그룹 통합 (팀 리더)

**Files:**
- Move (per axis):
  - `src/app/disability-types/` → `src/app/(wiki)/disability-types/`
  - `src/app/policies/` → `src/app/(wiki)/policies/`
  - `src/app/agreements/` → `src/app/(wiki)/agreements/`
  - `src/app/domains/` → `src/app/(wiki)/domains/`
  - `src/app/regions/` → `src/app/(wiki)/regions/`
  - `src/app/uncategorized/` → `src/app/(wiki)/uncategorized/`

**Why 팀 리더 단독**: 디렉터리 mv는 baseline commit. 팀원 dispatch 전에 끝나야 import path 정합성 검증 가능.

- [ ] **Step 1.1: git mv 6개 axis 디렉터리**

Run:
```bash
git mv src/app/disability-types src/app/\(wiki\)/disability-types
git mv src/app/policies src/app/\(wiki\)/policies
git mv src/app/agreements src/app/\(wiki\)/agreements
git mv src/app/domains src/app/\(wiki\)/domains
git mv src/app/regions src/app/\(wiki\)/regions
git mv src/app/uncategorized src/app/\(wiki\)/uncategorized
```

- [ ] **Step 1.2: 빌드 검증 — import path 깨짐 확인**

Run: `npm run build 2>&1 | tail -10`
Expected: build PASS, 568+ 정적 페이지 (라우트 mv지만 URL은 그대로). Route Group `(wiki)`이 URL에 영향 0이라 atomic 페이지 URL 보존.

만약 import path 깨지면 → 깨진 import는 `@/` alias 또는 상대 경로 점검. atomic 페이지 내부에서 `../../../components/...` 같은 상대 경로 사용 시 깊이 변경. *grep으로 확인*:
```bash
grep -rn "from \"\\.\\./" src/app/\(wiki\)/disability-types/ 2>/dev/null | head -10
```
모두 `@/...` alias 사용해야 안전. 발견 시 alias 변환.

- [ ] **Step 1.3: 통합 테스트 실행**

Run: `npm run test:integration 2>&1 | tail -3`
Expected: 기존 baseline 그대로 PASS (29+/29+).

- [ ] **Step 1.4: smoke 검증 — atomic 페이지 1건 dev server 접근**

Run (background):
```bash
npm run dev 2>&1 > /tmp/dev-m1-t1.log &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/disability-types/2024-staff-p-183
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/policies/2024-jbu-p-062
pkill -f "next dev"
```
Expected: 200 + 200 (URL 보존).

- [ ] **Step 1.5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): atomic 5개 axis (wiki) 그룹 통합

disability-types · policies · agreements · domains · regions · uncategorized
6개 axis 디렉터리를 src/app/(wiki)/ 그룹 안으로 mv. Route Group은
URL에 영향 없으므로 atomic 페이지 URL 보존.

Spec D4 §3.2 정합 — sourcePathToHref 변경 0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: atomic resources (wiki) 그룹 이동 (팀 리더)

**Files:**
- Move:
  - `src/app/(gov)/resources/law/[slug]/` → `src/app/(wiki)/resources/law/[slug]/`
  - `src/app/(gov)/resources/research/[slug]/` → `src/app/(wiki)/resources/research/[slug]/`

**Why 팀 리더 단독**: (gov)/resources/law/page.tsx (인덱스 정적 안내)는 T4에서 별도 slug 변경. T2는 [slug] 동적 라우트만 이동.

- [ ] **Step 2.1: git mv atomic resources 2개**

Run:
```bash
git mv src/app/\(gov\)/resources/law/\[slug\] src/app/\(wiki\)/resources/law/\[slug\]
git mv src/app/\(gov\)/resources/research/\[slug\] src/app/\(wiki\)/resources/research/\[slug\]
```

- [ ] **Step 2.2: 빌드 + smoke 검증**

Run:
```bash
npm run build 2>&1 | tail -10
```
Expected: build PASS, 568+ 정적 페이지. `/resources/law/ordinance-comparison`이 (wiki) 그룹 [slug] 동적 라우트로 빌드되는지 확인.

- [ ] **Step 2.3: dev server smoke**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m1-t2.log &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/resources/law/ordinance-comparison
pkill -f "next dev"
```
Expected: 200 (URL 보존, wiki-popular.ts:12 정합).

- [ ] **Step 2.4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): atomic resources (wiki) 그룹 이동

resources/law/[slug], resources/research/[slug] 동적 라우트 2개를
(gov) → (wiki) 그룹으로 mv. URL 그대로 유지 (sourcePathToHref 정합).
(gov)/resources/law/page.tsx 인덱스는 T4에서 별도 slug 변경.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: (gov) 정적 안내 → (gov)/legacy/ 이동 (팀 리더)

**Files:**
- Move:
  - `src/app/(gov)/page.tsx` (file) → `src/app/(gov)/legacy/page.tsx`
  - `src/app/(gov)/about/` → `src/app/(gov)/legacy/about/`
  - `src/app/(gov)/support/` → `src/app/(gov)/legacy/support/`
  - `src/app/(gov)/rights/` → `src/app/(gov)/legacy/rights/`
  - `src/app/(gov)/stories/` → `src/app/(gov)/legacy/stories/`
  - `src/app/(gov)/participate/` → `src/app/(gov)/legacy/participate/`
  - `src/app/(gov)/resources/page.tsx` (file) → `src/app/(gov)/legacy/resources/page.tsx`
  - `src/app/(gov)/resources/policy/` → `src/app/(gov)/legacy/resources/policy/`
  - `src/app/(gov)/resources/statistics/` → `src/app/(gov)/legacy/resources/statistics/`

**중요**: T2에서 (gov)/resources/law/[slug], research/[slug]는 이미 (wiki)로 mv. T3에서 (gov)/resources/는 page.tsx·policy/·statistics/만 남음. law/page.tsx·research/page.tsx 인덱스는 T4에서 slug 변경.

- [ ] **Step 3.1: legacy 디렉터리 사전 생성** (mkdir 후 mv)

Run:
```bash
mkdir -p src/app/\(gov\)/legacy/resources
```

- [ ] **Step 3.2: git mv (gov) 정적 안내 9개**

Run:
```bash
git mv src/app/\(gov\)/page.tsx src/app/\(gov\)/legacy/page.tsx
git mv src/app/\(gov\)/about src/app/\(gov\)/legacy/about
git mv src/app/\(gov\)/support src/app/\(gov\)/legacy/support
git mv src/app/\(gov\)/rights src/app/\(gov\)/legacy/rights
git mv src/app/\(gov\)/stories src/app/\(gov\)/legacy/stories
git mv src/app/\(gov\)/participate src/app/\(gov\)/legacy/participate
git mv src/app/\(gov\)/resources/page.tsx src/app/\(gov\)/legacy/resources/page.tsx
git mv src/app/\(gov\)/resources/policy src/app/\(gov\)/legacy/resources/policy
git mv src/app/\(gov\)/resources/statistics src/app/\(gov\)/legacy/resources/statistics
```

- [ ] **Step 3.3: 빌드 검증**

Run: `npm run build 2>&1 | tail -15`
Expected: build PASS. `/legacy/about/*`, `/legacy/support/*` 등 새 URL이 라우트로 등록. *기존* `/about`, `/support`는 라우트 사라짐 (T6 redirect 등록 전까지 404).

⚠️ *주의*: 이 시점 빌드 후 dev server에서 `/about` 접근하면 404. T6 redirect 등록 후 정상화.

- [ ] **Step 3.4: smoke — /legacy/* 새 URL 응답 확인**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m1-t3.log &
sleep 5
curl -s -o /dev/null -w "/legacy: %{http_code}\n" http://localhost:3000/legacy
curl -s -o /dev/null -w "/legacy/about: %{http_code}\n" http://localhost:3000/legacy/about
curl -s -o /dev/null -w "/about (T6 전 404 예상): %{http_code}\n" http://localhost:3000/about
pkill -f "next dev"
```
Expected: `/legacy` = 200, `/legacy/about` = 200, `/about` = 404 (T6 redirect 등록 전).

- [ ] **Step 3.5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): (gov) 정적 안내 9개 → (gov)/legacy/ 이동

about · support · rights · stories · participate · resources(인덱스) ·
resources/policy · resources/statistics + (gov) 랜딩 page.tsx를
/legacy/ 하위로 mv. resources/law·research 인덱스는 T4에서 slug 변경.

Spec D1 정합 — /legacy/* 보존(라우트만 이동, 콘텐츠 그대로).
기존 /about 등 URL은 T6 next.config redirects()로 영구 redirect 등록.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: (gov) atomic resources 인덱스 slug 변경 (팀 리더)

**Files:**
- Move:
  - `src/app/(gov)/resources/law/page.tsx` (인덱스 정적 안내) → `src/app/(gov)/legacy/resources/law-guide/page.tsx`
  - `src/app/(gov)/resources/research/page.tsx` (인덱스 정적 안내) → `src/app/(gov)/legacy/resources/research-guide/page.tsx`

**Why slug 변경**: spec R2 — `/legacy/resources/law` vs `/resources/law/[slug]` URL 충돌 방지. 정적 안내 인덱스는 `-guide` suffix로 분리.

- [ ] **Step 4.1: 새 디렉터리 생성 후 git mv**

Run:
```bash
mkdir -p src/app/\(gov\)/legacy/resources/law-guide
mkdir -p src/app/\(gov\)/legacy/resources/research-guide
git mv src/app/\(gov\)/resources/law/page.tsx src/app/\(gov\)/legacy/resources/law-guide/page.tsx
git mv src/app/\(gov\)/resources/research/page.tsx src/app/\(gov\)/legacy/resources/research-guide/page.tsx
```

- [ ] **Step 4.2: 빈 (gov)/resources 디렉터리 정리**

Run:
```bash
rmdir src/app/\(gov\)/resources/law 2>/dev/null
rmdir src/app/\(gov\)/resources/research 2>/dev/null
rmdir src/app/\(gov\)/resources 2>/dev/null
```
Expected: 빈 디렉터리 삭제. 만약 남아있는 파일 있으면 error → 점검.

- [ ] **Step 4.3: 빌드 + smoke 검증**

Run:
```bash
npm run build 2>&1 | tail -10
```
Expected: build PASS. `/legacy/resources/law-guide`, `/legacy/resources/research-guide` 라우트 등록. `/resources/law/[slug]`, `/resources/research/[slug]` (wiki 그룹) 라우트 등록 (URL 보존).

- [ ] **Step 4.4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): (gov) atomic resources 인덱스 slug 변경

resources/law/page.tsx, resources/research/page.tsx (정적 안내 인덱스)을
/legacy/resources/law-guide, /legacy/resources/research-guide로 mv.

Spec R2 정합 — /legacy/resources/law (정적) vs /resources/law/[slug]
(atomic) URL 충돌 방지. -guide suffix로 분리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: (wiki)/page.tsx 신설 + (wiki)/wiki/page.tsx 삭제 (팀 리더)

**Files:**
- Create: `src/app/(wiki)/page.tsx`
- Delete: `src/app/(wiki)/wiki/page.tsx`

**Why 팀 리더 단독**: 통합 file (spec §7.5.3) — 위키 entry는 M2에서 RoleEntries·ChatLibraryMediaEntries 등 다 통합. M1에서는 *최소 entry*(WikiHero + PopularPages + 베타 안내 삭제)만.

- [ ] **Step 5.1: `src/app/(wiki)/page.tsx` 신설**

Content (현 `(wiki)/wiki/page.tsx`에서 베타 안내 문단 삭제 + 메타데이터 갱신):

```tsx
import type { Metadata } from "next"
import { WikiHero } from "@/components/wiki/WikiHero"
import { PopularPages } from "@/components/wiki/PopularPages"

export const metadata: Metadata = {
  title: "장애인교원 위키",
  description:
    "장애인교원에 관한 535개 정책·법령·사례·보조공학 페이지를 위키 형태로 검색하고 채팅으로 질문하세요.",
}

export default function WikiHomePage() {
  return (
    <>
      <WikiHero />
      <PopularPages />
    </>
  )
}
```

- [ ] **Step 5.2: `src/app/(wiki)/wiki/page.tsx` 삭제**

Run:
```bash
git rm src/app/\(wiki\)/wiki/page.tsx
rmdir src/app/\(wiki\)/wiki 2>/dev/null
```
Expected: 파일 삭제. 빈 wiki/ 디렉터리 정리. `/wiki` 라우트는 T6 redirect로 `/`로 리다이렉트.

- [ ] **Step 5.3: 빌드 검증**

Run: `npm run build 2>&1 | tail -10`
Expected: build PASS. `/` 라우트가 (wiki) entry로 렌더. `/wiki` 라우트는 사라짐 (T6 전까지 404).

- [ ] **Step 5.4: dev server smoke**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m1-t5.log &
sleep 5
curl -s -o /dev/null -w "/: %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "/chat: %{http_code}\n" http://localhost:3000/chat
pkill -f "next dev"
```
Expected: `/` = 200 (위키 entry), `/chat` = 200 (Phase 3 채팅 그대로).

- [ ] **Step 5.5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): (wiki)/page.tsx 신설 — / root entry

위키 entry를 / root로 승격. (wiki)/wiki/page.tsx 삭제 (T6에서 /wiki → /
redirect 등록). 베타 안내 문단("기관용 정식 메뉴는 우측 상단 토글로
이동하세요") 삭제 — 위키가 본체이므로 안내 불요.

M2에서 RoleEntries + ChatLibraryMediaEntries 통합 예정.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: next.config.ts redirects() 등록 (팀원 C)

**Files:**
- Modify: `next.config.ts`
- Test: `tests/routing/legacy-redirects.test.ts` (T13에서 작성)

**Why 팀원 C scope**: 인프라 변경. T7~T11과 file overlap 0건.

- [ ] **Step 6.1: 현재 `next.config.ts` 읽기**

Run: 파일 내용 확인 (이미 알고 있음 — `output: 'export'` GitHub Pages 분기 + images unoptimized).

- [ ] **Step 6.2: `redirects()` 등록**

Edit `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";

const nextConfig: NextConfig = {
  ...(isGitHubPages && { output: "export" }),
  basePath: isGitHubPages ? "/webfortd" : "",
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      // 위키 entry — /wiki → / 영구 redirect
      { source: "/wiki", destination: "/", permanent: true },

      // (gov) 정적 안내 → /legacy/* (D7 호환성)
      { source: "/about", destination: "/legacy/about", permanent: true },
      { source: "/about/:path*", destination: "/legacy/about/:path*", permanent: true },
      { source: "/support", destination: "/legacy/support", permanent: true },
      { source: "/support/:path*", destination: "/legacy/support/:path*", permanent: true },
      { source: "/rights", destination: "/legacy/rights", permanent: true },
      { source: "/rights/:path*", destination: "/legacy/rights/:path*", permanent: true },
      { source: "/stories", destination: "/legacy/stories", permanent: true },
      { source: "/stories/:path*", destination: "/legacy/stories/:path*", permanent: true },
      { source: "/participate", destination: "/legacy/participate", permanent: true },
      { source: "/participate/:path*", destination: "/legacy/participate/:path*", permanent: true },

      // /resources 인덱스 + policy + statistics → /legacy/resources/* (D7)
      { source: "/resources", destination: "/legacy/resources", permanent: true },
      { source: "/resources/policy", destination: "/legacy/resources/policy", permanent: true },
      { source: "/resources/policy/:path*", destination: "/legacy/resources/policy/:path*", permanent: true },
      { source: "/resources/statistics", destination: "/legacy/resources/statistics", permanent: true },
      { source: "/resources/statistics/:path*", destination: "/legacy/resources/statistics/:path*", permanent: true },

      // atomic resources 인덱스 slug 변경 (R2 — /resources/law는 atomic 그대로 유지하므로 redirect X)
      // 단, 정적 안내 인덱스 옛 URL 안내 — 만약 외부 인용 있다면 -guide로
      // /resources/law (인덱스 옛 URL) → /resources/law/[slug] 동적과 충돌하므로 redirect 등록 안 함
      // 정적 인덱스는 새 slug `/legacy/resources/law-guide`로만 접근 가능. 별도 안내 없음 (M3 sitemap에서 처리)
    ];
  },
};

export default nextConfig;
```

⚠️ *주의*: GitHub Pages export 시 `redirects()`는 무시됨 (정적 export는 서버 redirect 불가). production = Vercel이라 정상 작동.

- [ ] **Step 6.3: 빌드 검증**

Run: `npm run build 2>&1 | tail -10`
Expected: build PASS. redirects 등록 메시지 (next.js v16은 redirects도 별도 출력).

- [ ] **Step 6.4: dev server smoke — redirect 확인**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m1-t6.log &
sleep 5
# 호환성 redirect 검증
curl -s -o /dev/null -w "/about: %{http_code} → %{redirect_url}\n" http://localhost:3000/about
curl -s -o /dev/null -w "/wiki: %{http_code} → %{redirect_url}\n" http://localhost:3000/wiki
curl -s -o /dev/null -w "/support/area/hr: %{http_code} → %{redirect_url}\n" http://localhost:3000/support/area/hr
curl -s -o /dev/null -w "/resources/law/ordinance-comparison: %{http_code}\n" http://localhost:3000/resources/law/ordinance-comparison
pkill -f "next dev"
```
Expected:
- `/about` = 308 → `/legacy/about`
- `/wiki` = 308 → `/`
- `/support/area/hr` = 308 → `/legacy/support/area/hr`
- `/resources/law/ordinance-comparison` = 200 (atomic 그대로, redirect 0)

- [ ] **Step 6.5: Commit**

```bash
git add next.config.ts
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): next.config.ts redirects() — 호환성 영구 redirect

기존 /about, /support, /rights, /stories, /participate, /resources/*
prefix를 /legacy/* prefix로 영구 redirect (308). /wiki는 / root로 영구
redirect. atomic /resources/law/[slug], /resources/research/[slug]는
URL 보존이므로 redirect 등록 안 함.

Spec D7 호환성 게이트.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: src/lib/navigation.ts /legacy/ prefix 일괄 갱신 (팀원 B)

**Files:**
- Modify: `src/lib/navigation.ts`

**Why 팀원 B scope**: UI 내부 링크. T6 redirects와 file overlap 0건.

- [ ] **Step 7.1: 모든 href에 `/legacy/` prefix 추가**

Edit `src/lib/navigation.ts` — `mainNavigation`과 `userEntries`의 모든 href 항목:

```typescript
export const mainNavigation: NavItem[] = [
  {
    title: "플랫폼 소개",
    href: "/legacy/about",
    children: [
      { title: "소개 및 이용안내", href: "/legacy/about/purpose" },
      { title: "연혁 및 협력기관", href: "/legacy/about/partners" },
    ],
  },
  {
    title: "지원제도 안내",
    href: "/legacy/support",
    children: [
      {
        title: "지원영역별",
        href: "/legacy/support/area",
        children: [
          { title: "인사·복무", href: "/legacy/support/area/hr" },
          { title: "지원인력·근로지원인", href: "/legacy/support/area/assistant" },
          { title: "보조공학기기", href: "/legacy/support/area/technology" },
          { title: "시설·환경", href: "/legacy/support/area/facility" },
        ],
      },
      {
        title: "장애유형별",
        href: "/legacy/support/disability",
        children: [
          { title: "시각장애", href: "/legacy/support/disability/visual" },
          { title: "청각장애", href: "/legacy/support/disability/hearing" },
          { title: "지체·뇌병변장애", href: "/legacy/support/disability/physical" },
          { title: "기타 장애유형", href: "/legacy/support/disability/other" },
        ],
      },
      { title: "시도별 제도", href: "/legacy/support/region" },
    ],
  },
  {
    title: "연구·법령·통계",
    href: "/legacy/resources",
    children: [
      { title: "연구자료", href: "/legacy/resources/research-guide" },
      { title: "법령·지침", href: "/legacy/resources/law-guide" },
      { title: "통계", href: "/legacy/resources/statistics" },
      { title: "정책 제안", href: "/legacy/resources/policy" },
    ],
  },
  {
    title: "권리 구제",
    href: "/legacy/rights",
    children: [
      { title: "장애인교원의 권리", href: "/legacy/rights/entitlements" },
      { title: "판례", href: "/legacy/rights/cases" },
      { title: "구제 절차 안내", href: "/legacy/rights/procedure" },
      { title: "상담·신고", href: "/legacy/rights/report" },
    ],
  },
  {
    title: "현장 사례",
    href: "/legacy/stories",
    children: [
      { title: "우수사례", href: "/legacy/stories/best-practices" },
      { title: "인식 개선 콘텐츠", href: "/legacy/stories/awareness" },
      { title: "미디어 소개", href: "/legacy/stories/media" },
    ],
  },
  {
    title: "참여하기",
    href: "/legacy/participate",
    children: [
      { title: "자주 묻는 질문", href: "/legacy/participate/faq" },
      { title: "질문하기", href: "/legacy/participate/ask" },
      { title: "나의 권리 알아보기", href: "/legacy/participate/check" },
    ],
  },
]

// ...
export const userEntries: UserEntry[] = [
  {
    title: "나에게 맞는 지원 찾기",
    description: "장애유형별 맞춤 지원제도를 확인하세요",
    href: "/legacy/support/disability",
    icon: "user",
  },
  {
    title: "우리 학교 지원 가이드",
    description: "학교 관리자를 위한 체크리스트와 편의제공 안내",
    href: "/legacy/support/area/hr",
    icon: "school",
  },
  {
    title: "제도 운영 매뉴얼",
    description: "교육청 인사담당자를 위한 실무 지침",
    href: "/legacy/resources/law-guide",
    icon: "file-text",
  },
  {
    title: "현황 통계",
    description: "정책입안자를 위한 통계 데이터",
    href: "/legacy/resources/statistics",
    icon: "bar-chart",
  },
]
```

⚠️ *주의*: T4 slug 변경 정합 — `/legacy/resources/research-guide` + `/legacy/resources/law-guide` (research/law 정적 안내 인덱스).

- [ ] **Step 7.2: 빌드 + 타입 검증**

Run:
```bash
npm run build 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -3
```
Expected: 둘 다 PASS.

- [ ] **Step 7.3: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): navigation.ts /legacy/ prefix 일괄 갱신

mainNavigation 6개 카테고리 + 25 children + userEntries 4건 모두 href를
/legacy/* prefix로 갱신. /legacy/resources/{law,research}-guide는 T4
slug 변경 정합.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: EntryToggle.tsx 라벨·링크·베타 라벨 갱신 (팀원 B)

**Files:**
- Modify: `src/components/wiki/EntryToggle.tsx`

- [ ] **Step 8.1: 라벨·링크·아이콘 갱신**

Edit `src/components/wiki/EntryToggle.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Archive, BookOpenText } from "lucide-react"
import { cn } from "@/lib/utils"

export function EntryToggle() {
  const pathname = usePathname()
  const onLegacy = pathname === "/legacy" || pathname.startsWith("/legacy/")

  return (
    <div
      role="group"
      aria-label="사이트 모드 전환"
      className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs"
    >
      <Link
        href="/"
        aria-current={!onLegacy ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          !onLegacy
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <BookOpenText className="h-3 w-3" aria-hidden="true" />
        위키·채팅
      </Link>
      <Link
        href="/legacy"
        aria-current={onLegacy ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
          onLegacy
            ? "bg-background text-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Archive className="h-3 w-3" aria-hidden="true" />
        이전 버전
      </Link>
    </div>
  )
}
```

변경 요약:
- `Building2` 아이콘 → `Archive` (이전 버전 의미)
- "기관용" 라벨 → "이전 버전"
- "위키·채팅 [베타]" → "위키·채팅" (베타 라벨 제거)
- `/` 링크는 위키·채팅 (메인), `/legacy` 링크는 이전 버전
- `aria-current` 계산을 onLegacy 기준으로 재구성

- [ ] **Step 8.2: 빌드 검증**

Run: `npm run build 2>&1 | tail -5`
Expected: build PASS.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/wiki/EntryToggle.tsx
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): EntryToggle 라벨·링크·아이콘 갱신

라벨: 기관용 → 이전 버전 / 위키·채팅 [베타] → 위키·채팅
링크: / = 위키 메인, /legacy = 이전 버전
아이콘: Building2 → Archive (이전 버전 의미)
베타 라벨 제거 (위키가 본체)

M3에서 EntryToggle 노출 정책 재검토 예정 (유지/푸터 이동/제거).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: (wiki)/layout.tsx 헤더·푸터·베타 라벨 갱신 (팀원 B)

**Files:**
- Modify: `src/app/(wiki)/layout.tsx`

- [ ] **Step 9.1: 헤더 로고·네비·푸터·베타 라벨 갱신**

Edit `src/app/(wiki)/layout.tsx`:

```tsx
import Link from "next/link"
import { BookOpenText, MessageCircle } from "lucide-react"
import { SkipLink } from "@/components/accessibility/SkipLink"
import { FocusManager } from "@/components/accessibility/FocusManager"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { EntryToggle } from "@/components/wiki/EntryToggle"
import { SiteSearch } from "@/components/search/SiteSearch"
import { AuthProvider } from "@/contexts/AuthContext"
import { SignInButton } from "@/components/auth/SignInButton"

export default function WikiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <SkipLink />
      <FocusManager />
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <BookOpenText className="h-5 w-5 text-primary" aria-hidden="true" />
                <span>장애인교원 위키</span>
              </Link>
              <nav aria-label="위키 메뉴" className="hidden md:block">
                <ul className="flex items-center gap-1 text-sm">
                  <li>
                    <Link
                      href="/"
                      className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      위키
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/chat"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      채팅
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <EntryToggle />
              <SiteSearch />
              <AccessibilityToolbar />
              <SignInButton />
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border bg-muted/30 py-6 text-center text-xs text-muted-foreground">
          <p>
            장애인교원 위키 · 정책·법령·사례 통합 안내 ·{" "}
            <Link href="/legacy" className="underline hover:text-foreground">
              이전 버전 보기
            </Link>
          </p>
        </footer>
      </div>
    </AuthProvider>
  )
}
```

변경 요약:
- 헤더 로고 링크 `/wiki` → `/`
- 헤더 로고 옆 베타 라벨(amber pill) 삭제
- 네비 "위키" 링크 `/wiki` → `/`
- 푸터 카피 갱신: "베타 단계입니다 · 기관용 사이트에서 확인하세요" → "정책·법령·사례 통합 안내 · 이전 버전 보기"
- 푸터 링크 `/` → `/legacy`

- [ ] **Step 9.2: 빌드 검증**

Run: `npm run build 2>&1 | tail -5`
Expected: build PASS.

- [ ] **Step 9.3: Commit**

```bash
git add src/app/\(wiki\)/layout.tsx
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): (wiki)/layout.tsx 헤더·푸터 갱신

헤더 로고·네비 링크 /wiki → /. 베타 라벨(amber pill) 제거.
푸터 카피 "베타 단계입니다 · 기관용 사이트" → "정책·법령·사례 통합 안내 ·
이전 버전 보기" + 링크 /legacy.

위키가 본체로 승격됨에 따른 카피 정합.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Header.tsx (gov) 로고 링크 /legacy 갱신 (팀원 B)

**Files:**
- Modify: `src/components/layout/Header.tsx:54`

**Note**: 이 Header는 (gov)/layout.tsx에서 사용. 즉 `/legacy/*` 페이지에서 보이는 헤더. 로고 클릭 시 (gov) 랜딩(`/legacy`)으로 가야 함.

- [ ] **Step 10.1: 로고 링크 변경**

Edit `src/components/layout/Header.tsx` line 53-59:

```tsx
{/* Logo */}
<Link
  href="/legacy"
  className="flex items-center gap-2 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
>
  <span className="text-primary">장애인교원</span>
  <span className="hidden sm:inline">교육전념 여건 지원</span>
</Link>
```

변경 요약: `href="/"` → `href="/legacy"`. (gov) 헤더에서 로고 클릭 시 (gov) 랜딩으로.

- [ ] **Step 10.2: 빌드 검증**

Run: `npm run build 2>&1 | tail -5`
Expected: build PASS.

- [ ] **Step 10.3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): Header.tsx (gov) 로고 링크 / → /legacy

(gov)/layout.tsx에서 사용되는 Header — /legacy/* 페이지에서 로고 클릭 시
(gov) 랜딩(/legacy)으로 가도록 정합.

(wiki) 헤더는 별도 (wiki)/layout.tsx 사용 (T9에서 처리).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: (gov)/legacy/**/page.tsx 11개 파일 내부 링크 일괄 갱신 (팀원 B)

**Files:**
- Modify (11 files):
  - `src/app/(gov)/legacy/page.tsx`
  - `src/app/(gov)/legacy/about/page.tsx`
  - `src/app/(gov)/legacy/participate/page.tsx`
  - `src/app/(gov)/legacy/participate/check/page.tsx`
  - `src/app/(gov)/legacy/participate/faq/page.tsx`
  - `src/app/(gov)/legacy/participate/ask/page.tsx`
  - `src/app/(gov)/legacy/support/page.tsx`
  - `src/app/(gov)/legacy/stories/page.tsx`
  - `src/app/(gov)/legacy/resources/policy/page.tsx`
  - `src/app/(wiki)/resources/law/[slug]/page.tsx` (T2에서 이미 (wiki)로 이동)
  - `src/app/(wiki)/resources/research/[slug]/page.tsx` (T2에서 이미 (wiki)로 이동)

**Note**: 마지막 2개는 *atomic 페이지로 (wiki) 그룹*에 있지만, 내부 링크가 *(gov) 인덱스*(`/resources/law`, `/resources/research`)를 가리킴. T4 slug 변경(`-guide`) 정합 갱신 필요.

- [ ] **Step 11.1: grep으로 영향 파일 재확인**

Run:
```bash
grep -rn 'href="/about\|href="/support\|href="/rights\|href="/stories\|href="/participate\|href="/resources' src/app/ 2>/dev/null
```
Expected: 위 11개 파일 + 기타 누락된 곳 0건.

- [ ] **Step 11.2: 각 파일별 prefix 추가**

각 파일에서 `Edit` 도구로 link prefix `/legacy/` 추가. 예시:

**`src/app/(gov)/legacy/page.tsx`** (line 70, 76, 128, 147):
- `href="/support"` → `href="/legacy/support"`
- `href="/about"` → `href="/legacy/about"`
- `href="/about/purpose"` → `href="/legacy/about/purpose"`
- `href="/about/partners"` → `href="/legacy/about/partners"`

**`src/app/(gov)/legacy/about/page.tsx`** (line 25, 40):
- `href="/about/purpose"` → `href="/legacy/about/purpose"`
- `href="/about/partners"` → `href="/legacy/about/partners"`

**`src/app/(gov)/legacy/participate/page.tsx`** (line 71, 77):
- `href="/participate/ask"` → `href="/legacy/participate/ask"`
- `href="/stories/best-practices"` → `href="/legacy/stories/best-practices"`

**`src/app/(gov)/legacy/participate/check/page.tsx`** (line 234):
- `href="/participate/ask"` → `href="/legacy/participate/ask"`

**`src/app/(gov)/legacy/participate/faq/page.tsx`** (line 130):
- `href="/participate/ask"` → `href="/legacy/participate/ask"`

**`src/app/(gov)/legacy/support/page.tsx`** (line 81):
- `href="/support/region"` → `href="/legacy/support/region"`

**`src/app/(gov)/legacy/participate/ask/page.tsx`** (line 91):
- `href="/participate/faq"` → `href="/legacy/participate/faq"`

**`src/app/(gov)/legacy/stories/page.tsx`** (line 93):
- `href="/participate/ask"` → `href="/legacy/participate/ask"`

**`src/app/(gov)/legacy/resources/policy/page.tsx`** (line 118):
- `href="/participate/ask"` → `href="/legacy/participate/ask"`

**`src/app/(wiki)/resources/law/[slug]/page.tsx`** (line 63):
- `href="/resources/law"` → `href="/legacy/resources/law-guide"`

**`src/app/(wiki)/resources/research/[slug]/page.tsx`** (line 63):
- `href="/resources/research"` → `href="/legacy/resources/research-guide"`

- [ ] **Step 11.3: 빌드 + grep 잔재 확인**

Run:
```bash
npm run build 2>&1 | tail -5
grep -rn 'href="/about\|href="/support\|href="/rights\|href="/stories\|href="/participate\|href="/resources' src/ 2>/dev/null | grep -v '/legacy/' | grep -v '_alt_'
```
Expected: build PASS. grep 결과 0건 (모든 (gov) 자기-참조 링크 갱신 완료).

- [ ] **Step 11.4: dev server smoke — /legacy/about 내부 링크 작동 확인**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m1-t11.log &
sleep 5
# /legacy/about 페이지 안에서 내부 링크가 /legacy/about/purpose 등을 가리키는지
curl -s http://localhost:3000/legacy/about | grep -oE 'href="/[^"]+"' | head -10
pkill -f "next dev"
```
Expected: `/legacy/about/purpose`, `/legacy/about/partners` 등 노출.

- [ ] **Step 11.5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4-m1): (gov)/legacy/** 11개 파일 내부 링크 /legacy/ prefix

(gov) 정적 안내 페이지 9개 + atomic resources 페이지 2개 = 총 11개
파일에서 내부 자기-참조 링크에 /legacy/ prefix 추가. atomic resources의
인덱스 링크는 T4 slug 변경 정합 (-guide suffix).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 회귀 검증 (팀원 C)

**Files:** —

- [ ] **Step 12.1: 전체 빌드**

Run: `npm run build 2>&1 | tail -10`
Expected: build PASS. 정적 페이지 카운트 = 568+ ± redirect 영향 (redirect는 정적 페이지 카운트 영향 없음).

- [ ] **Step 12.2: 모든 unit 테스트**

Run: `npm test 2>&1 | tail -3`
Expected: 기존 baseline 185+ unit / 184+ pass / 0 fail / 1 skipped (m3-sdk-probe).

- [ ] **Step 12.3: 통합 테스트**

Run: `npm run test:integration 2>&1 | tail -3`
Expected: 기존 baseline 29+ pass / 0 fail.

- [ ] **Step 12.4: dev server smoke — 모든 redirect + 라우트 한 번에**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m1-t12.log &
sleep 5

echo "=== 새 라우트 (200 응답 기대) ==="
for url in / /chat /legacy /legacy/about /legacy/support /legacy/rights /legacy/stories /legacy/participate /legacy/resources /legacy/resources/policy /legacy/resources/statistics /legacy/resources/law-guide /legacy/resources/research-guide; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$url")
  echo "$url → $code"
done

echo ""
echo "=== atomic 페이지 (200 응답 기대 — URL 보존) ==="
for url in /disability-types/2024-staff-p-183 /policies/2024-jbu-p-062 /resources/law/ordinance-comparison /agreements/collective-agreement-1; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$url")
  echo "$url → $code"
done

echo ""
echo "=== (gov)/legacy 헤더 EntryToggle 작동 검증 ==="
# (gov)/legacy 페이지 HTML에 EntryToggle이 렌더되고 / 링크가 포함되어 있는지
curl -s http://localhost:3000/legacy/about | grep -c 'href="/"' || echo "EntryToggle / 링크 누락"
curl -s http://localhost:3000/legacy/about | grep -c '이전 버전' || echo "이전 버전 라벨 누락"

echo ""
echo "=== 호환성 redirect (308 응답 기대) ==="
for url in /about /support /rights /stories /participate /resources /resources/policy /wiki; do
  code=$(curl -s -o /dev/null -w "%{http_code} → %{redirect_url}" "http://localhost:3000$url")
  echo "$url → $code"
done

pkill -f "next dev"
```
Expected:
- 새 라우트 13건 모두 200
- atomic 페이지 4건 모두 200
- 호환성 redirect 8건 모두 308 + 정확한 destination

- [ ] **Step 12.5: RUN_SMOKE=1 RAG 채팅 회귀 (atomic 페이지 출처 보존 확인)**

Run:
```bash
RUN_SMOKE=1 npm run test -- tests/rag/m3-smoke.test.ts 2>&1 | tail -10
```
Expected: 4건 모두 PASS, sourceRefs URL이 `/disability-types/*`, `/policies/*` 등 atomic 경로 정확히 박힘 (변경 0 검증).

- [ ] **Step 12.6: kb:publish:dry-run baseline 확인**

Run: `npm run kb:publish:dry-run 2>&1 | tail -10`
Expected: 535 candidate / 8 passing / 527 blocked. baseline 변동 0.

---

## Task 13: 회귀 가드 통합 테스트 신설 (팀원 C)

**Files:**
- Create: `tests/routing/legacy-redirects.test.ts`
- Create: `tests/routing/atomic-routes.test.ts`

**Why**: redirect 회귀 가드 + atomic 라우트 매핑 회귀 가드. 향후 next.config 또는 라우트 구조 수정 시 회귀 검출.

- [ ] **Step 13.1: 통합 테스트 작성**

`tests/routing/legacy-redirects.test.ts`:

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import nextConfig from '../../next.config'

const redirectsExpected = [
  { source: '/wiki', destination: '/', permanent: true },
  { source: '/about', destination: '/legacy/about', permanent: true },
  { source: '/about/:path*', destination: '/legacy/about/:path*', permanent: true },
  { source: '/support', destination: '/legacy/support', permanent: true },
  { source: '/support/:path*', destination: '/legacy/support/:path*', permanent: true },
  { source: '/rights', destination: '/legacy/rights', permanent: true },
  { source: '/rights/:path*', destination: '/legacy/rights/:path*', permanent: true },
  { source: '/stories', destination: '/legacy/stories', permanent: true },
  { source: '/stories/:path*', destination: '/legacy/stories/:path*', permanent: true },
  { source: '/participate', destination: '/legacy/participate', permanent: true },
  { source: '/participate/:path*', destination: '/legacy/participate/:path*', permanent: true },
  { source: '/resources', destination: '/legacy/resources', permanent: true },
  { source: '/resources/policy', destination: '/legacy/resources/policy', permanent: true },
  { source: '/resources/policy/:path*', destination: '/legacy/resources/policy/:path*', permanent: true },
  { source: '/resources/statistics', destination: '/legacy/resources/statistics', permanent: true },
  { source: '/resources/statistics/:path*', destination: '/legacy/resources/statistics/:path*', permanent: true },
]

test('next.config redirects() — 모든 호환성 redirect 등록', async () => {
  assert.ok(typeof nextConfig.redirects === 'function', 'redirects()는 함수여야 한다')
  const redirects = await nextConfig.redirects!()
  for (const expected of redirectsExpected) {
    const found = redirects.find((r) => r.source === expected.source)
    assert.ok(found, `redirect 누락: ${expected.source}`)
    assert.equal(found.destination, expected.destination, `destination 불일치: ${expected.source}`)
    assert.equal(found.permanent, expected.permanent, `permanent 불일치: ${expected.source}`)
  }
})

test('next.config redirects() — atomic /resources/{law,research}/[slug]는 redirect 등록 안 함 (URL 보존)', async () => {
  const redirects = await nextConfig.redirects!()
  const lawSlugRedirect = redirects.find((r) => r.source === '/resources/law/:path*')
  const researchSlugRedirect = redirects.find((r) => r.source === '/resources/research/:path*')
  assert.equal(lawSlugRedirect, undefined, 'atomic /resources/law/[slug]에 redirect 등록되면 안 됨 — URL 보존')
  assert.equal(researchSlugRedirect, undefined, 'atomic /resources/research/[slug]에 redirect 등록되면 안 됨 — URL 보존')
})
```

- [ ] **Step 13.2a: atomic-routes.test.ts 작성**

`tests/routing/atomic-routes.test.ts`:

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')

const atomicRoutes = [
  'src/app/(wiki)/disability-types/[slug]/page.tsx',
  'src/app/(wiki)/policies/[slug]/page.tsx',
  'src/app/(wiki)/agreements/[slug]/page.tsx',
  'src/app/(wiki)/domains/[slug]/page.tsx',
  'src/app/(wiki)/regions/[slug]/page.tsx',
  'src/app/(wiki)/uncategorized/[slug]/page.tsx',
  'src/app/(wiki)/resources/law/[slug]/page.tsx',
  'src/app/(wiki)/resources/research/[slug]/page.tsx',
]

const legacyRoutes = [
  'src/app/(gov)/legacy/page.tsx',
  'src/app/(gov)/legacy/about/page.tsx',
  'src/app/(gov)/legacy/resources/page.tsx',
  'src/app/(gov)/legacy/resources/law-guide/page.tsx',
  'src/app/(gov)/legacy/resources/research-guide/page.tsx',
]

const removedRoutes = [
  'src/app/disability-types/[slug]/page.tsx', // (wiki)로 이동
  'src/app/policies/[slug]/page.tsx',
  'src/app/(gov)/page.tsx', // /legacy/page.tsx로 이동
  'src/app/(gov)/about/page.tsx',
  'src/app/(gov)/resources/law/[slug]/page.tsx', // (wiki)로 이동
  'src/app/(wiki)/wiki/page.tsx', // 삭제 (/ root로 승격)
]

test('atomic 라우트 — (wiki) 그룹 안에 위치', () => {
  for (const route of atomicRoutes) {
    assert.ok(existsSync(join(repoRoot, route)), `atomic 라우트 누락: ${route}`)
  }
})

test('legacy 라우트 — (gov)/legacy 안에 위치', () => {
  for (const route of legacyRoutes) {
    assert.ok(existsSync(join(repoRoot, route)), `legacy 라우트 누락: ${route}`)
  }
})

test('이동된 라우트 — 옛 경로에서 사라짐', () => {
  for (const route of removedRoutes) {
    assert.ok(!existsSync(join(repoRoot, route)), `옛 경로가 아직 남아 있음 (M1 mv 누락): ${route}`)
  }
})
```

- [ ] **Step 13.2: 테스트 실행**

Run: `npm test -- tests/routing/legacy-redirects.test.ts tests/routing/atomic-routes.test.ts 2>&1 | tail -5`
Expected: 5 tests (legacy 2 + atomic 3), 5 pass, 0 fail.

- [ ] **Step 13.3: package.json `test` glob에 `tests/routing/**/*.test.ts` 추가**

Edit `package.json` — `test` 스크립트의 glob에 `'tests/routing/**/*.test.ts'` 알파벳 순서로 삽입.

현재 (예시):
```json
"test": "node --import tsx --test 'tests/*.test.ts' 'tests/auth/**/*.test.ts' 'tests/rag/**/*.test.ts' 'tests/scripts/**/*.test.ts'"
```

변경 후:
```json
"test": "node --import tsx --test 'tests/*.test.ts' 'tests/auth/**/*.test.ts' 'tests/rag/**/*.test.ts' 'tests/routing/**/*.test.ts' 'tests/scripts/**/*.test.ts'"
```

Run: `npm test 2>&1 | tail -3` (회귀 baseline + legacy-redirects 2건 = 187+ pass)

- [ ] **Step 13.4: Commit**

```bash
git add tests/routing/legacy-redirects.test.ts tests/routing/atomic-routes.test.ts package.json
git commit -m "$(cat <<'EOF'
test(phase-4-m1): routing 회귀 가드 통합 테스트 (legacy-redirects + atomic-routes)

(1) legacy-redirects.test.ts — next.config redirects() 16건 모두 등록
    + atomic /resources/{law,research}/[slug]는 redirect 등록 안 됨(URL 보존)
(2) atomic-routes.test.ts — atomic 8개 라우트가 (wiki) 그룹 위치 + legacy
    5개 라우트가 (gov)/legacy 위치 + 옛 경로 6건 모두 삭제됨 회귀 가드
package.json test glob에 tests/routing/** 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: CLAUDE.md 변경 이력 entry (팀원 C)

**Files:**
- Modify: `CLAUDE.md` (gitignored, Edit/Write만)

- [ ] **Step 14.1: 변경 이력 추가**

Edit `CLAUDE.md` 변경 이력 표 — 최상단에:

```markdown
| 2026-05-2X | **Phase 4 M1 머지 — 라우팅·IA 기반** — PR #XX (squash `XXXXXXX`) → master. atomic 6 axis (wiki) 그룹 통합 + (gov) → (gov)/legacy/ 11개 디렉터리 mv + (wiki)/page.tsx 신설(/ root entry) + (wiki)/wiki/page.tsx 삭제 + atomic resources 인덱스 slug 변경(-guide) + next.config redirects() 16건 등록 + 내부 링크 11개 파일 /legacy/ prefix + EntryToggle 라벨·아이콘·베타 라벨 갱신 + Header/(wiki)layout 갱신. 검증: 187+ unit + 29+ integration + 568+ 정적 + RUN_SMOKE=1 m3-smoke 4건 PASS + kb:publish:dry-run baseline 535/8/527 유지. sourcePathToHref 변경 0 (atomic URL 보존). Agent Teams 시범 발동(팀 리더 + 팀원 A/B/C) 결과 (성공/실패/조정사항)를 본 entry에 추가. |
```

날짜·PR #·sha는 머지 후 정확한 값으로.

- [ ] **Step 14.2: Commit**

```bash
git add CLAUDE.md
```

⚠️ *CLAUDE.md는 .gitignore* — git add 안 됨. Edit만으로 충분. commit 생략.

확인:
```bash
git status --ignored | grep CLAUDE.md
```
Expected: `CLAUDE.md`이 ignored 목록에 있음. commit 대상 아님.

---

## Task 15: codex-rescue dispatch (팀 리더 단독)

**Files:** —

**Why 팀 리더 단독**: 마일스톤 마무리 검수 게이트. CLAUDE.md §"마일스톤 단위 codex-rescue dispatch" 행동 규칙 정합.

- [ ] **Step 15.1: codex-rescue 백그라운드 dispatch**

Run `Agent` tool with subagent_type `codex:codex-rescue`. prompt 핵심:

```
M1 라우팅·IA 기반 마일스톤 완료. PR 생성 직전 검수 요청.

scope: spec D1~D8 정합 + cross-cutting invariant + 도메인 규칙.
  특히:
  - sourcePathToHref 변경 0 검증 (atomic URL 보존)
  - /legacy/resources/law-guide vs /resources/law/[slug] URL 충돌 없음
  - next.config redirects() 16건 정합
  - file scope 사전 분리 준수 (팀원별 편집 범위 vs 실제 commit)
  - import path alias 정합 (atomic 5개 axis가 (wiki) 그룹 mv 후 깨진 import 0건)
  - kb:publish:dry-run baseline 535/8/527 유지
  - RUN_SMOKE=1 RAG 채팅 출처 링크 atomic 경로 보존

스타일·관용구·라인 코멘트 보지 말 것 (coderabbit이 PR 단계에서 처리).

산출: APPROVE / APPROVE_WITH_FOLLOWUP / CONCERN 판정 + finding 리스트.
```

`run_in_background: true`.

- [ ] **Step 15.2: 백그라운드 task ID 기록**

dispatch 결과의 task ID를 메모. PR 생성 후 결과 회수.

---

## Task 16: PR 생성 (팀 리더 단독)

**Files:** —

- [ ] **Step 16.1: 브랜치 push**

Run:
```bash
git push -u origin feat/phase-4-m1-impl
```

- [ ] **Step 16.2: gh pr create**

Run:
```bash
gh pr create --title "feat(phase-4-m1): 라우팅·IA 기반 — atomic axis 통합 + (gov)/legacy + 호환성 redirect" --body "$(cat <<'EOF'
## Summary

- Phase 4 M1 — 위키·채팅 중심 IA 전면 리뉴얼의 첫 마일스톤
- atomic 6 axis (`disability-types`, `policies`, `agreements`, `domains`, `regions`, `uncategorized`) + `resources/{law,research}/[slug]`를 `(wiki)` Route Group으로 통합 — URL 보존(spec D4 §3.2)
- (gov) 정적 안내 9개 디렉터리 + 2개 인덱스 page.tsx → `/legacy/*` 보존 (spec D1)
- `(wiki)/page.tsx` 신설 — `/` root entry (현 `/wiki` 내용 + 베타 안내 문단 삭제)
- `next.config.ts redirects()` 16건 등록 (D7 호환성)
- 내부 링크 11개 파일 `/legacy/` prefix 일괄 갱신
- EntryToggle 라벨·아이콘·베타 라벨 갱신 (`기관용` → `이전 버전`)

## 결정 잠금 정합 (Spec D1~D8)

- ✅ D1: `(gov)` → `/legacy/*` 보존
- ✅ D4: atomic axis namespace 통합
- ✅ D7: 호환성 영구 redirect
- ✅ D8: Agent Teams 발동 (팀 리더 + 팀원 A/B/C, 내부 Reviewer 미배치)
- ⏳ D2/D3/D5/D6: M2~M3에서 처리

## sourcePathToHref 변경 0 (R1 차단)

`src/lib/rag/retrieval.ts:171` `sourcePathToHref` 로직 변경 없음. atomic 콘텐츠 경로(`content/resources/law/*.md`)와 URL(`/resources/law/[slug]`) 1:1 정합 보존.

## Test plan

- [ ] 187+ unit tests PASS
- [ ] 29+ integration tests PASS
- [ ] 568+ 정적 페이지 build PASS
- [ ] kb:publish:dry-run baseline 535/8/527 유지
- [ ] RUN_SMOKE=1 m3-smoke 4건 PASS (sourceRefs atomic 경로 보존)
- [ ] dev server smoke 13건 새 라우트 + 4건 atomic + 8건 호환성 redirect 모두 정상
- [ ] codex-rescue APPROVE 또는 finding 처리 완료
- [ ] coderabbit critical 처리 완료
- [ ] 위원장 production preview 직접 검증

## Agent Teams 운영 결과 기록

(머지 시 본문에 추가)
- 팀원 A 작업 결과:
- 팀원 B 작업 결과:
- 팀원 C 작업 결과:
- file lock 충돌 발생 여부:
- 베타 제약 영향 여부 (/resume 미지원 등):

## 다음 단계

M1 머지 → M2 plan 작성(팀 리더 단독) → M2 구현(Agent Teams 발동).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 16.3: PR 링크 기록**

PR URL을 위원장에게 보고. codex-rescue 결과 회수 대기.

---

## Task 17: codex-rescue 결과 처리 + 머지 (팀 리더 단독)

**Files:** (codex-rescue finding에 따라 변동)

- [ ] **Step 17.1: codex-rescue 결과 회수**

Run `Agent` tool with `subagent_type: TaskGet` 또는 dispatch 결과 확인.

판정:
- **APPROVE**: 추가 작업 없이 진행
- **APPROVE_WITH_FOLLOWUP**: finding 처리 후 진행
- **CONCERN**: 머지 차단. finding 처리 + 재 dispatch

- [ ] **Step 17.2: critical finding fix (있는 경우)**

CLAUDE.md "Codex stop-time review 활용 시 주의사항" 원칙 정합:
- 즉시 지엽 패치 금지
- 아키텍처 수준 대조 우선
- 동일 계층 반복 지적은 계층 선택 의심

- [ ] **Step 17.3: coderabbit review 대기 + 처리**

PR에 coderabbit 자동 review. critical만 처리. 스타일·관용구는 누적되면 *별도 cleanup PR*로.

- [ ] **Step 17.4: 위원장 production preview 직접 검증**

Vercel preview URL (engccer Hobby) 또는 dev server에서 위원장이 직접 검증:
- `/` 진입 (위키 entry)
- `/wiki` 진입 시 `/`로 redirect 확인
- `/legacy/about` 진입 (이전 안내)
- atomic 페이지 1건 무작위 진입
- EntryToggle 토글 작동
- 베타 라벨 잔재 없음 확인 (스크린 리더로)

- [ ] **Step 17.5: 머지**

위원장 명시 신호 후:
```bash
gh pr merge <PR번호> --squash --admin --delete-branch
```
(--admin: CODEOWNERS 자기 자신 review 불가 우회, 기존 PR 패턴 정합)

- [ ] **Step 17.6: CLAUDE.md 변경 이력 entry 정확한 값 갱신**

T14에서 작성한 entry의 PR # + sha를 정확한 값으로 갱신. Agent Teams 운영 결과(성공/실패/조정사항)도 추가.

- [ ] **Step 17.7: memory 갱신**

`memory/project_phase_status.md`에 M1 머지 entry 추가. `MEMORY.md`의 phase_status 요약 갱신.

---

## 완료 기준

- [ ] master HEAD에 M1 머지 commit
- [ ] 187+ unit + 29+ integration tests PASS
- [ ] 568+ 정적 페이지 build PASS
- [ ] kb:publish:dry-run baseline 535/8/527 유지
- [ ] RUN_SMOKE=1 m3-smoke 4건 PASS
- [ ] 호환성 redirect 16건 모두 작동
- [ ] codex-rescue APPROVE 또는 finding 처리 완료
- [ ] 위원장 production preview 직접 검증 통과
- [ ] CLAUDE.md 변경 이력 + memory 갱신
- [ ] Agent Teams 운영 결과 기록 (시범 발동 평가)

다음 마일스톤: writing-plans 스킬 → M2 plan(콘텐츠 기능 — 위키 entry 재설계 + /library + /media) 작성.
