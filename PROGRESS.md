# PROGRESS

> 현재 상태·다음 단계·미결 결정만 담는다(자율성 헌장 §문서화 규율). 항구 원칙은 CLAUDE.md, 날짜별 이력은 CHANGELOG.md, PR 단위 상세는 git log.

## 현재 상태 (2026-07-10)

- **웹**: Phase 1~4·A·B·7 전 완료. 최근 FAQ 코너 신설(#86, axis faq 9건 draft — 위원장 검수 대기). production https://webfortd.vercel.app (engccer Hobby 임시, KHUDT Pro 결제 락).
- **iOS 네이티브 v1 코딩 완료**: M0~M4 전부 머지(PR #87~#91, master `14334b2`). 5탭(위키·채팅·자료실·미디어·설정), 오프라인 위키 535건·검색·RAG 채팅·OTP 인증·이력·PDF 캐시. Kit 단위 테스트 49개 green.
  - 정본: spec `docs/superpowers/specs/2026-07-10-ios-native-app-design.md`, plan M0~M4 `docs/superpowers/plans/2026-07-10-ios-native-m*.md`, 배포 절차 `docs/IOS_DISTRIBUTION.md`.
- **서버 신규 공용 자산**(M3): Bearer 이중 인증(`src/lib/supabase/request-auth.ts`) + `GET /api/chat/threads/[id]`(이력 복원 — 웹 이력 복원 UX에도 재사용 가능).

## 다음 단계

1. **위원장 실기기 일괄 게이트** (M0~M4 통합, iPhone 연결 후 Xcode Run — Personal Team 자동 서명):
   - 비행기 모드: 위키 열람(표 포함)·검색 완주·자료실 캐시 재열람
   - VoiceOver: 로터 헤딩 점프, 축 카드·검색 결과 한 객체 낭독, 문서 제목 1회 낭독, 표 행 단위 "헤더 값" 낭독(실패 시 폴백이 plan M0 Task 8에 명시), 채팅 완주(질문→답변 포커스→출처 카드)
   - OTP 로그인 전체 플로(이메일→코드) + 대화 저장·복원 실동작
2. 게이트 통과 후: Apple Developer Program 가입 결정 → `docs/IOS_DISTRIBUTION.md` 절차 실행 → TestFlight.
3. 웹 트랙 잔여: FAQ 검수·publish, 콘텐츠 큐레이션(허유진 교수 협업), 이미지 검수 큐 79건.

## 미결 결정 (위원장)

| 항목 | 내용 | 근거 문서 |
|------|------|-----------|
| Apple Developer Program 가입 | 연 $99(비용 하드 스톱). 개인 명의(법적 이름 노출) vs 장교조 조직 명의(D-U-N-S 필요) | docs/IOS_DISTRIBUTION.md §1 |
| 앱 아이콘 | 1024×1024 미제작. 디자인 방향 결정 필요 | docs/IOS_DISTRIBUTION.md §2 |
| 웹 /privacy·/terms 본문 | placeholder 상태 — TestFlight 외부 테스터·심사 전 필수 | docs/IOS_DISTRIBUTION.md §2 |
| M5 라이브 음성 재개 시점 | dodo-planet Live 오류 수정·검증 후 이식(2026-07-10 지시) | spec §4.4 |

## 이월 백로그 (비차단, 우선순위 낮음)

- M3: 무효 Bearer 시 조용한 미저장(이력 저장 실패 신호 없음), threads GET rate limit 부재, 첨부 이력 미보존(저장은 텍스트만)
- M2: 첨부 단독 전송 미지원(웹은 허용)
- M0/M1: 파서 스모크 assertion 보강, HTMLBlock 정규식 협소화, backlinkSection compactMap 선필터(발현 불가·방어적)
- M4: 자료실·미디어 빈 목록 상태 뷰(현재 도달 불가), CatalogStore 로더 제네릭 통합
