# CHANGELOG

> 날짜별 변경 이력(마일스톤 경계 갱신). 2026-07-10 이전 이력은 git log와 CLAUDE.md §Phase 진행 요약이 정본(지연 생성 원칙에 따라 이 파일은 iOS 트랙 진입 시점부터 시작).

## 2026-07-20 — 받아쓰기 트랙 후속 정비 3건: gildongmu 백포트 + iOS 44pt 정비 + 웹 §6 신계약

- **gildongmu SpeechService 레이스 가드 백포트**(gildongmu main `e1f5d2f`, 실기기 배포): PR #103 리뷰가 검출해 "백포트 권장(미실행)"으로 기록됐던 2건 — ① 세대 토큰(cancel 후 늦게 완주한 start()의 마이크 재점화 차단) ② stopping 상호 배제(stop finalize 중 cancel의 중복 종료 차단) — 를 원본에 이식. 받아쓰기 트랙의 두 repo 정합 완결.
- **iOS 44pt 터치 타깃 정비 7파일**(#108 후속 이월 ①): Axis·WikiHome·Document·Settings·Auth·Library·Media의 바깥 `.frame(minHeight: 44)`를 label 안쪽 `.frame`+`.contentShape`로 이동(확립 패턴 "버튼 바깥 frame은 히트 영역을 안 넓힌다"). 실결함은 비-List 컨텍스트(DocumentView 원문 보기·백링크, LibraryView 트레일링·toolbar, AuthSheet)이고 List 행은 패턴 통일. 리뷰 확인: role·라벨 불변, 회귀 없음.
- **웹 받아쓰기 §6 신계약**(#108 후속 이월 ③, dodo R184·iOS 동형): ① VoiceRecordButton 전사 성공 통지를 일반 안내문("추가했어요")에서 **받아쓴 결과 원문**으로 교체(successMessage prop 제거, 소비자 콜백 먼저 → 원문 통지 순서 = "포커스 발화 뒤 결과 낭독") ② ChatUI 전사 성공 시 **전송 버튼 포커스 이동** — 전송 버튼이 빈 입력일 때 disabled라 `flushSync`로 append 커밋 후 focus(리뷰가 통제 실험으로 flushSync 필요성·ref 스프레드 체인 도달을 실측 확인) ③ hero 검색도 원문 통지로 정렬(입력창 재포커스+건수 통지는 기존 유지). §6 계약 vitest 2건 추가(VoiceRecordButton 원문 통지·ChatUI 포커스).
- **검증**: lint 0 error / unit 374 / components 전건 / next build / iOS 시뮬레이터 빌드 그린. 잔여 실측(위원장): List NavigationLink 행 전체 탭 육안 확인(최소 44pt는 보장됨), BlockRenderer 리스트 마커 이중 낭독 확인(기존 이월 ②).

## 2026-07-20 — iOS WhatsApp식 홀드 받아쓰기 이식: 탭 토글 대체 + Lazy 스택 CPU 결함 선제 제거 (#109)

- **배경**: gildongmu 실기기 VoiceOver 검증 완료(2026-07-20, 위원장 합격)된 홀드 받아쓰기 계약을 이식. 진입점별 차등 — 전송형(채팅)=홀드+잠금+취소 풀 계약, 단일 확정형(위키 검색)=홀드 단일 동작.
- **`HoldDictationButton` 신설**: gildongmu 정본 1:1 이식(UIKit 인식기 계층 — `UILongPressGestureRecognizer` 0.25s + `UITapGestureRecognizer.require(toFail:)`, SwiftUI 제스처 조합은 List 팬 경합·VO pass-through 드래그 유실 실기기 확정으로 금지). 경합 가드 3종(finishInFlight·cancelInFlight·startTask await)·지배 축 슬라이드 판정(위 60pt=잠금, 왼쪽 60pt=취소)·녹음 시작 interrupting 무음 통지(진행 중 VO 낭독 절단)·녹음 중 라벨 불변(정적 "받아쓰기")·짧은 탭=사용법 안내·권한 미시작 세션 잠금 무통지(3-state) 전부 보존. webfortd 적응 2가지: i18n → 한국어 리터럴, 통지 → `Announce` 단일 채널 경유. webfortd `SpeechService`는 동일 엔진(SpeechAnalyzer)에 세대 토큰·stopping 가드가 이미 있어 무수정 재사용.
- **채팅(ChatView)**: 릴리스=초안 병합 즉시 전송(생성 중엔 초안 보존 폴백, `send` 가드 거부 시 초안 복원), 잠금=전사를 입력창에 병합 확정+"받아쓰기 잠김"+새 세그먼트 polite 통지(재홀드로 이어쓰기), 왼쪽 밀기=세션 전사만 취소. "텍스트 지우기" 버튼 신설(초안 있을 때만, 자기소거 시 입력 필드 포커스 선점 §5). 구 탭 토글(라벨 전환 신호)·`micTaskInFlight` 제거.
- **위키 검색(WikiHomeView)**: 홀드 단일 동작(잠금·취소 없음) — 릴리스=쿼리 대체+즉시 검색. 구 탭 토글의 금지 라벨 "음성 입력"도 함께 소거.
- **Lazy 스택 결함 선제 제거**: 채팅 메시지 리스트·BlockRenderer의 `LazyVStack`→eager `VStack`. gildongmu 실기기 cpu_resource 마이크로스택샷으로 확정된 결함 — 대화 몇 턴 후 lazy 레이아웃 캐시(LazySubviewPlacements) 크기 추정 진동이 메인 스레드 100% CPU 무한 루프(앱 먹통·VO 무응답). 히스토리 유한이라 eager가 정본, 화면 밖 AX 컬링(완료 포커스 실패·로터 누락 원인)도 함께 해소.
- **리뷰 fix (P1)**: 홀드 중 탭 이탈 시 인식기 `.cancelled`의 stop()이 onDisappear cancel()보다 stopping 가드를 선점하면 늦은 전사가 떠난 화면의 onTranscript로 배달(전역 통지+무확인 전송) — ChatView에 WikiHomeView 동형 `isVisible` 가드 이식.
- **검증**: Kit 49 그린 / 시뮬레이터 빌드 그린 / iPhone 실기기 배포 / **위원장 VoiceOver 실측 합격**(홀드 시 힌트 낭독 즉시 중단·잠금 통지·이어쓰기·병합 전송·취소·짧은 탭 안내) 후 머지.

## 2026-07-19 — iOS 채팅 VoiceOver 접근성 헌장 §6 정렬: R184 포커스 계약 이식 (#108)

- **배경**: dodo-planet R184(2026-07-19 실기기 판정)·gildongmu 역이식으로 확정된 대화형 UI 계약이 gildongmu 초기 클론 계열인 webfortd iOS 채팅에 전부 미반영 — §6 전 항목 기준 점검·이식.
- **포커스 계약 개정**: 전송 시 보내기 버튼 선점 이동·유지(구계약 "완료 시 답변으로 이동" 폐기), 완료 시에만 마지막 질문 헤딩 이동 — 질문 상단 스크롤 가시화 → 400ms 후 포커스 → 바인딩 nil 리셋(AX 컬링 실패 신호) 감지 시 재스크롤+1회 재시도. VO 실행 중엔 append·델타 스크롤도 질문 상단으로 목적지 단일화. 중단(stop)은 완료가 아님 — `ChatStore.stop()`이 세대를 올려 취소 Task의 완료 신호(`answerRevision` 신설)를 무효화, 포커스는 버튼에 유지.
- **컨트롤 정비**: 전송·중단 단일 버튼 라벨 교체(if/else 교체·`.disabled()` 폐기 — 포커스 쥔 요소 제거로 인한 VO 최상단 리셋 차단) / 질문 버블 `.isHeader`+포커스 바인딩 직접 부착(로터 헤딩 턴 점프) / 마이크 라벨 "받아쓰기 시작/중지"(내용-라벨 충돌 금지) / 받아쓰기 완료 침묵 금지(전사 append → 전송 버튼 자동 포커스 → 결과 원문 polite 통지; SpeechService는 자동 정지 경로가 없어 반환값 소비 유지) / 44pt frame label 안쪽+contentShape 전수(채팅 계열).
- **Announce 단일 채널**: dodo 슬림판 유틸 신설(실패는 interrupting), 전 앱 직접 `Announcement` 호출 15건 일원화. `ChatFocusDiag` 계측(DEBUG, VO 실착지 파일 로그 — 실기기 실패 시 가설 패치 금지·로그 우선) 동반.
- **리뷰 fix**: 스레드 전환·새 대화·로그아웃 시 완료 포커스 시퀀스 미취소 → stale 대입이 새 포커스를 걷어가는 레이스 — 명시 취소 3경로 + `sequenceStillValid`(대상 메시지 생존 확인) 구조 가드.
- **검증**: Kit 49 그린 / 시뮬레이터 빌드 그린 / 시뮬레이터 AX 브리지 실측 — 질문 `AXHeading`, 답변 단락·리스트 항목별 분리 + 본문 `AXHeading`, "받아쓰기 시작"·"전송" 라벨 노출, 긴 답변 시 질문 AX 컬링 재현(2단계 시퀀스 필요성 방증). **VO 포커스 이동은 위원장 실기기 판정 잔여**.
- **웹 점검 결과(수정 불요)**: §5 계열은 기패치 — 전송 시 입력창 포커스 유지 + 완료 시 질문 헤딩 이동(`useChatCompletionFocus`), 산문은 react-markdown 블록 노드라 분리 무관. §6 받아쓰기 신계약(결과 원문 통지+전송 버튼 포커스)은 dodo 웹에도 미적용인 계열이라 웹 후속으로 이월.
- **후속 이월**: 44pt 바깥 frame 채팅 외 7개 파일 잔존(동일 패턴 정비 후보) / BlockRenderer 리스트 마커 `•` 실기기 이중 낭독 여부 확인.

## 2026-07-18 — 음성 받아쓰기 gildongmu 이식: 웹 전면 개선 + iOS 신설 + 웹 검색 (#103·#104·#106)

- **웹 전면 gildongmu화 (#103)**: Web Audio 효과음 3종(상승=시작·하강=정지·단음=취소 — 기존 useSound는 무음 no-op) + useVoiceRecorder 견고화(오류 코드 6종 계약, busyRef 더블탭 잠금, mountedRef 언마운트 가드, AbortController fetch 취소, 핸들러 해제) + VoiceRecordButton 교체(시작/정지 음성 안내 제거 → 효과음+aria-label 변화가 상태 신호, 시작 성공 시 버튼 재포커스, Esc 취소 IME 가드; 120초 마일스톤 안내·성공 polite 통지는 유지) + 권한 사전 모달·훅 삭제(getUserMedia 네이티브 단일 경로) + transcribe 인식 실패 400→422.
- **iOS 채팅 받아쓰기 신설 (#103)**: gildongmu SpeechService 이식(iOS 26 SpeechAnalyzer 온디바이스 ko-KR, 서버 왕복·Deepgram 키 불필요, 소리+햅틱) + ChatView 마이크 버튼(전사 append — 웹과 동형, gildongmu의 대체와 의도적 차이) + NSMicrophoneUsageDescription.
- **iOS 위키 탭 검색 받아쓰기 (#104)**: 마이크 버튼은 목록 첫 행(toolbar는 VoiceOver가 제목보다 먼저 읽는 gildongmu 실측), **정지 = 쿼리 입력 + performSearch 즉시 실행**(검색 전용 계약, 채팅 append와 대비) + 탭 가시성 가드(정지 확정 중 탭 이탈 시 오프스크린 검색·전역 알림 차단).
- **웹 위키 홈 hero 검색창 받아쓰기 (#106)**: iOS 위키 탭 계약의 웹 이식. VoiceRecordButton에 `idleLabel`·`successMessage` 옵셔널 prop(기본값=채팅 카피, ChatUI 회귀 없음)만 열어 재사용. 웹 검색은 라이브 콤보박스라 **전사 완료 = 쿼리 대체 + 결과 팝오버 + 입력창 재포커스**(combobox 화살표 탐색 전제 — 리뷰 P1)만으로 "검색 버튼 효과" 성립, 건수는 기존 `role=status` 발화. 오류는 ChatUI 동형 role=alert+닫기. 헤더 소형 검색창은 제외(h-9에 44px 타깃 부적합, display:contents 래퍼로 DOM 기여 불변). vitest 5건(useVoiceRecorder mock·훅 옵션 캡처). production READY + 라이브 hero 버튼 확인.
- **리뷰 fix 3건 (#103)**: iOS 세대 토큰(cancel 후 늦은 start 완주가 마이크 재점화), 웹 cancelRecording 이중 stop() throw → busyRef 영구 잠김(try/catch+상태 확인), iOS stop/cancel stopping 상호 배제. **①③은 gildongmu 원본에도 동일 결함 — 백포트 권장(미실행)**.
- 검증: unit 374 / components 166 / lint 0 error / 웹·iOS 빌드 성공. production READY + transcribe 실스모크 200(conf 0.95). iPhone 13 Pro 배포 + **위원장 실 마이크 스모크 통과(채팅·위키 검색 모두)**.
- 부수: eslint가 SwiftPM `.build` 산출물을 스캔해 lint가 깨지던 환경 결함 영구 해결(globalIgnores).
- 운영 교훈: GitHub commit status "failure"(deployment blocked 링크)여도 Vercel 배포 목록엔 같은 커밋이 BUILDING→READY로 진행될 수 있음(Hobby 동시 빌드 제한의 일시 차단 추정) — status만으로 실패 단정 금지.

## 2026-07-17 — 프로덕션 배포 정상화: [...kb] catch-all 통합 (#100)

- **원인 규명**: 2026-06-18경부터 engccer Hobby의 전 배포가 `exceeded_serverless_functions_per_deployment`(배포당 함수 12개 제한)로 실패. `vercel build` 산출물 실측 — 유니크 함수 17개 중 9개가 KB 축별 `[slug]` 라우트(prerender 라우트는 라우트당 함수 1개 + 콘텐츠 트레이스 6,501파일이라 공유 람다 그룹핑 불가). 라우트 수가 많은 KB 구조 특성이 원인이라 dodo-planet(API 68개, 균일 설정 → 공유 람다)·gildongmu는 안 걸림.
- **무효 실험 2회 기록**: `dynamicParams=false`·`force-dynamic` 모두 함수 수 불변(17) — 렌더 모드가 아니라 라우트 수가 지배 변수.
- **해소**: 축 `[slug]` 라우트 9개 → `(wiki)/[...kb]/page.tsx` 단일 catch-all(경로 파서 + generateStaticParams 통합, 605페이지 프리렌더·Draft Mode 유지, URL 완전 불변) + `ResourcesDocView` 공용화. 함수 17→9개(실배포 람다 7개).
- **검증**: 프리뷰·프로덕션 배포 READY(한 달 만의 첫 성공), 실서비스 URL smoke(축·law 문서 200, 미지 slug 404, 정적 라우트 불변), 막혀 있던 #97 모션 변경 라이브 반영 확인. unit 370·components 166·a11y 33 그린.
- **영구 규칙**: 새 KB 문서 라우트는 파일 라우트 신설 금지 — `[...kb]` 파서에 추가(파일 라우트 1개 = 함수 1개).
- 1안(KHUDT Pro 재활성)은 위원장 보류 — Billing Reactivate 버튼 활성·카드 등록 확인 상태로 대기(PROGRESS.md §미결 결정).

## 2026-07-17 — 애니메이션·모션 전수 감사 (웹 #97 + iOS #98)

improve-animations 스킬 사이클(감사 → 플랜화 → 실행 → review-animations 기준 리뷰 → 머지)을 두 트랙 단일 세션 완결. 정본: `plans/web-animations/`(9건 반영 + 기각 8건 근거), `plans/ios-animations/`(1건 반영 + 기각 7건 근거).

### 웹 (#97, squash `01545a2`)
- **HIGH**: 데스크탑 사이드바 Cmd+B 토글의 width/padding-left 200ms 전환 제거(키보드 고빈도 + layout 속성) / `src/lib/motion.ts` 신설 — OS `prefers-reduced-motion`+앱 `reduce-motion` 클래스 이중 게이트를 채팅 StickToBottom·scrollIntoView 2곳·TOC에 적용(CSS 전면 차단이 못 잡는 JS 스크롤 공백 해소, 단위 테스트 6) / 레거시 진행률 바 width→scaleX(GPU 합성)
- **MEDIUM**: framer-motion(import 0건)·`@radix-ui/react-navigation-menu` 의존성 제거 + 미사용 sources.tsx·navigation-menu.tsx 삭제 / src 내 `transition-all` 12곳 명시 속성 전환 + Button `active:scale-[0.97]` 눌림 피드백 / `@theme --ease-out` 강화(cubic-bezier(0.23,1,0.32,1)) + 오버레이 7곳 ease-out 명시(tw-animate `--tw-ease` 체인 빌드 CSS 실측) / 검색 결과 listbox 진입 모션
- **LOW**: ThreadDrawer 시트 ease-out·열림300/닫힘200 / 인기 페이지 체브론 hover 이동 제거
- 검증: unit 370 / components 166 / a11y 33 그린. 리뷰 Approve(P1/P2 0건).

### iOS (#98, squash `ee516d1`)
- 감사 결론: 명시 모션 0·시스템 기본 전환의 극소 표면 — 실질 파인딩은 채팅 자동 스크롤 하드 점프 1건(Reduce Motion 유일 공백).
- ChatView `scrollToLastMessage` → `withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25))` 단일 호출. 시뮬레이터 프레임 정량 실측: RM OFF 7~11프레임 연속 곡선 vs RM ON 1프레임 점프 대조 확정.
- `ios/deploy-device.sh` 이식(dodo-planet byte-identical, 세 repo 동일본) + 실기기(iPhone 13 Pro) 설치·실행 검증.

### 운영 이슈 발견 (트랙 부산물)
- **프로덕션 배포 전면 실패 원인 확정**: engccer Hobby의 전 배포가 2026-06-18경부터 `exceeded_serverless_functions_per_deployment`(Hobby 함수 12개 제한)로 ERROR — 빌드 성공·patchBuild 거부. 현 서빙은 스테일 빌드, 이후 서버 변경 라이브 미반영. 해소 경로(KHUDT Pro 복귀 vs 함수 감축)는 PROGRESS.md §미결 결정.

## 2026-07-14 — 공식 사업 트랙 문서 갱신 (docs only)

- 과업요청서 최종본(§1~§9 + 부록 A·B) 중부대 전달 반영: CLAUDE.md 사업 맥락·핵심 자문 문서 표, DIRECTION_2026.md §11 진행 상태, PROGRESS.md 공식 사업 트랙 항목.
- 공식 웹앱 올해 범위에서 일반 이용자 로그인·대화 기록 저장·고충상담 제외(교육부 개인정보 협의) 기록 — webfortd는 독립 트랙으로 해당 기능 유지.
- §앱 정체성의 구 시나리오 A(중부대 이관)/B를 2026-06-05 재포지셔닝의 두 미래 경로 A(레퍼런스)/B(장교조 편입)로 갱신.
- **공개 저장소 비기재 원칙 신설·소급 적용**: 수행 후보 업체 실명·개인 신상을 public repo 문서에서 중립화(CLAUDE.md·AGENTS.md 변경 이력, DIRECTION_2026.md §11, 스펙 2건). 정본은 장교조 자문 디렉터리.

## 2026-07-10 — iOS 네이티브 앱 v1 코딩 완료 (PR #87~#91)

단일 세션에서 설계(spec) → 마일스톤별 plan → subagent-driven 구현 → 3중 리뷰(태스크·whole-branch·coderabbit) → 머지까지 완주. 라이브 음성 채팅은 위원장 지시로 M5 보류(dodo-planet Live 오류 선수정 후 이식).

### M0 — 오프라인 위키 (#87)
- `ios/` 트리 신설: WebfortdKit(SPM, UI 비의존, macOS `swift test`) + SwiftUI 앱 + 수동 최소 pbxproj(폴더 동기화 그룹).
- 콘텐츠 번들 파이프라인(`ios/scripts/bundle-content.mjs`): published 535건 + 축소 kb-index, 결정적 출력.
- 위키 3화면(축 카드 → 가나다 목록 → 문서 렌더러). swift-markdown 0.8.0 기반 블록 AST(표 지원 — 코퍼스 161건이 표 사용).
- 리뷰 fix: 스크린리더 낭독 정본(plain)의 HTML 태그 누출 3계층 차단(`<br/>` 인라인 / 블록 HTML / 언더스코어 의사 태그 `<page_header>` — CommonMark 태그명 문법상 HTML 미인식 사각지대), 문서 제목 이중 낭독 제거(코퍼스 98.3% 발생).

### M1 — 오프라인 검색·백링크·홈 완성 (#88)
- KBSearch: AND 토큰 매치·제목 가중 결정적 정렬·발췌. 검색·발췌 모두 파싱된 plain 정본(리뷰가 raw 마크다운 발췌 노이즈 44%·`\r` 문제를 잡아 구조 수정, 원본 대소문자 보존).
- 홈 `.searchable` submit 검색(3-state + 결과 수 단일 통지), 오늘의 위키(전 문서 순환 — day%count의 169건 영구 미노출 결함 수정), 문서 백링크 섹션.

### M2 — RAG 채팅 (#89)
- Kit Chat 계층: AI SDK v6 UIMessage SSE 파서 + ChatAPI(`URLSession.bytes.lines`). 계약은 prod 실캡처 fixture 정본, 미지 이벤트 무시.
- TabView(위키·채팅) + ChatStore(재진입 가드·세대 카운터·중단) + BlockRenderer 재사용 마크다운 렌더.
- 출처 카드 → 번들 위키 문서 즉시 push(네이티브 차별화). 첨부(이미지 JPEG 재인코딩·PDF, 1건·10MB, 웹 계약 미러) — 실호출 이미지 인식 end-to-end 실증.
- 리뷰 fix: 오류 문구의 대화 이력 서버 재전송 차단(isError), 첨부 비동기 로드 race·대용량 메인 스레드 로드 해소, 빈 중단 메시지 제거.

### M3 — OTP 인증·서버 Bearer·채팅 이력 (#90)
- **서버**: `getRequestAuth()` Bearer 이중 인증(dodo-planet 패턴 — 무효 토큰은 쿠키 폴백 없이 거부) + 신규 `GET /api/chat/threads/[id]`(이력 복원). 웹 쿠키 흐름 무회귀(`npm test` 364).
- **iOS**: supabase-swift 2.50(앱 타깃 전용) OTP 코드 로그인(매직링크 금지 영구 결정 준수), 대화 목록·복원·이어가기(threadId), 로그아웃 시 익명 휘발 복귀.
- 리뷰 fix(Critical, 실 DB 실측): `source_refs`가 `JSON.stringify`로 jsonb 문자열 이중 인코딩 저장 → 이력 복원 전면 실패였을 결함. RPC 객체 직접 바인딩 + 읽기 방어 정규화. production 잔존 행 0건(backfill 불요). 그 외 UUID 그룹핑 검증, Bearer 스킴 대소문자(RFC 7235), bootstrap 상태 잔류(scenePhase 재시도), 대화 선택 재진입 가드.

### M4 — 자료실·미디어·설정 5탭 완성 (#91)
- 카탈로그 번들 추출(library.json 4건·media.json 1건, 웹 TS 배열 정본·published 미러·env fail-fast).
- 자료실: PDF 다운로드(받기/중단/열기 3-state, slug별 세대 가드) + Caches 오프라인 캐시(퍼지 시 열기 시점 재검증·강등) + QuickLook + 삭제 액션.
- 미디어: 이미지 온라인 로드 + alt 정본 + 출처 문서 push. 설정: 계정·콘텐츠 기준일·앱 정체성 문구·웹 링크.
- `docs/IOS_DISTRIBUTION.md`: Developer Program 가입 이후 TestFlight·심사 절차 정본(가입 자체는 비용 하드 스톱).

### 문서·메모리
- spec/plan 6개 문서 커밋, CLAUDE.md(iOS 트랙 원칙·구조·명령), PROGRESS.md·CHANGELOG.md 신설, 세션 메모리 갱신.
