---
date: 2026-05-29
owner: 김헌용 (장교조 위원장)
status: design
phase: Phase 4 M3 후속 (사이드바 리팩터 follow-up)
related:
  - docs/superpowers/specs/2026-05-28-sidebar-hamburger-redesign.md
  - src/components/layout/AppSidebar.tsx
  - src/components/layout/Footer.tsx
  - src/components/wiki/EntryToggle.tsx
  - src/app/(wiki)/page.tsx
parent_pr: "#60 (a586582 squash merged 2026-05-28)"
---

# 사이드바 위키 진입점 + 콘텐츠/Footer 재구성 설계

## 0. 배경과 동기

PR #60(2026-05-28 머지)으로 좌측 사이드바·햄버거 메뉴 리팩터가 완료되었으나, 위원장이 production 검증 중 다음 회귀를 발견:

1. **위키 영역 진입점 사라짐**: 사이드바에 `mainNavigation` 6개(전부 `/legacy/*`)만 노출되어, 위키 모드의 채팅·자료실·미디어로 가는 메뉴가 사라짐. 이전 `(wiki)/layout.tsx`의 inline header에 있던 "위키 / 채팅" 링크가 AppShell 교체로 사라지면서 대체 진입점이 들어가지 않음.
2. **About(사업 소개) 부재**: 본 사업의 정체성·범위를 안내하는 페이지가 메뉴 어디에도 없음.
3. **메인 콘텐츠 중복**: `/`에 `ChatLibraryMediaEntries` 3장 카드(채팅·자료실·미디어)가 있는데 사이드바 진입점이 추가되면 중복.
4. **Footer 부적합**: "장애인교원 교육전념 여건 지원" 섹션 + "바로가기" 섹션이 있고, 바로가기에는 `mainNavigation`(=레거시 메뉴 6개)이 노출되어 위키 모드 사용자에게 어색.
5. **정책/약관/사이트맵 페이지 부재**: 일반 웹사이트 하단에 있는 기본 정책 페이지가 없음.
6. **"AI 채팅" 라벨**: 위키 hero·콘텐츠 카드에 "AI 채팅"으로 표기되어 AI 색채가 과함. 위원장 톤 가이드("다정·명료") 정합 안 됨.
7. **메뉴 라벨 이모지**: 위원장 영구 원칙 — UI 라벨에 이모지를 쓰면 "AI 만든 느낌"이 강해짐. 모든 프로젝트 공통 금지 원칙 필요.

## 1. 결정 잠금 (Decision Lock)

| ID | 결정 | 근거 |
|----|------|------|
| **D1** | 사이드바 위키 진입점 5개 추가: 위키 홈(`/`) → 채팅(`/chat`) → 자료실(`/library`) → 미디어(`/media`) → About(`/about`). 라벨은 모두 텍스트만(이모지/AI 단어 없음). | "AI 채팅"이 아닌 "채팅"으로 통일. 자주 쓰는 메뉴 우선 순서. |
| **D2** | 사이드바 모드는 **pathname 자동 분기**: URL이 `/legacy/*`이면 `mainNavigation`(레거시 트리 6개), 외에는 위키 진입 5개. | EntryToggle 클릭이 곧 navigate → pathname 변경 → 사이드바 자동 전환. SidebarContext에 mode state 추가 불요. |
| **D3** | EntryToggle 라벨: "위키·채팅 ↔ 레거시 사이트". 기존 "이전 버전" → "레거시 사이트"로 변경. | "이전 버전"은 의미 모호 — 사용자에게 *별도 사이트로 이동*이라는 사실을 명시. |
| **D4** | 메인 콘텐츠 `(wiki)/page.tsx`에서 `ChatLibraryMediaEntries` 제거. WikiHero + RoleEntries + PopularPages만 남김. | 사이드바와 중복 회피. |
| **D5** | Footer 재구성. **제거**: "장애인교원 교육전념 여건 지원" 브랜드 섹션, "바로가기"(mainNavigation 노출) 섹션. **유지/신규**: 운영 주체 placeholder(주소·연락처) + 정책 링크 3개(개인정보처리방침/이용약관/사이트맵) + 관련 사이트 영역(현재 비움) + Copyright. | 위키 모드에서 레거시 메뉴 노출 어색 해소. 일반 웹사이트 footer 패턴. |
| **D6** | 신규 placeholder 페이지 3개: `/privacy`, `/terms`, `/sitemap`. 본문은 모두 "초안 작성 중" 안내 + Phase 5 정련 메모. | Footer 링크가 broken link 되지 않도록. 시각장애 사용자에게 dead anchor는 인지 비용↑. |
| **D7** | About 페이지 `(wiki)/about/page.tsx` 신규 생성. 본문은 placeholder — 위원장 박은 "앱 정체성 + 채팅 역할"(CLAUDE.md §앱 정체성과 채팅의 역할) 1~2단락 요약 + "본 사이트는 시범 모델입니다" 안내. 후속 위원장 정련. | 사업 정체성 노출. 시나리오 A·B 모두 동일 정체성. |
| **D8** | "AI 채팅" → "채팅" 전 영역 통일: WikiHero CTA, RoleEntries 추천 라벨, ChatLibraryMediaEntries(제거되니 무관), 채팅 페이지 metadata title, 사이드바 라벨. **"AI 챗봇" 등 비슷한 단어도 검색해 정리.** | 위원장 톤 가이드 — "AI"의 차가운 어감을 줄이고 "채팅"이라는 단순 친근 표현으로. |
| **D9** | **메뉴 라벨 이모지 금지 원칙** — 글로벌 `~/.claude/CLAUDE.md`에 영구 박음. 모든 프로젝트(dodo-planet 등) 공통. | 위원장 명시 요청 "기억해 줘". UI 라벨에 이모지는 AI 색채를 키워 사용자 신뢰 저하. lucide-react 아이콘은 허용(텍스트가 아닌 시각 보조). |
| **D10** | Footer 운영 주체 정보는 **placeholder 유지**(현재 더미 `support@example.go.kr` / `044-XXX-XXXX`). 시나리오 A(중부대 이관) 확정 시점에 위원장이 본 정보로 교체. | 지금 장교조 정보 박으면 후속 이관 시 다시 바뀜. |

