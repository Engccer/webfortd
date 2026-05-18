# Phase 1.5b — 86건 unmapped 이미지 자동화 (raster 보강 + closed-loop 검수)

설계 문서. 2026-05-18 작성. brainstorming 결과 정리. writing-plans skill로 넘기기 전 단계.

## 1. 배경

Phase 1.5(완료, master `fece638`·`0a2616c`)에서 86건 unmapped 이미지 매핑 자동화를 시도한 결과 **자동 적용 0건**으로 종료됐다. 원인 분석은 `docs/image-mapping-poc-report.md`와 `docs/image-mapping-disputed.md`에 상세히 기록되어 있고, 결론은 다음 셋이다.

1. **raster 추출 단계의 구조적 한계** — 예: `2023-hr-guide` PDF는 60건 unmapped TODO 대비 추출된 raster가 21개에 불과
2. **chapter slug의 page hint 없음** — 86건 중 60건이 frontmatter에 page 번호가 없는 chapter slug
3. **alt-raster 도메인 불일치** — 예: `2024-staff-p-149`의 alt는 "플로차트 N번째 단계"인데 raster pool은 모니터 암·휠체어 등 기기 사진이라 4종 모델 만장일치 NO로 합의 게이트 정확히 작동

위원장이 시각장애인이라 수동 시각 검수가 불가능하다. **무결성 보장 + 자동화율 최대화**가 동시에 충족돼야 한다.

## 2. 목표

- 86건 unmapped TODO 마커 중 자동 매핑 가능 케이스를 최대화한다
- 나머지 케이스는 위원장이 비동기 청취·결정할 수 있는 closed-loop 워크플로우로 처리한다
- 빌드 564 정적 페이지 변동 없음을 보장한다 (분해본 페이지에 매핑만 추가되는 구조)
- Phase 1.5에서 검증된 무결성 안전망(4종 합의 게이트, `_alt_original` 교차 검증 가드)을 그대로 재사용한다

## 3. 전략 — C안 (raster 보강 + closed-loop 검수 결합)

3단계 파이프라인:

```
[1] raster pool 보강 PoC
[2] 본 자동화 재가동
[3] closed-loop 검수 (잔여 처리)
```

### 3.1 1단계 — raster pool 보강 PoC

**대상**: `data/source-pdf/2023-hr-guide.pdf` (60/86 unmapped, raster 부족 비율 21:60으로 가장 심함)

**비교 도구 4종**:

| 도구 | 모드 | 강점 | 설치 상태 |
|------|------|------|----------|
| 현재 baseline | `scripts/extract-pdf-images.py` (PyMuPDF) | 빠름 | 21개 baseline |
| pdftocairo | 페이지 전체 + 임베디드(`pdfimages`) | poppler 기반, 안정 | brew 설치 필요 |
| docparse | layout-aware crop | 일러스트·플로차트 region 검출 | `~/Mac-Projects/Converters/`에 보유 |
| opendataloader-pdf | layout detection (Java) | layout-aware | Temurin 25 설치됨 |

**측정 지표**:

1. raster 총 개수 — 도구별 추출 결과 (baseline 21 대비)
2. 페이지별 분포 — 60건 unmapped TODO의 페이지 hint와 매칭 가능 후보 raster 개수
3. 중복률 — 도구 간 같은 이미지를 다른 cropping·포맷으로 추출하는지 비교 (단순 union 시 노이즈 비중 측정)
4. alt 매칭 시뮬레이션 — 60건 중 페이지 hint 있는 샘플 10건에 대해 합의 게이트 시뮬레이션. Codex usage 절약을 위해 Gemini·Gemma·Claude 3종으로 simulated 3/3 측정. **주의**: PoC 결과는 도구 채택용 상대 비교이지 본 자동화의 정확한 자동 적용률 예측이 아니다 — 본 자동화에서 Codex가 합류하면 4종 합의 게이트가 더 강해져 자동 적용률이 PoC simulation보다 낮아질 수 있다
5. chapter slug page-range 추출 가능성 — PDF의 outline/TOC에서 챕터 시작·끝 페이지 추출 가능 여부. **60건 chapter slug 처리의 prereq** — 이게 안 되면 chapter slug 60건은 closed-loop 직행

**산출물**:

