import SwiftUI

/// 이메일 인증 코드(OTP) 로그인 시트. 웹 `AuthModal` 2단계를 그대로 미러한다:
/// 이메일 입력 → 인증 코드 발송 → 코드 입력 → 확인. 코드를 입력한 그 기기에 즉시 세션이
/// 생기므로(매직링크의 "다른 컨텍스트에서 열림" 문제 없음) 별도 딥링크 처리가 필요 없다.
///
/// 진행 중에도 버튼을 `.disabled`로 잠그지 않는다 — 대신 액션 내부에서 재진입을 가드하고
/// 라벨만 바꾼다(§동적 콘텐츠 패턴: 포커스를 쥔 컨트롤을 disabled로 바꾸면 포커스가 body로
/// 이탈한다). 오류·성공 모두 단일 채널(Announcement + 화면에 보이는 문구)로 통지한다.
struct AuthSheet: View {
    let authStore: AuthStore

    @Environment(\.dismiss) private var dismiss

    private enum Step: Equatable {
        case email
        case code
    }

    private enum Field: Hashable {
        case email
        case code
    }

    @State private var step: Step = .email
    @State private var email = ""
    @State private var code = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    switch step {
                    case .email:
                        emailStep
                    case .code:
                        codeStep
                    }
                } footer: {
                    if let errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("로그인")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .frame(minWidth: 44, minHeight: 44)
                }
            }
        }
    }

    @ViewBuilder
    private var emailStep: some View {
        Text("이메일 주소를 입력하시면 인증 코드를 보내드려요. 받은 코드를 다음 화면에 입력하면 로그인됩니다.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        TextField("이메일 주소", text: $email)
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($focusedField, equals: .email)
            .frame(minHeight: 44)
        Button(isSubmitting ? "인증 코드 요청 중" : "인증 코드 받기") {
            Task { await requestCode() }
        }
        .frame(minHeight: 44)
    }

    @ViewBuilder
    private var codeStep: some View {
        Text("\(email) 으로 보낸 인증 코드를 입력해 주세요.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        TextField("인증 코드", text: $code)
            .textContentType(.oneTimeCode)
            .keyboardType(.numberPad)
            .focused($focusedField, equals: .code)
            .frame(minHeight: 44)
        Button(isSubmitting ? "확인 중" : "확인") {
            Task { await verifyCode() }
        }
        .frame(minHeight: 44)
        Button("다른 이메일 사용") {
            guard !isSubmitting else { return }
            step = .email
            code = ""
            errorMessage = nil
            focusedField = .email
        }
        .frame(minHeight: 44)
    }

    /// 이메일로 인증 코드 발송을 요청한다. `isSubmitting`으로 재진입만 가드하고 필드는
    /// 계속 편집 가능하게 둔다(입력 유실 방지).
    private func requestCode() async {
        guard !isSubmitting else { return }
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty else {
            show(error: "이메일 주소를 입력해 주세요.")
            focusedField = .email
            return
        }
        isSubmitting = true
        errorMessage = nil
        do {
            try await authStore.requestOtp(email: trimmedEmail)
            isSubmitting = false
            email = trimmedEmail
            step = .code
            focusedField = .code
        } catch {
            isSubmitting = false
            show(error: "인증 코드를 보내지 못했어요. 이메일 주소를 확인한 뒤 잠시 후 다시 시도해 주세요.")
            focusedField = .email
        }
    }

    /// 인증 코드를 검증한다. 성공하면 시트를 닫고 로그인 완료를 알린다.
    private func verifyCode() async {
        guard !isSubmitting else { return }
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedCode.isEmpty else {
            show(error: "인증 코드를 입력해 주세요.")
            return
        }
        isSubmitting = true
        errorMessage = nil
        do {
            try await authStore.verifyOtp(email: email, code: trimmedCode)
            isSubmitting = false
            AccessibilityNotification.Announcement("로그인했습니다").post()
            dismiss()
        } catch {
            isSubmitting = false
            show(error: "코드가 올바르지 않거나 만료되었어요. 코드를 다시 확인하거나 새 코드를 받아 주세요.")
            focusedField = .code
        }
    }

    /// 오류 문구를 화면에 표시함과 동시에 단일 채널(Announcement)로 통지한다
    /// (ChatStore.applyError와 동일 패턴 — 표시 문구와 낭독 문구를 별도로 관리하지 않는다).
    private func show(error message: String) {
        errorMessage = message
        AccessibilityNotification.Announcement(message).post()
    }
}
