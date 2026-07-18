import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebfortdKit

/// RAG 채팅 화면. 답변은 위키 문서와 동일한 BlockRenderer로 렌더링(제목 헤딩 드롭은 미적용).
/// 채팅 답변은 문서 제목이 없으므로 별도 처리 없음. 출처 카드는 번들 문서면 즉시 push한다.
struct ChatView: View {
    let store: KBStore?
    /// M4: `WebfortdApp`이 소유하고 `SettingsView`와 공유하는 인스턴스. 설정 탭 로그아웃이 이
    /// 채팅 탭 이력도 함께 리셋해야 하므로(§signOut) 각 화면이 자체 인스턴스를 새로 만들지 않는다.
    let chatStore: ChatStore
    let authStore: AuthStore

    @State private var inputText = ""
    @State private var speech = SpeechService()
    @AccessibilityFocusState private var focusedMessageId: UUID?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // 첨부 선택 흐름: 첨부 버튼 → confirmationDialog(사진 보관함 / 파일) → 각 피커.
    @State private var showAttachmentSourceDialog = false
    @State private var showPhotosPicker = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var showFileImporter = false

    // M3 인증 흐름: 로그인 시트 · 대화 목록 시트 · 계정 confirmationDialog.
    @State private var showAuthSheet = false
    @State private var showThreadListSheet = false
    @State private var showAccountMenu = false

    var body: some View {
        VStack(spacing: 0) {
            if chatStore.messages.isEmpty {
                ContentUnavailableView(
                    "정책·제도를 물어보세요",
                    systemImage: "bubble.left.and.text.bubble.right",
                    description: Text("예: 보조공학기기 지원은 어떻게 신청하나요?"))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                messageList
            }
            Divider()
            inputBar
        }
        .navigationTitle("채팅")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
        .sheet(isPresented: $showAuthSheet) {
            AuthSheet(authStore: authStore)
        }
        .sheet(isPresented: $showThreadListSheet) {
            ThreadListSheet(authStore: authStore, chatStore: chatStore)
        }
        .confirmationDialog(authStore.email ?? "계정", isPresented: $showAccountMenu, titleVisibility: .visible) {
            Button("로그아웃", role: .destructive) {
                Task { await signOut() }
            }
        }
        .onChange(of: chatStore.phase) { oldPhase, newPhase in
            // 완료 시 답변 첫 부분으로 포커스 이동(별도 완료 통지 없음. 포커스 이동이 신호).
            // 오류는 ChatStore가 이미 Announcement로 알렸으므로 여기서 다시 focus를 옮기면
            // 같은 문구가 두 번 낭독된다. lastErrorMessage가 있으면 건너뛴다.
            guard oldPhase == .streaming, newPhase == .idle, chatStore.lastErrorMessage == nil else { return }
            focusedMessageId = chatStore.messages.last?.id
        }
        .onChange(of: chatStore.threadLoadTick) { _, _ in
            // 대화 목록에서 스레드를 불러오면 첫 메시지로 포커스 이동(§동적 콘텐츠 등장 시
            // 포커스 이동). streamTick과 별개 tick으로 원인(전송 완료 vs 이력 로드)을 구분한다.
            focusedMessageId = chatStore.messages.first?.id
        }
        .onDisappear {
            // 탭 이탈 시 진행 중 음성 인식 폐기(마이크 잔존 방지, gildongmu 동형).
            Task { await speech.cancel() }
        }
        .alert(speechAlertMessage ?? "", isPresented: speechAlertBinding) {
            Button("확인") {}
        }
    }

