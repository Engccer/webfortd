import Foundation

/// Webfortd `/api/chat` 스트리밍 호출. dodo-planet `ChatAPI` 패턴을 따른다 —
/// `URLSession.bytes(for:)` + `bytes.lines`로 SSE를 줄 단위 소비하고,
/// 소비자 `Task` 취소가 `onTermination`을 통해 내부 네트워크 `Task`까지 전파된다.
public struct ChatAPI: Sendable {
    private let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    /// `messages` 전체(대화 이력 포함)를 UIMessage JSON으로 인코딩해 POST, 이벤트 스트림 반환.
    public func stream(
        messages: [ChatOutgoingMessage], threadId: String?
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    try await Self.run(
                        messages: messages, threadId: threadId,
                        baseURL: baseURL, session: session, continuation: continuation)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private static func run(
        messages: [ChatOutgoingMessage],
        threadId: String?,
        baseURL: URL,
        session: URLSession,
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encodeBody(messages: messages, threadId: threadId)
        request.timeoutInterval = 60

        let (bytes, response) = try await session.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatAPIError.server(status: -1)
        }
        guard httpResponse.statusCode != 429 else {
            throw ChatAPIError.rateLimited
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw ChatAPIError.server(status: httpResponse.statusCode)
        }

        for try await line in bytes.lines {
            guard let event = ChatStreamParser.parse(line: line) else { continue }
            continuation.yield(event)
        }
    }

    /// UIMessage 인코딩: `{"messages":[{"id":<uuid>,"role":role,"parts":[{"type":"text","text":text}, <file part>?]}], "threadId"?}`.
    /// 첨부가 있으면 text part 뒤에 file part(`{type:"file", mediaType, url:"data:<mime>;base64,...", filename}`)를
    /// 이어 붙인다(웹 `ChatUI.tsx` `files:[{type:'file', ...}]` 계약 미러).
    private static func encodeBody(messages: [ChatOutgoingMessage], threadId: String?) throws -> Data {
        let payload = UIMessagesPayload(
            messages: messages.map { message in
                var parts: [UIMessagesPayload.Part] = [.text(message.text)]
                if let attachment = message.attachment {
                    parts.append(.file(
                        mediaType: attachment.mediaType,
                        url: "data:\(attachment.mediaType);base64,\(attachment.dataBase64)",
                        filename: attachment.filename))
                }
                return UIMessagesPayload.Message(id: UUID().uuidString, role: message.role, parts: parts)
            },
            threadId: threadId)
        return try JSONEncoder().encode(payload)
    }

    private struct UIMessagesPayload: Encodable {
        enum Part: Encodable {
            case text(String)
            case file(mediaType: String, url: String, filename: String)

            private enum CodingKeys: String, CodingKey {
                case type, text, mediaType, url, filename
            }

            func encode(to encoder: Encoder) throws {
                var container = encoder.container(keyedBy: CodingKeys.self)
                switch self {
                case .text(let text):
                    try container.encode("text", forKey: .type)
                    try container.encode(text, forKey: .text)
                case .file(let mediaType, let url, let filename):
                    try container.encode("file", forKey: .type)
                    try container.encode(mediaType, forKey: .mediaType)
                    try container.encode(url, forKey: .url)
                    try container.encode(filename, forKey: .filename)
                }
            }
        }
        struct Message: Encodable {
            let id: String
            let role: String
            let parts: [Part]
        }
        let messages: [Message]
        let threadId: String?

        enum CodingKeys: String, CodingKey {
            case messages, threadId
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(messages, forKey: .messages)
            try container.encodeIfPresent(threadId, forKey: .threadId)
        }
    }
}
