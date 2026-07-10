import Foundation
import Testing
@testable import WebfortdKit

// kb-index-mini.json(2건) + doc-sample.md 실캡처 fixture 재사용.
@Suite struct KBSearchTests {
    func makeSearch() throws -> KBSearch {
        let indexURL = try #require(Bundle.module.url(
            forResource: "Fixtures/kb-index-mini", withExtension: "json"))
        let store = try KBStore(indexURL: indexURL,
                                contentRootURL: indexURL.deletingLastPathComponent())
        return KBSearch(store: store)
    }

    @Test func 제목_토큰_매치가_우선한다() throws {
        let results = try makeSearch().search("유효기간")
        #expect(results.first?.slug == "2020-ca-1-2")
    }

    @Test func 모든_토큰_AND_매치만_반환한다() throws {
        let search = try makeSearch()
        #expect(search.search("유효기간 존재하지않는토큰XYZ").isEmpty)
    }

    @Test func 빈_질의는_빈_배열() throws {
        let search = try makeSearch()
        #expect(search.search("").isEmpty)
        #expect(search.search("   ").isEmpty)
    }
}
