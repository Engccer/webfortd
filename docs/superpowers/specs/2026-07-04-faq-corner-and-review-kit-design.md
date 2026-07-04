# 2차 자문회의 후속 — FAQ 코너 + 연구진 검수 킷 + 첫 화면 목록 초안

- **작성일**: 2026-07-04
- **맥락**: 제2차 자문회의(2026-06-25) 후속 조치 중 **코드로 구현 가능한 부분**. 회의에서 FAQ 등 정적 안내 코너 + 맞춤형 시스템(위키+AI 챗봇) 이원 구성에 합의했고(회의록 §III.2, §IV), 시드 문서 4종 원문 대조 검수를 연구진이 담당(조치 5), 첫 화면 필수 노출 콘텐츠를 콘텐츠 회의에서 정리(조치 6)하기로 함.
- **포지셔닝**: webfortd는 본 사업의 레퍼런스·페이스메이커(CLAUDE.md 2026-06-05 결정). FAQ 코너는 "정적 안내 + 위키·채팅이 한 몸"임을 보여주는 시연 자산이고, 검수 킷은 연구진 검수 워크플로를 앞서 실증하는 지원 도구다.
- **회의록 원본**: `자문 디렉터리/2. 회의/260625 제2차 자문회의/260625_제2차_자문회의_회의록.md`

## 범위

세 산출물을 한 사이클로 묶는다. (1)만 코드 변경이고, (2)·(3)은 문서 산출물이라 서로 독립적으로 진행 가능하다.

1. **FAQ 코너** — 신규 axis `faq` (웹 기능, 코드)
2. **연구진 검수 지원 킷** — 자문 드라이브 문서 2종 + repo `data/README.md` 1절
3. **첫 화면 필수 노출 콘텐츠 목록 초안** — 자문 메모 (콘텐츠 회의 자료)

---

## 1. FAQ 코너 (신규 axis `faq`)

### 1.1 설계 원칙

- **마크다운이 정본**(영구 원칙). FAQ 콘텐츠는 `content/faq/<slug>.md` atomic 페이지. TS 코드에 Q&A를 박지 않는다.
- **기존 axis 파이프라인 재사용**. `policies`·`agreements` 등과 동일하게 검색·sync·RAG 임베딩·위키링크·출처 footer·published 게이트가 전부 자동 적용된다. 신규 컴포넌트 0개가 목표.
- **검수 게이트 준수**. 초기 콘텐츠는 전부 `status: draft`. 위원장이 Draft Mode(AdminBar)로 검수한 뒤 frontmatter를 `published`로 승격 → `kb:sync` → 공개. 검수 전에는 홈 카드·목록·RAG 어디에도 노출되지 않는다.

### 1.2 콘텐츠 모델

`content/faq/<slug>.md` 9건 — 작년 사이트 대응으로 이미 작성된 legacy FAQ(`src/app/(gov)/legacy/participate/faq/page.tsx`)의 편의제공·인사관리·권리구제 3카테고리 × 3질문을 질문별 페이지로 이식한다.

**frontmatter** (기존 스키마 `FrontmatterSchema` 준수):

```yaml
title: "보조공학기기 지원은 어떻게 신청하나요?"   # 질문 문장 = 제목
type: FAQ                                        # DocTypeSchema에 이미 존재
disability_types: ["전체"]
domains: ["편의지원"]                             # 카테고리→domains enum 매핑
regions: ["전국"]
year: 2026
status: draft                                    # 검수 전
source:
  organization: "장애인교원 위키 편집부"
  citation: "장애인교원 위키 자주 묻는 질문 (2026)"
source_origin: "faq"
reviewed_by: []                                  # draft라 비워둠(published 게이트 미적용)
references: []
accessibility:
  alt_text_complete: true
  captions_available: false
  reading_level: easy                            # 학부모 등 가장 쉬운 사용자 기준(채팅 톤 원칙 정합)
  audio_tts_ready: false
```

카테고리→`domains` enum 매핑: 편의제공→`편의지원`, 인사관리→`인사관리`, 권리구제→`권리구제` (모두 enum에 존재).

**본문**: legacy 답변을 이식하되 아래를 보강한다.
- 각 답변을 관련 위키 문서와 **교차 확인**하고, 근거가 되는 위키 페이지를 `[[slug]]` 위키링크로 연결한다(위키링크 빌드가 백링크·인접 그래프에 자동 편입 → 채팅 RAG가 FAQ와 근거 문서를 함께 인용 가능).
- 근거 위키 문서를 특정하지 못한 답변은 문구를 그대로 두되 `reviewer_notes` frontmatter에 "근거 문서 미연결 — 검수 시 확인" 표시. (위원장 검수 대상 명시)
- 톤은 채팅 역할 원칙과 동일: 다정·명료, 쉬운 문장 우선 + 정책 핵심·예외 누락 없음.

