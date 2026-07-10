# webfortd iOS 네이티브 M2 구현 계획: RAG 채팅 (익명)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /api/chat`(AI SDK v6 UIMessage SSE)를 소비하는 익명 RAG 채팅을 붙인다. 출처 카드는 번들 위키 문서로 즉시 내부 이동(네이티브 차별화). TabView(위키·채팅) 도입.

**Architecture:** WebfortdKit에 스트림 파서·API 클라이언트(UI 비의존, fixture는 2026-07-10 prod 실캡처), 앱 타깃에 ChatStore(@Observable)·ChatView. 어시스턴트 답변 렌더는 기존 MarkdownBlockParser + BlockRenderer 재사용.

**Tech Stack:** M0·M1과 동일. 신규 의존성 없음(URLSession.bytes).

## Global Constraints (기존 + M2 고유)

- iOS 26, Kit UIKit/SwiftUI import 금지, 이모지·em dash 금지, 주석 한국어, pathspec 커밋. 브랜치 `ios-native-m2`.
- 채팅은 **익명 동작**(로그인 없음, threadId 저장은 M3). rate limit 429는 사용자 문구로 표면화.
- 접근성(웹 PR #78 교훈 이식): 답변은 보이는 곳 한 군데(별도 live 복제 금지), 진행·오류 통지는 `AccessibilityNotification.Announcement` 단일 채널, 전송 중 입력·버튼은 **비활성화 대신 가드**(포커스 이탈 방지), 스트리밍 중단 버튼 제공, 완료 시 답변으로 포커스 이동(`@AccessibilityFocusState`), 터치 타깃 44pt.
- base URL: `AppConfig.webBaseURL` 재사용.
- 스트림 계약(2026-07-10 prod 실캡처 정본, scratchpad `chat-stream-capture.txt`): SSE `data: <json>` 라인. 이벤트 `start{messageId}` `start-step` `text-start` `text-delta{id,delta}` `text-end` `finish-step` `message-metadata{messageMetadata:{sourceRefs:[{slug,title,axis,type,href}], threadId?}}` `finish`, 마지막 `data: [DONE]`. **미지 타입은 무시**(전방 호환).

## 파일 구조 (M2 신규/수정)

```text
ios/WebfortdKit/Sources/WebfortdKit/Chat/ChatModels.swift      ← 신규: SourceRef·이벤트·요청 인코딩
ios/WebfortdKit/Sources/WebfortdKit/Chat/ChatStreamParser.swift← 신규: SSE 라인 → 이벤트
ios/WebfortdKit/Sources/WebfortdKit/Chat/ChatAPI.swift         ← 신규: 스트리밍 클라이언트
ios/WebfortdKit/Tests/WebfortdKitTests/Fixtures/chat-stream.sse← 신규: prod 실캡처
ios/WebfortdKit/Tests/WebfortdKitTests/ChatStreamParserTests.swift ← 신규
ios/WebfortdKit/Tests/WebfortdKitTests/ChatAPITests.swift      ← 신규 (StubURLProtocol)
ios/Webfortd/WebfortdApp.swift                                 ← TabView(위키·채팅) 재구성
ios/Webfortd/Chat/ChatStore.swift                              ← 신규 (@Observable)
ios/Webfortd/Chat/ChatView.swift                               ← 신규
```

---

### Task 1: Kit 채팅 계층 (모델·파서·API + prod fixture)

**Files:**
- Create: `ios/WebfortdKit/Sources/WebfortdKit/Chat/ChatModels.swift`, `ChatStreamParser.swift`, `ChatAPI.swift`
- Create: `ios/WebfortdKit/Tests/WebfortdKitTests/Fixtures/chat-stream.sse` (실캡처 복사)
- Test: `ChatStreamParserTests.swift`, `ChatAPITests.swift`

**Interfaces (Produces):**
```swift
public struct ChatSourceRef: Codable, Equatable, Sendable {
    public let slug: String
    public let title: String
    public let axis: String      // KBAxis rawValue와 호환되나 신규 축 대비 String
    public let type: String
    public let href: String
}

public enum ChatStreamEvent: Equatable, Sendable {
    case textDelta(String)
    case metadata(sourceRefs: [ChatSourceRef], threadId: String?)
    case finish
}

public enum ChatStreamParser {
    /// SSE 한 줄 → 이벤트. 관심 없는 타입·빈 줄·[DONE]은 nil.
    public static func parse(line: String) -> ChatStreamEvent?
}

public struct ChatOutgoingMessage: Sendable {
    public let role: String      // "user" | "assistant"
    public let text: String
    public init(role: String, text: String)
}

public struct ChatAPI {
    public init(baseURL: URL, session: URLSession = .shared)
    /// messages 전체(대화 이력 포함)를 UIMessage JSON으로 인코딩해 POST, 이벤트 스트림 반환.
    public func stream(messages: [ChatOutgoingMessage], threadId: String?)
        -> AsyncThrowingStream<ChatStreamEvent, Error>
}

public enum ChatAPIError: Error, Equatable {
    case rateLimited            // 429
    case server(status: Int)    // 그 외 non-2xx
}
```

**구현 요점:**
- `ChatStreamParser.parse`: `"data: "` 접두 제거 → `"[DONE]"`이면 nil → JSON 디코딩(`type` 스위치). `text-delta`→`.textDelta(delta)`, `message-metadata`→`.metadata(...)`(sourceRefs 없으면 빈 배열, threadId 없으면 nil), `finish`→`.finish`, 그 외 전부 nil(미지 무시). 파싱 불가 라인도 nil(로그 없음).
- `ChatAPI.stream`: dodo ChatAPI 패턴 — `URLSession.bytes(for:)` + `bytes.lines` 순회, `continuation.onTermination`에서 내부 Task cancel, `request.timeoutInterval = 60`. non-2xx는 상태코드 기준 throw(429→`.rateLimited`). UIMessage 인코딩: `{"messages":[{"id":<uuid>,"role":role,"parts":[{"type":"text","text":text}]}], "threadId"?}`.
- fixture: 컨트롤러가 캡처한 `/private/tmp/claude-502/-Users-hunyongkim-Mac-Projects-webfortd/c5b0b37f-c76f-4882-95bb-4fb7f0a82f71/scratchpad/chat-stream-capture.txt`를 `Fixtures/chat-stream.sse`로 복사(캡처 일자 주석은 테스트 파일에).
- `ChatStreamParserTests`: fixture 전체를 라인 순회해 (a) textDelta 조합이 "한국장애인고용공단…"으로 시작하는 전체 답변 복원 (b) metadata의 sourceRefs 3건·첫 slug `2024-jbu-p-016` (c) finish 1회 (d) 미지 타입(`start-step` 등)이 nil (e) 쓰레기 라인 nil.
- `ChatAPITests`: gildongmu 관례의 StubURLProtocol(전역 handler, `@Suite(.serialized)`)로 fixture 바이트를 응답으로 흘려 스트림 end-to-end + 429 → `.rateLimited` throw 검증.

- [ ] Step 1: fixture 복사 + 실패 테스트 작성 → FAIL 확인
- [ ] Step 2: 모델·파서 구현 → 파서 테스트 PASS
- [ ] Step 3: ChatAPI + StubURLProtocol 테스트 PASS (전체 `swift test` 27 + 신규 ≥6)
- [ ] Step 4: 커밋 `feat(ios): 채팅 스트림 파서·API(prod 실캡처 계약)` (pathspec: ios/WebfortdKit)

### Task 2: TabView + ChatStore + ChatView

**Files:**
- Modify: `ios/Webfortd/WebfortdApp.swift`
- Create: `ios/Webfortd/Chat/ChatStore.swift`, `ios/Webfortd/Chat/ChatView.swift`

**Interfaces:**
- Consumes: `ChatAPI`·`ChatStreamEvent`·`ChatSourceRef`·`ChatOutgoingMessage`(Task 1), `MarkdownBlockParser`+`BlockRenderer`+`droppingLeadingTitleHeading` 제외(채팅은 제목 없음 — 미사용), `AppRoute`, `KBStore`(출처 slug 존재 확인)
- Produces: 탭 2개(위키·채팅) 구조, `ChatStore`(`messages: [ChatMessage]`, `phase: idle/streaming`, `send(_:)`, `stop()`), `ChatMessage`(`id`, `role`, `text`, `sourceRefs: [ChatSourceRef]`)

**동작 명세:**
- `WebfortdApp`: `TabView { Tab("위키", systemImage: "books.vertical") { 기존 NavigationStack } ; Tab("채팅", systemImage: "bubble.left.and.text.bubble.right") { NavigationStack { ChatView } } }`. 각 탭 독립 `NavigationStack(path:)` + 공통 `navigationDestination(AppRoute)`(채팅 탭에서도 문서 push 가능). openURL 핸들러는 **현재 선택 탭의 path**에 push하도록 `@State selectedTab` 기준 분기. SF Symbol은 `aria-hidden` 등가(장식) — Tab 라벨 텍스트가 접근 이름.
- `ChatStore`(@Observable, MainActor 기본): `send(text)` — (a) 재진입 가드(`phase == .streaming`이면 무시), (b) user 메시지 append, (c) 빈 assistant 메시지 append 후 `ChatAPI.stream(messages: 전체 이력)` 소비하며 마지막 메시지 text에 delta 누적, metadata의 sourceRefs 반영, (d) 완료·오류 시 phase 복귀. `stop()` — 소비 Task cancel(부분 답변은 유지 + " (중단됨)" 접미 없이 그대로). 오류 매핑: `.rateLimited` → "요청이 많아요. 1분 뒤 다시 시도해 주세요.", 그 외 → "답변을 가져오지 못했습니다. 네트워크를 확인해 주세요."(오류는 assistant 자리 메시지 text로 표시 — 답변 위치 한 군데 원칙).
- `ChatView`:
  - 스크롤 메시지 리스트: user 버블(트레일링 정렬 배경), assistant는 **BlockRenderer**로 마크다운 렌더(전각 배치). 각 메시지 컨테이너는 combine하지 않음(본문 블록 접근성 구조 유지) — user 버블만 단일 Text.
  - 출처 카드: assistant 메시지 하단, sourceRefs 각각 `Button("출처: \(title)")` → `KBStore.summary(slug:)` 존재하면 `AppRoute.document(slug:)` push, 없으면(번들 외 문서) 웹 URL(`AppConfig.webBaseURL + href`) `Link`로 폴백. 44pt.
  - 입력 바: TextField(축 라벨 "질문 입력") + 전송 버튼. 전송 중: TextField는 `disabled` 금지 — 입력은 유지하되 send 가드, 전송 버튼은 중단 버튼으로 교체(같은 위치, 라벨 "중단").
  - 통지: 전송 직후 `Announcement("답변 작성 중")` 1회, 완료 시 답변 첫 부분으로 `@AccessibilityFocusState` 포커스 이동(별도 완료 통지 없음 — 포커스 이동이 신호). 오류 시 오류 문구 Announcement 1회.
  - 첫 화면(메시지 0건): 짧은 안내 `ContentUnavailableView("정책·제도를 물어보세요", systemImage:"bubble.left.and.text.bubble.right", description: "예: 보조공학기기 지원은 어떻게 신청하나요?")`.
- 상단 내비게이션 타이틀 "채팅". 면책 문구는 서버 응답에 이미 포함되므로 UI 중복 금지(미니멀).

- [ ] Step 1: TabView 재구성 + ChatStore + ChatView 구현, 빌드
- [ ] Step 2: **실호출 스모크**(시뮬레이터): 질문 전송 → 스트리밍 표시 → 출처 카드 → 카드 탭 시 번들 문서 push 확인. 스크린샷 `/tmp/webfortd-m2-chat.png`
- [ ] Step 3: swift test 전체 green 유지 확인
- [ ] Step 4: 커밋 `feat(ios): 채팅 탭(스트리밍·출처 카드·중단, BlockRenderer 재사용)` (pathspec: ios/Webfortd)

### Task 3: 첨부 (이미지·PDF 1건)

**Files:**
- Modify: `ios/WebfortdKit/Sources/WebfortdKit/Chat/ChatModels.swift`·`ChatAPI.swift` (file part 인코딩)
- Modify: `ios/Webfortd/Chat/ChatStore.swift`·`ChatView.swift`
- Test: `ChatAPITests.swift`에 file part 인코딩 검증 추가

**동작 명세 (웹 계약 미러):**
- 서버 계약: 파일은 UIMessage parts에 `{type:"file", mediaType, url:"data:<mime>;base64,<...>", filename}`, **1건만**, 10MB 초과 400. 허용 MIME: 이미지(image/png·jpeg·webp·heic는 클라이언트에서 jpeg 변환)·application/pdf (HWP류는 v1 iOS 미지원 — 파일 선택 UTType을 이미지·PDF로 제한, 잉여 회피).
- Kit: `ChatOutgoingMessage`에 `attachment: ChatAttachment?` 추가(`ChatAttachment{mediaType, dataBase64, filename}`), 인코딩 시 text part 뒤 file part. 테스트: 인코딩된 JSON에 file part 포함 검증.
- 앱: 입력 바에 첨부 버튼(라벨 "파일 첨부") → `confirmationDialog`(사진 보관함 PhotosPicker / 파일 .fileImporter(PDF)). 선택 후 입력 바 위에 "첨부: <파일명>" 행 + 제거 버튼(combine). 10MB 초과 시 즉시 안내 문구(Announcement + 표시) 후 미첨부. 전송 시 attachment 포함, 전송 후 클리어.

- [ ] Step 1: Kit file part 인코딩 + 테스트 → PASS
- [ ] Step 2: 앱 첨부 UI + 검증 로직, 빌드
- [ ] Step 3: 실호출 스모크(작은 PNG 1장 첨부 질문 — "이 이미지에 뭐라고 쓰여 있어?" 등) 확인, 스크린샷 `/tmp/webfortd-m2-attach.png`
- [ ] Step 4: 전체 swift test green + 커밋 `feat(ios): 채팅 첨부(이미지·PDF 1건, data URL 인코딩)` (pathspec: ios/WebfortdKit ios/Webfortd)
