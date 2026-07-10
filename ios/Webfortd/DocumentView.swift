import SwiftUI
import WebfortdKit

struct DocumentView: View {
    let store: KBStore?
    let slug: String
    @State private var blocks: [KBBlock]?
    @State private var loadFailed = false

    var body: some View {
        Group {
            if let store, let summary = store.summary(slug: slug) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(summary.frontmatter.title)
                            .font(.largeTitle).bold()
                            .accessibilityAddTraits(.isHeader)
                        if let blocks {
                            BlockRenderer(blocks: blocks)
                        } else if loadFailed {
                            Text("본문을 불러오지 못했습니다.")
                        } else {
                            ProgressView("불러오는 중")
                        }
                        sourceFooter(summary)
                    }
                    .padding()
                }
            } else {
                // 미지 slug(깨진 내부 링크 등)와 로드 실패를 구분해 알린다.
                ContentUnavailableView("문서를 찾을 수 없습니다", systemImage: "questionmark.circle",
                    description: Text("링크가 가리키는 문서가 아직 공개되지 않았을 수 있습니다."))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: slug) {
            guard let store else { return }
            do {
                let body = try store.loadBody(slug: slug)
                blocks = MarkdownBlockParser.parse(body)
            } catch {
                loadFailed = true
            }
        }
    }

    private func sourceFooter(_ summary: KBDocumentSummary) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Divider()
            // 한 줄 = 한 객체: 출처 전체를 단일 텍스트로.
            Text("출처: \(summary.frontmatter.source.citation), \(summary.frontmatter.source.organization)")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let urlString = summary.frontmatter.source.url, let url = URL(string: urlString) {
                Link("원문 보기", destination: url)
                    .font(.footnote)
                    .frame(minHeight: 44)
            }
        }
        .padding(.top, 16)
    }
}
