# 001 — 채팅 자동 스크롤에 withAnimation + Reduce Motion 게이트

- **Status**: DONE
- **Commit**: 01545a2
- **Severity**: MEDIUM
- **Category**: 8 누락 기회 + 6 접근성
- **Estimated scope**: 1 file (ios/Webfortd/Chat/ChatView.swift)

## Problem

채팅의 하단 추적 스크롤이 애니메이션 없는 하드 점프다. 새 메시지 등장(count 변화)과 스트리밍 델타(streamTick)마다 화면이 순간 이동해 시각 사용자에게 튀는 느낌을 주고, 웹 트랙(스무스 추적 스크롤 + reduced-motion 게이트, plans/web-animations/002)과 플랫폼 간 비대칭이다. iOS 코드베이스 전체에 `withAnimation`·`accessibilityReduceMotion` 사용이 0건이라 Reduce Motion 대응 축도 이 지점이 유일한 공백이다(나머지 화면 전환은 전부 시스템 기본이라 OS가 보장).

```swift
// ios/Webfortd/Chat/ChatView.swift:117-126 — 현재
            .onChange(of: chatStore.messages.count) { _, _ in scrollToLastMessage(proxy) }
            // 스트리밍 델타마다 하단으로 추적 스크롤(시각 사용자용). VoiceOver 포커스 이동은
            // 완료 시 1회(위 onChange(of: chatStore.phase))만 처리하므로 이 스크롤과 무관하다.
            .onChange(of: chatStore.streamTick) { _, _ in scrollToLastMessage(proxy) }
        }
    }

    private func scrollToLastMessage(_ proxy: ScrollViewProxy) {
        guard let lastId = chatStore.messages.last?.id else { return }
        proxy.scrollTo(lastId, anchor: .bottom)
    }
```

## Target

`withAnimation(.easeOut(duration: 0.25))`로 부드러운 추적 스크롤을 만들되, OS "동작 줄이기"가 켜져 있으면 현재의 즉시 점프를 유지한다. `withAnimation`은 transition 계열이라 연속 호출 시 현재 위치에서 retarget(중단 가능) — 스트리밍 델타 연타에도 0부터 재시작하지 않는다.

```swift
// ChatView struct 프로퍼티에 추가 (기존 @AccessibilityFocusState 근처)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

// scrollToLastMessage — 목표
    private func scrollToLastMessage(_ proxy: ScrollViewProxy) {
        guard let lastId = chatStore.messages.last?.id else { return }
        // 동작 줄이기 사용자는 즉시 점프가 정답 — 애니메이션 분기만 다르고 도착 상태는 동일.
        if reduceMotion {
            proxy.scrollTo(lastId, anchor: .bottom)
        } else {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo(lastId, anchor: .bottom)
            }
        }
    }
```

## Repo conventions to follow

- SwiftUI 뷰 프로퍼티 순서·한국어 주석 관례는 파일 상단 기존 코드(`@AccessibilityFocusState` 주석 스타일)를 따른다.
- dodo-planet iOS 동형 선례: `dodo-planet/plans/ios-animations/001-reduce-motion-autoscroll.md` (같은 게이트 패턴, R180 실측 검증됨).

## Steps

1. `ios/Webfortd/Chat/ChatView.swift`에 `@Environment(\.accessibilityReduceMotion) private var reduceMotion` 프로퍼티 추가.
2. `scrollToLastMessage`를 위 Target 코드로 교체.

## Boundaries

- VoiceOver 포커스 이동 로직(`onChange(of: chatStore.phase)`·`threadLoadTick`·`focusedMessageId`)은 절대 건드리지 않는다 — 스크롤 애니메이션과 독립임이 주석으로 보장된 구조.
- onChange 트리거 2곳(count·streamTick)의 구조 변경 금지 — 함수 내부만 수정.
- WebfortdKit(SPM) 변경 금지. 새 의존성 금지. 드리프트 시 STOP.

## Verification

- **Mechanical**: `swift test --package-path ios/WebfortdKit` 49개 그린(무관하지만 회귀 게이트), `xcodebuild -project ios/Webfortd.xcodeproj -scheme Webfortd -destination 'platform=iOS Simulator,name=iPhone 17' build` 성공.
- **실측 (시뮬레이터 프레임 정량 분석)**: `simctl io booted recordVideo` + ffmpeg 30fps 프레임 추출로:
  - 기본 상태: 채팅 전송 후 스크롤이 다프레임(약 7~8프레임/250ms) 연속 이동 곡선 — 1프레임 점프가 아님.
  - `xcrun simctl spawn booted defaults write com.apple.Accessibility ReduceMotionEnabled -bool true` + 앱 재실행 후: 스크롤이 사실상 1프레임 점프(기존 동작 보존).
- **Feel check**: 스트리밍 중 연속 델타에도 스크롤이 미끄러지듯 따라가고 덜컥거림(재시작) 없음. VoiceOver 켜고 완료 시 포커스가 답변 첫 메시지로 이동하는 기존 동작 불변.
- **Done when**: 두 실측 모두 프레임 증거 확보 + 빌드·테스트 그린.
