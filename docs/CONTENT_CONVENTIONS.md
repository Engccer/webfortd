# webfortd 콘텐츠 규약

이 문서는 webfortd 마크다운 정본의 **디렉터리 구조·파일 명명·슬러그·frontmatter 작성 규약**을 정의한다. 모든 편집 어댑터(Claude Code, 옵시디언, VS Code, GitHub 웹 등)가 따라야 할 공통 약속이다. 외주 견적·계약 시 첨부 자료로 활용한다.

## 0. 정본 원칙 요약

- **콘텐츠 정본**: git 저장소 `content/<axis>/<slug>.md` 파일.
- **빌드 산출물(파생)**: `src/lib/kb-index.generated.json`(검색·라우팅용 인덱스), 향후 Supabase `documents`·`document_chunks`·`wiki_backlinks` 테이블.
- **편집 도구**: 어댑터로 자유 선택. 결과(마크다운 본문 + frontmatter + `[[slug]]` 위키링크)가 동일하면 시스템 정합성에 영향 없음.

상세는 `docs/KB_ARCHITECTURE.md` §0 참조.

## 1. 디렉터리 구조

```
content/
├── disability-types/          # 장애유형 축
│   ├── visual-*.md
│   ├── hearing-*.md
│   └── ...
├── domains/                   # 영역 축 (인사관리·복무관리·편의지원 등)
│   ├── hr-management-*.md
│   ├── work-support-*.md
│   └── ...
├── regions/                   # 지역(시도교육청) 축
│   ├── seoul-*.md
│   └── ...
├── policies/                  # 법령·지침
├── agreements/                # 단체협약 등
├── stories/                   # 사례·인식개선
└── uncategorized/             # 자동 분류 실패 페이지(검수 대기)
```

### 축(axis) 선정 가이드

한 페이지가 여러 축에 걸치는 경우 **본문 내용에 가장 가까운 축**을 디렉터리로 선택하고, 나머지 축은 frontmatter `disability_types[]`·`domains[]`·`regions[]` 배열로 표현. 디렉터리는 단일 축, frontmatter는 다축이다.

- 본문이 특정 장애유형 중심 → `content/disability-types/`
- 본문이 행정 영역 중심 → `content/domains/`
- 본문이 시도교육청 정책 중심 → `content/regions/`
- 본문이 법령·시행령 → `content/policies/`
- 본문이 단체협약·결의문 → `content/agreements/`
- 본문이 인터뷰·인식개선·우수사례 → `content/stories/`

판단이 모호하면 `uncategorized/`로 저장하고 검수 단계에서 이동.

## 2. 슬러그 명명 규약

### 형식

- **kebab-case**: 영문 소문자 + 하이픈. 공백·언더스코어·대문자·한글 사용 금지.
- **확장자**: `.md`(MDX 사용 금지).
- **길이**: 최대 60자. 가능하면 40자 이내.

### 권장 prefix

| 축 | prefix | 예 |
|---|---|---|
| disability-types | `<유형>-` | `visual-hr-mgmt-2023`, `hearing-work-support-2024` |
| domains | `<영역>-` | `hr-management-overview`, `welfare-support-procedure` |
| regions | `<지역>-` | `seoul-ordinance-2024`, `gyeonggi-comparison` |
| policies | `<법령>-` | `disability-employment-act-2023` |
| agreements | `<당사자>-<연도>-` | `moe-khudt-2020-agreement` |

### 충돌 방지

- 동일 슬러그가 둘 이상 후보일 때 **연도 또는 발행 기관 약어를 suffix**로 추가(`-2023`, `-moe`).
- 자동 분해 스크립트(`scripts/decompose-source.ts`)는 충돌 시 `-2` `-3` 숫자 suffix를 붙이지만, 가능하면 의미 있는 suffix로 수동 정리.
- 슬러그는 한번 발급되면 **외부 인용·위키링크 안정성을 위해 변경하지 않는다**. 변경 필요 시 redirect 매핑을 추가(향후 M2 이후).

## 3. Frontmatter 스키마 v1 (M1에서 zod 정의)

모든 `.md` 파일은 YAML frontmatter를 가진다. 필드 정의는 `src/types/kb.ts`(M1에서 작성)의 zod 스키마가 정본이며, 본 문서는 그 요약·작성 가이드다.

### 필수 필드

