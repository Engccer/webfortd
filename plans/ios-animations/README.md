# iOS 네이티브 앱 애니메이션 개선 플랜 (2026-07-17 감사 기반)

`improve-animations` 스킬 감사(commit 01545a2)의 iOS 트랙. 웹 트랙(`plans/web-animations/`, PR #97)과 동형 사이클, 단일 세션 완결. dodo-planet iOS 트랙(R180)과 같은 검증 기법(시뮬레이터 cliclick 좌표 탭 + `simctl recordVideo` 프레임 정량 분석)을 재사용한다.

## 감사 요약 (정찰 결과)

iOS 코드베이스(`ios/` SwiftUI 소스 39파일)는 **명시적 모션이 0**이다: `withAnimation`·`.animation`·`.transition`·`symbolEffect`·`contentTransition`·spring·UIKit/CA 애니메이션 전부 0건. 화면 전환(sheet/NavigationStack/TabView)은 시스템 기본이라 진입·exit 대칭과 Reduce Motion을 OS가 보장한다. 따라서 이징·지속·물리성·무한 모션·중단가능성 축은 **위반 0건**이고, 실질 파인딩은 채팅 자동 스크롤 하드 점프 1건(= Reduce Motion 게이트의 유일한 공백이기도 함)에 수렴한다. "모션이 이미 옳다"가 이 감사의 대부분을 차지하는 유효 결과다.

## 플랜 목록

| # | 제목 | 심각도 | Status |
| --- | --- | --- | --- |
| 001 | 채팅 자동 스크롤 withAnimation + Reduce Motion 게이트 | MEDIUM | DONE |

## 부수 작업 (같은 PR)

- `ios/deploy-device.sh` 이식: dodo-planet의 워크스페이스 공통 제네릭 판(xcodeproj 자동 탐지, 세 repo 동일본 규칙)을 복사. webfortd는 Personal Team 자동 서명이라 `-allowProvisioningUpdates`로 그대로 동작 예상.

## 실측 결과 (2026-07-17, 시뮬레이터 iPhone 17 Pro 프레임 정량 분석)

이 머신에서 Simulator.app이 창을 만들지 못해(AppleScript window 0 지속) cliclick 좌표 탭 대신 **DEBUG 전용 임시 스크롤 프로브**(로컬 메시지 400ms 간격 주입, 측정 후 revert — 커밋 안 됨)로 무접촉 구동했고, `simctl recordVideo` 30fps 프레임 차분(본문 ROI 평균 절대차)으로 판정했다:

- **Reduce Motion OFF**: 스크롤 발동 지점이 7~11프레임(약 250~350ms) 연속 이동 곡선(runs [10, 11, 7, 8]) — `withAnimation(.easeOut(0.25))` 추적 스크롤 실작동. 콘텐츠가 뷰포트를 넘기 전 델타는 1프레임 텍스트 추가(스크롤 불필요 구간, 정상).
- **Reduce Motion ON**(`ReduceMotionEnabled` + 앱 재실행): 동일 이벤트가 전부 1프레임 점프(다프레임 run 소멸, 단독 스파이크 14.7 등) — 게이트 동작 확정, 기존 즉시 점프 보존.

## 리뷰 결과 (2026-07-17, code-reviewer × review-animations 기준)

**Approve — P1/P2 0건.** Reduce Motion 게이트 정확("움직임이 유일 속성이라 즉시 점프 = 올바른 적용"), streamTick 연타는 constant-motion 성격 + retarget 중단가능성으로 무해 판정, ease-out은 iOS 관성 감속 관용구 정합. P3 2건 처리:

- **중복 scrollTo 분기**: 반영 — dodo-planet 선례와 동일한 `withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25))` 단일 호출로 정리.
- **deploy-device.sh 주석 em dash 2곳**: 수용(잔존). dodo-planet 원본 byte-identical 복사본 — 세 repo 동일본 규칙상 단독 수정이 오히려 드리프트. 고칠 경우 세 repo 동시 수정 전제.

## 감사 시 기각된 항목 (재론 방지, 근거 포함)

- **시스템 화면 전환(sheet·NavigationStack·TabView·Toggle)**: OS가 모션·Reduce Motion 모두 보장 — 손대지 않는 것이 정답.
- **자료실 다운로드 상태 스왑(notCached→downloading→cached)**: 콘텐츠 교체는 정보 변화이지 공간 이동이 아님(dodo R180 "sendState 전환 기각"과 동일 계열, 미니멀리즘).
- **RemoteImageView(AsyncImage) 이미지 pop-in 페이드**: 장식적 추가 — 표준 iOS 관용구 유지.
- **ProgressView 스피너**: 시스템 표준 로딩 관용구(Reduce Motion도 시스템 처리).
- **채팅 메시지 삽입 transition**: 자동 스크롤(001)이 등장을 전달 — 삽입 페이드는 스크롤과 경합해 이중 모션(dodo R180 동일 기각).
- **스트리밍 텍스트 contentTransition**: 노이즈.
- **symbolEffect·심볼 교체 전환**: 토글형 심볼 표면 자체가 없음(음성은 M5 보류, 설정은 시스템 Toggle).