slug는 영문 kebab(예: `assistive-device-apply`, `work-assistant-scope`). 파일 경로가 `content/faq/<slug>.md`(3-part)여야 `getStaticParamsForAxis('faq')`가 잡는다.

### 1.3 코드 변경 (파일 단위)

TypeScript 전수형 Record가 갱신 지점을 강제하므로 누락이 컴파일 에러로 잡힌다.

| 파일 | 변경 |
|------|------|
| `src/types/kb.ts` | `CONTENT_AXES`에 `'faq'` 추가 (배열 끝, `uncategorized` 앞뒤 무관) |
| `src/lib/kb-axis.ts` | `AXIS_LABEL`에 `faq: "자주 묻는 질문"` + `BROWSABLE_AXES`에 faq 항목(라벨·description) 추가. 순서는 목록 하단(주제 axis 뒤, 보조 성격) |
| `src/components/wiki/AxisBrowseEntries.tsx` | `AXIS_ICON`에 `faq: HelpCircle`(lucide) 추가 + **count 0 카드 숨김**(아래 1.4) |
| `src/app/(wiki)/faq/page.tsx` | 신규 — `AxisListPage axis="faq"` (policies/page.tsx 복제) |
| `src/app/(wiki)/faq/[slug]/page.tsx` | 신규 — `KbPageLayout axis="faq"` + `getStaticParamsForAxis('faq')` (policies/[slug]/page.tsx 복제) |
| `content/faq/*.md` | 신규 9건 (1.2) |

