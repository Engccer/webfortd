import Foundation
import Testing
@testable import WebfortdKit

// Fixtures/doc-sample.md: 2026-07-10 content/agreements/2020-ca-1-2.md 실캡처.
@Suite struct KBStoreTests {
    func makeStore() throws -> KBStore {
        let indexURL = try #require(Bundle.module.url(
            forResource: "Fixtures/kb-index-mini", withExtension: "json"))
        // fixture 문서는 Fixtures/ 평면에 있으므로 contentRoot를 우회 주입해 검증한다.
        let contentRoot = indexURL.deletingLastPathComponent()
        return try KBStore(indexURL: indexURL, contentRootURL: contentRoot)
    }

    @Test func 축별_문서를_가나다_정렬로_돌려준다() throws {
        let store = try makeStore()
        let docs = store.documents(in: .agreements)
        #expect(docs.map(\.slug) == ["2020-ca-1-2"])
        #expect(store.documents(in: .stories).isEmpty)
    }

    @Test func 본문은_frontmatter가_제거되어_있다() throws {
        let store = try makeStore()
        // doc-sample.md 이름으로 로드하도록 slug_index 경로 대신 직접 파일 로드 검증
        let body = try store.loadBody(atRelativePath: "doc-sample.md")
        #expect(!body.hasPrefix("---"))
        #expect(!body.contains("status: published"))
        #expect(!body.isEmpty)
    }
}
