# 이미지 매핑 — 위원장 검수 큐 (Phase 1.5b PR C 후속)

Phase 1.5b 본 자동화(PR B) + ±10 window 보강(PR C) 후 잔여. 위원장이 화면 낭독기로 청취 후 결정.

## 결과 요약 (누적)

- 자동 적용: 7건 (known_answer hardcode 그대로 — PR A A8 검증된 ground truth)
- 검수 큐 (review): 72건 — 4종 합의 게이트 거부
- 매핑 사전 unresolved: 7건 — B1 단계 실패

## PR C ±10 window 결과 분석

page_number_seed 13건에 대해 ±10 raster window cross-validation 적용. Gemma 1차 stamp + 4종 합의 게이트.
- Gemma 1차 stamp YES 후보 발견: 일부 케이스
- 4종 합의 (4 YES 또는 3 YES + 0 NO) 통과: **0건** — Claude·Codex가 일관되게 NO 판정
- 결론: page-numbered slug의 정답 raster가 ±10 범위 밖이거나 alt와의 매칭 자체가 보수적 합의 게이트로 잡히기 어려움
- 무결성 게이트는 정확히 작동: false positive 0건

## 매핑 사전 unresolved (B1 단계 실패)

- `2024-staff-19#2024-support-staff-duty-guide#0` — 2024-support-staff-duty-guide (사유: chapter title PDF text 매칭 실패)
- `2024-staff-p-165#2024-support-staff-duty-guide#0` — 2024-support-staff-duty-guide (사유: slug_num 165 out of pdf range 156)
- `2024-staff-p-169#2024-support-staff-duty-guide#0` — 2024-support-staff-duty-guide (사유: slug_num 169 out of pdf range 156)
- `2024-staff-p-184#2024-support-staff-duty-guide#0` — 2024-support-staff-duty-guide (사유: slug_num 184 out of pdf range 156)
- `2024-staff-p-185#2024-support-staff-duty-guide#0` — 2024-support-staff-duty-guide (사유: slug_num 185 out of pdf range 156)
- `2024-staff-p-177#2024-support-staff-duty-guide#0` — 2024-support-staff-duty-guide (사유: slug_num 177 out of pdf range 156)
- `2024-staff-p-182#2024-support-staff-duty-guide#0` — 2024-support-staff-duty-guide (사유: slug_num 182 out of pdf range 156)

## 검수 대상 (review)

### `2024-jbu-p-013#2024-jbu-work-support-guide#0`
- 후보 raster: `public/source-images/2024-jbu-work-support-guide/page-013-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 6건 Gemma YES, 4종 합의 미달)
- alt: 플로우차트의 신청서 작성 단계에 있는 아이콘으로, 장애인 근로인이 직접 서류를 작성하는 모습을 표현합니다. 이것은 서비스 신청의 첫 번째 단계를 상징합니다.…

### `2024-jbu-p-013#2024-jbu-work-support-guide#1`
- 후보 raster: `public/source-images/2024-jbu-work-support-guide/page-013-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 9건 Gemma YES, 4종 합의 미달)
- alt: 플로우차트의 접수 단계에 있는 아이콘으로, 한국장애인고용공단을 상징하는 건물 그림입니다. 근로지원인 서비스 신청이 접수되는 과정을 나타냅니다.…

### `2024-jbu-p-029#2024-jbu-work-support-guide#0`
- 후보 raster: `public/source-images/2024-jbu-work-support-guide/page-029-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 6건 Gemma YES, 4종 합의 미달)
- alt: 이 다이어그램은 교구 제작 지원 절차를 5단계로 나타냅니다. 지체·뇌병변 장애인 교원이 학교 및 교육청에 지원을 요청하면, 학교 및 교육청이 이를 검토한 후 교원에게 지원을 제공합니다. 이어서 학교 및 교육청은 정기…

### `2024-staff-3-6#2024-support-staff-duty-guide#0`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-105-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 페이지 중앙에 크게 표시된 로마 숫자 'V'입니다. 이는 문서의 다섯 번째 장을 나타내며, 하단에는 '청각장애인교원 지원 방안'이라는 장 제목이 있습니다.…

