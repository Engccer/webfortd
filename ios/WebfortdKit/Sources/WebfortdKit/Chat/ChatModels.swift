import Foundation

/// 채팅 답변의 근거 출처 1건. 웹 `/api/chat` `messageMetadata.sourceRefs` 미러.
public struct ChatSourceRef: Codable, Equatable, Sendable {
    public let slug: String
    public let title: String
    public let axis: String      // KBAxis rawValue와 호환되나 신규 축 대비 String
    public let type: String
    public let href: String
}

/// 채팅 첨부 파일 1건(이미지·PDF, 최대 1건). 서버 계약(웹 `/api/chat` 미러):
/// UIMessage file part `{type:"file", mediaType, url:"data:<mime>;base64,<...>", filename}`.
/// HWP류는 v1 iOS 미지원. 클라이언트가 이미지·PDF만 생성한다(선택 UI 단계에서 이미 제한).
public struct ChatAttachment: Sendable, Equatable {
    public let mediaType: String   // "image/jpeg" | "application/pdf"
    public let dataBase64: String
    public let filename: String

    public init(mediaType: String, dataBase64: String, filename: String) {
        self.mediaType = mediaType
        self.dataBase64 = dataBase64
        self.filename = filename
    }
}

/// 클라이언트 → 서버 전송용 메시지 1건. `ChatAPI.stream`이 UIMessage로 인코딩한다.
public struct ChatOutgoingMessage: Sendable {
    public let role: String      // "user" | "assistant"
    public let text: String
    public let attachment: ChatAttachment?

    public init(role: String, text: String, attachment: ChatAttachment? = nil) {
        self.role = role
        self.text = text
        self.attachment = attachment
    }
}

/// `ChatAPI.stream`이 던지는 오류. 그 외 네트워크 오류는 URLSession 오류가 그대로 전파된다.
public enum ChatAPIError: Error, Equatable {
    case rateLimited            // 429
    case server(status: Int)    // 그 외 non-2xx
}
