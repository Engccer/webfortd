import Foundation

enum AppConfig {
    /// 문서 내 이미지의 원격 base. 오프라인이면 alt 텍스트가 정본.
    #if DEBUG
    /// 디버그는 WEBFORTD_BASE_URL env로 주입 가능. 파싱 불가 값이면 릴리스 기본값으로 폴백.
    static let webBaseURL: URL = {
        if let raw = ProcessInfo.processInfo.environment["WEBFORTD_BASE_URL"],
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "https://webfortd.vercel.app")!
    }()
    #else
    static let webBaseURL = URL(string: "https://webfortd.vercel.app")!
    #endif
}