### `2024-staff-3-8#2024-support-staff-duty-guide#0`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-130-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=YES Codex=YES (명시적 NO 2건)
- alt: 지원 인력과 교사가 마주 앉아 대화하는 일러스트. 교사가 '감사합니다'라고 말하며 지원 인력의 도움에 대한 긍정적인 반응을 보이고 있다. 이는 장애인 교원에 대한 원격 지원이 성공적으로 이루어졌음을 시사한다.…

### `2024-staff-p-095#2024-support-staff-duty-guide#0`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-095-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 7건 Gemma YES, 4종 합의 미달)
- alt: 이 흐름도는 지체·뇌병변장애인교원이 지원인력에게 시연 및 모델링 지원을 요청하는 것부터 수업에 활용되기까지의 5단계 절차를 보여줍니다. 지원인력은 교원에게 시연 및 모델링할 내용을 구체적으로 안내받아 연습하고, 교원…

### `2024-staff-p-127#2024-support-staff-duty-guide#0`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-127-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=NO Codex=- (Gemma 1차 stamp 0 YES (±10 window, 21 후보))
- alt: 휠체어에 앉은 여성이 한 손에 돋보기를 들고 다른 한 손을 높이 들어 올린 모습의 일러스트입니다. 이는 장애인교원의 교외 학급 활동을 위한 세심한 준비와 성공적인 실행을 상징합니다.…

### `2023-hr-1-2#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 관련 내용을 시각적으로 나타내는, 저울 모양의 아이콘.…

### `2023-hr-1-2#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 책 위에 저울이 놓인 아이콘으로, 장애인 공무원 인사관리의 법적 근거와 기본 방향을 상징합니다.…

### `2023-hr-1-2#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 책 위에 저울이 놓인 아이콘으로, 시·도교육청이 지원 방안 수립 시 고려해야 할 법적 근거 및 사항들을 상징합니다.…

### `2023-hr-1-4#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 파란색 배경에 저울이 얹힌 펼친 책 모양의 법령 아이콘으로, 문서 내에서 관련 법규 조항을 시각적으로 강조하고 다음 내용이 법적 근거임을 나타냅니다.…

### `2023-hr-1-4#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 문서 위에 저울이 놓인 모양의 아이콘으로, 관련 법령 및 지침을 상징합니다.…

### `2023-hr-1-4#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 문서 위에 저울이 놓인 모양의 아이콘으로, 관련 법령 및 지침을 상징합니다.…

### `2023-hr-1-4#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 문서 위에 저울이 놓인 모양의 아이콘으로, 관련 법령 및 지침을 상징합니다.…

### `2023-hr-1-4#2023-hr-guide#4`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 및 규정 관련 내용을 나타내는 저울과 펼쳐진 책 모양의 아이콘.…

### `2023-hr-2-2#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률을 상징하는 저울과 펼쳐진 책 모양의 아이콘입니다. 이 아이콘은 개인정보보호와 관련된 법률 조항을 안내하는 부분 앞에 배치되어 있습니다.…

### `2023-hr-2-2#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률을 상징하는 저울 모양의 아이콘. 다음 내용은 개인정보 보호법 관련 법적 조항임을 나타냅니다.…

### `2023-hr-2-2#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 밝은 표정으로 의족을 착용하고 한 손을 흔들고 있는 사람의 일러스트. 장애를 가진 사람의 활동성과 사회 참여를 상징합니다.…

### `2023-hr-2-2#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 아이콘. '개인정보 보호법' 제23조 '민감정보의 처리 제한'에 대한 법 조항이 이어진다.…

### `2023-hr-2-2#2023-hr-guide#4`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 아이콘. '개인정보 보호법' 제16조 '개인정보의 수집 제한'에 대한 법 조항이 이어진다.…

### `2023-hr-3-5#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-128-render.png`
- method: primary
- 합의: Claude=YES Gemini=YES Gemma=NO Codex=YES (명시적 NO 1건)
- alt: 의족을 착용한 성인 남성과 젊은 사람이 밝은 표정으로 손을 흔들며 환하게 웃고 있는 일러스트입니다. 이는 장애인의 활발한 사회 활동과 긍정적인 관계를 상징합니다.…

