import SwiftUI
import WebfortdKit

/// 로그인 사용자의 저장된 대화 목록 시트. 선택 시 `ChatStore.loadThread(id:)`로 현재 세션의
/// 메시지를 교체하고 시트를 닫는다(첫 메시지로의 접근성 포커스 이동은 `ChatView`가
/// `threadLoadTick` 변화를 관찰해 처리).
struct ThreadListSheet: View {
    let authStore: AuthStore
    let chatStore: ChatStore

    @Environment(\.dismiss) private var dismiss
    @State private var phase: Phase = .loading
    @State private var isSelecting = false

    /// 3-state + 성공 케이스: "확인 중"(loading) ≠ "0건"(empty) ≠ "조회 실패"(failed)를
    /// 뭉개지 않는다.
    private enum Phase {
        case loading
        case loaded([ChatThreadSummary])
        case empty
        case failed(String)
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("대화 목록")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("닫기") { dismiss() }
                            .frame(minWidth: 44, minHeight: 44)
                    }
                }
        }
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .empty:
            ContentUnavailableView(
                "저장된 대화가 없어요",
                systemImage: "bubble.left.and.text.bubble.right",
                description: Text("새 대화를 시작하면 여기에 나타나요."))
        case .failed(let message):
            ContentUnavailableView {
                Label("대화 목록을 불러오지 못했어요", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("다시 시도") {
                    Task { await load() }
                }
                .frame(minHeight: 44)
            }
        case .loaded(let threads):
            List(threads) { thread in
                Button {
                    Task { await select(thread) }
                } label: {
                    // 제목 + 상대 시간을 쉼표로 합친 단일 텍스트(§한 줄 = 한 접근성 객체).
                    Text("\(thread.title), \(Self.relativeTime(thread.updatedAt))")
                }
                .frame(minHeight: 44)
            }
        }
    }

    private func load() async {
        phase = .loading
        do {
            let threads = try await chatStore.threadsAPI.list()
            // 서버는 무효 토큰도 200 빈 배열로 정규화한다(route.ts 주석, user == null이면
            // 별도 401 없이 { threads: [] }). "정말 0건"과 "세션이 만료되어 조용히 빈 배열"이
            // 뭉개지지 않도록, 결과가 비었을 때만 토큰 유효성을 별도 확인해 3-state를 분리한다
            // (Task 2 보고서가 남긴 고려사항).
            if threads.isEmpty {
                phase = await authStore.accessToken() == nil
                    ? .failed("로그인이 만료됐어요. 다시 로그인해 주세요.")
                    : .empty
            } else {
                phase = .loaded(threads)
            }
        } catch {
            phase = .failed(Self.errorMessage(for: error))
        }
    }

    private func select(_ thread: ChatThreadSummary) async {
        guard !isSelecting else { return }
        isSelecting = true
        defer { isSelecting = false }

        do {
            try await chatStore.loadThread(id: thread.id)
            dismiss()
        } catch {
            phase = .failed(Self.errorMessage(for: error))
        }
    }

    private static func errorMessage(for error: Error) -> String {
        if let apiError = error as? ThreadsAPIError {
            switch apiError {
            case .unauthorized:
                return "로그인이 필요해요. 다시 로그인해 주세요."
            case .notFound:
                return "대화를 찾을 수 없어요."
            case .server:
                return "서버에서 오류가 발생했어요. 잠시 후 다시 시도해 주세요."
            }
        }
        return "네트워크를 확인한 뒤 다시 시도해 주세요."
    }

    /// `updated_at`(Postgres timestamptz의 ISO8601 문자열)을 상대 시간 문구로 변환한다.
    /// 파싱 실패 시(서버 포맷 변경 등) 원문 그대로 보여줘 정보 손실 없이 안전하게 폴백한다.
    private static func relativeTime(_ isoString: String) -> String {
        guard let date = parseDate(isoString) else { return isoString }
        return relativeFormatter.localizedString(for: date, relativeTo: Date())
    }

    private static func parseDate(_ isoString: String) -> Date? {
        if let date = isoFormatterWithFractionalSeconds.date(from: isoString) {
            return date
        }
        return isoFormatterPlain.date(from: isoString)
    }

    private static let isoFormatterWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoFormatterPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.unitsStyle = .full
        return formatter
    }()
}
