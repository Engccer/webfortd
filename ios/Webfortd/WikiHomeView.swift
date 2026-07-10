import SwiftUI
import WebfortdKit

struct WikiHomeView: View {
    let store: KBStore?
    var body: some View {
        Text(store.map { "문서 \($0.documents.count)건" } ?? "콘텐츠 번들을 찾지 못했습니다")
            .navigationTitle("장애인교원 위키")
    }
}
