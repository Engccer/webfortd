# Phase 4 M2 — 콘텐츠 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: spec §7.5 정합 — `superpowers:executing-plans` + **Agent Teams 시범 발동(M2 위원장 컨펌 후 결정)** 또는 단독 진행. 일부 task는 *팀 리더 단독*(통합 file·시드 데이터), 나머지는 팀원 dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위키 entry 재설계(역할별 진입점 5장 + 채팅/자료실/미디어 진입) + 자료실 `/library` 신설(`data/source-pdf/` 4건 노출 + 다운로드) + 미디어 자료실 `/media` 신설(Phase 1.5b 검증된 raster 노출 + alt 텍스트 + 다운로드) + atomic 페이지 footer 원본 PDF 다운로드 링크.

**Architecture:** 위키가 사이트 본체로 승격된(M1) 상태에서 *콘텐츠 자산 노출*과 *역할별 진입*을 활성화. 큐레이션 데이터는 `src/lib/wiki-role-entries.ts`, `src/lib/library-catalog.ts`, `src/lib/media-curation.ts`에 *합리적 default + 위원장-허유진 교수 협업 후 별도 PR 교체* 패턴. atomic 페이지의 source frontmatter(`source_origin: "2024-jbu-work-support-guide"`)를 `src/lib/atomic-source-map.ts`로 매핑해 footer에 원본 다운로드 링크 자동 노출.

**Tech Stack:** Next.js 16 (App Router · Static Files), React 19, TypeScript strict, node:test, Tailwind CSS 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-27-phase-4-wiki-renewal-design.md` §4 M2 + §5.2 신규 파일

**M1 완료 상태 의존**:
- master HEAD = `ef0b3ed` (PR #45)
- `(wiki)/page.tsx` = `/` root entry (현재 WikiHero + PopularPages만)
- atomic 라우트 모두 `(wiki)` 그룹 안
- `(gov)/legacy/*` 보존, `next.config.ts` redirects 16건 활성

**File scope 사전 분리 (spec §7.5.3 정합 — Agent Teams 시범 발동 가정)**:

| 팀원 | scope (편집 허용 파일) |
|------|---------------------|
| 팀 리더 | 시드 데이터 라이브러리 4건 (`src/lib/wiki-role-entries.ts`, `library-catalog.ts`, `media-curation.ts`, `atomic-source-map.ts`), 통합 file `(wiki)/page.tsx`, `KbPageLayout.tsx` (atomic footer 통합) |
| 팀원 A (자료실) | `src/app/(wiki)/library/**`, `src/components/library/**`, `public/library/**` (PDF 정적 서빙) |
| 팀원 B (미디어) | `src/app/(wiki)/media/**`, `src/components/media/**` |
| 팀원 C (인프라·검증·문서) | `tests/library/**`, `tests/media/**` (신규), `src/app/sitemap.ts` (M3 영역, M2는 metadata만), `CLAUDE.md`, package.json test glob |

**큐레이션 콘텐츠 — D6 협업 영역 placeholder**:

본 plan은 *합리적 default 시드*(M1 완료된 atomic 페이지 + `data/source-pdf/` 4건)로 *작동 가능한 baseline*을 구성한다. 위원장-허유진 교수 협업 결과는 *M2 머지 후 별도 PR*로 시드 데이터 라이브러리 4건만 교체(코드 구조 변경 없음).

---

## File Structure

### 신규 파일

| 파일 | 책임 |
|------|------|
| `src/lib/wiki-role-entries.ts` | 위키 entry 역할별 진입점 5장 시드 (교원·관리자·교육청·정책입안자·학부모). 각 항목 = `{ role, title, description, recommended: [{slug, axis, title, reason}] }` 형식. D6 placeholder. |
| `src/lib/library-catalog.ts` | 자료실(`/library`) 자산 카탈로그. `data/source-pdf/` 4건 + 추후 추가 자산. 항목 = `{ slug, title, year, organization, category, summary, fileSize, mimeType, downloadUrl }`. D6 placeholder. |
| `src/lib/media-curation.ts` | 미디어 자료실(`/media`) 노출 자산. Phase 1.5b `_image-mappings.json`에서 `manifest_path != null`인 *검증된 항목*만 + 위원장 추가 큐레이션. 항목 = `{ slug, imagePath, alt, caption, sourceDocSlug, sourceDocTitle }`. D6 placeholder. |
| `src/lib/atomic-source-map.ts` | atomic 페이지 `source_origin` frontmatter → 원본 PDF 매핑. 예: `"2024-jbu-work-support-guide"` → `"/library/2024-jbu-work-support-guide.pdf"`. |
| `src/components/wiki/RoleEntries.tsx` | 위키 entry 역할별 진입점 5장 카드 그리드. `wiki-role-entries.ts` 데이터 사용. |
| `src/components/wiki/ChatLibraryMediaEntries.tsx` | 채팅·자료실·미디어 진입 카드 3개 (위키 entry 하단). |
| `src/components/library/LibraryCard.tsx` | 자료실 자료 카드 (제목·연도·출처·요약·다운로드 버튼). |
| `src/components/library/LibrarySearch.tsx` | 자료실 검색 필터 (제목·카테고리·연도). 클라이언트 컴포넌트, useState. |
| `src/components/library/LibraryGrid.tsx` | 자료실 카드 그리드 + 검색 필터 통합. |
| `src/components/media/MediaCard.tsx` | 미디어 카드 (썸네일·캡션·alt 미리보기·다운로드 버튼). |
| `src/components/media/MediaDetail.tsx` | 미디어 상세 (전체 이미지 + alt 전문 + 출처 atomic 페이지 링크 + 다운로드). |
| `src/components/media/MediaGrid.tsx` | 미디어 카드 그리드 + 검색 필터. |
| `src/components/kb/KbSourceFooter.tsx` | atomic 페이지 footer "원본 PDF 다운로드" 링크. `atomic-source-map.ts` 사용. |
| `src/app/(wiki)/library/page.tsx` | 자료실 entry (`/library`). LibraryGrid 렌더. |
| `src/app/(wiki)/library/[slug]/page.tsx` | 자료실 자료 상세 (메타데이터 + 다운로드 + 관련 atomic 페이지 링크). |
| `src/app/(wiki)/media/page.tsx` | 미디어 자료실 entry (`/media`). MediaGrid 렌더. |
| `src/app/(wiki)/media/[slug]/page.tsx` | 미디어 상세 (`/media/[slug]`). MediaDetail 렌더. |
| `public/library/` | PDF 정적 서빙 디렉터리. `data/source-pdf/`의 파일들을 *심링크* 또는 *복사*. |
| `tests/library/library-catalog.test.ts` | library-catalog 데이터 정합 + LibrarySearch 필터 회귀 가드. |
| `tests/media/media-curation.test.ts` | media-curation 데이터 정합 + manifest_path 존재 회귀 가드. |
| `tests/routing/wiki-renewal-routes.test.ts` | `/library`·`/media`·`/library/[slug]`·`/media/[slug]` 라우트 존재 회귀 가드. |
| `tests/lib/atomic-source-map.test.ts` | atomic-source-map 매핑 정합 (frontmatter source_origin → /library/*.pdf). |

### 갱신 파일

| 파일 | 변경 |
|------|------|
| `src/app/(wiki)/page.tsx` | WikiHero + RoleEntries + PopularPages + ChatLibraryMediaEntries 통합. 통합 file = 팀 리더 단독 |
| `src/components/kb/KbPageLayout.tsx` | `<KbSourceFooter slug={slug} axis={axis} />` 추가 (article 안 footer 영역). 통합 file = 팀 리더 단독 |
| `CLAUDE.md` (gitignored) | 변경 이력 entry (M2 머지 후) |
| `package.json` | test glob에 `tests/library/**/*.test.ts`, `tests/media/**/*.test.ts` 추가 |

### 변경 0 (보존)

- `src/lib/rag/retrieval.ts` `sourcePathToHref` — 변경 0
- `src/lib/wiki-popular.ts` — PopularPages 데이터 그대로 (큐레이션 갱신은 별도 PR)
- atomic 라우트 페이지 본문 — KbPageLayout만 갱신, atomic page.tsx 자체는 변경 0
- `content/**/*.md` — 콘텐츠 정본

---

## 사전 점검 (Task 0)

**Files:** —

- [ ] **Step 0.1: 브랜치 + master sync 확인**

Run:
```bash
git status -s
git branch --show-current
git log --oneline -1 master
```
Expected: 브랜치는 본 plan 작업 시 `docs/phase-4-m2-plan`, 구현 시 `feat/phase-4-m2-impl`. master HEAD = `ef0b3ed`.

- [ ] **Step 0.2: 회귀 baseline 측정**

Run:
```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5
npm run test:integration 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5
npm run build 2>&1 | grep -E "(static pages|Error|fail)" | head -3
```
Expected baseline:
- unit: 207 / 206 pass / 0 fail / 1 skipped (m3-sdk-probe)
- integration: 35 / 32 pass / 3 fail (env 의존)
- build: 570 정적 페이지

- [ ] **Step 0.3: 자산 인벤토리 재확인**

Run:
```bash
ls data/source-pdf/
node -e "const d = require('./content/_image-mappings.json'); const valid = Object.entries(d.mappings).filter(([_, v]) => v.manifest_path); console.log('검증된 미디어:', valid.length, '/', Object.keys(d.mappings).length);"
```
Expected:
- 4 PDF 확인 (2023 근무지원·인사관리, 2024 중부대·지원인력)
- 검증된 미디어(manifest_path != null) 7~15건 (Phase 1.5b 결과)

- [ ] **Step 0.4: 구현 브랜치 생성**

Run:
```bash
git checkout master
git pull origin master
git checkout -b feat/phase-4-m2-impl
```

---

## Task 1: 시드 데이터 라이브러리 4건 신설 (팀 리더)

**Files:**
- Create: `src/lib/wiki-role-entries.ts`
- Create: `src/lib/library-catalog.ts`
- Create: `src/lib/media-curation.ts`
- Create: `src/lib/atomic-source-map.ts`

**Why 팀 리더 단독**: 시드 데이터는 모든 컴포넌트의 baseline. 팀원 dispatch 전에 끝나야 컴포넌트 작성 가능.

### Task 1.1: `wiki-role-entries.ts` — 역할별 진입점 5장

- [ ] **Step 1.1.1: 파일 작성**

`src/lib/wiki-role-entries.ts`:

```typescript
/**
 * 위키 entry 역할별 진입점 5장 시드 데이터.
 *
 * 위원장 영구 원칙(앱 정체성 §사용자 다층) 정합 — 장애인교원·관리자·교육청·정책입안자·학부모 다층.
 * D6 협업 영역 placeholder — 위원장-허유진 교수 협업 결과는 M2 머지 후 별도 PR로 교체.
 */

