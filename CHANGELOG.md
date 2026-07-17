# CHANGELOG

> 날짜별 변경 이력(마일스톤 경계 갱신). 2026-07-10 이전 이력은 git log와 CLAUDE.md §Phase 진행 요약이 정본(지연 생성 원칙에 따라 이 파일은 iOS 트랙 진입 시점부터 시작).

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
