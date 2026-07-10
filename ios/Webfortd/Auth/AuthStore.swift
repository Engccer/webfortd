import Foundation
import Observation
import Supabase

/// 인증 상태(3-state). "확인 중"(loading) ≠ "로그인 안 됨"(signedOut) ≠ "로그인 됨"(signedIn)을
/// 뭉개지 않는다. 세션 조회 실패(네트워크 등)를 signedOut으로 오인해 로그인된 사용자를
/// 갑자기 로그아웃 화면으로 되돌리지 않기 위함이다.
enum AuthState: Equatable {
    case loading
    case signedOut
    case signedIn(email: String)
}

/// 앱 전역에서 공유하는 단일 `SupabaseClient`. URL·anon key는 공개 배포값(웹 `.env.local`과
/// 같은 프로젝트를 가리키며 RLS로 서버 측 접근이 통제되므로 클라이언트 하드코딩이 안전하다).
enum SupabaseClientProvider {
    static let shared = SupabaseClient(
        supabaseURL: AppConfig.supabaseURL,
        supabaseKey: AppConfig.supabaseAnonKey
    )
}

/// OTP(인증 코드) 로그인 + 세션 상태 저장소. dodo-planet `AuthStore`의 4-state
/// (loading/signedOut/signedIn/bootstrapFailed)를 3-state로 슬림화했다: webfortd는 로그인이
/// 선택 사항(익명 채팅이 기본 동작)이라 세션 갱신 실패를 별도 재시도 화면으로 분리할 필요가
/// 없다. 부재만 signedOut으로 확정하고, 그 외 오류는 이전 state를 그대로 둔 채 다음 부트스트랩·
/// 요청에 맡긴다.
@MainActor
@Observable
final class AuthStore {
    private(set) var state: AuthState = .loading

    private let client: SupabaseClient
    private var isBootstrapping = false

    init(client: SupabaseClient = SupabaseClientProvider.shared) {
        self.client = client
    }

    var isSignedIn: Bool {
        if case .signedIn = state { return true }
        return false
    }

    /// 현재 로그인된 사용자의 이메일. signedIn이 아니면 nil.
    var email: String? {
        if case .signedIn(let email) = state { return email }
        return nil
    }

    /// 앱 시작 시 1회 호출: 기기에 저장된 세션 복원(SDK가 만료 시 자동 refresh). 세션 부재만
    /// signedOut으로 전환하고, 네트워크 오류 등 그 외 오류는 현재 state를 판정 기준으로 삼는다:
    /// - 현재 signedIn 상태면 유지(이미 유효한 세션이므로 일시 오류로 로그아웃 취급하지 않음)
    /// - 현재 loading/signedOut이면 signedOut 확정(보수적 표시, 다만 accessToken()은 여전히
    ///   세션 복구 시도). UI 부트스트랩 이후 로딩 상태에서 벗어나려면 호출부에서 foreground
    ///   복귀 시(scenePhase .active) 재부트스트랩 필요.
    func bootstrap() async {
        do {
            let session = try await client.auth.session
            state = .signedIn(email: session.user.email ?? "")
        } catch {
            if Self.isSessionAbsence(error) {
                state = .signedOut
            } else {
                // 네트워크 오류: 현재 상태에 따라 판정.
                if case .signedIn = state {
                    // 이전 세션이 유효했으면 유지.
                } else {
                    state = .signedOut
                }
            }
        }
    }

    /// 포그라운드 복귀 시 세션 상태 재확인. 이미 로그인 화면 표시 중(signedOut)이어도
    /// 로컬 세션이 살아 있으면 signedIn으로 정정한다(표시-실인증 불일치 해소).
    func bootstrapIfNeeded() async {
        guard !isBootstrapping else { return }
        isBootstrapping = true
        defer { isBootstrapping = false }
        await bootstrap()
    }

    /// `error`가 "세션이 아예 없음"(`AuthError.sessionMissing`)인지 판별. 순수 함수라 실
    /// SupabaseClient 없이 단위 테스트 가능하다.
    nonisolated static func isSessionAbsence(_ error: Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        return authError == .sessionMissing
    }

    /// 이메일로 인증 코드 발송. 실패 시 오류를 그대로 던져 `AuthSheet`가 한국어 안내로 치환한다.
    func requestOtp(email: String) async throws {
        try await client.auth.signInWithOTP(email: email)
    }

    /// 인증 코드 검증. 성공하면 그 즉시 이 기기에 세션이 생성되어 signedIn으로 전환한다
    /// (코드를 입력한 그 브라우저·기기에 바로 세션이 생기므로, 매직링크가 다른 컨텍스트에서
    /// 열려 세션이 유실되는 문제가 없다, 웹 `AuthContext.verifyOtp`와 동일 원칙).
    func verifyOtp(email: String, code: String) async throws {
        let response = try await client.auth.verifyOTP(email: email, token: code, type: .email)
        state = .signedIn(email: response.user.email ?? email)
    }

    /// 로그아웃. 서버 호출 실패(네트워크 단절 등)여도 로컬 state는 signedOut으로 정리한다.
    /// 사용자가 "로그아웃" 버튼을 누른 의도가 화면에는 반드시 반영되어야 한다.
    func signOut() async {
        try? await client.auth.signOut()
        state = .signedOut
    }

    /// `ChatAPI`·`ThreadsAPI`의 `tokenProvider`로 그대로 주입한다. SDK가 만료 토큰을 자동
    /// refresh하므로 호출부는 요청 직전 이 값만 새로 물으면 된다. 세션이 없거나 조회 실패 시
    /// nil을 반환해 익명 요청으로 폴백한다(ChatAPI 기존 계약).
    func accessToken() async -> String? {
        try? await client.auth.session.accessToken
    }
}