    /// denied·failed 안내(gildongmu 동형). 확인 시 idle 복귀(재시도 가능 상태로).
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

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button("새 대화") {
                chatStore.startNewThread()
            }
            .frame(minWidth: 44, minHeight: 44)
        }
        ToolbarItemGroup(placement: .navigationBarTrailing) {
            if authStore.isSignedIn {
                Button("대화 목록") {
                    showThreadListSheet = true
                }
                .frame(minWidth: 44, minHeight: 44)
                Button("계정") {
                    showAccountMenu = true
                }
                .frame(minWidth: 44, minHeight: 44)
            } else {
                Button("로그인") {
                    showAuthSheet = true
                }
                .frame(minWidth: 44, minHeight: 44)
            }
        }
    }

    /// 로그아웃 + 이력 리셋(로그아웃 후 서버 저장 없는 익명 휘발 모드로 복귀).
    private func signOut() async {
        await authStore.signOut()
        chatStore.startNewThread()
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    ForEach(chatStore.messages) { message in
                        messageRow(message)
                            .id(message.id)
                            .accessibilityFocused($focusedMessageId, equals: message.id)
                    }
                }
                .padding()
            }
            .onChange(of: chatStore.messages.count) { _, _ in scrollToLastMessage(proxy) }
            // 스트리밍 델타마다 하단으로 추적 스크롤(시각 사용자용). VoiceOver 포커스 이동은
            // 완료 시 1회(위 onChange(of: chatStore.phase))만 처리하므로 이 스크롤과 무관하다.
            .onChange(of: chatStore.streamTick) { _, _ in scrollToLastMessage(proxy) }
        }
    }

    private func scrollToLastMessage(_ proxy: ScrollViewProxy) {
        guard let lastId = chatStore.messages.last?.id else { return }
        // 동작 줄이기 사용자는 즉시 점프가 정답(nil 애니메이션). 도착 상태는 두 경우 동일.
        // withAnimation은 연속 호출 시 현재 위치에서 retarget하므로 스트리밍 델타 연타에 안전.
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) {
            proxy.scrollTo(lastId, anchor: .bottom)
        }
    }

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        if message.role == "user" {
            userBubble(message)
        } else {
            assistantAnswer(message)
        }
    }

    // user 버블만 단일 Text(다른 접근성 구조 없음).
    private func userBubble(_ message: ChatMessage) -> some View {
        HStack {
            Spacer(minLength: 32)
            Text(message.text)
                .padding(12)
                .background(.tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // assistant는 BlockRenderer로 전각 배치. 컨테이너를 combine하지 않아 본문 블록의
    // 헤딩·리스트 접근성 구조(로터 탐색 등)를 그대로 유지한다.
    @ViewBuilder
    private func assistantAnswer(_ message: ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if message.text.isEmpty {
                ProgressView()
            } else {
                BlockRenderer(blocks: MarkdownBlockParser.parse(message.text))
            }
            if !message.sourceRefs.isEmpty {
                sourceCards(message.sourceRefs)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sourceCards(_ refs: [ChatSourceRef]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(refs, id: \.slug) { ref in
                sourceCard(ref)
            }
        }
        .padding(.top, 4)
    }

    /// 번들 문서면 앱 내 push, 아니면(번들 외 문서) 웹 URL로 폴백.
    @ViewBuilder
    private func sourceCard(_ ref: ChatSourceRef) -> some View {
        if store?.summary(slug: ref.slug) != nil {
            NavigationLink(value: AppRoute.document(slug: ref.slug)) {
                Text("출처: \(ref.title)")
            }
            .frame(minHeight: 44)
        } else if let url = URL(string: ref.href, relativeTo: AppConfig.webBaseURL) {
            Link("출처: \(ref.title)", destination: url)
                .frame(minHeight: 44)
        }
    }

    private var inputBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let attachment = chatStore.pendingAttachment {
                attachmentRow(filename: attachment.filename)
            } else if let attachmentErrorMessage = chatStore.attachmentErrorMessage {
                Text(attachmentErrorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            HStack(spacing: 8) {
                attachmentButton

                // 축약 없이 명시적 라벨: 값이 채워져도 접근 가능한 이름으로 남는다.
                TextField("질문 입력", text: $inputText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                    .frame(minHeight: 44)

                // 라벨 변화("음성 입력"↔"입력 중지")가 상태 신호(disabled 금지, 접근성 헌장).
                // 온디바이스 SpeechAnalyzer(ko-KR) — 서버 왕복 없음(SpeechService).
                Button {
                    toggleMic()
                } label: {
                    Label(
                        speech.isListening ? "입력 중지" : "음성 입력",
                        systemImage: speech.isListening ? "mic.fill" : "mic"
                    )
                    .labelStyle(.iconOnly)
                }
                .frame(minWidth: 44, minHeight: 44)

                // 전송 중에도 TextField는 disabled 금지(입력은 유지, send가 자체 가드).
                // 전송 버튼만 같은 위치에서 중단 버튼으로 교체.
                if chatStore.phase == .streaming {
                    Button("중단") {
                        chatStore.stop()
                    }
                    .frame(minWidth: 44, minHeight: 44)
                } else {
                    Button("전송") {
                        send()
                    }
                    .frame(minWidth: 44, minHeight: 44)
                    .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .padding()
        .confirmationDialog("첨부 방식 선택", isPresented: $showAttachmentSourceDialog, titleVisibility: .visible) {
            Button("사진 보관함") { showPhotosPicker = true }
            Button("파일") { showFileImporter = true }
            Button("취소", role: .cancel) {}
        }
        .photosPicker(isPresented: $showPhotosPicker, selection: $selectedPhotoItem, matching: .images)
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let newItem else { return }
            chatStore.beginAttachmentLoad()
            Task {
                await loadImageAttachment(newItem)
                selectedPhotoItem = nil
            }
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.pdf]) { result in
            handleFileImportResult(result)
        }
    }

    private var attachmentButton: some View {
        Button("파일 첨부") {
            // 스트리밍 중이면 가드 + Announcement (disabled 금지, 포커스 유지 원칙).
            if chatStore.phase == .streaming {
                AccessibilityNotification.Announcement("답변 작성 중에는 첨부할 수 없어요").post()
                return
            }
            // 이미 첨부가 있으면 가드 + Announcement.
            if chatStore.pendingAttachment != nil {
                AccessibilityNotification.Announcement("첨부는 한 건만 가능해요. 기존 첨부를 제거해 주세요.").post()
                return
            }
            showAttachmentSourceDialog = true
        }
        .frame(minWidth: 44, minHeight: 44)
    }

    // 필드명 + 값을 한 Text로 합쳐(§한 줄 = 한 접근성 객체) 표시, 제거 버튼은 별도 인터랙티브 요소로 유지.
    private func attachmentRow(filename: String) -> some View {
        HStack {
            Text("첨부: \(filename)")
                .font(.footnote)
            Spacer()
            Button("첨부 제거") {
                chatStore.clearAttachment()
            }
            .frame(minWidth: 44, minHeight: 44)
        }
    }

    /// 음성 입력 토글: 최종 텍스트를 입력 필드 뒤에 append(자동 전송 안 함, 질문은 검토 후 전송).
    /// gildongmu는 대체(draft = text)지만 webfortd는 웹과 동형으로 타이핑 초안을 보존한다.
    private func toggleMic() {
        Task {
            if speech.isListening {
                if let text = await speech.stop() {
                    inputText = inputText.isEmpty ? text : inputText + " " + text
                }
            } else {
                await speech.start()
            }
        }
    }

    // 가드로 전송이 거부되면(ChatStore.send가 false 반환) 입력 텍스트를 비우지 않고 보존한다.
    private func send() {
        let text = inputText
        if chatStore.send(text) {
            inputText = ""
        }
    }

    /// PhotosPicker 선택물은 원본 포맷(HEIC 등 다양)을 UIImage로 로드 후 JPEG(quality 0.8)로
    /// 재인코딩한다. 서버 허용 MIME이 image/png·jpeg·webp뿐이라 HEIC 호환 문제를 클라이언트에서 회피.
    /// 디코드·재인코딩은 non-main(Task.detached)에서 수행해 메인 스레드 블로킹을 막는다.
    /// 로드 실패 시 attachmentErrorMessage 설정 + Announcement로 사용자에게 알린다(무신호 해소).
    @MainActor
    private func loadImageAttachment(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        let jpegData = await Task.detached(priority: .userInitiated) {
            Self.encodeJPEG(from: data)
        }.value
        guard let jpegData else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        chatStore.stageAttachment(mediaType: "image/jpeg", data: jpegData, filename: "photo.jpg")
    }

    /// UIImage 디코드 + JPEG 재인코딩 순수 헬퍼. self를 캡처하지 않는 `nonisolated static`으로 둬
    /// Task.detached에서 안전하게 실행한다(렌더링이 아닌 디코드는 non-main에서도 안전).
    private nonisolated static func encodeJPEG(from data: Data) -> Data? {
        guard let uiImage = UIImage(data: data) else { return nil }
        return uiImage.jpegData(compressionQuality: 0.8)
    }

    /// fileImporter는 보안 스코프 URL을 돌려주므로 접근 시작/종료를 명시적으로 감싼다.
    /// 대용량 파일은 실제 로드 전 파일 크기부터 검증해(§2) 불필요한 메모리 로드를 막고,
    /// Data 읽기 자체도 non-main(Task.detached)에서 수행한다.
    /// 각 단계 실패 시 attachmentErrorMessage 설정 + Announcement로 사용자에게 알린다(무신호 해소).
    private func handleFileImportResult(_ result: Result<URL, Error>) {
        guard case .success(let url) = result else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        guard url.startAccessingSecurityScopedResource() else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        // 파악 가능한 경우에만 사전 차단(§2), fileSize를 알 수 없으면 로드 후 stageAttachment의
        // 크기 검증이 안전망으로 남는다.
        let fileSize = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize
        if let fileSize, fileSize > ChatStore.maxAttachmentBytes {
            url.stopAccessingSecurityScopedResource()
            chatStore.notifyAttachmentTooLarge()
            return
        }
        chatStore.beginAttachmentLoad()
        let filename = url.lastPathComponent
        Task {
            defer { url.stopAccessingSecurityScopedResource() }
            let data = await Task.detached(priority: .userInitiated) {
                Self.readPDFData(from: url)
            }.value
            guard let data else {
                chatStore.notifyAttachmentLoadFailure()
                return
            }
            chatStore.stageAttachment(mediaType: "application/pdf", data: data, filename: filename)
        }
    }

    /// PDF 파일 읽기 순수 헬퍼. url은 Sendable이라 액터 경계를 안전하게 넘나든다.
    private nonisolated static func readPDFData(from url: URL) -> Data? {
        try? Data(contentsOf: url)
    }
}
