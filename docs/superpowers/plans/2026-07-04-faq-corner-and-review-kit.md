# FAQ 코너 + 연구진 검수 킷 + 첫 화면 목록 초안 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제2차 자문회의(2026-06-25) 후속 중 코드 구현 가능 부분 — 위키에 FAQ 코너(신규 axis `faq`)를 기존 파이프라인 재사용으로 추가하고, 연구진 검수 지원 킷과 첫 화면 필수 노출 목록 초안(자문 문서)을 작성한다.

**Architecture:** FAQ는 신규 컴포넌트 없이 기존 axis 파이프라인(`policies`·`agreements`와 동일)을 재사용한다. `faq`를 `CONTENT_AXES`·`AXIS_LABEL`·`BROWSABLE_AXES`에 등록하면 검색·sync·RAG·위키링크·출처 footer·published 게이트가 자동 적용된다. 콘텐츠는 `content/faq/*.md` 9건(전부 draft), 라우트는 `AxisListPage`/`KbPageLayout` 복제 2파일. 홈 "주제별 둘러보기"는 published 0건 axis 카드를 숨겨 draft 기간 "0개" 카드를 방지한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, node:test(단위), zod frontmatter 스키마, gray-matter, lucide-react.

## Global Constraints

- **마크다운이 정본, DB는 파생 인덱스** — FAQ Q&A를 TS 코드에 박지 않는다. `content/faq/*.md` atomic 페이지만.
- **검수 게이트** — 초기 FAQ 콘텐츠는 전부 `status: draft`. published 승격은 위원장 검수 후(머지 범위 밖).
- **UI 라벨 이모지 금지** — lucide SVG 아이콘만(`aria-hidden`).
- **접근성 헌장** — 신규 컴포넌트 0개가 목표. 기존 axis 라우트 컴포넌트 재사용으로 접근성 회귀 표면 없음.
- **커밋 규약** — 하니스 푸터(Co-Authored-By / Claude-Session) 유지. 신규 파일은 명시 경로 `git add <path>` 후 커밋(`-A`/`.` 금지).
- **테스트 명령** — 단위 `npm test`, 린트 `npm run lint`, 빌드 `npm run build`(validate:content + sync:content 포함).
- **frontmatter 스키마 값**(검증 통과 필수): `type: FAQ`, `domains`∈{편의지원,인사관리,권리구제,…}, `disability_types` 최소 1개, `regions` 최소 1개, `reading_level`∈{easy,standard,expert}, draft는 `reviewed_by: []` 허용.

---

## Task 1: axis `faq` 메타 등록 + 0-count 카드 정책 헬퍼

**Files:**
- Modify: `src/types/kb.ts` (`CONTENT_AXES` 배열)
- Modify: `src/lib/kb-axis.ts` (`AXIS_LABEL`, `BROWSABLE_AXES`, 신규 `visibleAxisCards`)
- Test: `tests/kb-axis.test.ts` (기존 BROWSABLE 단언 갱신 + 신규 테스트)

**Interfaces:**
- Consumes: 기존 `BrowsableAxis` 인터페이스, `ContentAxis` 타입, `AXIS_LABEL` Record.
- Produces:
  - `AXIS_LABEL["faq"] = "자주 묻는 질문"`
  - `BROWSABLE_AXES`에 `{ axis: "faq", label: "자주 묻는 질문", description: "..." }` 추가(배열 마지막)
  - `export interface AxisCardEntry extends BrowsableAxis { count: number }`
  - `export function visibleAxisCards(entries: AxisCardEntry[]): AxisCardEntry[]` — `count > 0`인 항목만 반환(Task 3의 `AxisBrowseEntries`가 소비)

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/kb-axis.test.ts`의 기존 "본문 5 axis만 포함한다" 블록을 faq 포함으로 갱신하고, `visibleAxisCards` describe를 추가한다.

기존 블록 교체 (파일 내 `describe("BROWSABLE_AXES", ...)` 첫 두 `it`):

```ts
  it("본문 axis + faq를 포함한다", () => {
    const axes = BROWSABLE_AXES.map((b) => b.axis)
    assert.deepEqual(
      [...axes].sort(),
      ["agreements", "disability-types", "domains", "faq", "policies", "regions"],
    )
  })

  it("resources·stories·uncategorized는 제외한다 (nested 라우트 / 콘텐츠 0건)", () => {
    const axes = BROWSABLE_AXES.map((b) => b.axis)
    assert.ok(!axes.includes("resources"))
    assert.ok(!axes.includes("stories"))
    assert.ok(!axes.includes("uncategorized"))
  })
