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

    @Test func plainLines가_표를_쉼표_행으로_편다() {
        let blocks = MarkdownBlockParser.parse("| 구분 | 내용 |\n|---|---|\n| 기간<br/>비고 | 2년 |")
        let lines = blocks.plainLines
        #expect(lines[0] == "구분, 내용")
        #expect(lines[1] == "기간 비고, 2년")
    }

    @Test func snippet은_라인_발췌_80자_규칙을_지킨다() {
        let body = "첫 줄\n중요한 단어가 있는 줄\n셋째 줄"
        #expect(KBSearch.snippet(around: "중요한", in: body) == "중요한 단어가 있는 줄")
        #expect(KBSearch.snippet(around: "없는토큰", in: body) == nil)
    }
}