export type Role = "teacher" | "manager" | "office" | "policy" | "parent"

export interface RoleRecommendation {
  slug: string
  axis: "disability-types" | "policies" | "agreements" | "domains" | "regions" | "resources/law" | "resources/research" | "uncategorized"
  title: string
  reason: string
}

export interface RoleEntry {
  role: Role
  title: string
  description: string
  icon: "user" | "school" | "building" | "scale" | "heart"
  recommended: RoleRecommendation[]
}

export const ROLE_ENTRIES: RoleEntry[] = [
  {
    role: "teacher",
    title: "장애인교원",
    description: "수업·업무에 필요한 편의지원과 보조공학 안내",
    icon: "user",
    recommended: [
      {
        slug: "2024-staff-p-183",
        axis: "disability-types",
        title: "특수 마우스",
        reason: "보조공학기기 신청 가이드",
      },
      {
        slug: "2024-staff-p-159",
        axis: "disability-types",
        title: "비교과 활동 내용 입력 (학교생활기록부)",
        reason: "학생부 입력 보조 지원",
      },
    ],
  },
  {
    role: "manager",
    title: "학교 관리자",
    description: "장애인교원 채용·근무 환경 조성 안내",
    icon: "school",
    recommended: [
      {
        slug: "2024-jbu-p-062",
        axis: "policies",
        title: "정서적 학대",
        reason: "교권 보호 정책",
      },
    ],
  },
  {
    role: "office",
    title: "교육청 인사담당자",
    description: "정책·법령·운영 매뉴얼 모음",
    icon: "building",
    recommended: [
      {
        slug: "ordinance-comparison",
        axis: "resources/law",
        title: "시도교육청 편의지원 조례 비교",
        reason: "9개 시도 조례 비교 분석 (2026-03-11)",
      },
    ],
  },
  {
    role: "policy",
    title: "정책 입안자",
    description: "통계·연구·해외 사례",
    icon: "scale",
    recommended: [],
  },
  {
    role: "parent",
    title: "장애학생 부모",
    description: "장애인교원과의 소통, 자녀 교육에 대한 안내",
    icon: "heart",
    recommended: [],
  },
]
```

⚠️ *Carry-over* (M2 머지 후 별도 PR): policy·parent 역할 추천 atomic 페이지 시드 (D6 협업 영역). 현재 placeholder = 빈 배열.

- [ ] **Step 1.1.2: 단위 테스트 작성**

`tests/lib/wiki-role-entries.test.ts` (또는 통합 가능):

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROLE_ENTRIES } from '../../src/lib/wiki-role-entries'

test('ROLE_ENTRIES — 5장 정확 (다층 사용자 원칙)', () => {
  assert.equal(ROLE_ENTRIES.length, 5)
})

test('ROLE_ENTRIES — 모든 role unique', () => {
  const roles = ROLE_ENTRIES.map((e) => e.role)
  assert.equal(new Set(roles).size, roles.length)
})

test('ROLE_ENTRIES — 각 항목 필수 필드 (title, description, icon)', () => {
  for (const e of ROLE_ENTRIES) {
    assert.ok(e.title, `${e.role}: title 누락`)
    assert.ok(e.description, `${e.role}: description 누락`)
    assert.ok(e.icon, `${e.role}: icon 누락`)
  }
})
```

- [ ] **Step 1.1.3: 테스트 실행**

Run: `npm test -- tests/lib/wiki-role-entries.test.ts 2>&1 | tail -3`
Expected: 3 tests, 3 pass.

- [ ] **Step 1.1.4: Commit**

```bash
git add src/lib/wiki-role-entries.ts tests/lib/wiki-role-entries.test.ts
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): wiki-role-entries 시드 — 역할별 진입점 5장

장애인교원·학교 관리자·교육청·정책 입안자·장애학생 부모 5장 시드.
spec D6 협업 영역 placeholder (policy·parent 추천은 빈 배열, M2 머지
후 허유진 교수 협업 결과로 별도 PR 교체).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: `library-catalog.ts` — 자료실 자산 4건

- [ ] **Step 1.2.1: 파일 작성**

`src/lib/library-catalog.ts`:

```typescript
/**
 * 자료실(/library) 자산 카탈로그.
 *
 * data/source-pdf/의 PDF 4건을 시드로 노출. D6 협업 영역 placeholder — 위원장-허유진 교수
 * 협업 결과 추가 자산은 M2 머지 후 별도 PR.
 *
 * downloadUrl은 public/library/ 정적 서빙 경로. Task 2.5에서 PDF 복사·심링크.
 */

export type LibraryCategory = "guide" | "policy" | "manual" | "agreement"

export interface LibraryItem {
  slug: string
  title: string
  year: number
  organization: string
  category: LibraryCategory
  summary: string
  fileSize: string
  mimeType: "application/pdf" | "application/x-hwpx"
  downloadUrl: string
  relatedAtomicAxis?: string
  relatedAtomicPrefix?: string
}

export const LIBRARY_ITEMS: LibraryItem[] = [
  {
    slug: "2023-disability-work-support-research",
    title: "장애유형별 장애인교원 근무 지원 방안 최종보고서",
    year: 2023,
    organization: "교육부",
    category: "policy",
    summary:
      "장애유형별 근무 지원 방안을 종합 분석한 정책 보고서. 9개 시도 사례 + 외국 사례 + 정책 제언.",
    fileSize: "12.3 MB",
    mimeType: "application/pdf",
    downloadUrl: "/library/2023-disability-work-support-research.pdf",
  },
  {
    slug: "2023-hr-guide",
    title: "장애인교원 인사관리 안내서",
    year: 2023,
    organization: "교육부",
    category: "guide",
    summary:
      "장애인교원 채용·배치·근무·복무 전 과정 인사 안내. 188개 atomic 페이지로 분해됨.",
    fileSize: "15.3 MB",
    mimeType: "application/pdf",
    downloadUrl: "/library/2023-hr-guide.pdf",
    relatedAtomicAxis: "disability-types",
    relatedAtomicPrefix: "2023-hr",
  },
  {
    slug: "2024-jbu-work-support-guide",
    title: "중부대학교 장애인교원 근무지원 안내자료",
    year: 2024,
    organization: "중부대학교",
    category: "guide",
    summary:
      "중부대학교 사업으로 제작된 장애인교원 근무지원 안내자료. 시범 사이트 콘텐츠 원본.",
    fileSize: "8.1 MB",
    mimeType: "application/pdf",
    downloadUrl: "/library/2024-jbu-work-support-guide.pdf",
    relatedAtomicAxis: "disability-types",
    relatedAtomicPrefix: "2024-jbu",
  },
  {
    slug: "2024-support-staff-duty-guide",
    title: "장애인교원 지원인력 직무 수행 안내자료",
    year: 2024,
    organization: "교육부",
    category: "manual",
    summary:
      "지원인력(근로지원인 등) 직무 수행 안내 156쪽 자료. atomic 페이지 분해됨.",
    fileSize: "5.4 MB",
    mimeType: "application/pdf",
    downloadUrl: "/library/2024-support-staff-duty-guide.pdf",
    relatedAtomicAxis: "disability-types",
    relatedAtomicPrefix: "2024-staff",
  },
]

