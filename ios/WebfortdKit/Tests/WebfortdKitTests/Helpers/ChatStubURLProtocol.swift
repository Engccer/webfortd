import Foundation

/// 스텁 응답 1건(상태코드 + body 청크). 여러 Suite의 스텁 URLProtocol이 공유하는 순수 값 타입.
struct APIStub {
    let statusCode: Int
    let chunks: [Data]
}

/// 스텁 URLProtocol 공통 구현. `canInit`/`canonicalRequest`/`startLoading`/`stopLoading`
/// 보일러플레이트를 한 곳에 모으고, `stubHandler(for:)`만 서브클래스가 각자의 전역 `handler`를
/// 참조해 오버라이드한다(gildongmu `StubURLProtocol` 관례 확장).
///
/// **판단 기록(Task 2, 2026-07-10)**: `handler`를 이 베이스 클래스의 공용 단일 static var로
/// 두지 않고 서브클래스마다 독립 선언하는 이유: Swift Testing은 기본적으로 서로 다른
/// top-level `@Suite`를 병렬 실행한다(`.serialized` trait은 같은 Suite 내부만 직렬화하지
/// 다른 Suite와의 동시 실행까지 막지 않는다). `ChatAPITests`·`ThreadsAPITests`가 전역 handler
/// 하나를 공유하면, 두 Suite가 동시에 실행될 때 한 테스트가 설정한 handler를 다른 테스트가
/// 읽기 전에 덮어써 flaky해질 수 있다. 따라서 Suite마다 독립된 서브클래스(및 독립된 static var)를
/// 두어 교차-Suite 경합을 구조적으로 차단하면서, 실제 배달 로직(startLoading 등)의 중복만 제거한다.
class StubURLProtocolBase: URLProtocol {
    class func stubHandler(for request: URLRequest) -> APIStub {
        fatalError("StubURLProtocolBase 서브클래스는 stubHandler(for:)를 오버라이드해야 합니다.")
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let stub = Self.stubHandler(for: request)
        let response = HTTPURLResponse(
            url: request.url!, statusCode: stub.statusCode, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        // 실캡처 SSE를 고정 크기 청크로 분할 전달해 bytes.lines가 청크 경계를 넘나드는
        // 개행을 재조립하는 경로를 실제로 태운다(응답 전체를 한 번에 didLoad 하지 않음).
        // 비스트리밍(JSON) 응답은 chunks 1건으로 넘기면 동일 경로로 처리된다.
        for chunk in stub.chunks {
            client?.urlProtocol(self, didLoad: chunk)
        }
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

/// 스텁 handler는 URLSession 내부 큐에서 실행되어 `#expect`가 실행 중인 테스트에 귀속되지
/// 않는다(실측: 실패해도 테스트가 그대로 통과 처리됨). 요청을 캡처만 해 두고, 검증은
/// 테스트 본문(async 컨텍스트)에서 수행한다.
final class CapturedRequestBox: @unchecked Sendable {
    var request: URLRequest?
}

/// 요청 본문 읽기 헬퍼. `URLSession.bytes(for:)`/`data(for:)` 경로는 작은 `httpBody` Data도
/// 내부적으로 `httpBodyStream`으로 변환해 URLProtocol에 전달하므로(실측), 두 경로 모두 대비한다.
func requestBodyData(_ request: URLRequest) -> Data {
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
