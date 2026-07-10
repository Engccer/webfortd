import Foundation

enum AppConfig {
    /// 문서 내 이미지의 원격 base. 오프라인이면 alt 텍스트가 정본.
    #if DEBUG
    static let webBaseURL = URL(string:
        ProcessInfo.processInfo.environment["WEBFORTD_BASE_URL"] ?? "https://webfortd.vercel.app")!
    #else
    static let webBaseURL = URL(string: "https://webfortd.vercel.app")!
    #endif
}