### `2023-hr-3#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인 공무원 임용 절차 중 공정한 승진 심사를 다루는 부분임을 나타냅니다.…

### `2023-hr-3#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인 공무원 인사관리의 기본 방향 중 차별 금지 원칙을 강조합니다.…

### `2023-hr-3#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인의 권리에 관한 협약 제27조(근로 및 고용…

### `2023-hr-3#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 파란색 법전과 저울 그림이 있는 아이콘으로, 장애인차별금지법 제10조(차별금지)의 구체적인 내용을 설명하는 섹션을 표시합니다.…

### `2023-hr-appendix-007#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-002-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 청록색 배경에 굵고 커다란 흰색 숫자 '01'이 표시되어 있습니다. 숫자의 하단은 가로지르는 흰색 선에 의해 부분적으로 가려져 있습니다.…

### `2023-hr-appendix-007#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-002-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=YES Codex=NO (명시적 NO 3건)
- alt: 핑크색 상의를 입고 목발을 짚은 사람을 흰색 상의를 입은 다른 사람이 어깨를 부축하며 돕고 있는 일러스트. 두 사람 모두 미소를 짓고 있어 서로에게 우호적인 분위기를 나타내며, 도움과 지지를 상징한다.…

### `2024-jbu-p-061#2024-jbu-work-support-guide#1`
- 후보 raster: `public/source-images/2024-jbu-work-support-guide/page-061-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 1건 Gemma YES, 4종 합의 미달)
- alt: 신체적 학대 예시 일러스트와 학대 유형 목록을 연결하는 화살표 아이콘.…

### `2023-hr-1-3#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법령을 나타내는 아이콘…

### `2023-hr-2-3#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률서적과 저울 모양의 아이콘. 아래에 이어지는 「국가공무원법」 제26조(임용의 원칙)의 관련 법령 내용을 나타냅니다.…

### `2023-hr-2-3#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률서적과 저울 모양의 아이콘. 아래에 이어지는 「교육공무원 인사관리규정」 제18조(전보계획)의 관련 법령 내용을 나타냅니다.…

### `2023-hr-2-3#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률과 공정성을 상징하는 아이콘으로, 관련 법령 내용에 대한 정보를 나타냄.…

### `2023-hr-2-3#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률과 공정성을 상징하는 아이콘으로, 관련 법령 내용에 대한 정보를 나타냄.…

### `2023-hr-2-3#2023-hr-guide#4`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률서적과 망치가 그려진 아이콘으로, 장애인 차별금지 및 권리구제 등에 관한 법률의 핵심 내용을 시각적으로 나타냅니다.…

### `2023-hr-2-3#2023-hr-guide#5`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률서적과 망치가 그려진 아이콘으로, 장애인 공무원의 인사관리 및 근무환경에 대한 균형인사지침 내용을 시각적으로 나타냅니다.…

### `2023-hr-2-3#2023-hr-guide#6`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률서적과 망치가 그려진 아이콘으로, 장애 교원 및 장애 자녀 양육 교원의 전보 계획에 관한 교육공무원 인사관리규정 내용을 시각적으로 나타냅니다.…

### `2023-hr-2-4#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 페이지 상단에 크게 흰색으로 표시된 숫자 '03'은 '장애인교원 인사관리 안내서' 문서의 세 번째 섹션을 나타냅니다.…

### `2023-hr-2-4#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-004-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 책상에 앉아 노트북을 사용하는 휠체어를 탄 여성과 그 옆에 서 있는 남성의 일러스트입니다. 이는 장애인 교원과 비장애인 교원이 함께 업무를 보는 모습을 상징합니다.…

### `2023-hr-2-5#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 관련 내용을 나타내는 법전과 저울 모양 아이콘입니다.…

### `2023-hr-2-5#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 조항을 상징하는 아이콘으로, 펼쳐진 책 위에 정의의 저울이 놓여 있는 모습입니다.…

### `2023-hr-2-5#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 관련 내용을 나타내는 천칭과 법전 모양의 아이콘…

### `2023-hr-2-5#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 관련 내용을 나타내는 천칭과 법전 모양의 아이콘…

