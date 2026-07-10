import Foundation
import Observation
import SwiftUI
import WebfortdKit

/// 채팅 메시지 1건. `role`은 `ChatOutgoingMessage`와 동일 표기("user" | "assistant").
struct ChatMessage: Identifiable, Equatable {
    let id: UUID
    let role: String
    var text: String
    var sourceRefs: [ChatSourceRef]

    init(role: String, text: String, sourceRefs: [ChatSourceRef] = []) {
        id = UUID()
        self.role = role
        self.text = text
        self.sourceRefs = sourceRefs
    }
}

/// 채팅 스트리밍 상태 저장소. M2는 익명 동작 — threadId는 앱 세션 내에서만 재사용하고
/// 영속화(로그인·서버 저장 이력)는 M3 몫이다.
@MainActor
@Observable
final class ChatStore {
    enum Phase: Equatable {
        case idle
        case streaming
    }

    private(set) var messages: [ChatMessage] = []
    private(set) var phase: Phase = .idle
    /// 마지막 전송이 오류로 끝났으면 오류 문구, 성공(정상 finish)이거나 중단이면 nil.
    /// ChatView가 완료 시 접근성 포커스 이동 여부를 판단하는 데만 쓰인다(오류는 Announcement로
    /// 이미 전달했으므로 focus 이동까지 겹치면 같은 문구가 두 번 낭독된다 — 중복 통지 금지).
    private(set) var lastErrorMessage: String?

    private let api: ChatAPI
    private var streamTask: Task<Void, Never>?
    private var threadId: String?
    /// stop() 직후 곧바로 재전송하면 취소된 이전 Task의 완료 처리가 새 Task의 phase를
    /// 되돌릴 수 있다 — 세대 토큰으로 "내 Task가 아직 최신인가"만 확인한다.
    private var generation = 0

    init(api: ChatAPI = ChatAPI(baseURL: AppConfig.webBaseURL)) {
        self.api = api
    }

    /// 사용자 질문 전송. 스트리밍 중 재진입은 무시(가드).
    func send(_ text: String) {
        guard phase == .idle else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        lastErrorMessage = nil
        messages.append(ChatMessage(role: "user", text: trimmed))
        let outgoing = messages.map { ChatOutgoingMessage(role: $0.role, text: $0.text) }
        let assistantIndex = messages.count
        messages.append(ChatMessage(role: "assistant", text: ""))

        phase = .streaming
        generation += 1
        let myGeneration = generation
        let requestThreadId = threadId

        AccessibilityNotification.Announcement("답변 작성 중").post()

        streamTask = Task { @MainActor [weak self, api] in
            guard let self else { return }
            do {
                for try await event in api.stream(messages: outgoing, threadId: requestThreadId) {
                    guard !Task.isCancelled else { break }
                    self.apply(event, at: assistantIndex)
                }
            } catch {
                // stop()에 의한 취소는 오류가 아니다 — 부분 답변을 그대로 유지한다.
                if !Task.isCancelled {
                    self.applyError(error, at: assistantIndex)
                }
            }
            self.finishStreaming(generation: myGeneration)
        }
    }

    /// 스트리밍 중단: Task를 취소하되 지금까지 누적된 부분 답변은 그대로 둔다(접미 없음).
    func stop() {
        streamTask?.cancel()
        streamTask = nil
        phase = .idle
    }

    private func finishStreaming(generation: Int) {
        guard self.generation == generation else { return }
        phase = .idle
    }

    private func apply(_ event: ChatStreamEvent, at index: Int) {
        switch event {
        case .textDelta(let delta):
            messages[index].text += delta
        case .metadata(let sourceRefs, let newThreadId):
            messages[index].sourceRefs = sourceRefs
            if let newThreadId {
                threadId = newThreadId
            }
        case .finish:
            break
        }
    }

    private func applyError(_ error: Error, at index: Int) {
        let message: String
        if let apiError = error as? ChatAPIError, apiError == .rateLimited {
            message = "요청이 많아요. 1분 뒤 다시 시도해 주세요."
        } else {
            message = "답변을 가져오지 못했습니다. 네트워크를 확인해 주세요."
        }
        // 오류는 assistant 자리 메시지 text로 표시(답변 위치 한 군데 원칙).
        messages[index].text = message
        lastErrorMessage = message
        AccessibilityNotification.Announcement(message).post()
    }
}