```

파일 import에 `visibleAxisCards`, `type AxisCardEntry` 추가 후, 파일 끝에 추가:

```ts
describe("visibleAxisCards", () => {
  const base = { axis: "faq", label: "자주 묻는 질문", description: "d" } as const

  it("count가 0인 카드는 숨긴다", () => {
    const entries: AxisCardEntry[] = [
      { ...base, axis: "faq", count: 0 },
      { ...base, axis: "policies", label: "정책·법령", count: 3 },
    ]
    const visible = visibleAxisCards(entries)
    assert.deepEqual(visible.map((e) => e.axis), ["policies"])
  })

  it("count가 1 이상인 카드는 모두 남긴다", () => {
    const entries: AxisCardEntry[] = [
      { ...base, axis: "faq", count: 2 },
      { ...base, axis: "policies", label: "정책·법령", count: 3 },
    ]
    assert.equal(visibleAxisCards(entries).length, 2)
  })

  it("원본 배열을 변형하지 않는다", () => {
    const entries: AxisCardEntry[] = [{ ...base, axis: "faq", count: 0 }]
    visibleAxisCards(entries)
    assert.equal(entries.length, 1)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/kb-axis.test.ts`
Expected: FAIL — `visibleAxisCards` is not exported / BROWSABLE_AXES에 faq 없음.

- [ ] **Step 3: `CONTENT_AXES`에 faq 추가** — `src/types/kb.ts`:

```ts
export const CONTENT_AXES = [
  'disability-types',
  'domains',
  'regions',
  'policies',
  'agreements',
  'faq',
  'stories',
  'resources',
  'uncategorized',
] as const
```

- [ ] **Step 4: `kb-axis.ts` 갱신** — `AXIS_LABEL`에 faq 라벨 추가:

```ts
export const AXIS_LABEL: Record<ContentAxis, string> = {
  "disability-types": "장애유형별",
  domains: "영역별",
  regions: "지역별",
  policies: "정책·법령",
  agreements: "단체협약",
  faq: "자주 묻는 질문",
  stories: "사례",
  resources: "자료실",
  uncategorized: "미분류",
}
```

`BROWSABLE_AXES` 배열 마지막(regions 항목 뒤)에 추가:

```ts
  {
    axis: "faq",
    label: AXIS_LABEL.faq,
    description: "편의지원 신청·인사·권리구제 등 장애인교원이 자주 묻는 질문과 답변",
  },
```

파일 끝에 헬퍼 추가:

```ts
/** 홈 "주제별 둘러보기" 카드 항목 — BrowsableAxis + 집계된 문서 수. */
export interface AxisCardEntry extends BrowsableAxis {
  count: number
}

/**
 * published 문서가 0건인 axis 카드를 숨긴다.
 * draft만 있는 신규 axis(예: 검수 전 faq)가 홈에 "0개" 빈 카드로 노출되는 것을 방지.
 * admin Draft Mode에서는 count가 draft를 포함하므로 검수 중에도 카드가 보인다.
 */
export function visibleAxisCards(entries: AxisCardEntry[]): AxisCardEntry[] {
  return entries.filter((e) => e.count > 0)
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/kb-axis.test.ts`
Expected: PASS (AXIS_LABEL 커버리지 + BROWSABLE faq 포함 + visibleAxisCards 3건).

- [ ] **Step 6: 린트**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 7: 커밋**

```bash
git add src/types/kb.ts src/lib/kb-axis.ts tests/kb-axis.test.ts
git commit -m "feat(faq): axis 'faq' 메타 등록 + visibleAxisCards 0-count 정책

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AquF3HF93ZGSRDgMzrZZab"
```

---

## Task 2: FAQ 콘텐츠 9건 (draft) + 근거 위키링크 연결

**Files:**
- Create: `content/faq/assistive-device-apply.md`, `work-assistant-scope.md`, `facility-install-request.md`, `position-assignment-disability.md`, `promotion-discrimination.md`, `sick-leave-usage.md`, `discrimination-report-where.md`, `accommodation-refused.md`, `report-retaliation-fear.md` (9건)

**Interfaces:**
- Consumes: Task 1의 `CONTENT_AXES`에 `faq` 등록(경로 검증 통과 조건). 기존 frontmatter 스키마.
- Produces: `content/faq/<slug>.md` 9건, 전부 `status: draft`. Task 3의 라우트가 이를 렌더.

**콘텐츠 원본**: `src/app/(gov)/legacy/participate/faq/page.tsx`의 편의제공·인사관리·권리구제 3×3 Q&A. 각 답변은 아래 파일에 그대로 옮기되, 근거 위키 문서를 위키링크로 연결한다.

- [ ] **Step 1: 근거 위키 슬러그 조사** — 각 FAQ 주제의 근거가 될 published 위키 페이지를 찾는다.

Run(예시, 주제별 반복):
```bash
cd /Users/hunyongkim/Mac-Projects/webfortd
grep -rl "보조공학" content/ | head; grep -rl "근로지원인\|보조인력" content/ | head
grep -rl "편의시설\|정당한 편의" content/ | head; grep -rl "보직\|인사" content/ | head
grep -rl "승진" content/ | head; grep -rl "병가\|휴직" content/ | head
grep -rl "차별\|인권위\|권리구제" content/ | head; grep -rl "진정\|불이익\|보복" content/ | head
```
각 주제에서 published(frontmatter `status: published`) 문서 중 가장 정합한 것의 slug(파일 stem)를 고른다. 확실한 근거가 있으면 본문 끝에 `관련 문서: [[slug]]` 한 줄로 연결, 없으면 위키링크 생략 + frontmatter `reviewer_notes`에 표시.

- [ ] **Step 2: 9개 파일 작성** — 아래 내용대로. `<<근거>>`는 Step 1에서 찾은 slug로 치환하거나(찾음) 줄 삭제 + reviewer_notes 추가(못 찾음).

`content/faq/assistive-device-apply.md`:
```markdown
---
title: "보조공학기기 지원은 어떻게 신청하나요?"
type: FAQ
disability_types: ["전체"]
domains: ["편의지원"]
regions: ["전국"]
year: 2026
status: draft
source:
  organization: "장애인교원 위키 편집부"
  citation: "장애인교원 위키 자주 묻는 질문 (2026)"
source_origin: "faq"
reviewed_by: []
references: []
accessibility:
  alt_text_complete: true
  captions_available: false
  reading_level: easy
  audio_tts_ready: false
---

소속 학교를 통해 시도교육청에 신청합니다. 신청서와 장애인등록증 사본, 필요성을 증명하는 서류를 제출하면 심사 후 지원 여부가 결정됩니다. 자세한 절차는 소속 시도교육청 담당부서에 문의하세요.

관련 문서: [[<<근거>>]]
```

나머지 8개는 위 형식에서 `title`·`domains`·본문·slug만 바꾼다. domains 매핑: 편의제공 3건=`편의지원`, 인사관리 3건=`인사관리`, 권리구제 3건=`권리구제`.

| slug | title | domains | 본문 |
|------|-------|---------|------|
| `work-assistant-scope` | "근로지원인은 어떤 업무를 도와주나요?" | 편의지원 | "근로지원인은 장애인교원의 직무 수행을 보조합니다. 수업 자료 준비, 판서 대필, 이동 보조, 문서 작성 보조, 의사소통 지원(수어통역 등) 등의 업무를 지원받을 수 있습니다." |
| `facility-install-request` | "편의시설 설치를 요청할 수 있나요?" | 편의지원 | "네, 요청할 수 있습니다. 경사로, 승강기, 장애인 화장실, 높낮이 조절 책상 등 필요한 편의시설 설치를 학교와 교육청에 요청할 수 있습니다. 장애인차별금지법에 따라 정당한 사유 없이 거부할 수 없습니다." |
| `position-assignment-disability` | "보직 배치 시 장애를 고려해달라고 요청할 수 있나요?" | 인사관리 | "네, 가능합니다. 장애 특성에 맞는 보직 배치를 요청할 수 있으며, 학교와 교육청은 이를 합리적으로 고려해야 합니다. 다만, 본인의 동의 없이 장애를 이유로 특정 보직에서 배제하는 것은 차별에 해당할 수 있습니다." |
| `promotion-discrimination` | "장애로 인해 승진에 불이익을 받으면 어떻게 하나요?" | 인사관리 | "장애를 이유로 한 승진 차별은 장애인차별금지법 위반입니다. 불합리한 차별을 받았다면 국가인권위원회에 진정하거나, 행정심판을 청구할 수 있습니다." |
| `sick-leave-usage` | "병가나 휴직을 자유롭게 사용할 수 있나요?" | 인사관리 | "장애인교원도 일반 교원과 동일하게 병가와 휴직을 사용할 수 있습니다. 장애 관련 치료를 위한 병가 사용 시 불이익을 받지 않도록 법적으로 보호됩니다." |
| `discrimination-report-where` | "차별을 당하면 어디에 신고하나요?" | 권리구제 | "국가인권위원회(1331), 장애인권익옹호기관(1644-8295), 고용노동부(1350) 등에 신고할 수 있습니다. 상황에 따라 적합한 기관을 선택하시고, 어디에 신고해야 할지 모르겠다면 먼저 상담을 받아보세요." |
| `accommodation-refused` | "편의제공을 거부당하면 어떻게 해야 하나요?" | 권리구제 | "정당한 사유 없는 편의제공 거부는 장애인차별금지법 위반입니다. 먼저 학교와 교육청에 재요청하고, 해결되지 않으면 국가인권위원회에 진정을 제기할 수 있습니다." |
| `report-retaliation-fear` | "신고하면 불이익을 받을까 걱정됩니다." | 권리구제 | "법적으로 진정이나 신고를 이유로 불이익을 주는 것은 금지되어 있습니다. 만약 신고 후 보복 행위가 있다면 이 또한 별도로 신고할 수 있습니다. 비밀 보장도 철저히 됩니다." |

근거 위키링크를 못 찾은 파일은 `관련 문서:` 줄을 삭제하고 frontmatter의 `reviewed_by: []` 아래에 다음을 추가:
```yaml
reviewer_notes: "근거 위키 문서 미연결 — 검수 시 확인·연결 필요"
```

- [ ] **Step 3: 콘텐츠 검증** — frontmatter 스키마 + 경로(axis) 검증.

Run: `npm run build`
Expected: validate:content 통과(9개 faq 포함), 빌드 성공, `/faq` + `/faq/[slug]` 라우트 생성. FAQ가 draft라 `/faq` 목록은 익명 0건이지만 라우트는 존재.

> 빌드가 validate 단계에서 실패하면 frontmatter enum 값(domains·type·reading_level)을 Global Constraints와 대조해 고친다.

- [ ] **Step 4: 커밋**

```bash
git add content/faq
git commit -m "feat(faq): FAQ 콘텐츠 9건 draft 추가 (legacy 이식 + 근거 위키링크)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AquF3HF93ZGSRDgMzrZZab"
```

---

## Task 3: FAQ 라우트 2파일 + 홈 둘러보기 카드 wiring

**Files:**
- Create: `src/app/(wiki)/faq/page.tsx`
- Create: `src/app/(wiki)/faq/[slug]/page.tsx`
- Modify: `src/components/wiki/AxisBrowseEntries.tsx` (`AXIS_ICON` faq + `visibleAxisCards` 적용)

**Interfaces:**
- Consumes: Task 1의 `visibleAxisCards`·`AxisCardEntry`·`AXIS_LABEL.faq`, 기존 `AxisListPage`/`buildAxisMetadata`·`KbPageLayout`·`getStaticParamsForAxis`.
- Produces: `/faq`(목록), `/faq/[slug]`(상세) 라우트. 홈 `AxisBrowseEntries`가 0-count 카드를 숨김.

- [ ] **Step 1: `/faq` 목록 라우트** — `src/app/(wiki)/faq/page.tsx` (policies/page.tsx 복제):

```tsx
import { AxisListPage, buildAxisMetadata } from "@/components/kb/AxisListPage"

export const metadata = buildAxisMetadata("faq")

export default function Page() {
  return <AxisListPage axis="faq" />
}
```

- [ ] **Step 2: `/faq/[slug]` 상세 라우트** — `src/app/(wiki)/faq/[slug]/page.tsx` (policies/[slug]/page.tsx 복제):

```tsx
import { Metadata } from "next"
import { KbPageLayout, buildKbMetadata } from "@/components/kb/KbPageLayout"
import { getStaticParamsForAxis } from "@/lib/kb"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getStaticParamsForAxis('faq')
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  return buildKbMetadata('faq', slug)
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  return <KbPageLayout axis="faq" slug={slug} />
}
```

- [ ] **Step 3: `AxisBrowseEntries` — faq 아이콘 + 0-count 숨김** — `src/components/wiki/AxisBrowseEntries.tsx`.

import에 `HelpCircle` 추가 + `visibleAxisCards`, `type AxisCardEntry` import:
```tsx
import { Accessibility, Layers, Scale, FileText, MapPin, HelpCircle } from "lucide-react"
import { BROWSABLE_AXES, visibleAxisCards, type AxisCardEntry } from "@/lib/kb-axis"
```

`AXIS_ICON`에 faq 추가:
```tsx
  regions: MapPin,
  faq: HelpCircle,
  // 아래는 BROWSABLE_AXES에 없지만 타입 완전성을 위해 채운다.
```

`entries` 집계 후 `visibleAxisCards`로 필터. `const entries = await Promise.all(...)` 다음 줄에서:
```tsx
  const visible = visibleAxisCards(entries as AxisCardEntry[])
```
그리고 렌더의 `{entries.map((b) => {` 를 `{visible.map((b) => {` 로 교체.

- [ ] **Step 4: 빌드 + 린트**

Run: `npm run build && npm run lint`
Expected: 빌드 성공(`/faq`, `/faq/[slug]` 등록), lint 0 errors. 현재 faq 전부 draft라 홈 둘러보기에 faq 카드 미노출(익명 count 0 → visibleAxisCards 제외).

- [ ] **Step 5: 단위 회귀**

Run: `npm test`
Expected: 기존 + Task 1 테스트 PASS, 신규 회귀 0건.

- [ ] **Step 6: 커밋**

```bash
git add "src/app/(wiki)/faq" src/components/wiki/AxisBrowseEntries.tsx
git commit -m "feat(faq): /faq 라우트 2파일 + 홈 둘러보기 0-count 카드 숨김

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AquF3HF93ZGSRDgMzrZZab"
```

---

## Task 4: 연구진 검수 지원 킷 (드라이브 문서 2종 + repo README 1절)

**Files:**
- Create: `<자문 data>/검수 안내.md` (Google Drive, git 밖)
- Create: `<자문 data>/검수 기록.md` (Google Drive, git 밖)
- Modify: `data/README.md` (repo, 커밋 대상)

`<자문 data>` = `/Users/hunyongkim/Library/CloudStorage/GoogleDrive-hudt0715@gmail.com/My Drive/장교조 업무 공유 폴더/17. 교육부 및 교육청 등 정책연구/2026년 교육부 정책연구/[과제 5[ 정보 지원 웹페이지 개발 및 운영/data`

**이 태스크는 문서 산출물이라 테스트 사이클이 없다.** Task 1~3과 독립적.

- [ ] **Step 1: `검수 안내.md` 작성** — 드라이브 data 폴더에. 구성: 검수 목적 / 5파일↔원본 PDF 대응표(`data/README.md`의 출처 표 재사용) / 검수 방법(메모장·워드로 `data/markdown/*.md` 열고 `data/*.pdf` 대조) / 볼 것(본문 누락·OCR 오인식·표 깨짐·문단 순서·이미지 설명) / 알려진 차이(`[이미지: ...]` 마커 의미 + fused 마크다운은 2026-05-14 스냅샷이라 이후 웹 반영본의 이미지·alt 정제 미포함 — 이미 웹에서 고쳐진 부분 중복 지적 방지) / 기록 방법(검수 기록.md) / 반영 절차(연구진 기록 → 위원장이 `content/<axis>/<slug>.md` 수정 → 웹 반영).

- [ ] **Step 2: `검수 기록.md` 작성** — 드라이브 data 폴더에. 자유 서술 한 줄 양식 `[파일명] · [위치(페이지/제목)] · [발견 내용] · [제안]` + 작성 예시 1건.

- [ ] **Step 3: `data/README.md`에 "연구진 원문 대조 검수 워크플로" 1절 추가** — repo. 검수 입력(`data/markdown/`↔`data/source-pdf/`)·반영 대상(`content/<axis>/<slug>.md`)·fused 마크다운은 입력 스냅샷이지 정본 아님을 명시.

- [ ] **Step 4: repo README 커밋**

```bash
git add data/README.md
git commit -m "docs(data): 연구진 원문 대조 검수 워크플로 1절 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AquF3HF93ZGSRDgMzrZZab"
```

---

## Task 5: 첫 화면 필수 노출 콘텐츠 목록 초안 (자문 메모)

**Files:**
- Create: `<자문 1.자문메모>/260704_첫화면_필수노출_콘텐츠_요구정리.md` (Google Drive, git 밖)

`<자문 1.자문메모>` = `.../[과제 5[ 정보 지원 웹페이지 개발 및 운영/1. 자문 메모`

**문서 산출물, 테스트 없음.** Task 1~4와 독립적.

- [ ] **Step 1: 자문 메모 작성** — 구성: 목적(콘텐츠 회의 입력 자료) / webfortd 현 메인 시연 기준선(검색 hero·오늘의 위키·주제별 둘러보기·역할별·자주 찾는 + 신설 FAQ) / 중부대 요구 정적 안내 코너(장애인교원 기본 이해·편의지원 항목과 신청 절차·학교 관리자/동료 안내) 첫 화면 필수 노출 후보 / 이용자 유형별(당사자·예비교사·학부모·관리자·교육청 담당자) 진입 동선 / 결정 필요 항목(FAQ 첫화면·사이드바 노출 방식, 정적 안내 코너와 위키 문서 경계, 랜딩 톤). 회의록 §III.2 인용.

---

## 최종 검증 (전체 태스크 후)

- [ ] `npm test` — 단위 전건 PASS, 신규 회귀 0
- [ ] `npm run lint` — 0 errors
- [ ] `npm run build` — 빌드 성공, `/faq`·`/faq/[slug]` 라우트 등록, 페이지 수 이전 대비 +10 내외
- [ ] draft 게이트 수동 확인: 익명 `/faq` 목록 0건 + 홈 둘러보기에 FAQ 카드 미노출(count 0 숨김). (admin Draft Mode 노출은 위원장 검수 시 확인)
- [ ] 리뷰: `superpowers:requesting-code-review` → codex-rescue(foreground) → 필요 시 coderabbit
- [ ] PR 생성(feature 브랜치 push + `gh pr create`)

## 머지 후 (위원장 수행, 계획 범위 밖)

1. Draft Mode로 FAQ 9건 검수(근거 위키링크·톤 확인)
2. 승인분 frontmatter `status: published` + `reviewed_by: ["1차 검토(김헌용)"]` 승격
3. `npm run kb:sync` → 홈 카드·목록 자동 노출
4. `npm run kb:embed`(선택) → RAG 채팅 FAQ 인용
5. 연구진에 드라이브 검수 킷 안내 / 콘텐츠 회의에 첫 화면 목록 초안 배포

## Self-Review 결과

- **Spec 커버리지**: §1 FAQ→Task 1~3, §2 검수 킷→Task 4, §3 목록 초안→Task 5, §1.4 0-count→Task 1(헬퍼)+Task 3(적용). 전 항목 매핑됨.
- **Placeholder**: `<<근거>>`는 Step 1 조사로 실제 slug 치환 or 줄 삭제하도록 절차 명시 — 미결 placeholder 아님.
- **타입 일관성**: `visibleAxisCards`·`AxisCardEntry` 이름이 Task 1 정의 ↔ Task 3 소비에서 일치. `AXIS_LABEL.faq`·`getStaticParamsForAxis('faq')` 기존 시그니처와 정합.
