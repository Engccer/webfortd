import Foundation
import SwiftUI
import WebfortdKit

/// 설정 탭: 계정(로그인 상태·로그인·로그아웃) + 콘텐츠(번들 문서 수·기준일) + 정보(앱 정체성·버전·링크).
/// `chatStore`는 `WebfortdApp`이 `ChatView`와 공유하는 같은 인스턴스라, 여기서 로그아웃해도
/// 채팅 탭 이력이 함께 리셋된다(§signOut, ChatView.signOut()과 완전히 동일한 동작).
struct SettingsView: View {
    let store: KBStore?
    let chatStore: ChatStore
    let authStore: AuthStore

    @State private var showAuthSheet = false
    @State private var showLogoutConfirm = false

    var body: some View {
        List {
            accountSection
            contentSection
            infoSection
        }
        .navigationTitle("설정")
        .sheet(isPresented: $showAuthSheet) {
            AuthSheet(authStore: authStore)
        }
        .confirmationDialog(
            "로그아웃할까요?", isPresented: $showLogoutConfirm, titleVisibility: .visible
        ) {
            Button("로그아웃", role: .destructive) {
                Task { await signOut() }
            }
        }
    }

    // MARK: - 계정

    // 3-state: "확인 중"(loading) ≠ "로그인 안 됨"(signedOut) ≠ "로그인 됨"(signedIn)을 뭉개지 않는다.
    @ViewBuilder
    private var accountSection: some View {
        Section("계정") {
            switch authStore.state {
            case .loading:
                Text("로그인 상태를 확인하고 있어요")
            case .signedOut:
                Text("로그인되어 있지 않아요")
                Button("로그인") {
                    showAuthSheet = true
                }
                .frame(minHeight: 44)
            case .signedIn(let email):
                Text("로그인: \(email)")
                Button("로그아웃", role: .destructive) {
                    showLogoutConfirm = true
                }
                .frame(minHeight: 44)
            }
        }
    }

    /// ChatView.signOut()과 동일 동작: 서버 세션 종료 + 대화 이력 리셋(로그아웃 후에는 서버 저장
    /// 없는 익명 휘발 모드로 복귀).
    private func signOut() async {
        await authStore.signOut()
        chatStore.startNewThread()
    }

    // MARK: - 콘텐츠

    private var contentSection: some View {
        Section("콘텐츠") {
            Text(contentSummaryText)
        }
    }

    // 3-state: 번들 결함(조회 실패)과 "문서 0건"(정상 값)을 뭉개지 않는다.
    private var contentSummaryText: String {
        guard let store else {
            return "콘텐츠 정보를 불러오지 못했습니다."
        }
        let index = store.index
        guard let generatedAt = index.generatedAt,
            let date = Self.parseGeneratedDate(generatedAt)
        else {
            // generated_at이 없으면(결정적 빌드의 기본값) 기준일을 생략한다. 없는 값을 지어내지 않는다.
            return "문서 \(index.sourceCount)건"
        }
        return "문서 \(index.sourceCount)건, 기준일 \(Self.dateOnlyFormatter.string(from: date))"
    }

    // MARK: - 정보

    private var infoSection: some View {
        Section("정보") {
            Text(Self.identityStatement)
            Text("버전 \(Self.appVersion)")
            Link("웹사이트 열기", destination: AppConfig.webBaseURL)
                .frame(minHeight: 44)
            Link("개인정보처리방침", destination: AppConfig.webBaseURL.appendingPathComponent("privacy"))
                .frame(minHeight: 44)
        }
    }

    /// 앱 정체성 영구 원칙 문구(webfortd CLAUDE.md §앱 정체성과 채팅의 역할 기준점). 장교조
    /// 브랜드 문구가 아니라 "장애인교원 교육전념 여건 지원 사업" 자산이라는 문구를 그대로 쓴다.
    private static let identityStatement =
        "이 앱은 장애인교원 교육전념 여건 지원 사업의 시범 자산으로, 대한민국 장애인교원 관련 제도·정책 정보를 제공합니다."

    private static let appVersion: String =
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "알 수 없음"

    private static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()

    /// `generated_at`은 `SYNC_TIMESTAMP` 환경변수 문자열을 그대로 담으므로(scripts/sync-content.ts,
    /// 미설정 시 null) 형식이 고정돼 있지 않다. ISO 8601(소수초 포함·미포함)을 우선 시도하고, 그마저
    /// 실패하면 앞 10자가 YYYY-MM-DD 형태인 경우에만 그대로 사용한다. 셋 다 실패하면 nil을 돌려줘
    /// 호출부가 기준일을 조용히 생략하게 한다(지어낸 날짜를 보여주지 않음).
    private static func parseGeneratedDate(_ raw: String) -> Date? {
        let withFractionalSeconds = ISO8601DateFormatter()
        withFractionalSeconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFractionalSeconds.date(from: raw) { return date }
        if let date = ISO8601DateFormatter().date(from: raw) { return date }
        return dateOnlyFormatter.date(from: String(raw.prefix(10)))
    }
}
