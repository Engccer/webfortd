import Foundation

/// 인라인 콘텐츠: 시각 강조는 attributed, 접근성·검색은 plain이 정본.
public struct KBInline: Equatable, Sendable {
    public let attributed: AttributedString
    public let plain: String
    public init(attributed: AttributedString, plain: String) {
        self.attributed = attributed
        self.plain = plain
    }
}

/// 문서 블록 AST: 렌더링(SwiftUI)은 앱 몫, Kit는 값만 제공.
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

public extension [KBBlock] {
    /// 본문 첫 블록이 문서 제목과 동일한 heading이면 제거한다.
    /// 코퍼스 98.3%가 "첫 heading == frontmatter title"이라 그대로 두면
    /// 화면과 VoiceOver 헤딩 로터에 같은 제목이 두 번 나온다(같은 정보 반복 금지).
    func droppingLeadingTitleHeading(title: String) -> [KBBlock] {
        guard case let .heading(_, content) = first,
              content.plain.trimmingCharacters(in: .whitespaces)
                == title.trimmingCharacters(in: .whitespaces)
        else { return self }
        return Array(dropFirst())
    }
}
