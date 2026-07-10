import Foundation
import Testing
@testable import WebfortdKit

/// 전역 stub 핸들러. gildongmu `StubURLProtocol` 관례(전역 handler + `nonisolated(unsafe)`)를 따른다.
/// `startLoading()`은 세션 delegate 큐에서 실행되므로 handler를 공유하는 테스트는 직렬 실행이 필요하다.
final class ChatStubURLProtocol: URLProtocol {
    struct Stub {
        let statusCode: Int
        let chunks: [Data]
    }

    nonisolated(unsafe) static var handler: ((URLRequest) -> Stub)?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let stub = Self.handler!(request)
        let response = HTTPURLResponse(
            url: request.url!, statusCode: stub.statusCode, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        // 실캡처 SSE를 고정 크기 청크로 분할 전달해 bytes.lines가 청크 경계를 넘나드는
        // 개행을 재조립하는 경로를 실제로 태운다(응답 전체를 한 번에 didLoad 하지 않음).
        for chunk in stub.chunks {
            client?.urlProtocol(self, didLoad: chunk)
        }
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private func chunked(_ data: Data, size: Int = 48) -> [Data] {
    guard !data.isEmpty else { return [] }
    return stride(from: 0, to: data.count, by: size).map { offset in
        data.subdata(in: offset..<min(offset + size, data.count))
    }
}

/// 요청 본문 읽기 헬퍼. `URLSession.bytes(for:)` 경로는 작은 `httpBody` Data도 내부적으로
/// `httpBodyStream`으로 변환해 URLProtocol에 전달하므로(실측), 두 경로 모두 대비한다.
private func requestBodyData(_ request: URLRequest) -> Data {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return Data() }
    stream.open()
    defer { stream.close() }
    var data = Data()
    let bufferSize = 4096
    var buffer = [UInt8](repeating: 0, count: bufferSize)
    while stream.hasBytesAvailable {
        let read = stream.read(&buffer, maxLength: bufferSize)
        guard read > 0 else { break }
        data.append(buffer, count: read)
    }
    return data
}

/// 스텁 handler는 URLSession 내부 큐에서 실행되어 `#expect`가 실행 중인 테스트에 귀속되지
/// 않는다(실측: 실패해도 테스트가 그대로 통과 처리됨). 요청을 캡처만 해 두고, 검증은
/// 테스트 본문(async 컨텍스트)에서 수행한다.
private final class CapturedRequestBox: @unchecked Sendable {
    var request: URLRequest?
}

/// ChatStubURLProtocol.handler가 전역 공유 상태라 스텁 사용 테스트는 이 스위트에서 직렬 실행한다.
@Suite(.serialized) struct ChatAPITests {
    private let baseURL = URL(string: "https://example.test")!

    private func stubbedAPI() -> ChatAPI {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ChatStubURLProtocol.self]
        return ChatAPI(baseURL: baseURL, session: URLSession(configuration: config))
    }

    private func fixtureData() throws -> Data {
        let url = try #require(Bundle.module.url(
            forResource: "Fixtures/chat-stream", withExtension: "sse"))
        return try Data(contentsOf: url)
    }

    @Test func 스트림이_텍스트_메타데이터_finish를_분할_전달_경로로_복원한다() async throws {
        let chunks = chunked(try fixtureData())
        ChatStubURLProtocol.handler = { _ in .init(statusCode: 200, chunks: chunks) }

        var events: [ChatStreamEvent] = []
        for try await event in stubbedAPI().stream(
            messages: [ChatOutgoingMessage(role: "user", text: "보조공학기기 지원 절차가 궁금해요")],
            threadId: nil
        ) {
            events.append(event)
        }

        let text = events.compactMap { event -> String? in
            if case .textDelta(let delta) = event { return delta }
            return nil
        }.joined()
        #expect(text.hasPrefix("한국장애인고용공단을 통해"))

        guard case .metadata(let sourceRefs, let threadId)? = events.first(where: {
            if case .metadata = $0 { return true }
            return false
        }) else {
            Issue.record("metadata 이벤트가 있어야 합니다.")
            return
        }
        #expect(sourceRefs.count == 3)
        #expect(sourceRefs.first?.slug == "2024-jbu-p-016")
        #expect(threadId == nil)
        #expect(events.last == .finish)
    }

    @Test func 첨부가_있으면_text_파트_뒤에_file_파트를_추가로_인코딩한다() async throws {
        let box = CapturedRequestBox()
        ChatStubURLProtocol.handler = { request in
            box.request = request
            return .init(statusCode: 200, chunks: [])
        }

        let attachment = ChatAttachment(mediaType: "image/jpeg", dataBase64: "AAAA", filename: "photo.jpg")
        let message = ChatOutgoingMessage(
            role: "user", text: "이 이미지에 뭐라고 쓰여 있어?", attachment: attachment)
        for try await _ in stubbedAPI().stream(messages: [message], threadId: nil) {}

        let request = try #require(box.request)
        let json = try JSONSerialization.jsonObject(with: requestBodyData(request)) as? [String: Any]
        let messages = try #require(json?["messages"] as? [[String: Any]])
        let parts = try #require(messages.first?["parts"] as? [[String: Any]])
        #expect(parts.count == 2)
        #expect(parts[0]["type"] as? String == "text")
        #expect(parts[0]["text"] as? String == "이 이미지에 뭐라고 쓰여 있어?")
        #expect(parts[1]["type"] as? String == "file")
        #expect(parts[1]["mediaType"] as? String == "image/jpeg")
        #expect(parts[1]["filename"] as? String == "photo.jpg")
        #expect(parts[1]["url"] as? String == "data:image/jpeg;base64,AAAA")
    }

    @Test func 첨부가_없으면_file_파트를_추가하지_않는다() async throws {
        let box = CapturedRequestBox()
        ChatStubURLProtocol.handler = { request in
            box.request = request
            return .init(statusCode: 200, chunks: [])
        }

        for try await _ in stubbedAPI().stream(
            messages: [ChatOutgoingMessage(role: "user", text: "첨부 없는 질문")], threadId: nil
        ) {}

        let request = try #require(box.request)
        let json = try JSONSerialization.jsonObject(with: requestBodyData(request)) as? [String: Any]
        let messages = try #require(json?["messages"] as? [[String: Any]])
        let parts = try #require(messages.first?["parts"] as? [[String: Any]])
        #expect(parts.count == 1)
        #expect(parts[0]["type"] as? String == "text")
    }

    @Test func rate_limit_429_응답은_rateLimited_오류를_던진다() async throws {
        ChatStubURLProtocol.handler = { _ in .init(statusCode: 429, chunks: []) }

        do {
            for try await _ in stubbedAPI().stream(
                messages: [ChatOutgoingMessage(role: "user", text: "질문")], threadId: nil
            ) {}
            Issue.record("ChatAPIError.rateLimited가 던져져야 합니다.")
        } catch let error as ChatAPIError {
            #expect(error == .rateLimited)
        }
    }
}
