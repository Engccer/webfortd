# 본문 이미지 TODO 마커 매핑 현황 — M4-C

자동 생성. `npm run image:report` 또는 `tsx scripts/image-mappings.ts report` 실행 결과.

- 총 TODO 마커: **4개**
- 미매칭 페이지: **3개**
- 매니페스트 엔트리: **4145개** (출처 4개)

## 출처별 TODO 분포

| 출처 | TODO 마커 | 매니페스트 이미지 |
|---|---|---|
| 2023-disability-types-work-support-report | 1 | 3652 |
| 2023-hr-guide | 2 | 155 |
| 2024-jbu-work-support-guide | 1 | 166 |

## 매핑 작업 안내

1. `tsx scripts/image-mappings.ts template` 실행해서 `content/_image-mappings.template.json` 생성.
2. 템플릿을 `content/_image-mappings.json`으로 복사 후 각 항목의 `manifest_path` 채움.
   - manifest path 예시: `public/source-images/<source>/page-NNN-fig-MM.png`
   - 같은 페이지에서 본문에 등장한 순서대로 매핑.
   - alt 수정 필요 시 `alt_override` 채움.
3. `tsx scripts/image-mappings.ts apply` 실행해서 본문 TODO 마커를 이미지 링크로 교체.
4. `npm run validate:content && npm run build`로 검증.

## 페이지별 미매칭 마커 (상위 30개)

### `content/disability-types/2023-hr-1-2-2.md` (2건)

- key=`2023-hr-1-2-2#2023-hr-guide#b3cb3a55`: <그림> 등록장애인의 장애유형 분류표. 대분류 신체적 장애: 중분류 외부신체기능장애(소분류 지체장애·뇌병변장애·시각장애·청각장애·언어장애·안면장…
- key=`2023-hr-1-2-2#2023-hr-guide#2a655115`: <그림> 전체 장애인과 장애인교원의 장애유형별 비율 비교 꺾은선 그래프(단위 %, 전체 장애인/장애인교원 순). 지체 44.3/57.4, 시각 …

### `content/policies/2023-research-1-2-1.md` (1건)

- key=`2023-research-1-2-1#2023-disability-types-work-support-report#0102ca08`: [그림 Ⅰ-1] 데이컴 기법 직무분석 분류표 예시. 세로축은 임무(Duties

### `content/policies/2024-jbu-4-3-2.md` (1건)

- key=`2024-jbu-4-3-2#2024-jbu-work-support-guide#27a8560d`: 장애인학대 사례지원 절차 흐름도. 01 신고(장애인학대 신고 1644-8295
