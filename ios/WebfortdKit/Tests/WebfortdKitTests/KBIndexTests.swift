import Foundation
import Testing
@testable import WebfortdKit

// Fixtures/kb-index-mini.json: 2026-07-10 kb-index.generated.json에서 slug 2건 추출(프로드 정본 축소).
@Suite struct KBIndexTests {
    func loadFixture() throws -> Data {
        let url = try #require(Bundle.module.url(
            forResource: "Fixtures/kb-index-mini", withExtension: "json"))
        return try Data(contentsOf: url)
    }

    @Test func 인덱스를_디코딩한다() throws {
        let index = try JSONDecoder().decode(KBIndex.self, from: loadFixture())
        #expect(index.sourceCount == 2)
        let doc = try #require(index.documents.first { $0.slug == "2020-ca-1-2" })
        #expect(doc.axis == .agreements)
        #expect(doc.filePath == "content/agreements/2020-ca-1-2.md")
        #expect(doc.frontmatter.title == "제1조【유효기간】")
        #expect(doc.frontmatter.status == .published)
        #expect(doc.frontmatter.source.organization.contains("교육부"))
        #expect(index.slugIndex["accommodation-refused"] != nil)
    }

    @Test func 미지_frontmatter_필드는_무시한다() throws {
        // fixture에는 accessibility·references 등 앱 미사용 필드가 실데이터 그대로 있다.
        _ = try JSONDecoder().decode(KBIndex.self, from: loadFixture())
    }
}
