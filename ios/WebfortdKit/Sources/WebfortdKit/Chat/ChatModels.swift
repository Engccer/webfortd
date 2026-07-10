import Foundation

/// 채팅 답변의 근거 출처 1건. 웹 `/api/chat` `messageMetadata.sourceRefs` 미러.
public struct ChatSourceRef: Codable, Equatable, Sendable {
    public let slug: String
    public let title: String
    public let axis: String      // KBAxis rawValue와 호환되나 신규 축 대비 String
    public let type: String
    public let href: String
}

/// 클라이언트 → 서버 전송용 메시지 1건. `ChatAPI.stream`이 UIMessage로 인코딩한다.
public struct ChatOutgoingMessage: Sendable {
    public let role: String      // "user" | "assistant"
    public let text: String

    public init(role: String, text: String) {
        self.role = role
        self.text = text
    }
}

/// `ChatAPI.stream`이 던지는 오류. 그 외 네트워크 오류는 URLSession 오류가 그대로 전파된다.
public enum ChatAPIError: Error, Equatable {
    case rateLimited            // 429
    case server(status: Int)    // 그 외 non-2xx
}
