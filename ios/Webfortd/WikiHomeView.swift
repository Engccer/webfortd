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

    /// AxisListView와 공유하는 축 라벨 조회 헬퍼(검색 결과·오늘의 위키 행에서도 사용).
    static func label(for axis: KBAxis) -> String {
        all.first { $0.axis == axis }?.label ?? axis.rawValue
    }
}

struct WikiHomeView: View {
    let store: KBStore?

    /// 검색 3-state: 검색 전(타이핑 중 미제출) ≠ 0건 ≠ 결과 있음. 화면·통지 모두 구분한다.
    private enum SearchPhase: Equatable {
        case notSubmitted
        case searching
        case completed
    }

    @State private var search: KBSearch?
    @State private var searchText = ""
    @State private var searchResults: [KBSearchResult] = []
    @State private var searchPhase: SearchPhase = .notSubmitted
    @State private var speech = SpeechService()
    /// 탭 가시성 — stop() 확정 대기 중 탭을 이탈하면 cancel()이 stopping 가드로
    /// 양보하므로, 늦게 도착한 전사 텍스트가 오프스크린 검색·전역 VoiceOver 알림을
    /// 발화하지 않도록 여기서 차단한다(ChatView의 "입력 필드 조용히 append"와 달리
    /// 검색은 부수효과가 커서 가드 필요 — 리뷰 P2).
    @State private var isVisible = true

    private var isSearchActive: Bool { !searchText.isEmpty }

