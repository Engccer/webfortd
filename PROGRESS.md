# PROGRESS

> 현재 상태·다음 단계·미결 결정만 담는다(자율성 헌장 §문서화 규율). 항구 원칙은 CLAUDE.md, 날짜별 이력은 CHANGELOG.md, PR 단위 상세는 git log.

## 현재 상태 (2026-08-04)

- **✅ 웹 콘텐츠 편집기 트랙 코드 완료 (2026-08-04, Task 1~10, `feat/web-content-editor`)**: 감수자(비개발자, 중부대 연구보조원)가 웹 화면에서 KB 콘텐츠 마크다운을 직접 수정하면 GitHub PAT 경유 커밋으로 반영되는 편집기. 핵심 산출물: `/editor?slug=` 편집 화면(본문 textarea + 프리뷰 + "수정 반영", in-flight 가드, localStorage 초안 자동 백업, 충돌 시 내 편집본 별도 보존) + KB 문서 페이지 "편집" 버튼(`editor_roles` 권한자에게만 client-side 노출) + 서버 코어(`src/lib/editor/edit-core.ts`, stateless 프로토콜. 제출 시점 SHA 재조회로 충돌 판정) + GitHub Contents API 래퍼(`src/lib/github/contents.ts`) + 야간 sync+embed GitHub Actions 워크플로(`LAST_EMBED_SHA` repo variable로 변경분만 처리) + `editor_roles` RLS 거부 integration 테스트(anon insert/update/delete 거부, service_role seed 확인) + `/editor` axe 케이스(`tests/a11y/admin-bar.spec.ts`, 비-admin 접근 시 안내 화면이 그대로 렌더되는 실동작 확인) + 감수자 1쪽 안내(`docs/EDITOR_GUIDE.md`). 정본: spec `docs/superpowers/specs/2026-08-04-web-content-editor-design.md`(적대적 리뷰 28건 처리 기록 포함). **경로 변경(round 2, 2026-08-04)**: `/admin/editor`가 `admin/layout.tsx`의 admin 전용 게이트에 걸려 editor 역할 감수자가 아예 도달 불가한 spec §5 권한 행렬 위반이 발견되어 `(wiki)/editor`로 이동. admin/*는 admin 전용 의미를 유지하고, 편집기는 자체 게이트(loadDocument forbidden 처리 + 안내 화면)로 완결. **잔여는 코드가 아니라 운영 설정과 마일스톤 마감 게이트**(아래 다음 단계 참고).
- **✅ 받아쓰기 트랙 후속 정비 3건 (2026-07-20)**: ① gildongmu SpeechService 레이스 가드 2건 백포트(gildongmu main `e1f5d2f`, 실기기 배포 — PR #103 잔여 해소) ② iOS 44pt 터치 타깃 정비 7파일(#108 이월 ① 해소) ③ 웹 받아쓰기 §6 신계약 — 결과 원문 통지 + 채팅 전송 버튼 포커스(flushSync, #108 이월 ③ 해소, hero 검색도 원문 통지 정렬). 상세: CHANGELOG 2026-07-20. **남은 실측(위원장)**: List NavigationLink 행 전체 탭 육안, BlockRenderer 리스트 마커 이중 낭독(#108 이월 ②).
- **✅ iOS WhatsApp식 홀드 받아쓰기 이식 (2026-07-20, PR #109)**: gildongmu 실기기 합격(2026-07-20) 계약 이식 — `HoldDictationButton` 신설(UIKit 인식기 계층, 경합 가드 3종, interrupting 무음 통지, 정적 라벨), 채팅=홀드+잠금+취소 풀 계약(릴리스=초안 병합 즉시 전송)+"텍스트 지우기" 버튼, 위키 검색=홀드 단일 동작. 채팅 리스트·BlockRenderer LazyVStack→eager VStack(gildongmu 실기기 확정 CPU 무한 루프 선제 제거). 리뷰 P1 fix(홀드 중 탭 이탈 늦은 전사 가드). Kit 49·시뮬레이터 빌드 그린, 실기기 배포 + **위원장 VoiceOver 실측 합격**(홀드·잠금·이어쓰기·병합 전송·취소·짧은 탭 전 항목). 상세: CHANGELOG 2026-07-20.
- **✅ iOS 채팅 VoiceOver 헌장 §6 정렬 (2026-07-19, PR #108)**: dodo R184 확정 계약 이식 — 전송 시 보내기 버튼 포커스 유지·완료 시에만 질문 헤딩 이동(스크롤 가시화 2단계+재시도), 전송·중단 단일 버튼(.disabled 폐기), 질문 헤딩 trait, 마이크 라벨 "받아쓰기 시작/중지", 받아쓰기 완료 통지+전송 버튼 포커스, Announce 단일 채널(15건 일원화)+ChatFocusDiag 계측, 44pt label 내부화(채팅 계열). 시뮬레이터 AX 브리지 실측 통과. **잔여: 위원장 실기기 VO 판정**(전송 유지→완료 질문 헤딩→다음 스와이프 답변 첫 블록; 실패 시 Documents/chat-focus-diag.log 회수). 후속 이월: ~~채팅 외 7개 파일 44pt~~·~~웹 받아쓰기 §6 신계약~~(둘 다 2026-07-20 후속 정비로 해소), BlockRenderer 리스트 마커 실기기 낭독 확인(위원장 잔존).
- **✅ 음성 받아쓰기 트랙 완결 (2026-07-18, PR #103·#104·#106)**: ① 웹 전면 gildongmu화 — Web Audio 효과음 3종, useVoiceRecorder 견고화(오류 코드 계약·더블탭 잠금·언마운트 가드·fetch 취소), 권한 사전 모달 삭제, 시작/정지 음성 안내 제거(효과음+aria-label 변화가 상태 신호, 120초 마일스톤 안내 유지), transcribe 422. ② iOS 채팅 받아쓰기 신설 — SpeechService(iOS 26 SpeechAnalyzer 온디바이스 ko-KR, 서버 왕복 0) + ChatView 마이크 버튼(append). ③ iOS 위키 검색 받아쓰기 — 정지=쿼리 입력+즉시 검색(검색 전용 계약) + 탭 가시성 가드. ④ 웹 위키 홈 hero 검색창 받아쓰기(#106) — 동일 계약 웹 이식: 전사=쿼리 대체+결과 팝오버+입력창 재포커스, 헤더 소형 검색창 제외. 리뷰 fix 3건(취소 경합 레이스)+P1(포커스 단절). production READY·실스모크 200, iPhone 13 Pro 배포, **위원장 실 마이크 스모크 통과(채팅·위키 검색)**. 정본: spec `docs/superpowers/specs/2026-07-18-voice-dictation-gildongmu-port-design.md`, CHANGELOG 2026-07-18. 잔여 후속: ~~gildongmu 백포트~~(2026-07-20 완료, gildongmu `e1f5d2f`) + 웹 hero 검색 실 마이크 스모크(위원장).
- **✅ 프로덕션 배포 정상화 (2026-07-17, PR #100)**: 2026-06-18경부터 모든 배포가 `exceeded_serverless_functions_per_deployment`(Hobby 함수 12개 제한)로 실패하던 것을 **KB 축 `[slug]` 라우트 9개 → `(wiki)/[...kb]` catch-all 통합**(URL 불변, 함수 17→9개)으로 해소. 한 달간 미반영이던 서버 변경(M3 Bearer·threads API, 모션 감사 #97 등) 전부 라이브 반영 확인. **영구 규칙: 새 KB 축·서브섹션 문서 라우트는 별도 파일 라우트를 만들지 말고 `[...kb]` 파서에 추가**(파일 라우트 1개 = Serverless Function 1개 소모). 1안(KHUDT Pro 재활성)은 위원장 보류 결정 — 카드 등록·Reactivate 버튼 활성 상태 확인됨(khudt@khudt.net Owner), 원할 때 실행 가능.
- **애니메이션·모션 감사 트랙 완결 (2026-07-17, PR #97·#98)**: improve-animations 스킬 감사 → 플랜화 → 실행 → review-animations 기준 리뷰(양 트랙 모두 Approve, P1/P2 0건) → 머지. 웹 파인딩 9건 반영(키보드 토글 무애니메이션, JS 스크롤 reduced-motion 게이트, transition-all 전폐, framer-motion 등 죽은 자산 제거, --ease-out 강화 외) + iOS 1건(채팅 자동 스크롤 withAnimation + Reduce Motion 게이트, 시뮬레이터 프레임 정량 실측 검증). 정본: `plans/web-animations/`·`plans/ios-animations/`(기각 항목 근거 포함). `ios/deploy-device.sh` 이식(세 repo 동일본) + 실기기(iPhone 13 Pro) 배포 완료. 잔여: 위원장 실사용 feel check(reduced-motion 토글·채팅 스크롤·드로어).

- **웹**: Phase 1~4·A·B·7 전 완료. 최근 FAQ 코너 신설(#86, axis faq 9건 draft — 위원장 검수 대기). production https://webfortd.vercel.app (engccer Hobby 임시, KHUDT Pro 결제 락).
- **공식 사업 트랙**(2026-07-14): 과업요청서 최종본 중부대 전달 완료 — 수행사 공고·비교 견적·계약은 중부대 주관. 공식 웹앱 올해 범위에서 일반 이용자 로그인·대화 기록 저장·고충상담 제외(교육부 개인정보 협의). webfortd는 독립 트랙이라 영향 없음. 상세: `docs/DIRECTION_2026.md` §11 진행 상태.
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
4. **웹 콘텐츠 편집기 운영 체크리스트**(spec §11, 코드 완료 이후 배포 시점 항목):
   - fine-grained PAT 발급(위원장 GitHub 계정, contents:write 한정) → Vercel 환경변수 등록 + 만료일 캘린더 등록
   - master ruleset 등록: force push·브랜치 삭제 금지
   - GitHub Actions Secrets 3종 + PAT 1종 등록(Task 9 실계약 확인, 이름 정확히 일치): `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SECRET_KEY`·`GOOGLE_GENERATIVE_AI_API_KEY` + repo variable 쓰기용 `VAR_RW_TOKEN`(Variables write 권한, `VAR_RW_TOKEN` 발급이 선행돼야 `gh variable set` 스텝이 403 없이 동작)
   - 연구보조원 이메일 `editor_roles` seed
   - 감수자 안내(`docs/EDITOR_GUIDE.md`) 전달
   - 마일스톤 마감 게이트: cross-cutting 리뷰 + 전체 테스트·lint·build green + 함수 수 실측(≤12) → PR 생성 → Vercel preview 실호출 게이트(편집 → 커밋 접수 → 빌드 → 페이지 반영 1회, 위원장 또는 테스트 계정) → 위원장 VoiceOver 실기기 실측(편집 흐름 전체, 리뷰로 대체 불가)

## 미결 결정 (위원장)

| 항목 | 내용 | 근거 문서 |
|------|------|-----------|
| KHUDT Pro 재활성(1안) 실행 시점 | 배포는 2안(PR #100)으로 정상화됨. Pro 복귀는 사업 자산 명의 정합 목적으로 여전히 유효한 옵션 — Billing에 Reactivate Pro 버튼 활성 + MasterCard •••• 2970 등록 확인(2026-07-17). 월 $20 결제 발생이라 위원장 실행 몫, 복귀 절차는 `docs/VERCEL_RECOVERY_PLAN.md`(5~15분) | 2026-07-17 보류 결정 |
| Apple Developer Program 가입 | 연 $99(비용 하드 스톱). 개인 명의(법적 이름 노출) vs 장교조 조직 명의(D-U-N-S 필요) | docs/IOS_DISTRIBUTION.md §1 |
| 앱 아이콘 | 1024×1024 미제작. 디자인 방향 결정 필요 | docs/IOS_DISTRIBUTION.md §2 |
| 웹 /privacy·/terms 본문 | placeholder 상태 — TestFlight 외부 테스터·심사 전 필수 | docs/IOS_DISTRIBUTION.md §2 |
| M5 라이브 음성 재개 시점 | dodo-planet Live 오류 수정·검증 후 이식(2026-07-10 지시) | spec §4.4 |

## 이월 백로그 (비차단, 우선순위 낮음)

- M3: 무효 Bearer 시 조용한 미저장(이력 저장 실패 신호 없음), threads GET rate limit 부재, 첨부 이력 미보존(저장은 텍스트만)
- M2: 첨부 단독 전송 미지원(웹은 허용)
- M0/M1: 파서 스모크 assertion 보강, HTMLBlock 정규식 협소화, backlinkSection compactMap 선필터(발현 불가·방어적)
- M4: 자료실·미디어 빈 목록 상태 뷰(현재 도달 불가), CatalogStore 로더 제네릭 통합
