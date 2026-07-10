import Foundation
import Testing
@testable import WebfortdKit

// StubURLProtocolBase · CapturedRequestBox · requestBodyData는
// Helpers/ChatStubURLProtocol.swift 공용 헬퍼(ChatAPITests와 공유, 중복 제거).
// handler는 Suite별 독립 static var(교차-Suite 경합 회피 — 헬퍼 파일 주석 판단 기록 참고).
final class ThreadsStubURLProtocol: StubURLProtocolBase {
    nonisolated(unsafe) static var handler: ((URLRequest) -> APIStub)?
    override class func stubHandler(for request: URLRequest) -> APIStub { handler!(request) }
}

/// ThreadsStubURLProtocol.handler가 전역 공유 상태라 스텁 사용 테스트는 이 스위트에서 직렬 실행한다.
@Suite(.serialized) struct ThreadsAPITests {
    private let baseURL = URL(string: "https://example.test")!

    private func stubbedAPI(token: String? = "jwt-token") -> ThreadsAPI {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ThreadsStubURLProtocol.self]
        return ThreadsAPI(
            baseURL: baseURL, session: URLSession(configuration: config),
            tokenProvider: { token })
    }

    private func stub(statusCode: Int, json: String) -> APIStub {
        APIStub(statusCode: statusCode, chunks: [Data(json.utf8)])
    }

    // 근거: src/app/api/chat/threads/route.ts — `.select('id, title, updated_at')` →
    // `Response.json({ threads: data ?? [] })` shape을 손으로 옮겨 적음(2026-07-10 Task 1 기준).
    @Test func list가_threads_배열을_updated_at_필드로_디코딩한다() async throws {
        let json = """
        {"threads":[
          {"id":"11111111-1111-1111-1111-111111111111","title":"보조공학기기 지원 절차","updated_at":"2026-07-10T01:02:03.000Z"},
          {"id":"22222222-2222-2222-2222-222222222222","title":"복직 관련 질문","updated_at":"2026-07-09T10:00:00.000Z"}
        ]}
        """
        ThreadsStubURLProtocol.handler = { _ in self.stub(statusCode: 200, json: json) }

        let threads = try await stubbedAPI().list()
        #expect(threads.count == 2)
        #expect(threads.first?.id == "11111111-1111-1111-1111-111111111111")
        #expect(threads.first?.title == "보조공학기기 지원 절차")
        #expect(threads.first?.updatedAt == "2026-07-10T01:02:03.000Z")
    }

    // 근거: route.ts — 비로그인이면 `user`가 null이라도 `{ threads: [] }` 200으로 응답한다
    // (무효 토큰도 마찬가지: `getRequestAuth`가 무효 Bearer를 user=null로 처리). 클라이언트는
    // 상태코드 분기 없이 그대로 디코딩하면 되므로, 빈 배열 응답이 정상 디코딩되는지만 확인한다.
    @Test func list_응답이_빈_배열이면_빈_배열을_반환한다() async throws {
        ThreadsStubURLProtocol.handler = { _ in self.stub(statusCode: 200, json: #"{"threads":[]}"#) }

        let threads = try await stubbedAPI(token: "invalid-token").list()
        #expect(threads.isEmpty)
    }

    @Test func list_요청에_Authorization_헤더가_부착된다() async throws {
        let box = CapturedRequestBox()
        ThreadsStubURLProtocol.handler = { request in
            box.request = request
            return self.stub(statusCode: 200, json: #"{"threads":[]}"#)
        }

        _ = try await stubbedAPI(token: "jwt-xyz").list()

        let request = try #require(box.request)
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer jwt-xyz")
        #expect(request.url?.path == "/api/chat/threads")
    }

    // 근거: src/app/api/chat/threads/[id]/route.ts — thread `.select('id, title')`,
    // messages `.select('id, role, content, source_refs, created_at')` →
    // `Response.json({ thread, messages: messages ?? [] })`. `id`·`created_at`은
    // Kit 인터페이스(ChatThreadMessage)에 없는 필드라 Codable이 무시함을 함께 확인한다.
    @Test func messages가_thread_title과_메시지_role_content_source_refs를_디코딩한다() async throws {
        let json = """
        {
          "thread": {"id":"11111111-1111-1111-1111-111111111111","title":"보조공학기기 지원 절차"},
          "messages": [
            {"id":"m1","role":"user","content":"보조공학기기 지원 절차가 궁금해요","source_refs":[],"created_at":"2026-07-10T01:00:00.000Z"},
            {"id":"m2","role":"assistant","content":"한국장애인고용공단을 통해 신청할 수 있어요","source_refs":[
              {"slug":"2024-jbu-p-016","title":"보조공학기기 지원사업","axis":"policies","type":"policy","href":"/wiki/policies/2024-jbu-p-016"}
            ],"created_at":"2026-07-10T01:00:05.000Z"}
          ]
        }
        """
        ThreadsStubURLProtocol.handler = { _ in self.stub(statusCode: 200, json: json) }

        let result = try await stubbedAPI().messages(threadId: "11111111-1111-1111-1111-111111111111")
        #expect(result.title == "보조공학기기 지원 절차")
        #expect(result.messages.count == 2)
        #expect(result.messages[0].role == "user")
        #expect(result.messages[0].content == "보조공학기기 지원 절차가 궁금해요")
        #expect(result.messages[0].sourceRefs.isEmpty)
        #expect(result.messages[1].sourceRefs.count == 1)
        #expect(result.messages[1].sourceRefs.first?.slug == "2024-jbu-p-016")
    }

    // jsonb 컬럼이 NULL이거나 키 자체가 빠질 수 있는 경우(§brief "없으면 []")를 커버.
    @Test func messages_source_refs_키가_없는_메시지는_빈_배열로_기본값_처리한다() async throws {
        let json = """
        {
          "thread": {"id":"11111111-1111-1111-1111-111111111111","title":"질문"},
          "messages": [
            {"id":"m1","role":"user","content":"질문 내용","created_at":"2026-07-10T01:00:00.000Z"}
          ]
        }
        """
        ThreadsStubURLProtocol.handler = { _ in self.stub(statusCode: 200, json: json) }

        let result = try await stubbedAPI().messages(threadId: "11111111-1111-1111-1111-111111111111")
        #expect(result.messages.first?.sourceRefs == [])
    }

    // 근거: route.ts — 비로그인(user == null)이면 401.
    @Test func messages_401_응답은_unauthorized_오류를_던진다() async throws {
        ThreadsStubURLProtocol.handler = { _ in
            self.stub(statusCode: 401, json: #"{"error":"로그인이 필요해요."}"#)
        }

        do {
            _ = try await stubbedAPI(token: nil).messages(threadId: "11111111-1111-1111-1111-111111111111")
            Issue.record("ThreadsAPIError.unauthorized가 던져져야 합니다.")
        } catch let error as ThreadsAPIError {
            #expect(error == .unauthorized)
        }
    }

    // 근거: route.ts — UUID 형식 불일치·미존재·타인 소유(RLS)는 모두 404로 통일.
    @Test func messages_404_응답은_notFound_오류를_던진다() async throws {
        ThreadsStubURLProtocol.handler = { _ in
            self.stub(statusCode: 404, json: #"{"error":"대화를 찾을 수 없어요."}"#)
        }

        do {
            _ = try await stubbedAPI().messages(threadId: "99999999-9999-9999-9999-999999999999")
            Issue.record("ThreadsAPIError.notFound가 던져져야 합니다.")
        } catch let error as ThreadsAPIError {
            #expect(error == .notFound)
        }
    }
}
