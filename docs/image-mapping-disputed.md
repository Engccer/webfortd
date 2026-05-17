# 이미지 매핑 — 위원장 검수 큐 (M4-D 자동화 후 잔여)

자동 생성. 본 자동화 (2026-05-18) 결과 자동 적용되지 않은 unmapped 케이스를 텍스트로 모았다.
위원장이 화면 낭독기로 청취해 결정한 후 `content/_image-mappings.json`의 해당 key에 `manifest_path`를 직접 채워 `npm run image:apply`를 실행한다.

## 결과 요약

- 자동 적용: **0건**
- 검수 큐 (review): **4건** — 후보가 있으나 합의 게이트 거부
- 스킵 (skip): **82건** — 후보 없음
  - no-raster-in-range: 22건
  - no-page-hint: 60건

## 자동 적용 0건의 의미

PoC 단계에서 예상한 30~50건 자동 매핑 시나리오와 달리, 본 자동화에서 **단 1건도 합의 게이트를 통과하지 않았다**. 이는 합의 게이트 실패가 아니라 **raster 추출 단계의 구조적 한계**가 노출된 결과다:

- `2023-hr-guide`: TODO 60건 vs 사용 가능 raster 21건 — 페이지 hint 매칭 가능 6건도 모두 페이지 범위 ±3 안에 raster 없음
- `2024-support-staff-duty-guide`: 페이지 hint p149 4건이 7후보 raster(p147~p151)와 모두 Gemini·Codex·Gemma 만장일치 NO — alt는 "플로차트 N번째 단계"인데 raster는 모니터 암 사진 등 무관한 기기 사진
- `2024-jbu-work-support-guide`: 매핑 가능 raster 10건 중 8건이 이미 PoC에서 사용됨, 남은 후보 없음
- `2023-disability-types-work-support-report`: 1건의 alt에 페이지 hint 없음 + raster pool 3098개라 자동화 대상 외

**다중 모델 합의 게이트는 의도대로 작동했다** — 부적합 후보를 자동 매핑하지 않음으로써 데이터 무결성을 보존. 위원장이 검수 큐를 청취 후 결정해야 한다.

## ⚠️ image:apply 버그 발견 — Phase 2 진입 전 패치 필요

본 자동화 실행 직후 `npm run image:apply` 호출 시 **잘못된 raster 3건이 본문에 삽입됨** (즉시 git checkout으로 rollback). 원인:

- `scripts/image-mappings.ts` apply 함수는 mappings.json 키의 `#indexInFile`을 본문 TODO 마커의 순서 인덱스와 매칭
- 그러나 mappings.json의 indexInFile은 **PoC 시점의 원본 스켈레톤 인덱스** (예: jbu-p-061#0, jbu-p-061#1)
- 본문에 이미 18건이 inserted된 상태에서 collectTodoOccurrences는 **남은 TODO 마커만** 재카운트 (jbu-p-061의 경우 #0부터 다시 시작)
- → mappings.json의 `#0` (`_alt_original: 발로 차`)이 현재 본문의 `#0` (`alt: 화살표 아이콘`)에 매칭되어 page-100-fig-01.png가 잘못된 alt에 삽입됨

**적용 가드 누락**: apply가 `_alt_original`과 본문 TODO의 alt를 비교하지 않음. M3 codex-rescue P0는 source 교차 검증을 박았으나 alt 무결성 검증은 빠짐.

### 임시 가드 (Phase 2 적용 전 사용)

- `npm run image:apply` 단독 실행 금지 — 매핑 추가 시 이 버그 재현 가능
- alt_override만 본문 반영 시 `/tmp/image-match-poc/apply-alt-overrides.mjs` 사용 (manifest_path 기반 매칭이라 안전)

### 항구 패치 (Phase 2 진입 시 함께)

`applyMappings` 함수에 alt 무결성 검증 추가:

```ts
// codex-rescue M3 P0 #3 (제안): alt 교차 검증.
// _alt_original이 본문 TODO 마커의 alt와 일치하지 않으면 차단.
if (mapping._alt_original && mapping._alt_original.trim() !== occ.alt.trim()) {
  result.errors.push(
    `${key}: _alt_original 불일치 — JSON='${mapping._alt_original.slice(0,40)}...' 본문='${occ.alt.slice(0,40)}...' (stale indexInFile 가능성)`
  )
  continue
}
```

## review 케이스 — 후보 있으나 합의 게이트 거부 (4건)

각 케이스마다 후보별 3종 모델 verdict와 raw 응답을 첨부했다. 위원장이 raw 응답을 청취해 어느 후보가 적합한지 판단.

### `2024-staff-p-149#2024-support-staff-duty-guide#0`

- 파일: `content/policies/2024-staff-p-149.md`
- 페이지 hint: 149
- alt: 플로차트의 첫 번째 단계로, 청각장애인교원이 수업 중 학생 생활지도와 관련하여 지원인력에게 청각 정보 청취를 요청하는 과정을 보여줍니다.

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-01.png` (page 147, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지는 책상에 고정된 모니터 암(거치대)과 그에 연결된 모니터를 보여주는 실물 사진입니다. 설명에서 언급한 '청각장애인교원의 요청 과정을 보여주는 플로차트'와는 전혀 무관한 하드웨어 장비 이미지이므로 설명이 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 책상에 고정된 모니터 암/거치대와 모니터를 보여줍니다. 플로차트, 청각장애인교원, 수업 장면, 학생 생활지도, 지원인력에게 청각 정보 청취를 요청하는 과정은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-02.png` (page 147, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지는 한 남성이 의자에 앉아 북스탠드에 거치된 책과 태블릿을 이용하는 모습을 보여주고 있으며, 이는 독서 보조 기기 사용 장면으로 보입니다. 청각장애인 교원의 수업 중 학생 생활지도 및 지원인력에 대한 요청 과정을 나타내는 플로차트 단계와는 명백히 다른 내용입니다.

NO
```

**Codex 응답**:
```
이미지는 실내에서 한 남성이 의자에 앉아 있고, 앞쪽에는 책/문서 받침대와 장비가 보입니다. 플로차트, 청각장애인교원, 수업 중 학생 생활지도, 지원인력에게 청각 정보 청취를 요청하는 장면으로 보이는 핵심 요소는 확인되지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-148-fig-01.png` (page 148, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
설명은 플로차트의 단계를 묘사하고 있으나, 제공된 이미지는 특정 기계 장치(정밀 기기 또는 보조 공학 기기로 추정)를 촬영한 실물 사진입니다. 이미지에는 플로차트 형식이나 청각장애인교원, 지원인력 등의 인물이 전혀 포함되어 있지 않으므로 설명과 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 회색 패널과 금속 프레임, 배선/호스가 있는 장비 또는 기계처럼 보입니다. 설명은 플로차트의 첫 단계와 청각장애인교원, 지원인력, 청각 정보 청취 요청 장면을 말하고 있어 이미지의 실제 객체와 맞지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-149-fig-01.png` (page 149, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제시된 이미지는 태블릿 PC의 화면에 다양한 아이콘(집, 학교, 병원, 약국 등)이 표시된 모습을 보여주는 사진입니다. 이는 의사소통 보조 기기나 특정 애플리케이션의 실행 화면으로 보이며, 설명에서 언급한 '플로차트'나 '청각장애인교원이 지원인력에게 청각 정보 청취를 요청하는 과정'을 묘사하고 있지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 플로차트가 아니라 그림/아이콘이 표시된 태블릿 또는 스마트 기기 화면과 뒷면 기기를 보여줍니다. 설명의 핵심인 “청각장애인교원이 수업 중 지원인력에게 청각 정보 청취를 요청하는 과정”은 이미지에서 확인되지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-01.png` (page 150, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제공된 이미지는 'UTAS' 브랜드의 특수 키보드(보조공학기기)를 촬영한 사진입니다. 설명에서 언급한 '플로차트'나 '수업 중 청각 정보 청취 요청 과정'을 묘사하는 그림과는 명백히 다릅니다.

NO
```

**Codex 응답**:
```
이미지는 흰색 보조 입력 장치/키보드 형태의 물체로 보이며, 플로차트나 수업 중 청각 정보 청취 요청 과정을 묘사한 장면은 아닙니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-02.png` (page 150, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
상기 이미지는 '클릭키 5.0'이라는 화상 키보드 프로그램의 실행 화면을 보여주고 있습니다. 설명에서 언급한 '청각장애인교원의 지원인력 요청 과정 플로차트'와는 전혀 관련이 없는 이미지입니다.

NO
```

**Codex 응답**:
```
이미지는 검은색 키들이 배열된 가상 키보드 프로그램 화면입니다. 플로차트나 청각장애인교원, 수업 중 생활지도, 지원인력에게 청각 정보 청취를 요청하는 장면은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-151-fig-01.png` (page 151, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제시된 이미지는 수동 휠체어의 사진이며, 설명에서 언급한 '청각장애인교원의 지원인력 요청 과정 플로차트'와는 전혀 관련이 없는 객체입니다.

NO
```

**Codex 응답**:
```
이미지는 파란 프레임의 수동 휠체어를 보여줍니다. 설명처럼 플로차트 단계, 청각장애인교원, 수업 중 생활지도, 지원인력에게 청각 정보 청취를 요청하는 장면은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

### `2024-staff-p-149#2024-support-staff-duty-guide#1`

- 파일: `content/policies/2024-staff-p-149.md`
- 페이지 hint: 149
- alt: 플로차트의 두 번째 단계로, 지원인력이 청각장애인교원으로부터 요청받은 사항을 수행하는 과정입니다.

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-01.png` (page 147, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
설명과 이미지를 비교한 결과, 핵심 객체와 구성이 명백히 다릅니다.

1.  **이미지 내용**: 이 이미지는 책상에 고정된 **모니터 암(모니터 거치대)**을 보여주는 실물 사진입니다.
2.  **설명 내용**: 설명은 "플로차트(순서도)의 두 번째 단계"라고 명시하고 있으며, 지원인력이 요청받은 사항을 수행하는 **과정(추상적 절차)**을 묘사한다고 되어 있습니다.

따라서 실물 기기인 모니터 암 사진이 프로세스를 나타내는 플로차트의 단계라는 설명은 서로 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 책상에 클램프로 고정된 모니터 암/거치대와 모니터를 보여줍니다. 설명처럼 플로차트의 두 번째 단계나 지원인력이 요청 사항을 수행하는 과정은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-02.png` (page 147, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제시된 이미지는 책이 거치대(북스탠드)에 놓여 있는 모습과 한 남성이 편안한 의자에 앉아 모니터 혹은 거치대를 바라보며 컵을 들고 있는 사진입니다. 이는 "플로차트의 두 번째 단계"를 설명하는 다이어그램이나 도식화된 과정이 아니므로 설명과 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 나무 벽이 있는 실내에서 책/문서를 펼쳐 고정한 스탠드와 조명 또는 카메라 장비, 오른쪽에 앉아 있는 사람이 보입니다. 플로차트의 두 번째 단계나 지원인력이 청각장애인교원의 요청을 수행하는 장면이라는 설명은 이미지에서 직접 확인되지 않으며, 핵심 구성도 설명과 맞지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-148-fig-01.png` (page 148, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지에는 복잡한 기계 장치 또는 의료/재활 보조 기구로 보이는 물체가 찍혀 있으며, 이는 설명에서 언급한 '플로차트의 두 번째 단계'나 '지원인력이 요청받은 사항을 수행하는 과정'을 묘사하는 그림이 아닙니다.

NO
```

**Codex 응답**:
```
이미지는 플로차트가 아니라 회색 기계 장비처럼 보입니다. 설명과 핵심 객체가 명백히 다릅니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-149-fig-01.png` (page 149, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지에는 태블릿 기기의 앞면과 뒷면이 나타나 있으며, 화면에는 의사소통을 돕는 여러 아이콘이 포함된 애플리케이션이 실행되고 있습니다. 이는 플로차트의 단계가 아니라 스마트 기기(태블릿) 그 자체를 보여주는 이미지입니다.

NO
```

**Codex 응답**:
```
첨부 이미지는 화면에 아이콘형 의사소통 보드가 표시된 태블릿/스마트 기기와 뒷면 기기를 보여줍니다. 설명의 “플로차트 두 번째 단계”나 “지원인력이 요청 사항을 수행하는 과정”을 나타내는 장면, 사람, 업무 수행 과정은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-01.png` (page 150, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제공된 이미지(public/source-images/2024-support-staff-duty-guide/page-150-fig-01.png)는 특수 제작된 키보드(UTAS 브랜드의 보조공학기기) 사진이며, 설명에서 언급한 '플로차트의 두 번째 단계' 또는 '과정을 묘사하는 그림'이 아닙니다.

NO
```

**Codex 응답**:
```
이미지는 흰색 보조 키보드/입력 장치처럼 보이며, 플로차트나 업무 수행 과정 장면을 묘사하지 않습니다. 설명의 핵심 객체와 구성이 이미지와 일치하지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-02.png` (page 150, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제공된 이미지는 '클리키 5.0'이라는 화상 키보드 프로그램의 실행 화면입니다. 설명에서 언급한 '플로차트의 두 번째 단계'나 '지원인력이 요청 사항을 수행하는 과정'을 나타내는 도식이나 그림이 아니므로, 설명과 이미지는 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 키보드 입력 프로그램 화면으로 보이며, 검은색 가상 키보드와 메뉴/버튼들이 표시되어 있습니다. 설명처럼 플로차트의 두 번째 단계나 지원인력이 요청사항을 수행하는 과정은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-151-fig-01.png` (page 151, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제시된 이미지는 휠체어의 외형과 주요 부위(등받이, 바퀴 축, 발판 등)가 강조된 사진입니다.

설명에서 언급한 '청각장애인교원 지원 서비스의 플로차트 단계'나 '수행 과정'을 묘사하는 내용과는 명백히 거리가 멀며, 이미지와 설명의 핵심 객체 및 내용이 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 파란색 프레임과 검은색 좌석·등받이가 있는 수동 휠체어입니다. 설명의 “플로차트 두 번째 단계”, “지원인력”, “청각장애인교원”, “요청받은 사항 수행 과정”과 같은 내용은 이미지에서 확인되지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

### `2024-staff-p-149#2024-support-staff-duty-guide#2`

- 파일: `content/policies/2024-staff-p-149.md`
- 페이지 hint: 149
- alt: 플로차트의 세 번째 단계로, 지원인력이 청취한 내용을 청각장애인교원에게 전달하는 과정을 나타냅니다.

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-01.png` (page 147, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
설명은 플로차트의 단계를 묘사하고 있으나, 이미지는 책상에 클램프로 고정된 모니터 암(arm)과 모니터의 실물 사진입니다. 핵심 객체와 구성이 전혀 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 책상에 고정된 은색 모니터 암과 검은색 모니터를 보여줍니다. 설명의 플로차트, 지원인력, 청각장애인교원에게 전달하는 과정과는 핵심 객체와 구성이 일치하지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-02.png` (page 147, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이 설명은 제공된 이미지와 일치하지 않습니다. 이미지는 독서대(북스탠드) 또는 모니터 암을 사용하는 모습(책이 펼쳐져 있는 모습과 사람이 의자에 앉아 모니터를 보는 모습)을 담은 사진이며, '지원인력이 내용을 전달하는 플로차트'와는 관련이 없습니다.

NO
```

**Codex 응답**:
```
이미지는 목재 벽 배경의 실내에서 한 사람이 의자에 앉아 모니터/장비를 보고 있고, 앞쪽에는 펼쳐진 책이나 자료대와 마이크처럼 보이는 장비가 있습니다. 플로차트의 세 번째 단계나 지원인력이 청취 내용을 청각장애인교원에게 전달하는 장면으로 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-148-fig-01.png` (page 148, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
설명은 플로차트의 단계를 묘사하고 있으나, 실제 이미지는 기계 장치(점자 출력기 혹은 특수 인쇄 장비로 추정됨)를 촬영한 사진입니다. 핵심 객체와 구성이 설명과 전혀 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 사람이나 플로차트 단계가 아니라, 회색 패널과 금속 프레임으로 된 장비/기계처럼 보입니다. 설명의 “지원인력이 청취한 내용을 청각장애인교원에게 전달”하는 장면과 핵심 객체가 일치하지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-149-fig-01.png` (page 149, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제공된 설명은 플로차트의 단계를 묘사하고 있으나, 이미지는 다양한 아이콘이 나열된 태블릿 기기(AAC 보조기기 등)를 보여주는 제품 사진입니다. 설명과 이미지의 핵심 객체 및 구성이 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 화면에 여러 아이콘이 보이는 스마트폰/태블릿 기기와 뒷면 기기를 보여줍니다. 플로차트의 세 번째 단계나 지원인력이 청취 내용을 청각장애인교원에게 전달하는 과정은 나타나 있지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-01.png` (page 150, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지에는 특수 제작된 보조공학기기(키보드 형태의 입력 장치)가 나타나 있습니다. 설명에서 언급한 '플로차트'나 '지원인력이 청취 내용을 전달하는 과정'을 묘사한 그림이 아니므로 핵심 객체와 구성이 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 흰색 보드형 입력 장치/키보드처럼 보이며, 여러 개의 원형 버튼과 일부 검은 버튼, 연결선이 있습니다. 플로차트나 “지원인력이 청취한 내용을 청각장애인교원에게 전달하는 과정”을 나타내는 장면은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-02.png` (page 150, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제시된 설명은 지원인력이 내용을 전달하는 플로차트 과정을 묘사하고 있으나, 실제 이미지는 '클리키 5.0'이라는 화상 키보드 프로그램의 실행 화면을 보여주고 있습니다. 이미지와 설명이 전혀 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 검은색 키보드 배열을 보여주는 소프트웨어 화면입니다. 플로차트나 단계 흐름, 지원인력과 청각장애인교원 간 전달 과정을 나타내는 요소는 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-151-fig-01.png` (page 151, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
설명은 청각장애인 지원 관련 플로차트의 단계를 묘사하고 있으나, 실제 이미지는 빨간색 원으로 특정 부위가 강조된 파란색 휠체어의 사진입니다. 이미지와 설명이 명백히 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 파란 프레임과 검은 좌석/등받이가 있는 수동 휠체어입니다. 설명은 플로차트의 단계와 지원인력이 청취 내용을 청각장애인교원에게 전달하는 과정을 말하고 있어, 이미지의 핵심 객체와 일치하지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

### `2024-staff-p-149#2024-support-staff-duty-guide#3`

- 파일: `content/policies/2024-staff-p-149.md`
- 페이지 hint: 149
- alt: 플로차트의 네 번째 단계로, 청각장애인교원이 지원인력에게 피드백을 제공하고 다음 수업 청취를 요청하는 과정입니다.

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-01.png` (page 147, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
설명은 플로차트의 특정 단계를 묘사하고 있으나, 이미지는 책상에 고정된 모니터 암(arm)의 사진입니다. 설명과 이미지의 내용이 전혀 일치하지 않습니다.

NO
```

**Codex 응답**:
```
이미지는 흰색 모니터 암/거치대에 검은색 모니터가 장착된 제품 사진입니다. 플로차트, 청각장애인교원, 지원인력, 피드백 제공, 수업 청취 요청 과정은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-147-fig-02.png` (page 147, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지는 독서대와 그를 이용하는 사람을 보여주는 사진으로, 청각장애인교원이 지원인력에게 피드백을 제공하는 플로차트 단계에 대한 설명과는 명백히 다릅니다.

NO
```

**Codex 응답**:
```
이미지는 나무 벽이 있는 실내에서 한 남성이 의자에 앉아 컴퓨터 모니터를 보고 있고, 앞쪽에는 책/자료 거치대와 조명 또는 마이크처럼 보이는 장비, 식물이 보입니다. 설명의 핵심인 “플로차트의 네 번째 단계”, “청각장애인교원이 지원인력에게 피드백 제공”, “다음 수업 청취 요청”을 나타내는 시각적 요소는 확인되지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-148-fig-01.png` (page 148, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
설명은 플로차트의 한 단계를 묘사하고 있으나, 제시된 이미지는 기계 장치(예: 산업용 장비 또는 특수 스캐너)의 사진입니다. 이미지의 내용과 설명이 전혀 일치하지 않습니다.

NO
```

**Codex 응답**:
```
첨부 이미지는 회색 금속 장비/기계 장치처럼 보이며, 플로차트 단계나 청각장애인교원, 지원인력, 피드백 제공, 수업 청취 요청 과정을 나타내는 도식이 아닙니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-149-fig-01.png` (page 149, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지는 여러 가지 아이콘(장애인, 학교생활, 의료기관 등)이 표시된 태블릿 기기를 보여주고 있으며, 이는 보조공학기기 또는 의사소통 지원 앱의 화면으로 보입니다. 설명에서 언급한 '플로차트의 네 번째 단계'나 '교원이 피드백을 제공하는 과정'을 묘사한 그림이 아닙니다.

NO
```

**Codex 응답**:
```
이미지는 화면에 아이콘형 UI가 보이는 스마트폰/태블릿 기기 사진입니다. 플로차트 단계, 청각장애인교원, 지원인력, 피드백 제공, 다음 수업 청취 요청을 나타내는 구성은 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-01.png` (page 150, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제공된 이미지와 설명은 일치하지 않습니다.

이미지는 'UTAS' 브랜드의 특수 키보드(청각장애인 또는 시각장애인용 보조공학기기)를 보여주고 있으나, 설명은 플로차트의 특정 단계와 교수자의 피드백 과정을 묘사하고 있습니다.

NO
```

**Codex 응답**:
```
첨부 이미지는 흰색 직사각형 전자 키보드/입력 장치처럼 보이며, 여러 개의 원형·검은색 버튼과 연결 케이블이 있습니다. 설명처럼 플로차트의 네 번째 단계나 피드백/수업 청취 요청 과정을 나타내는 도식은 아닙니다.

NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-150-fig-02.png` (page 150, fig 2)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
제공된 이미지는 '클리키 5.0'이라는 이름의 화상 키보드 프로그램 실행 화면을 보여주고 있습니다. 설명에서 언급한 '플로차트의 네 번째 단계'나 '피드백 제공 및 다음 수업 청취 요청 과정'과는 전혀 관련이 없는 객체입니다.

NO
```

**Codex 응답**:
```
NO
```

**Gemma 응답**:
```
NO
```

#### 후보: `public/source-images/2024-support-staff-duty-guide/page-151-fig-01.png` (page 151, fig 1)

verdict: Gemini=NO | Codex=NO | Gemma=NO → reject (명시적 NO 3건)

**Gemini 응답**:
```
이미지는 휠체어를 보여주고 있으며, 설명에서 언급된 '플로차트의 단계'나 '청각장애인교원 및 지원인력의 상호작용'과는 아무런 관련이 없습니다.

NO
```

**Codex 응답**:
```
이미지는 파란색 프레임과 검은색 좌석이 있는 수동 휠체어입니다. 설명의 “플로차트 네 번째 단계”, “청각장애인교원”, “지원인력에게 피드백 제공”, “다음 수업 청취 요청”과 같은 장면이나 구성 요소는 보이지 않습니다.

NO
```

**Gemma 응답**:
```
NO
```

## skip 케이스 — 자동화 후보 없음 (82건)

페이지 hint가 없거나 (chapter slug) 해당 페이지 범위에 raster가 없는 케이스. 위원장이 manifest를 직접 탐색해 채우거나 매핑 보류 결정.

### source: `2024-jbu-work-support-guide` (7건)

- `2024-jbu-p-013#2024-jbu-work-support-guide#0` (no-raster-in-range)
  - 파일: `content/disability-types/2024-jbu-p-013.md`
  - alt: 플로우차트의 신청서 작성 단계에 있는 아이콘으로, 장애인 근로인이 직접 서류를 작성하는 모습을 표현합니다. 이것은 서비스 신청의 첫 번째 단계를
- `2024-jbu-p-013#2024-jbu-work-support-guide#1` (no-raster-in-range)
  - 파일: `content/disability-types/2024-jbu-p-013.md`
  - alt: 플로우차트의 접수 단계에 있는 아이콘으로, 한국장애인고용공단을 상징하는 건물 그림입니다. 근로지원인 서비스 신청이 접수되는 과정을 나타냅니다.
- `2024-jbu-p-029#2024-jbu-work-support-guide#0` (no-raster-in-range)
  - 파일: `content/disability-types/2024-jbu-p-029.md`
  - alt: 이 다이어그램은 교구 제작 지원 절차를 5단계로 나타냅니다. 지체·뇌병변 장애인 교원이 학교 및 교육청에 지원을 요청하면, 학교 및 교육청이 이
- `2024-jbu-p-061#2024-jbu-work-support-guide#1` (no-raster-in-range)
  - 파일: `content/domains/2024-jbu-p-061.md`
  - alt: 신체적 학대 예시 일러스트와 학대 유형 목록을 연결하는 화살표 아이콘.
- `2024-jbu-2-10#2024-jbu-work-support-guide#0` (no-page-hint)
  - 파일: `content/policies/2024-jbu-2-10.md`
  - alt: 보충 설명을 알리는 '참고' 아이콘.
- `2024-jbu-p-063#2024-jbu-work-support-guide#2` (no-raster-in-range)
  - 파일: `content/policies/2024-jbu-p-063.md`
  - alt: 경제적 착취 삽화와 그 유형 목록을 연결하는 오른쪽 방향 화살표입니다.
- `2024-jbu-p-063#2024-jbu-work-support-guide#4` (no-raster-in-range)
  - 파일: `content/policies/2024-jbu-p-063.md`
  - alt: 유기 및 방임 삽화와 그 유형 목록을 연결하는 오른쪽 방향 화살표입니다.

### source: `2024-support-staff-duty-guide` (14건)

- `2024-staff-19#2024-support-staff-duty-guide#0` (no-page-hint)
  - 파일: `content/disability-types/2024-staff-19.md`
  - alt: 휠체어에 앉아 메가폰을 든 사람을 포함하여 세 명의 교직원 또는 지원 인력이 함께 소통하며 협력하는 일러스트. 한 명은 휠체어에 앉아 메가폰을 
- `2024-staff-3-6#2024-support-staff-duty-guide#0` (no-page-hint)
  - 파일: `content/disability-types/2024-staff-3-6.md`
  - alt: 페이지 중앙에 크게 표시된 로마 숫자 'V'입니다. 이는 문서의 다섯 번째 장을 나타내며, 하단에는 '청각장애인교원 지원 방안'이라는 장 제목이
- `2024-staff-3-8#2024-support-staff-duty-guide#0` (no-page-hint)
  - 파일: `content/disability-types/2024-staff-3-8.md`
  - alt: 지원 인력과 교사가 마주 앉아 대화하는 일러스트. 교사가 '감사합니다'라고 말하며 지원 인력의 도움에 대한 긍정적인 반응을 보이고 있다. 이는 
- `2024-staff-p-023#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/disability-types/2024-staff-p-023.md`
  - alt: 학생 좌석 배치 지원 절차를 시각장애인교원과 지원인력 간의 상호작용으로 보여주는 순서도입니다. 시각장애인교원이 좌석 배치 및 모둠 구성 지원을 
- `2024-staff-p-095#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/disability-types/2024-staff-p-095.md`
  - alt: 이 흐름도는 지체·뇌병변장애인교원이 지원인력에게 시연 및 모델링 지원을 요청하는 것부터 수업에 활용되기까지의 5단계 절차를 보여줍니다. 지원인력
- `2024-staff-p-127#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/disability-types/2024-staff-p-127.md`
  - alt: 휠체어에 앉은 여성이 한 손에 돋보기를 들고 다른 한 손을 높이 들어 올린 모습의 일러스트입니다. 이는 장애인교원의 교외 학급 활동을 위한 세심
- `2024-staff-p-165#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/disability-types/2024-staff-p-165.md`
  - alt: 청각장애인교원을 위한 전화 소통 지원 서비스인 '전화를 대신 받기'의 네 단계 과정을 보여주는 흐름도입니다. 청각장애인교원의 통화 요청과 내용 
- `2024-staff-p-169#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/disability-types/2024-staff-p-169.md`
  - alt: 두 여성이 소파에 앉아 서로 마주 보며 수어로 대화하는 일러스트. 이는 청각장애인과의 원활한 소통을 보여준다.
- `2024-staff-p-184#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/domains/2024-staff-p-184.md`
  - alt: 검은색 프레임의 수동 휠체어 전신 사진입니다. 이 휠체어는 사용자가 손으로 직접 바퀴를 굴려 이동하는 방식으로, 큰 뒷바퀴와 작은 앞바퀴를 갖추
- `2024-staff-p-185#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/domains/2024-staff-p-185.md`
  - alt: 발행처 옆에 있는 교육부 로고. 파란색 원 안에 태극 문양이 형상화되어 있으며, 그 아래에 '교육부'와 'Ministry of Education
- `2024-staff-2-4#2024-support-staff-duty-guide#0` (no-page-hint)
  - 파일: `content/policies/2024-staff-2-4.md`
  - alt: 안내견과 함께 흰 지팡이를 사용하여 걷고 있는 시각장애인 교원의 일러스트입니다. 안내견은 노란 조끼를 입고 교원과 나란히 발걸음을 맞추고 있으며
- `2024-staff-p-116#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/policies/2024-staff-p-116.md`
  - alt: 책상에 앉아 함께 업무를 보는 세 사람의 일러스트. 한 명은 노트북을 사용하고 있고, 두 명은 서류를 들고 있으며, 이 중 한 명은 의족을 착용
- `2024-staff-p-177#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/policies/2024-staff-p-177.md`
  - alt: 문서의 '부록' 섹션 제목입니다. 부록에는 장애인 교원 지원인력 제공 관련 법적 근거와 보조기기의 종류별 사용 및 관리 방법에 대한 정보가 포함
- `2024-staff-p-182#2024-support-staff-duty-guide#0` (no-raster-in-range)
  - 파일: `content/policies/2024-staff-p-182.md`
  - alt: 책을 거치하는 스탠드 위에 펼쳐진 책이 놓여 있고, 기계 팔이 책 페이지를 넘길 준비를 하고 있는 자동 책장 넘기기 보조기기 사진입니다.

### source: `2023-hr-guide` (60건)

- `2023-hr-1-2#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-2.md`
  - alt: 법률 관련 내용을 시각적으로 나타내는, 저울 모양의 아이콘.
- `2023-hr-1-2#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-2.md`
  - alt: 책 위에 저울이 놓인 아이콘으로, 장애인 공무원 인사관리의 법적 근거와 기본 방향을 상징합니다.
- `2023-hr-1-2#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-2.md`
  - alt: 책 위에 저울이 놓인 아이콘으로, 시·도교육청이 지원 방안 수립 시 고려해야 할 법적 근거 및 사항들을 상징합니다.
- `2023-hr-1-4#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-4.md`
  - alt: 파란색 배경에 저울이 얹힌 펼친 책 모양의 법령 아이콘으로, 문서 내에서 관련 법규 조항을 시각적으로 강조하고 다음 내용이 법적 근거임을 나타냅
- `2023-hr-1-4#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-4.md`
  - alt: 법률 문서 위에 저울이 놓인 모양의 아이콘으로, 관련 법령 및 지침을 상징합니다.
- `2023-hr-1-4#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-4.md`
  - alt: 법률 문서 위에 저울이 놓인 모양의 아이콘으로, 관련 법령 및 지침을 상징합니다.
- `2023-hr-1-4#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-4.md`
  - alt: 법률 문서 위에 저울이 놓인 모양의 아이콘으로, 관련 법령 및 지침을 상징합니다.
- `2023-hr-1-4#2023-hr-guide#4` (no-page-hint)
  - 파일: `content/domains/2023-hr-1-4.md`
  - alt: 법률 및 규정 관련 내용을 나타내는 저울과 펼쳐진 책 모양의 아이콘.
- `2023-hr-2-2#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/domains/2023-hr-2-2.md`
  - alt: 법률을 상징하는 저울과 펼쳐진 책 모양의 아이콘입니다. 이 아이콘은 개인정보보호와 관련된 법률 조항을 안내하는 부분 앞에 배치되어 있습니다.
- `2023-hr-2-2#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/domains/2023-hr-2-2.md`
  - alt: 법률을 상징하는 저울 모양의 아이콘. 다음 내용은 개인정보 보호법 관련 법적 조항임을 나타냅니다.
- `2023-hr-2-2#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/domains/2023-hr-2-2.md`
  - alt: 밝은 표정으로 의족을 착용하고 한 손을 흔들고 있는 사람의 일러스트. 장애를 가진 사람의 활동성과 사회 참여를 상징합니다.
- `2023-hr-2-2#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/domains/2023-hr-2-2.md`
  - alt: 법률 아이콘. '개인정보 보호법' 제23조 '민감정보의 처리 제한'에 대한 법 조항이 이어진다.
- `2023-hr-2-2#2023-hr-guide#4` (no-page-hint)
  - 파일: `content/domains/2023-hr-2-2.md`
  - alt: 법률 아이콘. '개인정보 보호법' 제16조 '개인정보의 수집 제한'에 대한 법 조항이 이어진다.
- `2023-hr-3-5#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/domains/2023-hr-3-5.md`
  - alt: 의족을 착용한 성인 남성과 젊은 사람이 밝은 표정으로 손을 흔들며 환하게 웃고 있는 일러스트입니다. 이는 장애인의 활발한 사회 활동과 긍정적인 
- `2023-hr-3#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/domains/2023-hr-3.md`
  - alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인 공무원 임용 절차 중 공정한 승진 심사를 다루는 부분임을 나타냅니다.
- `2023-hr-3#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/domains/2023-hr-3.md`
  - alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인 공무원 인사관리의 기본 방향 중 차별 금지 원칙을 강조합니다.
- `2023-hr-3#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/domains/2023-hr-3.md`
  - alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인의 권리에 관한 협약 제27조(근로 및 고용
- `2023-hr-3#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/domains/2023-hr-3.md`
  - alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인차별금지법 제10조(차별금지)의 구체적인 내용을 설명하는 섹션을 표시합니다.
- `2023-hr-appendix-007#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/domains/2023-hr-appendix-007.md`
  - alt: 청록색 배경에 굵고 커다란 흰색 숫자 '01'이 표시되어 있습니다. 숫자의 하단은 가로지르는 흰색 선에 의해 부분적으로 가려져 있습니다.
- `2023-hr-appendix-007#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/domains/2023-hr-appendix-007.md`
  - alt: 핑크색 상의를 입고 목발을 짚은 사람을 흰색 상의를 입은 다른 사람이 어깨를 부축하며 돕고 있는 일러스트. 두 사람 모두 미소를 짓고 있어 서로
- `2023-hr-p-046#2023-hr-guide#0` (no-raster-in-range)
  - 파일: `content/domains/2023-hr-p-046.md`
  - alt: 보라색 배경 위에 흰색 숫자 '02'가 큰 글씨로 중앙에 배치되어 있으며, 페이지를 가로지르는 흰색 선에 걸쳐 있습니다. 선 아래에는 '장애인교
- `2023-hr-p-057#2023-hr-guide#0` (no-raster-in-range)
  - 파일: `content/domains/2023-hr-p-057.md`
  - alt: 관련 법령으로 「사업주 및 장애인 등에 대한 융자·지원 규정」에 따른 근로지원인 유형 관련 내용을 설명하는 섹션 옆에 위치한 법령 아이콘입니다.
- `2023-hr-p-057#2023-hr-guide#1` (no-raster-in-range)
  - 파일: `content/domains/2023-hr-p-057.md`
  - alt: 관련 법령으로 「장애인 고용촉진 및 직업재활법」 제21조의2에 따른 장애인 공무원 지원 내용을 설명하는 섹션 옆에 위치한 법령 아이콘입니다.
- `2023-hr-1-3#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-1-3.md`
  - alt: 법령을 나타내는 아이콘
- `2023-hr-2-3#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-3.md`
  - alt: 법률서적과 저울 모양의 아이콘. 아래에 이어지는 「국가공무원법」 제26조(임용의 원칙)의 관련 법령 내용을 나타냅니다.
- `2023-hr-2-3#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-3.md`
  - alt: 법률서적과 저울 모양의 아이콘. 아래에 이어지는 「교육공무원 인사관리규정」 제18조(전보계획)의 관련 법령 내용을 나타냅니다.
- `2023-hr-2-3#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-3.md`
  - alt: 법률과 공정성을 상징하는 아이콘으로, 관련 법령 내용에 대한 정보를 나타냄.
- `2023-hr-2-3#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-3.md`
  - alt: 법률과 공정성을 상징하는 아이콘으로, 관련 법령 내용에 대한 정보를 나타냄.
- `2023-hr-2-3#2023-hr-guide#4` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-3.md`
  - alt: 법률서적과 망치가 그려진 아이콘으로, 장애인 차별금지 및 권리구제 등에 관한 법률의 핵심 내용을 시각적으로 나타냅니다.
- `2023-hr-2-3#2023-hr-guide#5` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-3.md`
  - alt: 법률서적과 망치가 그려진 아이콘으로, 장애인 공무원의 인사관리 및 근무환경에 대한 균형인사지침 내용을 시각적으로 나타냅니다.
- `2023-hr-2-3#2023-hr-guide#6` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-3.md`
  - alt: 법률서적과 망치가 그려진 아이콘으로, 장애 교원 및 장애 자녀 양육 교원의 전보 계획에 관한 교육공무원 인사관리규정 내용을 시각적으로 나타냅니다
- `2023-hr-2-4#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-4.md`
  - alt: 페이지 상단에 크게 흰색으로 표시된 숫자 '03'은 '장애인교원 인사관리 안내서' 문서의 세 번째 섹션을 나타냅니다.
- `2023-hr-2-4#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-4.md`
  - alt: 책상에 앉아 노트북을 사용하는 휠체어를 탄 여성과 그 옆에 서 있는 남성의 일러스트입니다. 이는 장애인 교원과 비장애인 교원이 함께 업무를 보는
- `2023-hr-2-5#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-5.md`
  - alt: 법률 관련 내용을 나타내는 법전과 저울 모양 아이콘입니다.
- `2023-hr-2-5#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-5.md`
  - alt: 법률 조항을 상징하는 아이콘으로, 펼쳐진 책 위에 정의의 저울이 놓여 있는 모습입니다.
- `2023-hr-2-5#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-5.md`
  - alt: 법률 관련 내용을 나타내는 천칭과 법전 모양의 아이콘
- `2023-hr-2-5#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-5.md`
  - alt: 법률 관련 내용을 나타내는 천칭과 법전 모양의 아이콘
- `2023-hr-2-5#2023-hr-guide#4` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-5.md`
  - alt: 관련 법령 정보를 나타내는 아이콘. 고대 문서나 법전을 상징하는 형태로, 법률 관련 내용을 시각적으로 강조합니다.
- `2023-hr-2-5#2023-hr-guide#5` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-5.md`
  - alt: 안내견 조끼를 입은 골든 리트리버 안내견이 옆에 앉아 있고, 그 옆에 한 여성이 서서 손을 흔들며 밝게 웃고 있는 일러스트입니다. 이 이미지는 
- `2023-hr-2-6#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-6.md`
  - alt: 저울 모양이 새겨진 갈색 법전 아이콘입니다. 이 아이콘은 해당 섹션이 법적 조항과 관련된 내용임을 나타냅니다.
- `2023-hr-2-6#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-6.md`
  - alt: 저울 모양이 새겨진 갈색 법전 아이콘입니다. 이 아이콘은 해당 섹션이 법적 조항과 관련된 내용임을 나타냅니다.
- `2023-hr-2-6#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-6.md`
  - alt: 점자법 관련 법률 조항을 시각적으로 나타내는 열린 법전 아이콘입니다.
- `2023-hr-2-6#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-6.md`
  - alt: 법전 아이콘. 이 아이콘은 옆에 있는 텍스트가 「지능정보화기본법」의 관련 조항임을 나타냅니다.
- `2023-hr-2-6#2023-hr-guide#4` (no-page-hint)
  - 파일: `content/policies/2023-hr-2-6.md`
  - alt: 법률 또는 법규 관련 내용을 상징하는 아이콘입니다.
- `2023-hr-5#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-5.md`
  - alt: 법률 관련 내용을 나타내는 갈색 책과 망치 모양의 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 법률」 제11조에 따른 편의시설 지원 관
- `2023-hr-5#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/policies/2023-hr-5.md`
  - alt: 법률 관련 내용을 나타내는 갈색 책과 망치 모양의 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 법률 시행령」 제5조에 따른 편의시설 지
- `2023-hr-5#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/policies/2023-hr-5.md`
  - alt: 법률 관련 내용을 나타내는 갈색 책과 망치 모양의 아이콘으로, 「장애인·노인·임산부 등의 편의증진 보장에 관한 법률」 시행령에 따른 공공건물 및
- `2023-hr-5#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/policies/2023-hr-5.md`
  - alt: 법률 서적과 저울이 그려진 아이콘으로, 법령 관련 정보를 나타냅니다.
- `2023-hr-6#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-6.md`
  - alt: 연보라색 두 권의 책이 쌓여 있고 그 위에 저울 모양이 그려진 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 법률」의 내용을 참조하고 있
- `2023-hr-6#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/policies/2023-hr-6.md`
  - alt: 첫 번째 아이콘과 동일하게 연보라색 두 권의 책이 쌓여 있고 그 위에 저울 모양이 그려진 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 
- `2023-hr-6#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/policies/2023-hr-6.md`
  - alt: 법률 또는 법규 관련 내용임을 나타내는 책과 저울 모양의 주황색 아이콘입니다.
- `2023-hr-6#2023-hr-guide#3` (no-page-hint)
  - 파일: `content/policies/2023-hr-6.md`
  - alt: 법률 또는 법규 관련 내용임을 나타내는 책과 저울 모양의 주황색 아이콘입니다.
- `2023-hr-6#2023-hr-guide#4` (no-page-hint)
  - 파일: `content/policies/2023-hr-6.md`
  - alt: 법률 또는 법규 관련 내용임을 나타내는 책과 저울 모양의 주황색 아이콘입니다.
- `2023-hr-7#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-7.md`
  - alt: 법전과 저울이 그려진 법령 아이콘으로, 장애인 인식개선 교육 실시와 관련된 상세 법령 내용을 안내하고 있다.
- `2023-hr-8#2023-hr-guide#0` (no-page-hint)
  - 파일: `content/policies/2023-hr-8.md`
  - alt: 책과 저울 모양의 법령 아이콘. 「장애인고용촉진 및 직업재활법 시행령」의 장애인지원관 담당 업무 관련 조항의 주요 내용을 나타냅니다.
- `2023-hr-8#2023-hr-guide#1` (no-page-hint)
  - 파일: `content/policies/2023-hr-8.md`
  - alt: 책과 저울 모양의 법령 아이콘. 「장애인고용촉진 및 직업재활법」에 따른 장애인지원관 지정 관련 조항의 주요 내용을 나타냅니다.
- `2023-hr-8#2023-hr-guide#2` (no-page-hint)
  - 파일: `content/policies/2023-hr-8.md`
  - alt: 분홍색 배경 위에 흰색으로 크게 쓰인 숫자 04가 보입니다.
- `2023-hr-p-052#2023-hr-guide#0` (no-raster-in-range)
  - 파일: `content/policies/2023-hr-p-052.md`
  - alt: 파란색 법률 아이콘으로, 저울과 책이 그려져 있으며 「교육공무원법」 제44조(휴직)에 대한 설명을 시각적으로 나타냅니다.
- `2023-hr-p-052#2023-hr-guide#1` (no-raster-in-range)
  - 파일: `content/policies/2023-hr-p-052.md`
  - alt: 파란색 법률 아이콘으로, 저울과 책이 그려져 있으며 「국가공무원 복무·징계 관련 예규」에 대한 설명을 시각적으로 나타냅니다.
- `2023-hr-p-052#2023-hr-guide#2` (no-raster-in-range)
  - 파일: `content/policies/2023-hr-p-052.md`
  - alt: 법률 조항임을 나타내는 책과 저울 모양의 아이콘입니다.

### source: `2023-disability-types-work-support-report` (1건)

- `2023-research-1-4#2023-disability-types-work-support-report#0` (no-page-hint)
  - 파일: `content/policies/2023-research-1-4.md`
  - alt: 데이컴 기법을 활용한 직무 분석 분류표 예시 다이어그램입니다. 세로축은 '임무(Duties)', 가로축은 '작업(Tasks)'으로 표시되어 있으