### `2023-hr-2-5#2023-hr-guide#4`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 관련 법령 정보를 나타내는 아이콘. 고대 문서나 법전을 상징하는 형태로, 법률 관련 내용을 시각적으로 강조합니다.…

### `2023-hr-2-5#2023-hr-guide#5`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 안내견 조끼를 입은 골든 리트리버 안내견이 옆에 앉아 있고, 그 옆에 한 여성이 서서 손을 흔들며 밝게 웃고 있는 일러스트입니다. 이 이미지는 장애인 교원을 위한 편의 지원을 상징합니다.…

### `2023-hr-2-6#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-078-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=YES Codex=NO (명시적 NO 3건)
- alt: 저울 모양이 새겨진 갈색 법전 아이콘입니다. 이 아이콘은 해당 섹션이 법적 조항과 관련된 내용임을 나타냅니다.…

### `2023-hr-2-6#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-078-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=YES Codex=NO (명시적 NO 3건)
- alt: 저울 모양이 새겨진 갈색 법전 아이콘입니다. 이 아이콘은 해당 섹션이 법적 조항과 관련된 내용임을 나타냅니다.…

### `2023-hr-2-6#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-078-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 점자법 관련 법률 조항을 시각적으로 나타내는 열린 법전 아이콘입니다.…

### `2023-hr-2-6#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-078-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법전 아이콘. 이 아이콘은 옆에 있는 텍스트가 「지능정보화기본법」의 관련 조항임을 나타냅니다.…

### `2023-hr-2-6#2023-hr-guide#4`
- 후보 raster: `public/source-images/2023-hr-guide/page-078-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 또는 법규 관련 내용을 상징하는 아이콘입니다.…

### `2023-hr-5#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 관련 내용을 나타내는 갈색 책과 망치 모양의 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 법률」 제11조에 따른 편의시설 지원 관련 내용을 설명한다.…

### `2023-hr-5#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 관련 내용을 나타내는 갈색 책과 망치 모양의 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 법률 시행령」 제5조에 따른 편의시설 지원 관련 내용을 설명한다.…

### `2023-hr-5#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 관련 내용을 나타내는 갈색 책과 망치 모양의 아이콘으로, 「장애인·노인·임산부 등의 편의증진 보장에 관한 법률」 시행령에 따른 공공건물 및 공공이용시설에 대한 설명을 시작한다.…

### `2023-hr-5#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 서적과 저울이 그려진 아이콘으로, 법령 관련 정보를 나타냅니다.…

### `2023-hr-6#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 연보라색 두 권의 책이 쌓여 있고 그 위에 저울 모양이 그려진 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 법률」의 내용을 참조하고 있음을 나타냅니다.…

### `2023-hr-6#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 첫 번째 아이콘과 동일하게 연보라색 두 권의 책이 쌓여 있고 그 위에 저울 모양이 그려진 아이콘으로, 「장애인 차별금지 및 권리구제 등에 관한 법률 시행령」의 내용을 참조하고 있음을 나타냅니다.…

### `2023-hr-6#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 또는 법규 관련 내용임을 나타내는 책과 저울 모양의 주황색 아이콘입니다.…

### `2023-hr-6#2023-hr-guide#3`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 또는 법규 관련 내용임을 나타내는 책과 저울 모양의 주황색 아이콘입니다.…

### `2023-hr-6#2023-hr-guide#4`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법률 또는 법규 관련 내용임을 나타내는 책과 저울 모양의 주황색 아이콘입니다.…

### `2023-hr-7#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 법전과 저울이 그려진 법령 아이콘으로, 장애인 인식개선 교육 실시와 관련된 상세 법령 내용을 안내하고 있다.…

### `2023-hr-8#2023-hr-guide#0`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 책과 저울 모양의 법령 아이콘. 「장애인고용촉진 및 직업재활법 시행령」의 장애인지원관 담당 업무 관련 조항의 주요 내용을 나타냅니다.…

### `2023-hr-8#2023-hr-guide#1`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 책과 저울 모양의 법령 아이콘. 「장애인고용촉진 및 직업재활법」에 따른 장애인지원관 지정 관련 조항의 주요 내용을 나타냅니다.…