**사이드바 미변경**: `WikiEntriesNav` 평면 5진입은 영구 결정(PR #61). FAQ 진입 추가 여부는 콘텐츠 회의 소재로 (3) 목록 초안에만 기재한다.

### 1.4 홈 "주제별 둘러보기" 0-count 카드 처리

`AxisBrowseEntries`는 각 axis의 published 문서 수를 세어 카드에 노출한다. faq를 `BROWSABLE_AXES`에 넣으면(라우팅에 필수) draft 상태 동안 "0개" 카드가 뜬다 — 익명 사용자에게 깨진 화면 인상.

**해결**: `AxisBrowseEntries`에서 `count === 0`인 카드를 렌더에서 제외한다. 이는 faq만을 위한 특례가 아니라, 향후 어떤 axis든 published 0건이면 빈 카드를 숨기는 **방어적 개선**이다.
- 익명/일반: faq publish 전엔 카드 없음 → publish 후 자동 등장.
- admin Draft Mode: count가 draft 포함이라 검수 중에도 카드가 보인다(검수 동선에 유용, 의도된 동작).

### 1.5 검증

- **단위**: `kb-axis` faq 라벨·browsable 포함 테스트. `AxisBrowseEntries` 0-count 필터 테스트(published 0 axis 카드 미노출 + 1건 이상 노출).
- **콘텐츠 검증**: `npm run build`(validate:content 포함)가 9개 FAQ frontmatter를 통과. axis `faq`가 `CONTENT_AXES`에 있어야 경로 검증 통과.
- **빌드**: `/faq` + `/faq/[slug]` 9개 정적 라우트 생성. 페이지 수 +10.
- **게이트 불변식**: draft 상태에서 익명 `/faq` 목록 0건, `/faq/<slug>` UnderReviewNotice(기존 KbPageLayout 게이트). admin Draft Mode에서 전체 노출.

### 1.6 검수·공개 흐름 (머지 후, 위원장 수행)

1. draft 9건 머지 → 위원장이 Draft Mode로 각 FAQ 검수(근거 위키링크 정합·톤 확인).
2. 승인 항목 frontmatter `status: published` + `reviewed_by: ["1차 검토(김헌용)"]` 승격.
3. `npm run kb:sync` → DB 반영, 홈 카드·목록 자동 노출.
4. `npm run kb:embed`(선택) → RAG 채팅이 FAQ 인용 가능.

---

## 2. 연구진 검수 지원 킷

조치 5(시드 4종 마크다운·원문 대조 검수, 중부대 연구진, 7~8월) 지원. 연구진은 비개발자이므로 메모장·워드로 여는 마크다운 검수 흐름을 전제로 한다.

**중요 사전 확인(실측 완료)**: 자문 드라이브 `data/markdown/` 5파일은 webfortd `data/source-md/` 5파일과 **바이트 단위 동일**(2026-07-04 `cmp` 확인). 단, 이 fused 마크다운은 2026-05-14 파싱본이라 이후 `content/` atomic 페이지에만 반영된 Phase 1.5 이미지 매핑·alt 정제(누적 28건)가 **반영돼 있지 않다**. 검수 안내에 이 차이를 명시해 "이미 웹에서 고쳐진 부분"을 중복 지적하지 않도록 한다.

### 2.1 산출물

**(a) 자문 드라이브 `data/검수 안내.md`** — 연구진용 가이드:
- 검수 목적(원문 PDF ↔ 파싱 마크다운 정확성, AI 답변 품질의 근간)
- 5파일 ↔ 원본 PDF 대응표(파일명·발행 기관·연도, `data/README.md` 표 재사용)
- 검수 방법(메모장/워드로 `data/markdown/*.md` 열기, `data/*.pdf` 원문과 대조)
- 볼 것: 본문 누락·오인식(OCR 오류)·표 깨짐·문단 순서·이미지 설명 적정성
- 알려진 차이: `[이미지: ...]` 자리 표시 마커의 의미, 웹 반영본과 fused 마크다운의 alt 차이(위 사전 확인)
- 기록 방법((b) 양식으로)
- 반영 절차(연구진 기록 → 위원장이 `content/<axis>/<slug>.md` atomic 페이지 수정 → 웹 반영)

**(b) 자문 드라이브 `data/검수 기록.md`** — 기록 양식 + 작성 예시:
- 자유 서술 한 줄 형식(비개발자 배려): `[파일명] · [위치(페이지/제목)] · [발견 내용] · [제안]`
- 작성 예시 1건

**(c) repo `data/README.md`에 "연구진 원문 대조 검수 워크플로" 1절 추가** (커밋 대상):
- 검수 입력=`data/markdown/`(드라이브)↔`data/source-pdf/`, 반영 대상=`content/<axis>/<slug>.md`
- fused 마크다운은 입력 스냅샷이지 정본 아님 — 검수 지적의 최종 반영은 atomic 페이지에서

### 2.2 경계

- 검수 결과를 atomic 페이지에 자동 반영하는 스크립트는 **만들지 않는다**(YAGNI). 지적은 latent 판단(문맥·정책 정확성)이라 위원장이 개별 반영. 규모가 커지면 그때 도구화.

---

## 3. 첫 화면 필수 노출 콘텐츠 목록 초안

조치 6(첫 화면·필수 노출 콘텐츠 요구 정리, 콘텐츠 회의) 자료. 자문 메모로 작성한다.

**산출물**: 자문 디렉터리 `1. 자문 메모/260704_첫화면_필수노출_콘텐츠_요구정리.md`

**구성**:
- 목적: 콘텐츠 회의(중부대·장교조) 입력 자료. webfortd 현 메인을 시연 기준으로, 공식 웹앱 첫 화면 필수 노출 목록의 초안 제시.
- webfortd 현 메인 구성 정리(검색 hero·오늘의 위키·주제별 둘러보기·역할별·자주 찾는 + 신설 FAQ 코너)를 시연 기준선으로.
- 중부대 요구 반영: 정적 안내 코너(장애인교원 기본 이해·편의지원 항목과 신청 절차·학교 관리자/동료 안내)를 첫 화면 필수 노출 후보에 포함(회의록 §III.2).
- 이용자 유형별(장애인교원 당사자·예비교사·학부모·관리자·교육청 담당자) 첫 화면 진입 동선 제안.
- **결정 필요 항목**(회의 논의용): FAQ의 첫 화면/사이드바 노출 방식, 정적 안내 코너와 위키 문서의 경계, 랜딩 페이지 톤(관공서형 vs 미니멀).

**경계**: 이 문서는 코드가 아니라 회의 자료. webfortd 구현 변경을 규정하지 않는다.

---

## 범위 밖 (YAGNI)

- FAQ 카테고리 그룹핑 UI — 9건 규모에 가나다 평면 목록으로 충분. 카테고리 다수화 시 재검토.
- FAQ 사이드바 진입 — 영구 결정(PR #61) 유지, 콘텐츠 회의 결정 사항.
- 검수 결과 자동 반영 스크립트 — latent 작업이라 도구화 보류.
- 국내 AI 모델 사전 검증·추가 보고서 전처리 — 비용 발생/대기 항목, 이 사이클 밖.
- 개인정보 교육부 질의문 — 자문 트랙(위원장 작성), 코드 아님.

## 테스트 전략

- **게이트 테스트**(결정적·로컬): kb-axis faq 메타 + AxisBrowseEntries 0-count 필터 + build content validation. 매 커밋.
- **접근성**: `/faq`·`/faq/[slug]`는 기존 axis 라우트와 동일 컴포넌트라 axe 회귀 자동 커버. 신규 접근성 표면 없음(신규 컴포넌트 0).

## 위험·완화

| 위험 | 완화 |
|------|------|
| faq axis 추가가 DB `documents.axis`(text, 제약 없음)·sync에 영향 | 0001 스키마 axis는 free text라 제약 없음. sync는 `content/**` 워크라 자동 편입. 확인: kb:sync:dry-run |
| draft FAQ가 홈 0-count 카드로 노출 | 1.4 count 0 숨김 |
| legacy 답변의 정책 정확성이 오래됨 | 전부 draft로 시작 + 위원장 검수 게이트. 근거 미연결은 reviewer_notes 표시 |
| fused 마크다운 검수 지적이 웹 반영본과 중복 | 검수 안내에 alt·이미지 차이 명시(2.1) |
