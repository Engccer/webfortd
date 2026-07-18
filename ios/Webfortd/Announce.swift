import SwiftUI

/// 접근성 헌장의 "단일 polite live region" 불변식을 iOS에 적용한 단일 통지 채널(dodo-planet
/// `Announce` 슬림판 — 라이브 음성 마이크 게이팅 시간창은 M5 보류라 미이식, API는 동일).
///
/// 전 앱에서 VoiceOver 상태 통지(진행·완료·오류)는 반드시 이 유틸을 거치고,
/// `AccessibilityNotification.Announcement`를 다른 곳에서 직접 호출하지 않는다.
/// 통지 채널을 하나로 유지해야 발화가 겹치거나 경합하지 않는다.
enum Announce {
    /// 메시지를 VoiceOver로 통지한다.
    /// - Parameters:
    ///   - message: 통지할 텍스트.
    ///   - interrupting: `true`면 현재 발화 중인 내용을 끊고 우선 발화한다.
    ///     차단 오류처럼 즉시 알려야 하는 경우에만 사용하고, 일반 상태 통지는 남발하지 않는다(기본값 `false`).
    static func post(_ message: String, interrupting: Bool = false) {
        guard interrupting else {
            AccessibilityNotification.Announcement(message).post()
            return
        }
        var attributed = AttributedString(message)
        attributed.accessibilitySpeechAnnouncementPriority = .high
        AccessibilityNotification.Announcement(attributed).post()
    }
}
