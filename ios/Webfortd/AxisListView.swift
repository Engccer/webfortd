import SwiftUI
import WebfortdKit

struct AxisListView: View {
    let store: KBStore?
    let axis: KBAxis

    var body: some View {
        Group {
            if let store {
                let docs = store.documents(in: axis)
                List(docs, id: \.slug) { doc in
                    NavigationLink(value: AppRoute.document(slug: doc.slug)) {
                        // 한 줄 = 한 객체: 제목과 연도를 단일 텍스트로.
                        // 44pt frame은 label 안쪽 + contentShape(바깥 frame은 히트 영역을 안 넓힌다)
                        Text("\(doc.frontmatter.title), \(doc.frontmatter.year)년")
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                }
            } else {
                ContentUnavailableView("콘텐츠를 불러오지 못했습니다",
                    systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle(BrowsableAxis.label(for: axis))
        .navigationBarTitleDisplayMode(.inline)
    }
}