- `/tmp/image-match-poc/raster-tools-comparison.md` — 도구별 비교 보고서
- 채택 도구 1~2종 + 사용 모드 결정 + 도구별 raster union/conflict 처리 정책
- chapter slug page-range 부여 방식 결정 — 옵션: `frontmatter.pageRange` 필드 / `_image-mappings.json` 메타 / 별도 매핑 테이블
- PR A `phase-1-5b-raster-pool-poc`

**예상 시간**: 약 3시간 (도구 설치·실행 1시간 + 매칭 시뮬레이션 1시간 + 보고서 작성 1시간)

#### 3.1.1 PoC 결과 (2026-05-19, Task A1~A9 완료)

**보고서**: `/tmp/image-match-poc/raster-tools-comparison.md` (git ignored)

**채택 도구: PyMuPDF 페이지 전체 렌더 (`get_pixmap(dpi=150)`)**

docparse·opendataloader-pdf는 SKIP (각각 image extraction 미지원, jar 로컬 미발견). pdftocairo+pdfimages는 baseline 대비 +2장에 그쳐 pymupdf-pages 단독 채택으로 충분. 선택 근거:

- raster pool 6배 확장: 2023-hr-guide 22장(baseline) → 133장, 2024-staff 156장
- 벡터 그래픽·플로차트를 페이지 캡처 방식으로 커버 (임베디드 추출 누락 보완)
- 모델 매칭 검증 완료: 올바른 raster 직접 지정 시 Claude 7/7·Gemma 7/7·Gemini 4/4 YES (100%)

**chapter slug page-range 부여 방식: PDF 텍스트 검색 기반 매핑 사전**

4개 PDF 모두 `fitz.get_toc()` 빈 배열 반환 확인 — outline 자동 부여 경로 **완전 폐기**. 대안은 `fitz.page.get_text()` + `search_for()`를 이용한 slug→raster index 매핑 사전 스크립트.

**새 prereq: slug→raster 비선형 오프셋 매핑 사전 구축**

±1 window 시뮬레이션 30쌍 100% reject. 원인: slug 페이지 번호와 PDF 물리 페이지 index 간 오프셋이 케이스마다 다름 (예: hr `p-046`→raster-024 오프셋 -22, hr `p-057`→raster-060 오프셋 +3, staff `p-023`→raster-025 오프셋 +2). 상수 보정 불가. **매핑 사전 없이는 자동 매칭 불가능** — 이 prereq가 완성되어야 alt 매칭 시뮬레이션이 유의미한 후보를 생성할 수 있다.

**PR B plan 첫 task로 매핑 사전 구축 확정**:

```
Task B1: slug→raster index 매핑 사전 구축
  - 도구: fitz.page.get_text() + search_for()
  - 대상: 4개 PDF × 86건 unmapped TODO
  - 출력: /tmp/image-match-poc/slug-raster-map.json (+ slug-raster-unresolved.json)
  - page-numbered slug 처리 흐름:
    * 1차: PDF 페이지 텍스트에서 "p-NNN" 또는 페이지 번호 문자열 search_for() → 물리 페이지 index
    * fallback: 슬러그 번호를 기준으로 ±N 범위(예: ±25) raster 후보 생성 후 alt-image 모델로 1차 후보 좁힘 (PR B Task B3 합의 게이트의 사전 단계)
    * unresolved: 두 방법 모두 실패한 case → unresolved 목록에 별도 출력, closed-loop 검수 큐로 자동 routing
  - chapter slug 처리 흐름:
    * 1차: atomic 페이지 frontmatter title을 PDF text에서 search_for()
    * fallback: alias/normalized-title table (공백·줄바꿈·접두사 "01 "·기호 정규화) 적용 후 재검색. 챕터 root slug의 path 위계(예: domains/2023-hr-1-2)로 인접 atomic 페이지의 매핑 결과를 inherit
    * unresolved: 매칭 실패한 chapter slug → unresolved 목록에 별도 출력, closed-loop 검수 큐로 자동 routing
  - acceptance criteria: 86건 중 매핑 성공 건수 + unresolved 목록이 자체 산출되어, PR B Task B2(자동 적용)가 unresolved를 closed-loop 검수 큐(PR C)로 자동 routing 가능. 매핑 성공률 < 60% 시 spec 재검토(텍스트 정규화 가설 자체 결함 신호).
```

**Gemini API 제약**: REPO 외부 절대 경로 이미지 접근 불가. PR B에서 base64 `inlineData` API 직접 호출로 우회.