## 2. 컴포넌트 분할

기존 단일 `SidebarNav.tsx`가 `mainNavigation` 트리만 렌더링하던 구조를 **모드 분기**로 확장:

```
src/components/layout/
  AppSidebar.tsx           (modify) — pathname 감지 → SidebarNav OR WikiEntriesNav 분기 렌더
  SidebarNav.tsx           (unchanged) — 레거시 트리 (기존 그대로)
  WikiEntriesNav.tsx       (NEW) — 위키 진입 5개 평면 리스트 (sub-tree 없음)
  Footer.tsx               (rewrite) — 신규 구조

src/components/wiki/
  EntryToggle.tsx          (modify) — 라벨 "이전 버전" → "레거시 사이트"
  WikiHero.tsx             (modify) — "채팅으로 질문" 그대로 (이미 OK), CTA 검색 후 점검
  ChatLibraryMediaEntries.tsx  (DELETE) — `(wiki)/page.tsx`에서 제거. 컴포넌트는 보존(미래 다른 위치 재사용 가능성). plan에서 결정.
  RoleEntries.tsx          (check) — "AI 채팅" 단어 있으면 수정

src/app/
  (wiki)/page.tsx          (modify) — ChatLibraryMediaEntries import + 사용 제거
  (wiki)/about/page.tsx    (NEW) — placeholder
  privacy/page.tsx         (NEW) — placeholder (그룹 외 root에 두기 — Footer 정책은 모드 무관)
  terms/page.tsx           (NEW) — placeholder
  sitemap/page.tsx         (NEW) — placeholder
  (wiki)/chat/page.tsx     (modify) — metadata title "채팅" 확인

src/lib/
  wiki-entries.ts          (NEW) — 위키 진입 5개 항목 데이터 (icon + label + href)
```

**WikiEntriesNav는 왜 별도 컴포넌트인가**: `SidebarNav`는 3단계 트리 + Disclosure + 화살표 키 처리(`ArrowRight`/`ArrowLeft`)가 깊게 들어가 있음. 위키 진입은 평면 5개라 트리 로직이 잉여. 단일 책임 분리 + 시각장애 사용자 키보드 흐름 단순화(Tab만으로 충분).

## 3. 사이드바 모드 분기

`AppSidebar.tsx`에서 `usePathname()`으로 판단:

```tsx
const pathname = usePathname()
const isLegacyMode = pathname === "/legacy" || pathname.startsWith("/legacy/")

return (
  <aside ...>
    {/* 헤더 */}
    ...
    {/* 메뉴 본체 */}
    {isLegacyMode ? (
      <SidebarNav items={mainNavigation} pathname={pathname} onNavigate={handleNavigate} />
    ) : (
      <WikiEntriesNav items={wikiEntries} pathname={pathname} onNavigate={handleNavigate} />
    )}
    ...
  </aside>
)
```

