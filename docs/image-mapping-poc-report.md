# 이미지 매핑 자동화 PoC 보고서 (2026-05-17)

Phase 1 머지 후 잔여 작업 중 **86건 unmapped 이미지 매핑**을 자동화하기 위한 사전 검증 보고서. 위원장(시각장애인)이 시각적 검수 불가한 환경에서 자동화의 무결성을 어떻게 보장할 것인가를 다룬다.

## 배경

Phase 1 M4-C에서 `content/_image-mappings.json` 인프라가 구축되었고, M4 자동화 단계에서 Gemini CLI가 18건을 자동 적용했다. 나머지 86건은 unmapped 상태로 위원장 직접 검수 영역으로 남았다. 그러나 위원장이 시각장애인이라 manifest의 PNG 후보 중 어느 것이 본문 placeholder가 가리키는 그림인지 시각적으로 확인할 수 없어 자동화가 필수적이다.

## PoC 진행 흐름

### 1단계: Gemini CLI multi-image 매칭 PoC

Gemini CLI에 alt + 후보 raster 5개를 한 prompt로 던지고 정답 번호를 답하게 함.

- 18건 ground truth 대상 정확도: **38.9%** (7/18)
- API 오류 3건 (gaxios 400, multi-image 부담)
- 오답 패턴: 인접 페이지의 비슷한 일러스트·흐름도 사이 혼동

자동화 도입 부적합 판정. 시각장애인 검수 환경에서 데이터 무결성 사고 위험.

### 2단계: OCR 기반 매칭 PoC

macOS Vision framework로 한국어 OCR 추출 후 alt 키워드와 자카드 유사도 매칭.

- 전체 정확도: **22.2%** (4/18)
- OCR 적용 가능 케이스 (텍스트 5자 이상): 5/18
- 그 중 정확도: **60%** (3/5)
- 13건 (72%)이 텍스트 없는 일러스트·사진이라 OCR 적용 자체 불가

자동화율 약 15%로 본 자동화 목표(86건) 달성 불가.

### 3단계: Claude vision 자기참조 검증 — 사용자 통찰로 한계 노출

본 세션이 Claude vision (Read tool)으로 ground truth 18건을 검증해 100% 일치 확인. 그러나 위원장이 짚어준 핵심 통찰:

> "Claude vision 또한 또 다른 AI라는 점에서 100% 신뢰하긴 어려워. 따라서 비슷한 멀티모달 성능을 지닌 Claude, Gemini, Codex + 무료 로컬 모델인 Gemma로, 4중 교차 검증을 하거나 4중까지는 아니더라도 최소 2종 교차 검증을 해야 무결성을 담보할 수 있을 것 같은데."

→ 단일 AI 검증은 self-referential. ground truth가 Claude vision 의견에 불과하다는 점이 PoC 자체의 측정 기준을 왜곡한다.

### 4단계: 4종 cross-validation — Claude·Gemini·Codex·Gemma

18건 각각에 대해 4종 모델이 "alt가 이 raster를 정확히 묘사하는가? YES/NO" 독립 판정.

**합의 분포**:

| 합의 수준 | 건수 | 신뢰도 |
|---|---|---|
| 4/4 합의 (모두 YES) | 7건 | 진짜 무결 |
| 3/4 합의 | 6건 | 1개 모델만 반대 |
| 2/4 합의 | 3건 | 의심 |
| 1/4 합의 (Claude만 YES) | 2건 | **Claude 단독 판정** |
| 0/4 | 0건 | — |

**모델별 YES 비율**:

| 모델 | YES/18 | 비율 | 에러 |
|---|---|---|---|
| Claude (본 세션) | 18 | 100% | 0 |
| Gemini CLI | 15 | 83% | 0 |
| Codex CLI | 8 | 44% | **6 (usage limit)** |
| Gemma 4 E4B | 13 | 72% | 0 |

**핵심 발견**: Claude의 100% YES는 self-referential 판정. 다른 3종은 5건에서 NO 의견.

### 5단계: 분쟁 5건 — 모델 합의 묘사 수집

Gemini·Gemma에 "이 그림을 한국어로 정확히 묘사하라" prompt 호출해 독립 묘사 수집. 결과:

| 케이스 | 현재 alt 오기 | 모델 합의 묘사 | 판정 |
|---|---|---|---|
| `staff-p-159` 하트 포즈 | "왼쪽=소녀, 오른쪽=여성" | 두 모델 모두 "왼쪽=여성, 오른쪽=소녀" | **alt 좌우 반대** |
| `staff-p-183` 트랙볼 | "본체 왼쪽에 큰 노란 트랙볼" | "본체 중앙에 노란 트랙볼" | **alt 위치 오기** |
| `jbu-p-062` 따돌림 | "두 사람이 등을 돌리고 손짓" | "세 명 남성. 가운데는 눈물, 양쪽은 손가락질" | **alt 동작 오기** |
| `jbu-p-016` 보조공학기기 절차 | 절차 도식 묘사 | 동일 묘사 | **alt 무결**, Codex·Gemma 판정 오인 |
| `jbu-p-063` 가방 돈 | 경제적 착취 묘사 | Gemini는 동일, Gemma는 "결제"로 오인 | **alt 무결**, Gemma 오인 |