### 3.2 2단계 — 본 자동화 재가동

PoC 채택 도구 결정 후 진입.

**단계**:

1. **raster 재추출** — 채택 도구로 4개 PDF 전체 재추출 → `public/source-images/<source-slug>/` 갱신. 기존 baseline raster는 보존(파일명 충돌 방지 prefix 또는 별도 디렉터리)
2. **chapter slug page-range 메타 부여** — PR B Task B1에서 구축한 slug→raster 매핑 사전을 이용해 60건 chapter slug + 26건 page-numbered slug에 page range/index 메타 부여. unresolved 목록은 PR C closed-loop 검수 큐로 직행 (outline 자동 부여 경로는 §3.1.1에서 폐기됨)
3. **4종 cross-validation 재실행** — `/tmp/image-match-poc/cross-validate.mjs` + `auto-mapping.mjs` 재사용. 합의 게이트 동일 조건 (Phase 1.5와 같이 4/4 또는 3/4 + 명시적 NO 0)
4. **자동 적용** — `npm run image:apply`로 본문 반영. PR #5의 `_alt_original` 가드가 stale indexInFile 매칭 차단
5. **빌드 검증** — `npm run build`로 564개 정적 페이지 변동 없음 확인

**예상 시간**: 1~2일 (raster 재추출 1시간, cross-validation 4~6시간 [API 호출 부담], 적용·빌드 검증 30분)

**산출물 PR**: PR B `phase-1-5b-86-auto-rerun`

### 3.3 3단계 — closed-loop 검수 워크플로우

본 자동화 후 잔여 케이스를 위원장이 비동기 처리.

**검수 큐 MD 포맷** (`docs/image-mapping-review.md`):

케이스별 항목:
- key: `{source-slug}#{file-slug}#{index}`
- 파일: `content/...md` 경로
- alt 원문
- 페이지 hint (있으면)
- **후보별** (raster 후보 0~N개, 합의 게이트 거부 이유 포함):
  - 후보 raster 경로
  - 4종 모델 독립 묘사 (Gemini·Codex·Gemma·Claude vision)
  - verdict 합의 결과
- **추천** — Claude가 합의 묘사 기반 추천 후보 명시 (없으면 "skip 권장")

**위원장 결정 종류** (4가지로 닫힘):

- `case <key> 후보 <N> 채택` — N번 후보 raster를 매핑
- `case <key> alt 정제 "<신규 alt>"` — alt 자체 교체 (Phase 1.5 정제 3건 패턴 재현)
- `case <key> skip` — 영구 보류 (raster 자체 없음)
- `case <key> 후보 <N> 채택 + alt 정제 "<신규 alt>"` — 둘 다

**Claude Code 처리 흐름**:

1. `_image-mappings.json` 갱신 (`manifest_path` 또는 `alt_override`)
2. `npm run image:apply` 또는 `apply-alt-overrides.mjs` 실행
3. 빌드 검증
4. 결정 사유를 git 커밋 메시지에 기록 ("위원장 결정: case X → 후보 2 채택")

**B fallback 조건**:

본 자동화 후 잔여 10건 이하면 검수 큐 MD 생략 → Claude Code 세션에서 한 건씩 대화형 진행 (Claude가 4종 묘사 요약 보고 → 위원장 응답 → 즉시 적용).

**산출물 PR**: PR C `phase-1-5b-closed-loop-apply`

## 4. 무결성 보장 매커니즘

Phase 1.5에서 검증된 안전망 + 신규 추가:

1. **4종 합의 게이트** — Claude·Gemini·Codex·Gemma 만장일치 또는 3/4 + 명시적 NO 0
2. **`_alt_original` 교차 검증 가드** (PR #5 머지) — stale indexInFile 매칭 차단
3. **위원장 결정 git 기록** — 모든 closed-loop 결정 커밋 메시지에 기록 → 재현·감사 가능
4. **빌드 검증** — 적용 후 `npm run build`로 564개 정적 페이지 변동 없음 확인
5. **rollback 안전망** — 적용 후 문제 발견 시 `git checkout content/`로 즉시 복원 (Phase 1.5 실증)
6. **codex-rescue 게이트** — 각 PR 머지 직전 `codex:codex-rescue` dispatch

## 5. 테스트 항목

- `npm test` — 73개 테스트 그린 유지
- `npm run validate:content` — frontmatter 검증
- `npm run check:alt-text` — alt text 라벨 검증
- `npm run check:mdx-escape` — MDX 이스케이프 검증
- `npm run build` — 564 페이지 빌드 변동 없음

codex-rescue 리뷰 focus:
- `_alt_original` 가드 우회 가능성
- chapter slug page-range 메타 부여 시 frontmatter 스키마 정합
- raster 재추출로 인한 기존 mapping 18건의 `manifest_path` 무결성 (재추출이 baseline raster를 덮어쓰지 않는지)

## 6. PR 전략

| PR | 브랜치 | 내용 |
|----|--------|------|
| **PR A** | `phase-1-5b-raster-pool-poc` | raster 추출 도구 4종 비교 보고서, 채택 도구 결정, chapter slug page-range 부여 방식 결정 |
| **PR B** | `phase-1-5b-86-auto-rerun` | 4개 PDF raster 재추출 (baseline 보존), 4종 합의 게이트 재실행, 자동 적용 결과, 검수 큐 갱신 |
| **PR C** | `phase-1-5b-closed-loop-apply` | 위원장 검수 결정 반영 (`manifest_path` + `alt_override`), 빌드 검증 |

각 PR은 codex-rescue 후 머지. PR B와 C 사이에 위원장 청취 시간이 비동기로 들어간다.

## 7. 일정

| 일자 | 작업 |
|------|------|
| 2026-05-18 | spec 문서 작성·커밋 → writing-plans skill 진입 |
| 2026-05-19 | PR A — raster PoC 실행, 보고서, 머지 |
| 2026-05-20~21 | PR B — raster 재추출, cross-validation, 자동 적용 |
| 2026-05-22 | 검수 큐 생성, 위원장 청취 시작 |
| 2026-05-23~26 | 위원장 closed-loop 검수 (비동기 진행) |
| 2026-05-27 | PR C — 검수 결정 적용, 머지, production 배포 |

위원장 일정에 따라 변동. Phase 2 본 착수(Supabase 연결)와 병행 가능 — 이 작업은 콘텐츠 정본 보강이라 Phase 2 인프라 변경과 충돌 없음.

## 8. 의존성·전제

- Codex CLI usage limit 일일 재충전 (PoC 단계에서 절약하고 본 자동화에서 합류)
- `/tmp/image-match-poc/` 캐시 재사용 가능 (Phase 1.5 PoC 자료 보존됨)
- `_image-mappings.json` 스키마는 Phase 1.5와 동일 유지 (chapter slug page-range 부여 시 한 가지 필드만 추가 검토)
- `frontmatter.pageRange` 부여 옵션 선택 시 `scripts/validate-frontmatter.ts` 갱신 필요

## 9. 위험·완화

| 위험 | 완화 |
|------|------|
| raster 도구 union 시 노이즈 → 합의 게이트 정확도 저하 | PoC 중복률 측정으로 채택 도구 좁히기 (1~2종) |
| Codex API usage 한계 | 본 자동화에서 ERROR 케이스만 별도 캐시 재실행 (Phase 1.5 패턴) |
| closed-loop 위원장 일정 지연 | 잔여 10건 이하면 B fallback 활성화 (대화형 즉시 처리) |
| raster 재추출이 기존 mapping 18건 깨뜨림 | codex-rescue가 baseline raster 무결성 검증 + 재추출 결과를 별도 디렉터리 분리 |
| alt 정제 케이스가 본 자동화 결과 alt와 충돌 | `_alt_original` 가드가 `alt_override` 적용 시에도 작동하도록 확인 |

## 10. 작업 트리거

이번 sprint는 위원장 명시 신호("86건도 처리해야 해. 무결성을 보장하면서 자동화하여 처리할 수 있는 방법을 찾고 작업 계획 세워 줘.", 2026-05-18)가 있으니 즉시 진입.

## 11. 후속 — Phase 2 진입과의 관계

Phase 2 본 착수(Supabase 연결, 530 페이지 status 전환)와는 독립적이지만, 이 작업의 결과(자동 적용된 매핑 + 검수 큐 처리 결과)가 Phase 2의 임베딩 파이프라인 입력 품질에 직결된다. raster가 본문에 매핑되어 있어야 임베딩 단계에서 이미지-텍스트 정합성이 보장된다.

Phase 4(TTS·이미지 alt 자동생성)에서는 이 작업의 4종 합의 패턴과 `_alt_original` 가드를 재사용 가능하다.
