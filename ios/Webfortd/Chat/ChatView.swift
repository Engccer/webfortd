import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebfortdKit

/// RAG 채팅 화면. 답변은 위키 문서와 동일한 BlockRenderer로 렌더링(제목 헤딩 드롭은 미적용).
/// 채팅 답변은 문서 제목이 없으므로 별도 처리 없음. 출처 카드는 번들 문서면 즉시 push한다.
struct ChatView: View {
    let store: KBStore?

    @State private var chatStore = ChatStore()
    @State private var inputText = ""
    @AccessibilityFocusState private var focusedMessageId: UUID?

    // 첨부 선택 흐름: 첨부 버튼 → confirmationDialog(사진 보관함 / 파일) → 각 피커.
    @State private var showAttachmentSourceDialog = false
    @State private var showPhotosPicker = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var showFileImporter = false

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
        .onChange(of: chatStore.phase) { oldPhase, newPhase in
            // 완료 시 답변 첫 부분으로 포커스 이동(별도 완료 통지 없음. 포커스 이동이 신호).
            // 오류는 ChatStore가 이미 Announcement로 알렸으므로 여기서 다시 focus를 옮기면
            // 같은 문구가 두 번 낭독된다. lastErrorMessage가 있으면 건너뛴다.
            guard oldPhase == .streaming, newPhase == .idle, chatStore.lastErrorMessage == nil else { return }
            focusedMessageId = chatStore.messages.last?.id
        }
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
            .onChange(of: chatStore.messages.count) { _, _ in
                guard let lastId = chatStore.messages.last?.id else { return }
                proxy.scrollTo(lastId, anchor: .bottom)
            }
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

    private func send() {
        let text = inputText
        inputText = ""
        chatStore.send(text)
    }

    /// PhotosPicker 선택물은 원본 포맷(HEIC 등 다양)을 UIImage로 로드 후 JPEG(quality 0.8)로
    /// 재인코딩한다. 서버 허용 MIME이 image/png·jpeg·webp뿐이라 HEIC 호환 문제를 클라이언트에서 회피.
    /// 로드 실패 시 attachmentErrorMessage 설정 + Announcement로 사용자에게 알린다(무신호 해소).
    @MainActor
    private func loadImageAttachment(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        guard let uiImage = UIImage(data: data) else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        guard let jpegData = uiImage.jpegData(compressionQuality: 0.8) else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        chatStore.stageAttachment(mediaType: "image/jpeg", data: jpegData, filename: "photo.jpg")
    }

    /// fileImporter는 보안 스코프 URL을 돌려주므로 접근 시작/종료를 명시적으로 감싼다.
    /// 각 단계에서 실패 시 attachmentErrorMessage 설정 + Announcement로 사용자에게 알린다(무신호 해소).
    private func handleFileImportResult(_ result: Result<URL, Error>) {
        guard case .success(let url) = result else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        guard url.startAccessingSecurityScopedResource() else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }
        guard let data = try? Data(contentsOf: url) else {
            chatStore.notifyAttachmentLoadFailure()
            return
        }
        chatStore.stageAttachment(mediaType: "application/pdf", data: data, filename: url.lastPathComponent)
    }
}
