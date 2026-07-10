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

    /// 블록 트리의 낭독·검색용 순수 텍스트 라인들(코드블록·이미지·구분선 제외).
    /// 접근성·검색은 plain이 정본, raw 마크다운(`<br/>`·표 파이프·`**`·`\r`)이
    /// 아니라 이 라인들을 캐시·발췌 대상으로 삼는다.
    var plainLines: [String] {
        flatMap { block -> [String] in
            switch block {
            case .heading(_, let inline): return [inline.plain]
            case .paragraph(let inline): return [inline.plain]
            case .bulletList(let items), .orderedList(let items, _):
                return items.flatMap(\.plainLines)
            case .table(let header, let rows):
                return [header.map(\.plain).joined(separator: ", ")]
                    + rows.map { $0.map(\.plain).joined(separator: ", ") }
            case .blockquote(let blocks): return blocks.plainLines
            case .codeBlock, .image, .thematicBreak: return []
            }
        }
    }
}
