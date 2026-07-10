import Foundation

/// 인라인 콘텐츠 — 시각 강조는 attributed, 접근성·검색은 plain이 정본.
public struct KBInline: Equatable, Sendable {
    public let attributed: AttributedString
    public let plain: String
    public init(attributed: AttributedString, plain: String) {
        self.attributed = attributed
        self.plain = plain
    }
}

/// 문서 블록 AST — 렌더링(SwiftUI)은 앱 몫, Kit는 값만 제공.
public indirect enum KBBlock: Equatable, Sendable {
    case heading(level: Int, content: KBInline)
    case paragraph(KBInline)
    case bulletList([[KBBlock]])
    case orderedList([[KBBlock]], start: Int)
    case table(header: [KBInline], rows: [[KBInline]])
    case codeBlock(code: String, language: String?)
    case blockquote([KBBlock])
    case image(source: String, alt: String)
    case thematicBreak
}
