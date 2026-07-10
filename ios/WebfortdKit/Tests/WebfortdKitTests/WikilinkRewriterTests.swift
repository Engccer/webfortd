import Testing
@testable import WebfortdKit

@Suite struct WikilinkRewriterTests {
    let known: (String) -> Bool = { ["target-a", "b-2"].contains($0) }

    @Test func 기본_위키링크를_내부_링크로_바꾼다() {
        #expect(WikilinkRewriter.rewrite("전문은 [[target-a]] 참조.", isKnownSlug: known)
            == "전문은 [target-a](webfortd-wiki://target-a) 참조.")
    }

    @Test func 라벨과_앵커를_처리한다() {
        #expect(WikilinkRewriter.rewrite("[[target-a|협약 전문]]과 [[b-2#조항]]", isKnownSlug: known)
            == "[협약 전문](webfortd-wiki://target-a)과 [b-2](webfortd-wiki://b-2)")
    }

    @Test func 미지_slug는_평문으로_남긴다() {
        #expect(WikilinkRewriter.rewrite("[[unknown|라벨]] [[unknown2]]", isKnownSlug: known)
            == "라벨 unknown2")
    }

    @Test func 펜스_코드블록_내부는_건드리지_않는다() {
        let md = "```\n[[target-a]]\n```\n[[target-a]]"
        #expect(WikilinkRewriter.rewrite(md, isKnownSlug: known)
            == "```\n[[target-a]]\n```\n[target-a](webfortd-wiki://target-a)")
    }
}
