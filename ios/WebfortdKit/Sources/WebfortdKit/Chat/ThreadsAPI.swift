import Foundation

/// 로그인 사용자의 대화 목록 1건. 서버 `GET /api/chat/threads`
/// (`src/app/api/chat/threads/route.ts` — `.select('id, title, updated_at')`) 응답 shape 미러.
public struct ChatThreadSummary: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let updatedAt: String

    private enum CodingKeys: String, CodingKey {
        case id, title
        case updatedAt = "updated_at"
    }

    public init(id: String, title: String, updatedAt: String) {
        self.id = id
        self.title = title
        self.updatedAt = updatedAt
    }
}

/// 대화 이력 메시지 1건. 서버 `GET /api/chat/threads/{id}`
/// (`src/app/api/chat/threads/[id]/route.ts` — `.select('id, role, content, source_refs, created_at')`)
/// 응답 중 앱이 필요로 하는 필드만 취한다(`id`·`created_at`은 Kit 인터페이스에서 미사용, Codable이 무시).
/// `source_refs`는 jsonb 배열 컬럼이라 값이 없거나(NULL) 키 자체가 빠질 수 있어 커스텀 디코딩으로 `[]` 기본값을 보장한다.
public struct ChatThreadMessage: Codable, Equatable, Sendable {
    public let role: String
    public let content: String
    public let sourceRefs: [ChatSourceRef]

    private enum CodingKeys: String, CodingKey {
        case role, content
        case sourceRefs = "source_refs"
    }

    public init(role: String, content: String, sourceRefs: [ChatSourceRef]) {
        self.role = role
        self.content = content
        self.sourceRefs = sourceRefs
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = try container.decode(String.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        sourceRefs = try container.decodeIfPresent([ChatSourceRef].self, forKey: .sourceRefs) ?? []
    }
}

/// `ThreadsAPI` 호출이 던지는 오류. 그 외 네트워크·디코딩 오류는 그대로 전파된다.
public enum ThreadsAPIError: Error, Equatable {
    case unauthorized      // 401
    case notFound          // 404
    case server(status: Int)
}

/// 로그인 사용자의 대화 이력 조회(`ChatAPI`와 분리 — Kit는 Supabase에 무의존이라
/// 토큰 발급은 앱 레이어 책임, `tokenProvider`로만 주입받는다). `ChatAPI`와 달리
/// 익명 호출 개념이 없어 `tokenProvider`가 필수 인자다.
public struct ThreadsAPI: Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: @Sendable () async -> String?

    public init(baseURL: URL, session: URLSession = .shared,
                tokenProvider: @escaping @Sendable () async -> String?) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    /// `GET /api/chat/threads` — 무효 토큰도 서버가 200 빈 배열로 응답하므로(주석: route.ts)
    /// 클라이언트는 상태코드 분기 없이 그대로 디코딩한다.
    public func list() async throws -> [ChatThreadSummary] {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/chat/threads"))
        request.httpMethod = "GET"
        await attachAuthorization(to: &request)

        let (data, response) = try await session.data(for: request)
        try Self.validate(response: response)
        return try JSONDecoder().decode(ThreadsListResponse.self, from: data).threads
    }

    /// `GET /api/chat/threads/{id}` — 401(비로그인)·404(미존재·타인 소유는 RLS로 미존재 취급)를 구분해 던진다.
    public func messages(threadId: String) async throws -> (title: String, messages: [ChatThreadMessage]) {
        var request = URLRequest(
            url: baseURL.appendingPathComponent("api/chat/threads/\(threadId)"))
        request.httpMethod = "GET"
        await attachAuthorization(to: &request)

        let (data, response) = try await session.data(for: request)
        try Self.validate(response: response)
        let decoded = try JSONDecoder().decode(ThreadDetailResponse.self, from: data)
        return (decoded.thread.title, decoded.messages)
    }

    private func attachAuthorization(to request: inout URLRequest) async {
        if let token = await tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private static func validate(response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ThreadsAPIError.server(status: -1)
        }
        switch httpResponse.statusCode {
        case 200..<300:
            return
        case 401:
            throw ThreadsAPIError.unauthorized
        case 404:
            throw ThreadsAPIError.notFound
        default:
            throw ThreadsAPIError.server(status: httpResponse.statusCode)
        }
    }

    private struct ThreadsListResponse: Decodable {
        let threads: [ChatThreadSummary]
    }

    private struct ThreadDetailResponse: Decodable {
        struct Thread: Decodable {
            let id: String
            let title: String
        }
        let thread: Thread
        let messages: [ChatThreadMessage]
    }
}
