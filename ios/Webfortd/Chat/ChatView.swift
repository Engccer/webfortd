import SwiftUI
import WebfortdKit

/// RAG 채팅 화면. 답변은 위키 문서와 동일한 BlockRenderer로 렌더링(제목 헤딩 드롭은 미적용).
/// 채팅 답변은 문서 제목이 없으므로 별도 처리 없음. 출처 카드는 번들 문서면 즉시 push한다.
struct ChatView: View {
    let store: KBStore?

    @State private var chatStore = ChatStore()
    @State private var inputText = ""
    @AccessibilityFocusState private var focusedMessageId: UUID?

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
        HStack(spacing: 8) {
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
        .padding()
    }

    private func send() {
        let text = inputText
        inputText = ""
        chatStore.send(text)
    }
}