**EntryToggle 클릭 시 흐름**:
1. 사용자가 "레거시 사이트" 버튼 클릭 → `/legacy`로 navigate
2. `usePathname()` 결과 변경 → `isLegacyMode=true`
3. `SidebarNav`가 `mainNavigation` 트리 렌더
4. 사이드바는 모바일 overlay 모드면 자동 닫힘(T6 useRef 패턴 그대로)

같은 흐름이 위키 → 레거시 → 위키 양방향 모두 자연.

## 4. WikiEntriesNav 컴포넌트 명세

```tsx
interface WikiEntry {
  href: string
  title: string  // 텍스트만, 이모지 금지 (D9)
  description?: string  // 사이드바 표시 안 함, 추후 tooltip 등 확장 여지
}

interface WikiEntriesNavProps {
  items: WikiEntry[]
  pathname: string
  onNavigate: () => void
}
```

**렌더**: `<nav aria-label="위키 메뉴"><ul>` + 평면 `<li>` 5개. 각 항목은 `<Link>` + `aria-current="page"` (현재 경로일 때) + `min-h-11` 터치 타깃.

**아이콘**: lucide-react 아이콘 1개 (시각 보조). `aria-hidden="true"` 처리.

**5개 항목**:

| 순서 | href | title | 아이콘 | 비고 |
|------|------|-------|--------|------|
| 1 | `/` | 위키 홈 | `Home` | 메인 진입 |
| 2 | `/chat` | 채팅 | `MessageSquare` | "AI" 단어 없음 |
| 3 | `/library` | 자료실 | `FolderArchive` | |
| 4 | `/media` | 미디어 | `Image` | |
| 5 | `/about` | About | `Info` | 사업 소개 |

## 5. Footer 재구성 명세

새 구조 (모바일 1열, 데스크탑 3열 그리드):

```
┌─────────────────────────────────────────────────────────┐
│ 운영 주체 정보              관련 사이트         정책 링크   │
│ [주소 placeholder]          (현재 비움)        개인정보처리방침 │
│ 이메일: support@…           (Phase 5에서 추가)  이용약관       │
│ 전화: 044-XXX-XXXX                            사이트맵        │
│                                                              │
│ ────────────────────────────────────────────────────         │
│ © 2026 장애인교원 교육전념 여건 지원                            │
└─────────────────────────────────────────────────────────┘
```

**제거**: 
- 브랜드 섹션 ("장애인교원 교육전념 여건 지원" h2 + 설명)
- "바로가기" 섹션 (mainNavigation 노출)

**유지/신규**:
- 운영 주체 정보 ("문의" 영역 확장): 주소 한 줄 placeholder("주소: TBD") + 이메일 + 전화 (D10)
- 관련 사이트 (heading만, 본문은 "준비 중" 안내)
- 정책 링크: `/privacy`, `/terms`, `/sitemap` 텍스트 링크
- Copyright: "© 2026 장애인교원 교육전념 여건 지원" (브랜드 1줄 — 브랜드 섹션과는 다름, 단순 식별)

**접근성**: heading 구조 `<h2>운영 주체</h2><h2>관련 사이트</h2><h2>정책</h2>` — Footer 안에서 시각장애 사용자가 섹션 단위로 빠르게 점프 가능.

## 6. 신규 페이지 placeholder

### 6.1 `/about` ((wiki) 그룹)

`src/app/(wiki)/about/page.tsx`:

```tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About",
  description: "본 사이트의 정체성·목적·운영 주체를 안내합니다.",
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">About</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        장애인교원에 관한 모든 정보를 한곳에서 안내합니다.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">사이트 정체성</h2>
        <p>
          본 사이트는 <strong>장애인교원 교육전념 여건 지원 사업</strong>의
          시범 모델입니다. 함께하는장애인교원노동조합(장교조)이 제작·운영하고
          있으며, 사업의 본격 확장 단계에서는 교육부·중부대 공식 운영으로
          이관될 예정입니다.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">채팅의 역할</h2>
        <p>
          본 사이트의 채팅은 <strong>대한민국 장애인교원 관련 제도 및 정책 안내</strong>를
          담당합니다. 장애인교원·예비교사·장애학생 부모·정책 입안자 누구든 자연어로
          정책 질문을 할 수 있고, 출처와 함께 답변을 받을 수 있습니다.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">콘텐츠 범위</h2>
        <p>
          535개의 정책·법령·사례·보조공학기기 페이지가 위키 형태로 연결되어
          있습니다. 자료실에서는 원본 정책 보고서·안내서를 PDF로 다운로드할 수
          있고, 미디어 자료실에서는 카드뉴스·인포그래픽을 alt 텍스트와 함께
          볼 수 있습니다.
        </p>
      </section>

      <p className="mt-12 text-sm text-muted-foreground">
        본 페이지의 본문은 시범 단계 placeholder입니다. 운영 주체의 정식 본문은
        Phase 5에서 정련됩니다.
      </p>
    </article>
  )
}
```