```yaml
---
title: "페이지 제목"            # string
type: "안내서"                  # 'law' | '지침' | '연구보고서' | '안내서' | '사례' | '통계' | '카드뉴스' | '영상' | 'FAQ' | '뉴스' | '기타'
disability_types: ['시각']      # 배열, KB_ARCHITECTURE §2 enum 중 ≥1
domains: ['인사관리']           # 배열, ≥1, 권장 ≤3
regions: ['전국']               # 배열, ≥1
year: 2023                      # number
status: "draft"                 # 'draft' | 'in_review' | 'published' | 'archived' | 'deprecated'
source:
  organization: "교육부"
  citation: "교육부(2023). 장애인교원 인사관리 안내서."
  url: "https://..."            # 선택
source_origin: "2023-hr-mgmt"  # 자동 분해된 페이지의 원본 파일 식별자
---
```

### 선택 필드

```yaml
subtitle: "부제목"
authors: ["김헌용"]
reviewed_by: ["hudt0715"]       # GitHub 핸들 또는 이름
reviewed_at: "2026-05-20"
reviewer_notes: "..."
effective_date: "2023-12-01"    # 법령 시행일
references:                     # 본문 인용 외부 자료
  - citation: "..."
    type: "law"                  # 'paper' | 'law' | 'web' | 'book' | 'media'
    url: "..."
accessibility:
  alt_text_complete: true
  captions_available: false
  reading_level: "standard"     # 'easy' | 'standard' | 'expert'
  audio_tts_ready: false
```

## 4. 본문 작성 규약

### 위키링크

```markdown
[[disability-types-visual]]                # 슬러그로 링크
[[disability-types-visual|시각장애 페이지]] # 표시 텍스트 커스터마이즈
[[disability-types-visual#보조공학]]        # 페이지 내 헤딩으로 링크
```

- 빌드 시 `scripts/sync-content.ts`가 위키링크를 추출해 `wiki_backlinks` 인덱스를 생성.
- 깨진 위키링크(존재하지 않는 슬러그)는 CI에서 경고로 보고.

### 헤딩 구조

- H1 한 페이지에 1개(보통 title과 같지 않다면 생략 가능, 단 본문 최상단이면 명시).
- H2를 주요 섹션으로, H3는 소절.
- 페이지 자체가 더 큰 문서에서 분해된 경우 원본 H2를 페이지의 H1로 끌어올리지 말고, H2부터 시작.

### 이미지

```markdown
![대체 텍스트는 충분히 설명적으로](/source-images/<원본>/page-N-fig-M.png)
```

- alt text는 시각장애 사용자가 이해할 수 있도록 **5단어 이상, 구체적**으로.
- 자동 추출된 이미지에 대체 텍스트가 없으면 `<!-- TODO:image-alt -->` 마커를 남기고 검수 단계에서 보완.

### 표

- GFM 표 문법 사용. 머리행을 명시.
- 표 셀이 비어 있는 경우 의도된 빈 셀이면 `-`로 표기(시각장애 사용자 낭독기에서 빈 셀이 모호하지 않도록).

### 인용·참조

- 외부 자료 인용은 본문에 각주 또는 `references[]` frontmatter로 명시.
- 본문 내 짧은 인용은 `> ` blockquote, 긴 인용은 frontmatter 출처 + 본문 요약.

## 5. 검수 워크플로 (M5에서 자동화)

- 모든 콘텐츠 변경은 git PR로 진행. PR 템플릿(`.github/pull_request_template.md`)의 체크리스트 준수.
- `status: 'draft'` → `'in_review'` → `'published'` 진입은 PR 머지로 동치.
- 검수자는 `reviewed_by`·`reviewed_at`을 PR 머지 직전 또는 자동화 스크립트(`scripts/mark-reviewed.ts`)로 기재.
- CI는 `validate:content`(frontmatter 스키마)와 위키링크 깨짐 체크를 실행.

## 6. 어댑터별 작성 참고

### Claude Code (위원장 기본 워크플로우)

자연어로 지시하면 Claude가 frontmatter·슬러그 매핑·위키링크를 일괄 작성. 시각장애 편집자에게 가장 친화적.

### 옵시디언 GUI/CLI

옵시디언 `[[]]` 위키링크 문법이 그대로 호환. `obsidian-bases` 플러그인으로 frontmatter taxonomy enum 자동 검증 가능.

### VS Code + 마크다운 확장

스크린리더 호환 표준 환경. Foam·Markdown All in One·YAML 확장 권장.

### GitHub 웹 에디터

단발 수정에 적합. PR 본문에 영향 페이지 명시.

## 7. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-17 | 최초 작성 — Phase 1 M0에서 디렉터리 규약·슬러그 명명·frontmatter 가이드 박기. 정본 위치는 `src/types/kb.ts`(M1에서 작성)의 zod 스키마. |
