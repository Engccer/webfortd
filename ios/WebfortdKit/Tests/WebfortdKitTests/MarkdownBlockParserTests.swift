import Foundation
import Testing
@testable import WebfortdKit

@Suite struct MarkdownBlockParserTests {
    @Test func 헤딩과_문단을_파싱한다() {
        let blocks = MarkdownBlockParser.parse("## 제1조\n\n본 협약의 유효기간.")
        guard case let .heading(level, h) = blocks[0], case let .paragraph(p) = blocks[1] else {
            Issue.record("블록 종류 불일치: \(blocks)"); return
        }
        #expect(level == 2)
        #expect(h.plain == "제1조")
        #expect(p.plain == "본 협약의 유효기간.")
    }

    @Test func 표를_헤더와_행으로_파싱한다() {
        let md = "| 구분 | 내용 |\n|---|---|\n| 기간 | 2년 |\n| 대상 | 전체 |"
        let blocks = MarkdownBlockParser.parse(md)
        guard case let .table(header, rows) = blocks[0] else {
            Issue.record("table 아님: \(blocks)"); return
        }
        #expect(header.map(\.plain) == ["구분", "내용"])
        #expect(rows.count == 2)
        #expect(rows[0].map(\.plain) == ["기간", "2년"])
    }

    @Test func 내부_링크가_attributed에_반영된다() {
        let blocks = MarkdownBlockParser.parse("[협약 전문](webfortd-wiki://target-a) 참조")
        guard case let .paragraph(inline) = blocks[0] else {
            Issue.record("paragraph 아님"); return
        }
        #expect(inline.plain == "협약 전문 참조")
        let links = inline.attributed.runs.compactMap(\.link)
        #expect(links == [URL(string: "webfortd-wiki://target-a")])
    }

    @Test func 리스트_항목을_파싱한다() {
        let blocks = MarkdownBlockParser.parse("- 첫째\n- 둘째")
        guard case let .bulletList(items) = blocks[0] else {
            Issue.record("bulletList 아님"); return
        }
        #expect(items.count == 2)
        guard case let .paragraph(first) = items[0][0] else {
            Issue.record("항목 내부가 paragraph 아님"); return
        }
        #expect(first.plain == "첫째")
    }

    @Test func 단독_이미지는_image_블록이_된다() {
        let blocks = MarkdownBlockParser.parse("![조직도 설명](/source-images/a.png)")
        guard case let .image(source, alt) = blocks[0] else {
            Issue.record("image 아님: \(blocks)"); return
        }
        #expect(source == "/source-images/a.png")
        #expect(alt == "조직도 설명")
    }

    @Test func 번들_전량_파싱_스모크() throws {
        // 파이프라인 미실행 환경(fresh clone)에서는 조용히 통과.
        guard let store = try? KBStore.bundled(), !store.documents.isEmpty else { return }
        var emptySlugs: [String] = []
        for doc in store.documents {
            let blocks = MarkdownBlockParser.parse(try store.loadBody(slug: doc.slug))
            if blocks.isEmpty { emptySlugs.append(doc.slug) }
        }
        #expect(emptySlugs.isEmpty, "빈 파싱 결과: \(emptySlugs)")
    }
}