export function getLibraryItemBySlug(slug: string): LibraryItem | undefined {
  return LIBRARY_ITEMS.find((item) => item.slug === slug)
}

export function filterLibraryItems(opts: {
  category?: LibraryCategory
  query?: string
}): LibraryItem[] {
  const { category, query } = opts
  const q = query?.trim().toLowerCase() ?? ""
  return LIBRARY_ITEMS.filter((item) => {
    if (category && item.category !== category) return false
    if (q) {
      const hay = `${item.title} ${item.organization} ${item.summary}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
```

- [ ] **Step 1.2.2: 단위 테스트 작성**

`tests/library/library-catalog.test.ts`:

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIBRARY_ITEMS, getLibraryItemBySlug, filterLibraryItems } from '../../src/lib/library-catalog'

test('LIBRARY_ITEMS — 시드 4건 (data/source-pdf/ 정합)', () => {
  assert.equal(LIBRARY_ITEMS.length, 4)
})

test('LIBRARY_ITEMS — 모든 slug unique', () => {
  const slugs = LIBRARY_ITEMS.map((i) => i.slug)
  assert.equal(new Set(slugs).size, slugs.length)
})

test('LIBRARY_ITEMS — 모든 downloadUrl이 /library/ prefix', () => {
  for (const item of LIBRARY_ITEMS) {
    assert.ok(item.downloadUrl.startsWith('/library/'), `${item.slug}: downloadUrl prefix 위반`)
  }
})

test('getLibraryItemBySlug — 존재하는 slug 조회 성공', () => {
  const item = getLibraryItemBySlug('2023-hr-guide')
  assert.ok(item)
  assert.equal(item?.year, 2023)
})

test('getLibraryItemBySlug — 존재하지 않는 slug undefined 반환', () => {
  assert.equal(getLibraryItemBySlug('not-exists'), undefined)
})

test('filterLibraryItems — category guide만 2건', () => {
  const result = filterLibraryItems({ category: 'guide' })
  assert.equal(result.length, 2)
  assert.ok(result.every((i) => i.category === 'guide'))
})

test('filterLibraryItems — query "인사관리" 부분 매칭', () => {
  const result = filterLibraryItems({ query: '인사관리' })
  assert.equal(result.length, 1)
  assert.equal(result[0].slug, '2023-hr-guide')
})
```

- [ ] **Step 1.2.3: 테스트 실행**

Run: `npm test -- tests/library/library-catalog.test.ts 2>&1 | tail -3`
Expected: 7 tests, 7 pass.

- [ ] **Step 1.2.4: Commit**

```bash
git add src/lib/library-catalog.ts tests/library/library-catalog.test.ts
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): library-catalog 시드 — data/source-pdf 4건

2023 근무지원 방안·인사관리 + 2024 중부대·지원인력 4건 시드 + filter/getter
함수. spec D2(현재 보유 자산만) 정합. spec D6 협업 영역 placeholder
(추가 자산은 M2 머지 후 별도 PR).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.3: `media-curation.ts` — 미디어 자산 노출

- [ ] **Step 1.3.1: 파일 작성**

`src/lib/media-curation.ts`:

```typescript
/**
 * 미디어 자료실(/media) 노출 자산.
 *
 * Phase 1.5b _image-mappings.json에서 manifest_path != null인 *검증된 항목*만 시드.
 * D6 협업 영역 placeholder — 위원장-허유진 교수 협업 결과 추가 자산은 M2 머지 후
 * 별도 PR.
 */

export interface MediaItem {
  slug: string
  imagePath: string
  alt: string
  caption: string
  sourceDocSlug: string
  sourceDocTitle: string
  sourceAxis: "disability-types" | "policies" | "agreements" | "domains" | "regions" | "resources/law" | "resources/research" | "uncategorized"
}

export const MEDIA_ITEMS: MediaItem[] = [
  {
    slug: "2024-staff-p-023-seat-assignment-flow",
    imagePath: "/source-images/2024-support-staff-duty-guide/page-025-render.png",
    alt: "학생 좌석 배치 지원 절차를 시각장애인교원과 지원인력 간의 상호작용으로 보여주는 순서도입니다. 시각장애인교원이 좌석 배치 및 모둠 구성 지원을 요청하면, 지원인력이 그 내용을 확인하고 요청에 따라 좌석 배치와 모둠 구성을 수행합니다. 이후 지원인력이 완성된 현황을 설명하고 시각장애인교원이 요청 내용과의 일치 여부를 확인하는 4단계 과정으로 구성됩니다.",
    caption: "학생 좌석 배치 지원 절차 (4단계)",
    sourceDocSlug: "2024-staff-p-023",
    sourceDocTitle: "학생 좌석 배치 지원",
    sourceAxis: "disability-types",
  },
]

export function getMediaItemBySlug(slug: string): MediaItem | undefined {
  return MEDIA_ITEMS.find((item) => item.slug === slug)
}

export function filterMediaItems(opts: {
  axis?: MediaItem["sourceAxis"]
  query?: string
}): MediaItem[] {
  const { axis, query } = opts
  const q = query?.trim().toLowerCase() ?? ""
  return MEDIA_ITEMS.filter((item) => {
    if (axis && item.sourceAxis !== axis) return false
    if (q) {
      const hay = `${item.caption} ${item.alt} ${item.sourceDocTitle}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
```

⚠️ *Carry-over* (M2 머지 후 별도 PR): `_image-mappings.json` 다른 검증된 항목(현재 known_answer 7건 + 위원장 추가 큐레이션) 시드 확장.

- [ ] **Step 1.3.2: 단위 테스트 작성**

`tests/media/media-curation.test.ts`:

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MEDIA_ITEMS, getMediaItemBySlug, filterMediaItems } from '../../src/lib/media-curation'

const repoRoot = process.cwd()

test('MEDIA_ITEMS — 시드 1건 이상 (최소 baseline)', () => {
  assert.ok(MEDIA_ITEMS.length >= 1)
})

test('MEDIA_ITEMS — 모든 slug unique', () => {
  const slugs = MEDIA_ITEMS.map((i) => i.slug)
  assert.equal(new Set(slugs).size, slugs.length)
})

test('MEDIA_ITEMS — imagePath public/source-images 존재 검증', () => {
  for (const item of MEDIA_ITEMS) {
    const fullPath = join(repoRoot, 'public', item.imagePath.replace(/^\//, ''))
    assert.ok(existsSync(fullPath), `${item.slug}: imagePath 누락 ${item.imagePath}`)
  }
})

test('MEDIA_ITEMS — 모든 alt 50자 이상 (의미 있는 설명 보장)', () => {
  for (const item of MEDIA_ITEMS) {
    assert.ok(item.alt.length >= 50, `${item.slug}: alt 너무 짧음 (${item.alt.length}자)`)
  }
})

test('getMediaItemBySlug — 존재하는 slug 조회', () => {
  const item = getMediaItemBySlug('2024-staff-p-023-seat-assignment-flow')
  assert.ok(item)
})

test('filterMediaItems — axis disability-types 1건 이상', () => {
  const result = filterMediaItems({ axis: 'disability-types' })
  assert.ok(result.length >= 1)
})
```

- [ ] **Step 1.3.3: 테스트 실행**

Run: `npm test -- tests/media/media-curation.test.ts 2>&1 | tail -3`
Expected: 6 tests, 6 pass.

⚠️ *주의*: `public/source-images/2024-support-staff-duty-guide/page-025-render.png` 파일 존재 필수. 없으면 fail. Phase 1.5b 결과물로 이미 존재 가정.

- [ ] **Step 1.3.4: Commit**

```bash
git add src/lib/media-curation.ts tests/media/media-curation.test.ts
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): media-curation 시드 — 검증된 raster 1건

Phase 1.5b known_answer 7건 중 2024-staff-p-023 좌석 배치 순서도 1건
baseline 시드 + getter/filter. spec D6 협업 영역 placeholder
(추가 큐레이션은 M2 머지 후 별도 PR).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.4: `atomic-source-map.ts` — atomic 페이지 source_origin → /library URL

- [ ] **Step 1.4.1: 파일 작성**

`src/lib/atomic-source-map.ts`:

```typescript
/**
 * atomic 페이지의 source_origin frontmatter → 원본 PDF 다운로드 URL 매핑.
 *
 * KbPageLayout의 footer에서 사용. source_origin이 없거나 미매핑이면 footer 다운로드
 * 링크 미노출 (graceful degradation).
 *
 * library-catalog.ts와 정합 — library 자료의 slug가 source_origin과 일치하도록 명명.
 */

import { LIBRARY_ITEMS } from "./library-catalog"

export interface SourceMapEntry {
  origin: string
  libraryItemSlug: string
}

export const SOURCE_MAP: SourceMapEntry[] = [
  { origin: "2023-hr-guide", libraryItemSlug: "2023-hr-guide" },
  { origin: "2024-jbu-work-support-guide", libraryItemSlug: "2024-jbu-work-support-guide" },
  { origin: "2024-support-staff-duty-guide", libraryItemSlug: "2024-support-staff-duty-guide" },
]

export function getSourceDownload(sourceOrigin: string | undefined): { url: string; title: string; fileSize: string } | undefined {
  if (!sourceOrigin) return undefined
  const entry = SOURCE_MAP.find((e) => e.origin === sourceOrigin)
  if (!entry) return undefined
  const item = LIBRARY_ITEMS.find((i) => i.slug === entry.libraryItemSlug)
  if (!item) return undefined
  return { url: item.downloadUrl, title: item.title, fileSize: item.fileSize }
}
```

- [ ] **Step 1.4.2: 단위 테스트 작성**

`tests/lib/atomic-source-map.test.ts`:

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOURCE_MAP, getSourceDownload } from '../../src/lib/atomic-source-map'
import { LIBRARY_ITEMS } from '../../src/lib/library-catalog'

test('SOURCE_MAP — 모든 libraryItemSlug가 LIBRARY_ITEMS에 존재', () => {
  for (const entry of SOURCE_MAP) {
    const found = LIBRARY_ITEMS.find((i) => i.slug === entry.libraryItemSlug)
    assert.ok(found, `${entry.origin} → ${entry.libraryItemSlug}: library-catalog에 미존재`)
  }
})

test('getSourceDownload — 매핑된 origin 정상 반환', () => {
  const result = getSourceDownload('2024-jbu-work-support-guide')
  assert.ok(result)
  assert.equal(result?.url, '/library/2024-jbu-work-support-guide.pdf')
  assert.ok(result?.title.includes('중부대'))
})

test('getSourceDownload — undefined origin → undefined', () => {
  assert.equal(getSourceDownload(undefined), undefined)
})

test('getSourceDownload — 미매핑 origin → undefined (graceful)', () => {
  assert.equal(getSourceDownload('not-mapped-origin'), undefined)
})
```

- [ ] **Step 1.4.3: 테스트 실행**

Run: `npm test -- tests/lib/atomic-source-map.test.ts 2>&1 | tail -3`
Expected: 4 tests, 4 pass.

- [ ] **Step 1.4.4: Commit**

```bash
git add src/lib/atomic-source-map.ts tests/lib/atomic-source-map.test.ts
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): atomic-source-map — frontmatter source_origin → /library

atomic 페이지의 source_origin을 library-catalog의 자료 slug로 매핑.
KbPageLayout footer 다운로드 링크용. graceful degradation (미매핑·
undefined origin 모두 undefined 반환).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.5: package.json test glob 갱신

- [ ] **Step 1.5.1: glob 추가**

Edit `package.json` `test` 스크립트:

```json
"test": "node --conditions react-server --import tsx --test 'tests/*.test.ts' 'tests/auth/**/*.test.ts' 'tests/lib/**/*.test.ts' 'tests/library/**/*.test.ts' 'tests/media/**/*.test.ts' 'tests/rag/**/*.test.ts' 'tests/routing/**/*.test.ts' 'tests/scripts/**/*.test.ts'"
```

(알파벳 순: lib < library < media < rag < routing)

- [ ] **Step 1.5.2: 전체 테스트 회귀 확인**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5`
Expected: 207 + 20 (Task 1.x 추가) = 227 / 226 pass / 0 fail / 1 skipped.

- [ ] **Step 1.5.3: Commit**

```bash
git add package.json
git commit -m "test(phase-4-m2): package.json glob에 tests/library tests/media 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

---

## Task 2: 자료실 `/library` 라우트 + UI (팀원 A scope)

**Files:**
- Create: `src/components/library/LibraryCard.tsx`
- Create: `src/components/library/LibrarySearch.tsx`
- Create: `src/components/library/LibraryGrid.tsx`
- Create: `src/app/(wiki)/library/page.tsx`
- Create: `src/app/(wiki)/library/[slug]/page.tsx`
- Create: `public/library/.gitkeep`
- Copy/symlink: `data/source-pdf/*.pdf` → `public/library/`

### Task 2.1: `LibraryCard.tsx`

- [ ] **Step 2.1.1: 컴포넌트 작성**

`src/components/library/LibraryCard.tsx`:

```tsx
import Link from "next/link"
import { FileText, Download } from "lucide-react"
import type { LibraryItem } from "@/lib/library-catalog"

const CATEGORY_LABEL: Record<LibraryItem["category"], string> = {
  guide: "안내서",
  policy: "정책 보고서",
  manual: "매뉴얼",
  agreement: "단체협약",
}

interface LibraryCardProps {
  item: LibraryItem
}

export function LibraryCard({ item }: LibraryCardProps) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <header className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">
            <Link
              href={`/library/${item.slug}`}
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {item.title}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.year}년 · {item.organization} · {CATEGORY_LABEL[item.category]}
          </p>
        </div>
      </header>
      <p className="mb-4 flex-1 text-sm text-muted-foreground">{item.summary}</p>
      <footer className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{item.fileSize}</span>
        <a
          href={item.downloadUrl}
          download
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${item.title} 다운로드 (${item.fileSize})`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          다운로드
        </a>
      </footer>
    </article>
  )
}
```

- [ ] **Step 2.1.2: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | grep -v "tests/rag" | tail -3` (rag baseline 제외)
Expected: 0 errors in library 영역.

- [ ] **Step 2.1.3: Commit**

```bash
git add src/components/library/LibraryCard.tsx
git commit -m "feat(phase-4-m2): LibraryCard 컴포넌트 — 자료실 카드

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 2.2: `LibrarySearch.tsx`

- [ ] **Step 2.2.1: 컴포넌트 작성**

`src/components/library/LibrarySearch.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import type { LibraryCategory } from "@/lib/library-catalog"

const CATEGORY_OPTIONS: Array<{ value: LibraryCategory | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "guide", label: "안내서" },
  { value: "policy", label: "정책 보고서" },
  { value: "manual", label: "매뉴얼" },
  { value: "agreement", label: "단체협약" },
]

interface LibrarySearchProps {
  onChange: (state: { category: LibraryCategory | "all"; query: string }) => void
}

export function LibrarySearch({ onChange }: LibrarySearchProps) {
  const [category, setCategory] = useState<LibraryCategory | "all">("all")
  const [query, setQuery] = useState("")

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="library-search" className="sr-only">자료실 검색</label>
        <input
          id="library-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange({ category, query: e.target.value })
          }}
          placeholder="자료 제목·기관 검색"
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="library-category" className="sr-only">자료실 카테고리</label>
        <select
          id="library-category"
          value={category}
          onChange={(e) => {
            const next = e.target.value as LibraryCategory | "all"
            setCategory(next)
            onChange({ category: next, query })
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.2.2: Commit**

```bash
git add src/components/library/LibrarySearch.tsx
git commit -m "feat(phase-4-m2): LibrarySearch 컴포넌트 — 검색·카테고리 필터

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 2.3: `LibraryGrid.tsx`

- [ ] **Step 2.3.1: 컴포넌트 작성**

`src/components/library/LibraryGrid.tsx`:

```tsx
"use client"

import { useState } from "react"
import { LIBRARY_ITEMS, filterLibraryItems, type LibraryCategory } from "@/lib/library-catalog"
import { LibraryCard } from "./LibraryCard"
import { LibrarySearch } from "./LibrarySearch"

export function LibraryGrid() {
  const [filtered, setFiltered] = useState(LIBRARY_ITEMS)

  return (
    <div>
      <LibrarySearch
        onChange={({ category, query }) => {
          const opts = {
            category: category === "all" ? undefined : (category as LibraryCategory),
            query,
          }
          setFiltered(filterLibraryItems(opts))
        }}
      />
      {filtered.length === 0 ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
        >
          검색 결과가 없습니다.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <LibraryCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2.3.2: Commit**

```bash
git add src/components/library/LibraryGrid.tsx
git commit -m "feat(phase-4-m2): LibraryGrid — 카드 그리드 + 필터 통합

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 2.4: `/library` 라우트

- [ ] **Step 2.4.1: page.tsx 작성**

`src/app/(wiki)/library/page.tsx`:

```tsx
import type { Metadata } from "next"
import { LibraryGrid } from "@/components/library/LibraryGrid"

export const metadata: Metadata = {
  title: "자료실",
  description: "장애인교원 정책·법령·안내서 원본 PDF·HWPX 자료실. 4건 시작.",
}

export default function LibraryPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">자료실</h1>
        <p className="mt-2 text-muted-foreground">
          정책 보고서·안내서·매뉴얼·단체협약 등 원본 자료를 다운로드할 수 있습니다.
        </p>
      </header>
      <LibraryGrid />
    </section>
  )
}
```

- [ ] **Step 2.4.2: `/library/[slug]` 상세 페이지 작성**

`src/app/(wiki)/library/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download, FileText } from "lucide-react"
import { LIBRARY_ITEMS, getLibraryItemBySlug } from "@/lib/library-catalog"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return LIBRARY_ITEMS.map((item) => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = getLibraryItemBySlug(slug)
  if (!item) return { title: "자료를 찾을 수 없습니다" }
  return { title: item.title, description: item.summary }
}

export default async function LibraryItemPage({ params }: PageProps) {
  const { slug } = await params
  const item = getLibraryItemBySlug(slug)
  if (!item) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/library"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        자료실 목록
      </Link>
      <header className="mb-6 flex items-start gap-4 border-b border-border pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{item.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.year}년 · {item.organization} · {item.fileSize}
          </p>
        </div>
      </header>
      <p className="mb-8 text-base text-foreground">{item.summary}</p>
      <a
        href={item.downloadUrl}
        download
        className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={`${item.title} PDF 다운로드 (${item.fileSize})`}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        원본 PDF 다운로드
      </a>
      {item.relatedAtomicAxis && item.relatedAtomicPrefix && (
        <section className="mt-10 rounded-md border border-border bg-muted/30 p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">관련 atomic 페이지</h2>
          <p className="text-sm text-muted-foreground">
            이 자료는 위키의 atomic 페이지로 분해되어 있습니다. 위키에서{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">/{item.relatedAtomicAxis}/{item.relatedAtomicPrefix}-*</code>{" "}
            슬러그로 시작하는 페이지들을 탐색하세요.
          </p>
        </section>
      )}
    </article>
  )
}
```

- [ ] **Step 2.4.3: 빌드 검증**

Run: `npm run build 2>&1 | grep -E "(static pages|Error|library)" | head -10`
Expected: build PASS. `/library`, `/library/[slug]` 라우트 등록 + 4건 generateStaticParams.

- [ ] **Step 2.4.4: Commit**

```bash
git add "src/app/(wiki)/library"
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): /library 라우트 — entry + 자료 상세

/library (entry, LibraryGrid) + /library/[slug] (상세, generateStaticParams
로 4건 정적 빌드). atomic 페이지와의 관련성 안내 박스 포함.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.5: `public/library/` 정적 PDF 서빙

- [ ] **Step 2.5.1: 디렉터리 + .gitkeep**

Run:
```bash
mkdir -p public/library
touch public/library/.gitkeep
```

- [ ] **Step 2.5.2: PDF 심링크 (개발용) + .gitignore 등록**

⚠️ *결정*: PDF는 *심링크*로 dev 서빙. *production*은 GitHub repo에 PDF 자체를 commit하지 않고 *Vercel deploy 시 빌드 step에서 복사* 또는 *공개 CDN 사용*.

본 task는 *최소 시범*으로 *복사* (Vercel 빌드 시 public/library/*.pdf 정적 서빙). data/source-pdf/는 .gitignore에 이미 있다고 가정. public/library/*.pdf도 .gitignore.

Run:
```bash
cp data/source-pdf/*.pdf public/library/ 2>/dev/null || echo "복사 실패 — data/source-pdf/ 확인"
ls -la public/library/
```

Expected: 4 PDF 복사 + .gitkeep.

- [ ] **Step 2.5.3: 파일명 정합 (library-catalog.ts downloadUrl과 일치)**

⚠️ *주의*: `data/source-pdf/`의 파일명이 한국어/공백 포함. `library-catalog.ts`의 downloadUrl은 ASCII slug (예: `2023-hr-guide.pdf`). 따라서 *rename 또는 ASCII slug로 복사* 필요.

Run:
```bash
cd public/library
mv "2023 장애유형별 장애인교원 근무 지원 방안_최종보고서.pdf" "2023-disability-work-support-research.pdf" 2>/dev/null
mv "2023 장애인교원 인사관리 안내서.pdf" "2023-hr-guide.pdf" 2>/dev/null
mv "241210_책자_내지_중부대학교_장애인교원_근무지원_안내자료_V4.pdf" "2024-jbu-work-support-guide.pdf" 2>/dev/null
mv "내지_장애인교원_지원인력_직무_수행_안내자료인쇄용_156P_수정.pdf" "2024-support-staff-duty-guide.pdf" 2>/dev/null
ls -la
cd -
```

Expected: 4 PDF (ASCII slug) + .gitkeep.

- [ ] **Step 2.5.4: .gitignore 등록**

Edit `.gitignore` — `public/library/*.pdf` 추가 (라이센스·용량 회피):

```
# Phase 4 M2 — public/library PDF는 빌드/dev 시점에만 존재
public/library/*.pdf
!public/library/.gitkeep
```

⚠️ *Vercel 배포 정책 결정*: production 빌드 시 PDF 누락 위험. 옵션:
- (a) PDF를 .gitignore에서 빼서 repo에 commit (약 40MB)
- (b) Vercel 빌드 step에서 외부 CDN 또는 storage(S3 등) 다운로드 → public/library/로 복사
- (c) 시범 단계는 (a) — commit. M3에서 (b)로 갱신.

본 plan은 (a) 채택. .gitignore 등록 *안 함*. 위 sed 명령 skip.

- [ ] **Step 2.5.5: PDF commit**

Run:
```bash
git add public/library/
git commit -m "$(cat <<'EOF'
chore(phase-4-m2): public/library/ — PDF 4건 정적 서빙

data/source-pdf/의 4건을 ASCII slug로 rename해 public/library/에 복사.
library-catalog.ts downloadUrl과 정합.

시범 단계는 repo commit (약 40MB). M3에서 외부 CDN/storage로 갱신 검토.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

⚠️ *주의*: 40MB PR diff. GitHub PR 검수 시 첨부 파일 표시 안 됨. *PR description에 명시*.

- [ ] **Step 2.5.6: smoke — /library/2023-hr-guide.pdf 다운로드 확인**

Run:
```bash
npm run build 2>&1 | tail -3
npm run dev 2>&1 > /tmp/dev-m2-t2.log &
sleep 6
curl -s -o /dev/null -w "/library/2023-hr-guide.pdf → %{http_code} (%{size_download} bytes)\n" http://localhost:3000/library/2023-hr-guide.pdf
pkill -f "next dev" 2>/dev/null
sleep 1
```
Expected: 200 + 15MB+ bytes.

---

## Task 3: 미디어 자료실 `/media` 라우트 + UI (팀원 B scope)

**Files:**
- Create: `src/components/media/MediaCard.tsx`
- Create: `src/components/media/MediaDetail.tsx`
- Create: `src/components/media/MediaGrid.tsx`
- Create: `src/app/(wiki)/media/page.tsx`
- Create: `src/app/(wiki)/media/[slug]/page.tsx`

### Task 3.1: `MediaCard.tsx`

- [ ] **Step 3.1.1: 컴포넌트 작성**

`src/components/media/MediaCard.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"
import type { MediaItem } from "@/lib/media-curation"

interface MediaCardProps {
  item: MediaItem
}

export function MediaCard({ item }: MediaCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/media/${item.slug}`}
        className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <div className="relative aspect-video bg-muted">
          <Image
            src={item.imagePath}
            alt={item.alt}
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-contain"
          />
        </div>
        <div className="p-4">
          <h3 className="text-base font-semibold text-foreground hover:underline">
            {item.caption}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            출처: {item.sourceDocTitle}
          </p>
        </div>
      </Link>
    </article>
  )
}
```

- [ ] **Step 3.1.2: Commit**

```bash
git add src/components/media/MediaCard.tsx
git commit -m "feat(phase-4-m2): MediaCard — 미디어 카드 (썸네일·캡션·출처)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 3.2: `MediaDetail.tsx`

- [ ] **Step 3.2.1: 컴포넌트 작성**

`src/components/media/MediaDetail.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"
import { Download, ExternalLink } from "lucide-react"
import type { MediaItem } from "@/lib/media-curation"

interface MediaDetailProps {
  item: MediaItem
}

export function MediaDetail({ item }: MediaDetailProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/media"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        ← 미디어 자료실 목록
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{item.caption}</h1>
      </header>
      <div className="mb-6 overflow-hidden rounded-lg border border-border bg-muted">
        <Image
          src={item.imagePath}
          alt={item.alt}
          width={1200}
          height={800}
          sizes="(min-width: 768px) 720px, 100vw"
          className="h-auto w-full object-contain"
        />
      </div>
      <section className="mb-6 rounded-md border border-border bg-muted/30 p-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">이미지 설명 (alt text)</h2>
        <p className="text-sm text-foreground">{item.alt}</p>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={item.imagePath}
          download
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${item.caption} 이미지 다운로드`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          이미지 다운로드
        </a>
        <Link
          href={`/${item.sourceAxis}/${item.sourceDocSlug}`}
          className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          출처 페이지 보기
        </Link>
      </div>
    </article>
  )
}
```

- [ ] **Step 3.2.2: Commit**

```bash
git add src/components/media/MediaDetail.tsx
git commit -m "feat(phase-4-m2): MediaDetail — 전체 이미지 + alt 전문 + 다운로드

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 3.3: `MediaGrid.tsx`

- [ ] **Step 3.3.1: 컴포넌트 작성**

`src/components/media/MediaGrid.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { MEDIA_ITEMS, filterMediaItems } from "@/lib/media-curation"
import { MediaCard } from "./MediaCard"

export function MediaGrid() {
  const [filtered, setFiltered] = useState(MEDIA_ITEMS)
  const [query, setQuery] = useState("")

  return (
    <div>
      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="media-search" className="sr-only">미디어 자료실 검색</label>
        <input
          id="media-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setFiltered(filterMediaItems({ query: e.target.value }))
          }}
          placeholder="캡션·alt·출처 검색"
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {filtered.length === 0 ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
        >
          검색 결과가 없습니다.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <MediaCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3.3.2: Commit**

```bash
git add src/components/media/MediaGrid.tsx
git commit -m "feat(phase-4-m2): MediaGrid — 카드 그리드 + 검색 필터

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 3.4: `/media` 라우트 + 상세

- [ ] **Step 3.4.1: page.tsx 작성**

`src/app/(wiki)/media/page.tsx`:

```tsx
import type { Metadata } from "next"
import { MediaGrid } from "@/components/media/MediaGrid"

export const metadata: Metadata = {
  title: "미디어 자료실",
  description: "장애인교원 안내자료의 카드뉴스·인포그래픽·삽화 모음. alt 텍스트와 출처 포함.",
}

export default function MediaPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">미디어 자료실</h1>
        <p className="mt-2 text-muted-foreground">
          정책 안내자료의 시각 자료를 alt 텍스트와 함께 모은 곳입니다. 출처 페이지로 이동해 전체 맥락을 확인할 수 있습니다.
        </p>
      </header>
      <MediaGrid />
    </section>
  )
}
```

- [ ] **Step 3.4.2: `/media/[slug]` 상세**

`src/app/(wiki)/media/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MEDIA_ITEMS, getMediaItemBySlug } from "@/lib/media-curation"
import { MediaDetail } from "@/components/media/MediaDetail"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return MEDIA_ITEMS.map((item) => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = getMediaItemBySlug(slug)
  if (!item) return { title: "미디어 자료를 찾을 수 없습니다" }
  return { title: item.caption, description: item.alt.slice(0, 160) }
}

export default async function MediaItemPage({ params }: PageProps) {
  const { slug } = await params
  const item = getMediaItemBySlug(slug)
  if (!item) notFound()
  return <MediaDetail item={item} />
}
```

- [ ] **Step 3.4.3: 빌드 검증**

Run: `npm run build 2>&1 | grep -E "(static pages|Error|media)" | head -10`
Expected: build PASS. `/media`, `/media/[slug]` 라우트 등록 + MEDIA_ITEMS.length건 generateStaticParams.

- [ ] **Step 3.4.4: smoke**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m2-t3.log &
sleep 6
curl -s -o /dev/null -w "/media → %{http_code}\n" http://localhost:3000/media
curl -s -o /dev/null -w "/media/2024-staff-p-023-seat-assignment-flow → %{http_code}\n" http://localhost:3000/media/2024-staff-p-023-seat-assignment-flow
pkill -f "next dev" 2>/dev/null
sleep 1
```
Expected: 200 + 200.

- [ ] **Step 3.4.5: Commit**

```bash
git add "src/app/(wiki)/media"
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): /media 라우트 — entry + 상세

/media (entry, MediaGrid) + /media/[slug] (상세, MediaDetail).
generateStaticParams로 MEDIA_ITEMS 정적 빌드.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: KbSourceFooter — atomic 페이지 footer 원본 다운로드 (팀 리더)

**Files:**
- Create: `src/components/kb/KbSourceFooter.tsx`
- Modify: `src/components/kb/KbPageLayout.tsx`

**Why 팀 리더 단독**: KbPageLayout은 모든 atomic 페이지가 사용. 통합 file.

### Task 4.1: `KbSourceFooter.tsx`

- [ ] **Step 4.1.1: 컴포넌트 작성**

`src/components/kb/KbSourceFooter.tsx`:

```tsx
import Link from "next/link"
import { Download, FileText } from "lucide-react"
import { getSourceDownload } from "@/lib/atomic-source-map"

interface KbSourceFooterProps {
  sourceOrigin: string | undefined
}

export function KbSourceFooter({ sourceOrigin }: KbSourceFooterProps) {
  const download = getSourceDownload(sourceOrigin)
  if (!download) return null

  return (
    <footer className="mt-12 rounded-lg border border-border bg-muted/30 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
        원본 자료
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        이 페이지는 다음 원본 자료에서 분해된 atomic 페이지입니다.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">{download.title}</span>
        <span className="text-xs text-muted-foreground">{download.fileSize}</span>
        <a
          href={download.url}
          download
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${download.title} PDF 다운로드 (${download.fileSize})`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          PDF 다운로드
        </a>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4.1.2: Commit**

```bash
git add src/components/kb/KbSourceFooter.tsx
git commit -m "feat(phase-4-m2): KbSourceFooter — atomic footer 원본 다운로드

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 4.2: KbPageLayout 통합

- [ ] **Step 4.2.1: import 추가**

Edit `src/components/kb/KbPageLayout.tsx` — 상단 imports에 KbSourceFooter 추가:

```tsx
import { KbSourceFooter } from "./KbSourceFooter"
```

- [ ] **Step 4.2.2: article 안 footer 영역 추가**

Edit `src/components/kb/KbPageLayout.tsx` — line 171 `<MDXClientWrapper source={mdxSource} headings={doc.headings} />` 다음, `</article>` 직전:

```tsx
          <MDXClientWrapper source={mdxSource} headings={doc.headings} />
          <KbSourceFooter sourceOrigin={fm.source_origin} />
        </article>
```

⚠️ *주의*: `fm.source_origin`이 frontmatter에 정의돼 있는지 type 확인. 없으면 type 확장 필요.

- [ ] **Step 4.2.3: type 확인 + 필요 시 확장**

Run:
```bash
grep -n "source_origin" src/types/kb.ts src/lib/kb-adapter.ts 2>/dev/null
```

만약 type에 없으면 `src/types/kb.ts`에 `source_origin?: string` 추가.

- [ ] **Step 4.2.4: 빌드 + smoke**

Run:
```bash
npm run build 2>&1 | grep -E "(static pages|Error)" | head -5
npm run dev 2>&1 > /tmp/dev-m2-t4.log &
sleep 6
# atomic 페이지에서 footer 노출 확인 (source_origin 있는 페이지)
curl -s http://localhost:3000/disability-types/2024-staff-p-183 | grep -c "원본 자료"
curl -s http://localhost:3000/disability-types/2024-staff-p-183 | grep -c "PDF 다운로드"
pkill -f "next dev" 2>/dev/null
sleep 1
```
Expected: build PASS. "원본 자료" + "PDF 다운로드" 각 1 카운트 (source_origin = "2024-support-staff-duty-guide" 매핑됨).

- [ ] **Step 4.2.5: Commit**

```bash
git add src/components/kb/KbPageLayout.tsx src/types/kb.ts
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): KbPageLayout footer 통합 — 원본 PDF 다운로드 링크

article 안 footer에 KbSourceFooter 추가. source_origin frontmatter가
atomic-source-map에 매핑돼 있으면 원본 PDF 다운로드 링크 노출 (graceful
degradation — 미매핑 시 null 렌더).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 위키 entry 재설계 — RoleEntries + ChatLibraryMediaEntries 통합 (팀 리더)

**Files:**
- Create: `src/components/wiki/RoleEntries.tsx`
- Create: `src/components/wiki/ChatLibraryMediaEntries.tsx`
- Modify: `src/app/(wiki)/page.tsx`

**Why 팀 리더 단독**: 위키 entry 통합 file.

### Task 5.1: `RoleEntries.tsx`

- [ ] **Step 5.1.1: 컴포넌트 작성**

`src/components/wiki/RoleEntries.tsx`:

```tsx
import Link from "next/link"
import { User, School, Building, Scale, Heart } from "lucide-react"
import { ROLE_ENTRIES, type Role } from "@/lib/wiki-role-entries"

const ICON_MAP: Record<Role | "default", typeof User> = {
  teacher: User,
  manager: School,
  office: Building,
  policy: Scale,
  parent: Heart,
  default: User,
}

export function RoleEntries() {
  return (
    <section
      aria-labelledby="role-entries-heading"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6"
    >
      <div className="mb-6">
        <h2
          id="role-entries-heading"
          className="text-xl font-semibold text-foreground sm:text-2xl"
        >
          역할별 진입점
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          어떤 역할이신가요? 가장 필요한 정보로 안내해 드립니다.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ROLE_ENTRIES.map((entry) => {
          const Icon = ICON_MAP[entry.role] ?? ICON_MAP.default
          return (
            <article
              key={entry.role}
              className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground">{entry.title}</h3>
              <p className="mb-3 flex-1 text-xs text-muted-foreground">{entry.description}</p>
              {entry.recommended.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {entry.recommended.map((rec) => (
                    <li key={rec.slug}>
                      <Link
                        href={`/${rec.axis}/${rec.slug}`}
                        className="block rounded px-1 py-0.5 text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <span className="font-medium">{rec.title}</span>
                        <span className="ml-1 text-muted-foreground">— {rec.reason}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">큐레이션 준비 중</p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 5.1.2: Commit**

```bash
git add src/components/wiki/RoleEntries.tsx
git commit -m "feat(phase-4-m2): RoleEntries — 역할별 진입점 5장 카드 그리드

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 5.2: `ChatLibraryMediaEntries.tsx`

- [ ] **Step 5.2.1: 컴포넌트 작성**

`src/components/wiki/ChatLibraryMediaEntries.tsx`:

```tsx
import Link from "next/link"
import { MessageCircle, FolderArchive, Image as ImageIcon } from "lucide-react"

const ENTRIES = [
  {
    href: "/chat",
    title: "AI 채팅",
    description: "정책·법령·사례에 대해 자연어로 질문하세요.",
    icon: MessageCircle,
  },
  {
    href: "/library",
    title: "자료실",
    description: "원본 정책 보고서·안내서를 PDF로 다운로드합니다.",
    icon: FolderArchive,
  },
  {
    href: "/media",
    title: "미디어 자료실",
    description: "안내자료의 카드뉴스·인포그래픽을 alt 텍스트와 함께 봅니다.",
    icon: ImageIcon,
  },
]

export function ChatLibraryMediaEntries() {
  return (
    <section
      aria-labelledby="chat-library-media-heading"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6"
    >
      <h2 id="chat-library-media-heading" className="sr-only">채팅·자료실·미디어</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground group-hover:text-primary">
                {entry.title}
              </h3>
              <p className="text-sm text-muted-foreground">{entry.description}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 5.2.2: Commit**

```bash
git add src/components/wiki/ChatLibraryMediaEntries.tsx
git commit -m "feat(phase-4-m2): ChatLibraryMediaEntries — 채팅·자료실·미디어 진입 카드 3개

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
"
```

### Task 5.3: `(wiki)/page.tsx` 재설계 (통합)

- [ ] **Step 5.3.1: page.tsx 갱신**

Edit `src/app/(wiki)/page.tsx`:

```tsx
import type { Metadata } from "next"
import { WikiHero } from "@/components/wiki/WikiHero"
import { RoleEntries } from "@/components/wiki/RoleEntries"
import { PopularPages } from "@/components/wiki/PopularPages"
import { ChatLibraryMediaEntries } from "@/components/wiki/ChatLibraryMediaEntries"

export const metadata: Metadata = {
  title: "장애인교원 위키",
  description:
    "장애인교원에 관한 535개 정책·법령·사례·보조공학 페이지를 위키 형태로 검색하고 채팅으로 질문하세요.",
}

export default function WikiHomePage() {
  return (
    <>
      <WikiHero />
      <RoleEntries />
      <PopularPages />
      <ChatLibraryMediaEntries />
    </>
  )
}
```

- [ ] **Step 5.3.2: 빌드 + smoke**

Run:
```bash
npm run build 2>&1 | grep -E "(static pages|Error)" | head -3
npm run dev 2>&1 > /tmp/dev-m2-t5.log &
sleep 6
curl -s http://localhost:3000/ | grep -c "역할별 진입점"
curl -s http://localhost:3000/ | grep -c "AI 채팅"
curl -s http://localhost:3000/ | grep -c "자료실"
curl -s http://localhost:3000/ | grep -c "미디어 자료실"
pkill -f "next dev" 2>/dev/null
sleep 1
```
Expected: build PASS. 4 grep 모두 1+ 카운트.

- [ ] **Step 5.3.3: Commit**

```bash
git add "src/app/(wiki)/page.tsx"
git commit -m "$(cat <<'EOF'
feat(phase-4-m2): (wiki)/page.tsx 재설계 — Hero + 역할별 + 인기 + 진입 카드

위키 entry에 RoleEntries(역할별 5장) + ChatLibraryMediaEntries(채팅·
자료실·미디어 3개) 통합. 다층 사용자(위원장 영구 원칙) + 자료실/
미디어 진입성 강화.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 회귀 가드 통합 테스트 (팀원 C scope)

**Files:**
- Create: `tests/routing/wiki-renewal-routes.test.ts`

### Task 6.1: 라우트 회귀 가드

- [ ] **Step 6.1.1: 테스트 작성**

`tests/routing/wiki-renewal-routes.test.ts`:

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

const wikiRenewalRoutes = [
  'src/app/(wiki)/library/page.tsx',
  'src/app/(wiki)/library/[slug]/page.tsx',
  'src/app/(wiki)/media/page.tsx',
  'src/app/(wiki)/media/[slug]/page.tsx',
]

const wikiRenewalComponents = [
  'src/components/library/LibraryCard.tsx',
  'src/components/library/LibrarySearch.tsx',
  'src/components/library/LibraryGrid.tsx',
  'src/components/media/MediaCard.tsx',
  'src/components/media/MediaDetail.tsx',
  'src/components/media/MediaGrid.tsx',
  'src/components/wiki/RoleEntries.tsx',
  'src/components/wiki/ChatLibraryMediaEntries.tsx',
  'src/components/kb/KbSourceFooter.tsx',
]

const seedLibraries = [
  'src/lib/wiki-role-entries.ts',
  'src/lib/library-catalog.ts',
  'src/lib/media-curation.ts',
  'src/lib/atomic-source-map.ts',
]

test('Phase 4 M2 — 위키 entry 신규 라우트 존재', () => {
  for (const route of wikiRenewalRoutes) {
    assert.ok(existsSync(join(repoRoot, route)), `M2 라우트 누락: ${route}`)
  }
})

test('Phase 4 M2 — 신규 컴포넌트 존재', () => {
  for (const comp of wikiRenewalComponents) {
    assert.ok(existsSync(join(repoRoot, comp)), `M2 컴포넌트 누락: ${comp}`)
  }
})

test('Phase 4 M2 — 시드 데이터 라이브러리 4건 존재', () => {
  for (const lib of seedLibraries) {
    assert.ok(existsSync(join(repoRoot, lib)), `M2 시드 라이브러리 누락: ${lib}`)
  }
})
```

- [ ] **Step 6.1.2: 테스트 실행**

Run: `npm test -- tests/routing/wiki-renewal-routes.test.ts 2>&1 | tail -3`
Expected: 3 tests, 3 pass.

- [ ] **Step 6.1.3: Commit**

```bash
git add tests/routing/wiki-renewal-routes.test.ts
git commit -m "$(cat <<'EOF'
test(phase-4-m2): wiki-renewal-routes 회귀 가드 — 라우트·컴포넌트·시드 존재

13개 신규 파일(4 라우트 + 9 컴포넌트 + 4 시드)이 모두 존재 검증. M3 정리
또는 향후 리팩토링 시 라우트 누락 회귀 차단.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 회귀 검증 (팀원 C)

**Files:** —

- [ ] **Step 7.1: 전체 빌드**

Run: `npm run build 2>&1 | grep -E "(static pages|Error|fail)" | head -3`
Expected: 580+ 정적 페이지 (M1 570 + library 5 + media MEDIA_ITEMS.length+1 등).

- [ ] **Step 7.2: 전체 unit 테스트**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5`
Expected: ~240 / 239 pass / 0 fail / 1 skipped (Task 1.x + Task 6 합산).

- [ ] **Step 7.3: dev server 종합 smoke**

Run:
```bash
npm run dev 2>&1 > /tmp/dev-m2-t7.log &
sleep 6

echo "=== M2 신규 라우트 ==="
for url in / /library /library/2023-hr-guide /library/2024-jbu-work-support-guide /media /media/2024-staff-p-023-seat-assignment-flow; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$url")
  echo "$url → $code"
done

echo ""
echo "=== PDF 다운로드 ==="
curl -s -o /dev/null -w "/library/2023-hr-guide.pdf → %{http_code} (%{size_download} bytes)\n" http://localhost:3000/library/2023-hr-guide.pdf

echo ""
echo "=== 위키 entry 콘텐츠 ==="
ENTRY=$(curl -s http://localhost:3000/)
echo "$ENTRY" | grep -c "역할별 진입점"
echo "$ENTRY" | grep -c "AI 채팅"
echo "$ENTRY" | grep -c "자료실"
echo "$ENTRY" | grep -c "미디어 자료실"

echo ""
echo "=== atomic 페이지 footer 원본 다운로드 ==="
curl -s http://localhost:3000/disability-types/2024-staff-p-183 | grep -c "원본 자료"

pkill -f "next dev" 2>/dev/null
sleep 1
```
Expected:
- 6 라우트 모두 200
- PDF 200 + 15MB+
- 위키 entry 4건 콘텐츠 모두 1+ 카운트
- atomic footer 원본 자료 1 카운트

- [ ] **Step 7.4: kb:publish:dry-run baseline 확인 (선택)**

Run: `npm run kb:publish:dry-run 2>&1 | tail -3` (Supabase env 있을 때만)
Expected: 535 candidate / 8 passing / 527 blocked (변동 0).

---

## Task 8: CLAUDE.md 변경 이력 (팀원 C, gitignored Edit만)

**Files:** `CLAUDE.md` (gitignored)

- [ ] **Step 8.1: 변경 이력 entry 추가**

Edit `CLAUDE.md` 변경 이력 표 — 최상단에 (정확한 PR # + sha는 머지 후 갱신):

```markdown
| 2026-05-2X | **Phase 4 M2 머지 — 콘텐츠 기능** — PR #XX (squash `XXXXXXX`) → master. 시드 데이터 4건(wiki-role-entries·library-catalog·media-curation·atomic-source-map) + 자료실 /library 라우트·UI + 미디어 자료실 /media 라우트·UI + KbSourceFooter atomic footer 원본 다운로드 + (wiki)/page.tsx 재설계(RoleEntries 5장 + ChatLibraryMediaEntries 3장 통합) + 회귀 가드 wiki-renewal-routes 통합 테스트. **검증**: ~240 unit / 239 pass / 0 fail + 580+ 정적 페이지 + smoke 모두 정상. 큐레이션 콘텐츠는 D6 placeholder(허유진 교수 협업 후 별도 PR로 시드 교체). Agent Teams 시범 발동 (또는 단독, 위원장 컨펌 결과 명시). |
```

⚠️ *PR 머지 후 정확한 PR # + sha + Agent Teams 결과 갱신*.

---

## Task 9: codex-rescue dispatch (팀 리더 단독, 선택)

**Files:** —

⚠️ *M1 경험*: codex-rescue agent가 무한 루프(echo OK 수천 회 반복)에 빠져 TaskStop + 직접 검수로 대체. M2도 동일 위험.

**옵션**:
- (a) codex-rescue dispatch 시도 + 무한 루프 시 즉시 TaskStop + 직접 검수 fallback
- (b) M1 학습에 따라 skip + 처음부터 직접 검수
- (c) coderabbit만 활용 (PR 단계 자동 review)

추천: **(b)** — M1 경험 정합. 직접 검수 + coderabbit이 cross-cutting + 스타일 모두 cover. M2의 invariant는 M1보다 작음(라우트 mv 없음, 컴포넌트 신설 위주).

**직접 검수 항목** (M1 패턴 정합):
1. sourcePathToHref·기존 RAG 영향 0 (M2는 라우팅 변경 0, 자동 보장)
2. library 4건 + media 1+건 모두 정적 빌드 정합
3. KbSourceFooter graceful degradation (미매핑 atomic 페이지에서 null 렌더)
4. 위키 entry 4 섹션 모두 노출 (Hero · RoleEntries · PopularPages · ChatLibraryMediaEntries)
5. PDF 다운로드 정상 (Content-Disposition: attachment 헤더)
6. atomic 페이지 footer 원본 다운로드 정상
7. RoleEntries 5장 모두 노출 (placeholder 2장은 "큐레이션 준비 중" 안내)
8. baseline 회귀 0건 (M1 207 → M2 240)

---

## Task 10: PR 생성 + 머지 (팀 리더 단독)

**Files:** —

- [ ] **Step 10.1: 브랜치 push**

Run: `git push -u origin feat/phase-4-m2-impl`

- [ ] **Step 10.2: gh pr create**

Run:
```bash
gh pr create --title "feat(phase-4-m2): 콘텐츠 기능 — 자료실 + 미디어 + 위키 entry 재설계" --body "$(cat <<'EOF'
## Summary

- Phase 4 M2 — 위키·채팅 중심 IA 리뉴얼의 콘텐츠 기능 마일스톤
- **시드 데이터 4건**: wiki-role-entries(역할별 진입점 5장) · library-catalog(자료실 4건) · media-curation(미디어 1+건) · atomic-source-map
- **자료실 /library**: LibraryGrid + LibraryCard + LibrarySearch + /library/[slug] 상세. data/source-pdf/ 4건 PDF 정적 서빙
- **미디어 자료실 /media**: MediaGrid + MediaCard + MediaDetail + /media/[slug]. Phase 1.5b 검증된 raster 시드
- **atomic 페이지 footer**: KbSourceFooter 추가 — source_origin frontmatter → 원본 PDF 다운로드 링크 자동 노출
- **위키 entry 재설계**: WikiHero + **RoleEntries** + PopularPages + **ChatLibraryMediaEntries** 통합
- **회귀 가드**: wiki-renewal-routes 통합 테스트 3건

## 결정 잠금 정합

- ✅ D2: 자료실 콘텐츠 = 현재 보유 자산만 (data/source-pdf 4건)
- ✅ D3: 위키 entry IA = 역할별 진입점 5장 + 인기 페이지 + 채팅/자료실/미디어 진입
- ✅ D6: 큐레이션 = placeholder (위원장-허유진 교수 협업 결과는 별도 PR로 시드 교체)
- ✅ D8: Agent Teams (시범 발동 또는 단독 — 본문에 명시)

## 회귀 검증

- unit: ~240 / 239 pass / 0 fail / 1 skipped (m3-sdk-probe baseline)
- build: 580+ 정적 페이지
- dev server smoke: 6 신규 라우트 + PDF 다운로드 + 위키 entry 4 섹션 + atomic footer 모두 정상

## D6 협업 영역 후속 PR (M2 머지 후)

- wiki-role-entries.ts policy·parent 추천 atomic 페이지 시드 (현재 빈 배열)
- library-catalog.ts 추가 자산 (PHP 게시판 인계 후)
- media-curation.ts 추가 raster (Phase 1.5b 검증된 7건 + 신규)
- 시드 *교체*만, 코드 구조 변경 없음

## 다음 단계

M2 머지 → M3 plan 작성 (정리·접근성: 베타 라벨 잔재 · sitemap · OG · WCAG · 위원장 VoiceOver 최종 검수). Phase 3 M7(파일 첨부 + 음성) 머지 상태에 따라 충돌 점검.

## ⚠️ PR diff 크기 안내

`public/library/` 4 PDF (~40MB) 포함. 시범 단계 정책 (M3에서 외부 CDN/storage로 갱신 검토).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 10.3: CI 점검 + 머지 결정**

Run: `gh pr checks <PR번호>`
Expected: validate PASS + Vercel PASS.

머지: `gh pr merge <PR번호> --squash --admin --delete-branch`

- [ ] **Step 10.4: master sync + memory 갱신**

Run:
```bash
git checkout master
git pull origin master
git log --oneline -3
```

CLAUDE.md Task 8 entry의 PR # + sha 정확한 값으로 갱신. `memory/project_phase_status.md` + `MEMORY.md`에 M2 머지 entry 추가.

---

## 완료 기준

- [ ] master HEAD에 M2 머지 commit
- [ ] ~240 unit tests PASS
- [ ] 580+ 정적 페이지 build PASS
- [ ] 6 신규 라우트 smoke 정상 (/library, /library/[slug] 4건, /media, /media/[slug] 1+건)
- [ ] PDF 다운로드 정상 (Content-Disposition: attachment + 15MB+)
- [ ] 위키 entry 4 섹션 노출 (Hero · RoleEntries · PopularPages · ChatLibraryMediaEntries)
- [ ] atomic 페이지 footer 원본 다운로드 노출 (source_origin 매핑된 페이지)
- [ ] kb:publish:dry-run baseline 535/8/527 유지 (Supabase env 가능 시)
- [ ] codex-rescue 결과 (skip 또는 처리 완료)
- [ ] coderabbit critical 처리 완료
- [ ] 위원장 production preview 직접 검증 통과
- [ ] CLAUDE.md 변경 이력 + memory 갱신
- [ ] D6 협업 영역 후속 PR plan 위원장-허유진 교수에게 전달

다음 마일스톤: writing-plans 스킬 → M3 plan(정리·접근성) 작성.
