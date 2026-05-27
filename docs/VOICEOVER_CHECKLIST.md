# 위원장 VoiceOver 검수 체크리스트

> **목적**: 자동 검증(axe-core)이 못 잡는 *실제 사용 경험*을 위원장이 iPhone Safari + VoiceOver로 10분 동안 점검.
> **시점**: Phase 4 M3 PR B 머지 + production deploy 검증 직후.
> **결과 보관**: 자유 형식 메모 → `~/Library/CloudStorage/GoogleDrive-hudt0715@gmail.com/My Drive/장교조 업무 공유 폴더/22. 위원장 메모/2. 2026/1. 중부대 웹사이트 개발/2026/`

---

## 사전 준비

- iPhone Safari, VoiceOver 활성 (설정 → 손쉬운 사용 → VoiceOver, 트리플 클릭으로 토글)
- 헤드폰 권장 (스피커는 주변 소음 영향)
- 시작 URL: https://webfortd.vercel.app/

---

## 7 step (각 1~2분)

### 1. Skip-link
- `/` 진입 → 첫 Tab 한 번 누름 → "본문으로 이동" 링크 음성 안내 확인
- Enter → main-content 영역으로 점프 (header 건너뜀)

### 2. 헤더 nav 순회
- Tab/Shift+Tab으로 헤더 nav 항목 순회
- 각 항목 음성 안내 명확 (위키 / 채팅 / 자료실 / 미디어 / 로그인 등)
- 현재 페이지는 aria-current 음성 "현재 페이지" 안내

### 3. 위키 entry hero + RoleEntries 5장
- `/` 위키 entry 페이지에서 hero 제목 음성 안내
- RoleEntries 5장 카드 (교사 / 관리자 / 사무 / 정책 / 학부모) 각각 *역할 + 한 줄 설명* 음성 안내
- placeholder 2장(정책·학부모)은 "준비 중" 음성 안내

### 4. /library 카드 4장 + 검색
- `/library` 진입 → 카드 4장 음성 안내 (제목 + 연도 + 기관)
- 검색 input → "자료실 검색" placeholder 음성
- "인사관리" 입력 → 결과 1건 음성

### 5. /library/[slug] + atomic footer
- `/library/2023-hr-guide` 진입 → 상세 정보 음성
- 페이지 하단 "원본 자료 다운로드" 링크 도달 → Enter로 PDF 다운로드 시작 음성

### 6. /chat 입력 + 추천 + 응답
- `/chat` 진입 → 입력창 focus 음성 "메시지 입력"
- 추천 버튼 3개 Tab으로 도달 → Enter
- 응답 카드 aria-live로 실시간 음성 안내 ("응답 중..." → 텍스트)
- sourceRefs 출처 카드 Tab 도달 가능

### 7. 모바일 회전
- 세로 모드에서 위 5단계 흐름 자연스러움 확인
- iPhone 회전 → 가로 모드 → 레이아웃 깨짐 X, 음성 흐름 유지

---

## 발견 시 처리

- **Critical** (사용 불가 수준): 즉시 별도 PR fix, M3 머지 차단
- **Moderate** (사용 가능하나 불편): 별도 issue 또는 Phase 5 큐
- **Nit** (취향 수준): 무시

발견 사항은 위원장 메모 폴더에 자유 형식 기록.

---

## 종료

7 step 모두 통과 → Phase 4 M3 완료 → Phase 4 종료 선언.