    var body: some View {
        Group {
            if let store {
                List {
                    // 마이크는 검색 필드 바로 다음 행(gildongmu 실기기 실측: toolbar에 두면
                    // VoiceOver가 제목보다 먼저 읽는다). WhatsApp식 홀드 단일 동작(2026-07-20
                    // 탭 토글 대체): 누른 채로 말하고 떼면 즉시 검색 — 검색은 단일 확정형
                    // 입력이라 잠금·취소 슬라이드 없음(onPause: nil). 최종 텍스트만 검색어로
                    // 넣는다(partial 실시간 반영 금지, 필드 값 경합 회피). 포커스 이동은 하지
                    // 않는다 — 검색이 자동 실행되는 설계라 결과 통지(performSearch)가 후속.
                    // isVisible 가드: stop() 확정 대기 중 탭 이탈 시 늦은 전사가 오프스크린
                    // 검색·전역 통지를 발화하지 않도록 차단(리뷰 P2, 탭 토글 시절과 동일).
                    Section {
                        HoldDictationButton(
                            speech: speech,
                            hint: "누른 채로 말하고, 손을 떼면 검색합니다",
                            showsTitle: true,
                            onTranscript: { text in
                                guard isVisible else { return }
                                searchText = text
                                Announce.post(text)
                                performSearch(store: store)
                            },
                            onPause: nil
                        )
                    }
                    if isSearchActive {
                        searchSection
                    } else {
                        todaySection(store)
                        axisSection(store)
                    }
                }
                .searchable(text: $searchText, prompt: "정책·제도 검색")
                .onSubmit(of: .search) {
                    performSearch(store: store)
                }
                .onChange(of: searchText) { _, newValue in
                    // 검색어를 지우면 홈 콘텐츠로 복귀. 다음 검색은 새로 submit해야 실행된다.
                    guard newValue.isEmpty else { return }
                    searchPhase = .notSubmitted
                    searchResults = []
                }
                .task {
                    // 본문 캐시는 첫 검색 시 1회 구축되므로 인스턴스 생성 자체는 가볍다.
                    if search == nil {
                        search = KBSearch(store: store)
                    }
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
        .onAppear { isVisible = true }
        .onDisappear {
            isVisible = false
            // 탭 이탈 시 진행 중 음성 인식 폐기(마이크 잔존 방지, ChatView 동형).
            Task { await speech.cancel() }
        }
        .alert(speechAlertMessage ?? "", isPresented: speechAlertBinding) {
            Button("확인") {}
        }
    }

    /// denied·failed 안내(ChatView 동형). 확인 시 idle 복귀(재시도 가능 상태로).
    private var speechAlertMessage: String? {
        switch speech.phase {
        case .denied: "설정에서 마이크 접근을 허용해 주세요"
        case .failed: "음성 인식을 시작하지 못했습니다. 다시 시도해 주세요"
        default: nil
        }
    }

    private var speechAlertBinding: Binding<Bool> {
        Binding(
            get: { speechAlertMessage != nil },
            set: { if !$0 { speech.reset() } }
        )
    }

    // MARK: - 검색 결과

    @ViewBuilder
    private var searchSection: some View {
        switch searchPhase {
        case .notSubmitted:
            EmptyView()
        case .searching:
            ProgressView()
        case .completed:
            if searchResults.isEmpty {
                ContentUnavailableView.search
            } else {
                ForEach(searchResults, id: \.slug) { result in
                    documentRow(title: result.title, axis: result.axis,
                                snippet: result.snippet, slug: result.slug)
                }
            }
        }
    }

    private func performSearch(store: KBStore) {
        let query = searchText
        guard !query.isEmpty else { return }
        if search == nil {
            search = KBSearch(store: store)
        }
        guard let search else { return }
        searchPhase = .searching
        // Task로 한 프레임 양보: 진행 표시가 화면에 그려진 뒤 무거운 동기 검색
        // (첫 호출은 본문 캐시 구축 포함 약 1초)을 실행해 UI 프리즈 체감을 줄인다.
        Task { @MainActor in
            let results = search.search(query)
            searchResults = results
            searchPhase = .completed
            let message = results.isEmpty ? "검색 결과가 없습니다" : "검색 결과 \(results.count)건"
            Announce.post(message)
        }
    }

    // MARK: - 오늘의 위키

    @ViewBuilder
    private func todaySection(_ store: KBStore) -> some View {
        if let doc = todayDocument(store) {
            Section("오늘의 위키") {
                documentRow(title: doc.frontmatter.title, axis: doc.axis, snippet: nil, slug: doc.slug)
            }
        }
    }

    /// 오늘의 위키: 기준일로부터 경과 일수 기반 결정적 1건 선택, 534일 주기로 전 문서에 도달한다
    /// (웹은 KST 시드 셔플 5건, 알고리즘 독립, 목적 동일).
    private func todayDocument(_ store: KBStore) -> KBDocumentSummary? {
        let docs = store.documents.sorted { $0.slug < $1.slug }
        guard !docs.isEmpty else { return nil }
        // 기준일로부터의 경과 일수로 전체 문서를 순환(534일 주기로 전 문서 도달).
        let days = Calendar.current.dateComponents(
            [.day], from: Date(timeIntervalSinceReferenceDate: 0), to: Date()).day ?? 0
        let index = ((days % docs.count) + docs.count) % docs.count
        return docs[index]
    }

    // MARK: - 축 카드

    @ViewBuilder
    private func axisSection(_ store: KBStore) -> some View {
        ForEach(visibleAxes(store), id: \.axis) { entry in
            // 44pt frame은 label 안쪽 + contentShape(바깥 frame은 히트 영역을 안 넓힌다)
            NavigationLink(value: AppRoute.axis(entry.axis)) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(entry.label), \(store.documents(in: entry.axis).count)개 문서")
                        .font(.headline)
                    Text(entry.description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
        }
    }

    /// 웹 visibleAxisCards 미러: published 0건 축 숨김.
    private func visibleAxes(_ store: KBStore) -> [BrowsableAxis] {
        BrowsableAxis.all.filter { !store.documents(in: $0.axis).isEmpty }
    }

    // MARK: - 공용 행

    /// 검색 결과·오늘의 위키 공통 행: 제목+축(+발췌) 단일 접근성 객체, 탭 시 문서로 이동.
    @ViewBuilder
    private func documentRow(title: String, axis: KBAxis, snippet: String?, slug: String) -> some View {
        // 44pt frame은 label 안쪽 + contentShape(바깥 frame은 히트 영역을 안 넓힌다)
        NavigationLink(value: AppRoute.document(slug: slug)) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(title), \(BrowsableAxis.label(for: axis))")
                if let snippet {
                    Text(snippet)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .combine)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
    }
}