→ 5건 중 **3건은 alt 자체가 부정확**, 2건은 alt 무결 모델 일부 오인. **다중 모델 합의 패턴이 alt 부정확성을 실제로 잡아냄.**

이 발견은 PoC의 부산물이지만 본 작업의 핵심 가치 — Phase 1 M4에서 Gemini CLI가 만든 alt 표현 중 일부가 좌우·위치·동작 등 세부에서 어긋났다는 사실이 다중 모델 합의로 노출됨.

## 본 자동화 절차 — 확정안

### 1. alt 정제 단계 (M4-D, 신설)

PoC에서 발견된 부정확 alt 3건을 모델 합의 묘사로 교체. 위원장이 텍스트로 비교 후 결정.

### 2. 본 자동화 절차 (86건 unmapped)

```
1차: 후보 raster 추출 (같은 source, 페이지 hint ± N)
2차: 4종 모델 (Claude·Gemini·Codex·Gemma) 독립 YES/NO 판정
3차: 합의 게이트
  - 4/4 YES                              → 자동 적용 (최고 신뢰도)
  - 3/4 YES + 명시적 NO 0건              → 자동 적용
  - 3/4 YES + Codex ERROR로 양보         → 자동 적용 (안전망)
  - 2/4 이하 또는 명시적 NO 존재         → unmapped 유지 + 위원장 검수 큐
```

### 3. Codex usage limit 대응

- PoC에서 Codex ERROR 6/18 = 33% 비율
- 86건 자동화에서 약 30건 ERROR 예상
- ERROR 케이스는 **Gemini + Gemma + Claude 3종 합의로 강등 운영**
- **2026-05-18 03시 차단 해제 후** ERROR 케이스만 재처리 옵션

### 4. 부산물 — 분쟁 케이스 풍부 정보

unmapped로 남는 케이스마다 4종 모델의 독립 묘사를 `docs/image-mapping-disputed.md`에 텍스트로 기록. 위원장이 화면 낭독기로 청취하고 결정 가능.

## 후속 작업 순서 (2026-05-18 03시 이후)

1. **18건 ground truth 확정 작업 — Codex 차단 해제 후 ERROR 6건 재실행**. 4종 cross-validation 완성. (M5 codex-rescue 이연)
2. **alt 정제 3건 PR** — staff-p-159·staff-p-183·jbu-p-062의 alt를 모델 합의 묘사로 교체
3. **본 자동화 86건 진입** — 위 절차에 따라 unmapped 이미지 매핑 자동화
4. 자동화 결과 검수 + `npm run image:apply` + production 배포 확인

## 결정 요약

| 항목 | 결정 |
|---|---|
| 자동화 엔진 | 4종 cross-validation (Claude·Gemini·Codex·Gemma) |
| 무결성 보장 | 최소 3/4 합의 + Codex ERROR 양보 시 안전망 |
| Gemma 위치 | 보조 신호 (객체 인식 한계 있음, alt 매칭에선 가치 있음) |
| ground truth 신뢰도 | Claude 단독 판정은 self-referential — 다중 모델 합의가 진짜 무결성 |
| Phase 1 M4 매핑 18건 | 13건 무결, 3건 alt 부정확 수정 필요, 2건 검토 후 유지 |
| 작업 트리거 | Codex usage limit 해제 (2026-05-18 03시 이후) |

## 부록 — PoC 실행 자료

PoC 스크립트 및 결과 캐시 위치 (gitignored, 로컬 보존):

- `/tmp/image-match-poc/extract-ground-truth.mjs` — 18건 ground truth 추출
- `/tmp/image-match-poc/run-poc.mjs` — Gemini multi-image PoC
- `/tmp/image-match-poc/ocr.swift` — macOS Vision framework OCR
- `/tmp/image-match-poc/run-ocr-poc.mjs` — OCR 매칭 PoC
- `/tmp/image-match-poc/cross-validate.mjs` — 4종 cross-validation
- `/tmp/image-match-poc/describe-disputed.mjs` — 분쟁 5건 묘사 수집
- `/tmp/image-match-poc/ground-truth.json` — 18건 매핑 메타
- `/tmp/image-match-poc/results.json` — Gemini multi-image 결과
- `/tmp/image-match-poc/ocr-results.json` — OCR 매칭 결과
- `/tmp/image-match-poc/cross-validate.json` — 4종 합의 결과
- `/tmp/image-match-poc/cross-cache.json` — 4종 호출 캐시 (Codex 재실행 시 재사용 가능)
- `/tmp/image-match-poc/disputed-descriptions.json` — 분쟁 5건 모델별 묘사

Codex 차단 해제 후 cross-cache.json에서 ERROR 항목만 삭제 후 cross-validate.mjs 재실행하면 ERROR 6건만 재처리됨.