### `2023-hr-8#2023-hr-guide#2`
- 후보 raster: `public/source-images/2023-hr-guide/page-005-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=YES Codex=NO (명시적 NO 3건)
- alt: 분홍색 배경 위에 흰색으로 크게 쓰인 숫자 04가 보입니다.…

### `2023-research-1-4#2023-disability-types-work-support-report#0`
- 후보 raster: `public/source-images/2023-disability-types-work-support-report/page-018-render.png`
- method: fallback
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 데이컴 기법을 활용한 직무 분석 분류표 예시 다이어그램입니다. 세로축은 '임무(Duties)', 가로축은 '작업(Tasks)'으로 표시되어 있으며, 임무별로 수행되는 작업들을 분류할 수 있도록 빈 칸들이 배열된 매트…

### `2024-jbu-2-10#2024-jbu-work-support-guide#0`
- 후보 raster: `public/source-images/2024-jbu-work-support-guide/page-099-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=NO Codex=NO (명시적 NO 4건)
- alt: 보충 설명을 알리는 '참고' 아이콘.…

### `2024-jbu-p-063#2024-jbu-work-support-guide#2`
- 후보 raster: `public/source-images/2024-jbu-work-support-guide/page-063-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 2건 Gemma YES, 4종 합의 미달)
- alt: 경제적 착취 삽화와 그 유형 목록을 연결하는 오른쪽 방향 화살표입니다.…

### `2024-jbu-p-063#2024-jbu-work-support-guide#4`
- 후보 raster: `public/source-images/2024-jbu-work-support-guide/page-063-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 6건 Gemma YES, 4종 합의 미달)
- alt: 유기 및 방임 삽화와 그 유형 목록을 연결하는 오른쪽 방향 화살표입니다.…

### `2024-staff-2-4#2024-support-staff-duty-guide#0`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-032-render.png`
- method: primary
- 합의: Claude=NO Gemini=NO Gemma=ERROR Codex=NO (명시적 NO 3건)
- alt: 안내견과 함께 흰 지팡이를 사용하여 걷고 있는 시각장애인 교원의 일러스트입니다. 안내견은 노란 조끼를 입고 교원과 나란히 발걸음을 맞추고 있으며, 교원은 안내견의 하네스를 잡고 있습니다. 이 그림은 시각장애인 교원의…

### `2024-staff-p-116#2024-support-staff-duty-guide#0`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-116-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 2건 Gemma YES, 4종 합의 미달)
- alt: 책상에 앉아 함께 업무를 보는 세 사람의 일러스트. 한 명은 노트북을 사용하고 있고, 두 명은 서류를 들고 있으며, 이 중 한 명은 의족을 착용하고 있습니다.…

### `2024-staff-p-149#2024-support-staff-duty-guide#0`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-149-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=NO Codex=- (Gemma 1차 stamp 0 YES (±10 window, 18 후보))
- alt: 플로차트의 첫 번째 단계로, 청각장애인교원이 수업 중 학생 생활지도와 관련하여 지원인력에게 청각 정보 청취를 요청하는 과정을 보여줍니다.…

### `2024-staff-p-149#2024-support-staff-duty-guide#1`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-149-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=NO Codex=- (Gemma 1차 stamp 0 YES (±10 window, 18 후보))
- alt: 플로차트의 두 번째 단계로, 지원인력이 청각장애인교원으로부터 요청받은 사항을 수행하는 과정입니다.…

### `2024-staff-p-149#2024-support-staff-duty-guide#2`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-149-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=- Codex=- (±10 window 1건 Gemma YES, 4종 합의 미달)
- alt: 플로차트의 세 번째 단계로, 지원인력이 청취한 내용을 청각장애인교원에게 전달하는 과정을 나타냅니다.…

### `2024-staff-p-149#2024-support-staff-duty-guide#3`
- 후보 raster: `public/source-images/2024-support-staff-duty-guide/page-149-render.png`
- method: page_number_seed
- 합의: Claude=- Gemini=- Gemma=NO Codex=- (Gemma 1차 stamp 0 YES (±10 window, 18 후보))
- alt: 플로차트의 네 번째 단계로, 청각장애인교원이 지원인력에게 피드백을 제공하고 다음 수업 청취를 요청하는 과정입니다.…

