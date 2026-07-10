import SwiftUI
import WebfortdKit

/// 내비게이션 목적지: 위키 축 목록과 문서.
enum AppRoute: Hashable {
    case axis(KBAxis)
    case document(slug: String)
}

@main
struct WebfortdApp: App {
    private let store: KBStore?
    @State private var path: [AppRoute] = []

    init() {
        // 파이프라인 미실행 등 번들 결함은 홈에서 안내(3-state: 실패를 빈 목록과 뭉개지 않음).
        store = try? KBStore.bundled()
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $path) {
                WikiHomeView(store: store)
                    .navigationDestination(for: AppRoute.self) { route in
                        switch route {
                        case .axis(let axis):
                            AxisListView(store: store, axis: axis)
                        case .document(let slug):
                            DocumentView(store: store, slug: slug)
                        }
                    }
            }
            .environment(\.openURL, OpenURLAction { url in
                // 문서 본문 내부 위키링크 → 앱 내 push.
                guard url.scheme == KBLink.scheme, let slug = url.host() else {
                    return .systemAction
                }
                path.append(.document(slug: slug))
                return .handled
            })
        }
    }
}