### 6.2 `/privacy`, `/terms`, `/sitemap`

모두 동일 패턴의 placeholder. 위치는 **`src/app/그룹외/<slug>/page.tsx`** — 정책 페이지는 위키/레거시 모드와 무관하게 항상 동일 경로. AppShell이 wrap.

예시 `src/app/privacy/page.tsx`:

```tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "개인정보처리방침",
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        본 페이지의 본문은 작성 중입니다.
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Phase 5(중부대 이관 또는 장교조 직접 운영 확정 시점)에서 정식 본문이
        제공됩니다. 현재는 placeholder 상태입니다.
      </p>
    </article>
  )
}
```

`/terms`, `/sitemap`도 동일 구조. `/sitemap`은 추후 자동 생성된 사이트맵 페이지로 진화 — 지금은 placeholder.

**중요**: `/privacy`, `/terms`, `/sitemap`은 `(wiki)`/`(gov)` 그룹 밖에 둠 → 따라서 그룹 layout이 적용되지 않음. 하지만 AppShell의 적용 범위를 확인해야 함(루트 layout에서 한 번 더 wrap 필요할 수 있음).

**plan에서 결정**: 정책 페이지가 자체 layout이 필요한지(layout.tsx 신규) 또는 root layout만으로 충분한지(현재 root layout은 ThemeProvider만 적용, AppShell 적용 없음 — group layout에서만 적용). 

→ 결정: 정책 페이지를 **`(wiki)` 그룹 안**에 두어 AppShell + 사이드바를 그대로 사용. 사이드바 모드 분기는 pathname `/privacy` `/terms` `/sitemap` 모두 `/legacy/*` 아님이라 위키 모드(5 진입)로 노출. 자연스러움. 변경: `src/app/(wiki)/privacy/page.tsx` 등.

## 7. 이모지 금지 원칙 (D9, 글로벌 메모리)

`~/.claude/CLAUDE.md`에 새 섹션 추가:

```markdown
## 행동 규칙: UI 메뉴 라벨 이모지 금지

UI 메뉴·버튼·네비게이션 항목 라벨에는 **이모지를 사용하지 않는다**. 모든
프로젝트(dodo-planet, webfortd, lg-thinq-console, seats-arranger 등)
공통 원칙.

**근거**: 메뉴 라벨에 이모지(🏠 채팅 / 📂 자료실 등)를 쓰면 사용자가 "AI가
만든 화면"이라는 인상을 받아 신뢰도가 떨어진다. 위원장 직접 명시(2026-05-29
webfortd 사이드바 fix 시).

**허용**:
- lucide-react·Heroicons 등 SVG 아이콘 라이브러리 (텍스트가 아니므로 OK,
  스크린리더에는 `aria-hidden` 처리)
- 본문·블로그 글 안의 이모지 (UI 컨트롤이 아님)
- 외부 콘텐츠 인용 안 이모지 (사용자가 작성한 데이터)

**금지**:
- 메뉴 항목 라벨 ("🏠 위키 홈" 등)
- 버튼 라벨 ("📚 자료실" 등)
- 사이드바 헤더, 카드 제목 등 UI 텍스트 전반
```

## 8. 마이그레이션 순서 (구현 plan에서 단계화)

