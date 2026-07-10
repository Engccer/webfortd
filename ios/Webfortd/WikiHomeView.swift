import SwiftUI
import WebfortdKit

/// 웹 src/lib/kb-axis.ts BROWSABLE_AXES 미러: 순서·라벨·안내문 동일.
struct BrowsableAxis {
    let axis: KBAxis
    let label: String
    let description: String

    static let all: [BrowsableAxis] = [
        .init(axis: .disabilityTypes, label: "장애유형별",
              description: "시각·청각·지체 등 장애유형에 따른 편의지원과 보조공학 안내"),
        .init(axis: .domains, label: "영역별",
              description: "수업·평가·행정·연수 등 교육활동 영역별 지원 내용"),
        .init(axis: .policies, label: "정책·법령",
              description: "장애인교원에 관한 법령·정책·제도 안내"),
        .init(axis: .agreements, label: "단체협약",
              description: "교원노조 단체협약 속 장애인교원 관련 조항"),
        .init(axis: .regions, label: "지역별",
              description: "시·도 교육청별 조례·지침과 지역 지원 현황"),
        .init(axis: .faq, label: "자주 묻는 질문",
              description: "편의지원 신청·인사·권리구제 등 장애인교원이 자주 묻는 질문과 답변"),
    ]
}

struct WikiHomeView: View {
    let store: KBStore?

    var body: some View {
        Group {
            if let store {
                List(visibleAxes(store), id: \.axis) { entry in
                    NavigationLink(value: AppRoute.axis(entry.axis)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(entry.label), \(store.documents(in: entry.axis).count)개 문서")
                                .font(.headline)
                            Text(entry.description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                    .frame(minHeight: 44)
                }
            } else {
                // 3-state: 번들 결함은 "문서 0건"이 아니라 실패로 알린다.
                ContentUnavailableView(
                    "콘텐츠를 불러오지 못했습니다",
                    systemImage: "exclamationmark.triangle",
                    description: Text("앱 콘텐츠 번들이 없습니다. 개발 중이라면 node ios/scripts/bundle-content.mjs 실행 후 다시 빌드하세요."))
            }
        }
        .navigationTitle("장애인교원 위키")
    }

    /// 웹 visibleAxisCards 미러: published 0건 축 숨김.
    private func visibleAxes(_ store: KBStore) -> [BrowsableAxis] {
        BrowsableAxis.all.filter { !store.documents(in: $0.axis).isEmpty }
    }
}