| 단계 | 작업 | 검증 |
|------|------|------|
| 8.1 | `src/lib/wiki-entries.ts` 신규 (5개 항목 데이터) | 단순 정적 데이터, 단위 테스트 1건 |
| 8.2 | `WikiEntriesNav.tsx` 신규 + 컴포넌트 테스트 5건 | aria-label, aria-current, Tab 순서, 아이콘 aria-hidden |
| 8.3 | `AppSidebar.tsx` 수정 — `usePathname` 기반 모드 분기 + WikiEntriesNav 렌더 | AppSidebar 테스트 신규 5건 추가 (모드별 노출 확인) |
| 8.4 | `EntryToggle.tsx` 수정 — 라벨 "이전 버전" → "레거시 사이트" | 기존 테스트 업데이트 |
| 8.5 | `(wiki)/page.tsx` 수정 — ChatLibraryMediaEntries 제거 | Playwright a11y 회귀 0건 |
| 8.6 | Footer.tsx 재구성 + heading 구조 | 테스트: 브랜드/바로가기 부재, 정책 링크 존재, heading 3개 |
| 8.7 | 신규 페이지 4개 placeholder (about, privacy, terms, sitemap) — 모두 `(wiki)` 그룹 안 | 각 페이지 200 응답 + 본문 placeholder 텍스트 검증 |
| 8.8 | "AI 채팅" → "채팅" grep + 일괄 정리 (chat metadata, hero CTA, role entries, wiki-popular 등) | 텍스트 검색 0건 잔존 |
| 8.9 | 글로벌 ~/.claude/CLAUDE.md 이모지 금지 원칙 박기 | 변경 자체가 검증 (PR과 별개 — 별도 file 편집) |
| 8.10 | 회귀 가드 + 빌드 + Playwright a11y 전체 통과 | `npm run test:components` / `npm run lint` / `npm run build` / `npm run test:a11y` |
| 8.11 | PR 생성 + 머지 + production 검증 (Chrome MCP) | 사이드바 위키 진입 5개 노출 + EntryToggle "레거시 사이트" + Footer 정책 링크 |

## 9. 리뷰 포커스 (codex-rescue + coderabbit)

마일스톤 PR 직전:

- **D2 (pathname 자동 분기)** — `/legacy/about/purpose` 같은 깊은 경로에서도 `mainNavigation` 노출되는지. 빈 경로(`/`)는 위키 모드 정확히 진입하는지.
- **D5 (Footer 구조)** — 브랜드/바로가기 제거 후 heading 구조 깨지지 않는지 (h2 누락 등). 정책 링크가 broken 안 되는지.
- **D8 ("AI 채팅" 통일)** — 잔존 문자열 0건 (특히 mdx/json/test 안 잔존 가능).
- **신규 페이지 4개** — 각 페이지가 (wiki) 그룹 layout(AppShell) 안에서 정상 렌더되는지. about 안 "장교조" 단어 사용 정확성.

## 10. 비범위 (Out of Scope)

- About 본 콘텐츠 정련 — 위원장 후속
- 정책/약관/사이트맵 본 콘텐츠 — Phase 5
- 관련 사이트 항목 — Phase 5에서 위원장이 결정
- Footer 주소·연락처 본 정보 — 시나리오 A 확정 후
- 사이드바에 검색 기능 추가 — Phase 5+
- 다국어 — 한국어 우선 원칙 유지

## 11. 종속성 / 영향 받는 파일

```
src/components/layout/AppSidebar.tsx                (modify)
src/components/layout/WikiEntriesNav.tsx            (new)
src/components/layout/Footer.tsx                    (rewrite)
src/components/wiki/EntryToggle.tsx                 (modify)
src/components/wiki/WikiHero.tsx                    (check — "AI" 단어 점검)
src/components/wiki/RoleEntries.tsx                 (check — "AI" 단어 점검)
src/components/wiki/ChatLibraryMediaEntries.tsx     (delete? — 또는 보존)
src/app/(wiki)/page.tsx                             (modify)
src/app/(wiki)/about/page.tsx                       (new)
src/app/(wiki)/privacy/page.tsx                     (new)
src/app/(wiki)/terms/page.tsx                       (new)
src/app/(wiki)/sitemap/page.tsx                     (new)
src/app/(wiki)/chat/page.tsx                        (check — metadata)
src/lib/wiki-entries.ts                             (new)
src/lib/navigation.ts                               (check — "AI 채팅" 단어 검색)
src/lib/wiki-popular.ts                             (check)
src/lib/wiki-role-entries.ts                        (check)

tests/components/WikiEntriesNav.test.tsx            (new)
tests/components/AppSidebar.test.tsx                (extend — 모드 분기 테스트)
tests/components/Footer.test.tsx                    (new 또는 extend)
tests/components/EntryToggle.test.tsx               (update — 새 라벨)
tests/a11y/sidebar.spec.ts                          (extend — 모드 분기 회귀 가드)

~/.claude/CLAUDE.md                                  (modify — D9 영구 원칙)
```

총 신규 ~7 + 수정 ~10 + 테스트 ~4 ≈ 21개 파일. LOC 추가 약 500~700.
