import Foundation
import Markdown

/// swift-markdown Document → [KBBlock]. GFM 표 지원이 채택 근거(161개 문서가 표 사용).
public enum MarkdownBlockParser {
    public static func parse(_ markdown: String) -> [KBBlock] {
        let document = Document(parsing: markdown)
        return document.children.compactMap { convertBlock($0) }
    }

    private static func convertBlock(_ markup: Markup) -> KBBlock? {
        switch markup {
        case let heading as Heading:
            return .heading(level: heading.level, content: inline(of: heading))
        case let paragraph as Paragraph:
            // 단독 이미지 문단은 image 블록으로 승격(렌더러가 AsyncImage+alt 처리).
            if paragraph.childCount == 1, let image = paragraph.child(at: 0) as? Markdown.Image {
                return .image(source: image.source ?? "", alt: image.plainText)
            }
            return .paragraph(inline(of: paragraph))
        case let list as UnorderedList:
            return .bulletList(list.listItems.map { item in
                item.children.compactMap { convertBlock($0) }
            })
        case let list as OrderedList:
            return .orderedList(
                list.listItems.map { item in item.children.compactMap { convertBlock($0) } },
                start: Int(list.startIndex))
        case let table as Markdown.Table:
            // cells/rows는 LazyMapSequence — .map을 이어붙이면 lazy 체이닝이 지속돼
            // [KBInline]/[[KBInline]]로 바로 대입되지 않는다(swift-markdown 0.8.0 실측). Array(...)로 즉시 평가.
            let header = Array(table.head.cells.map { inline(of: $0) })
            let rows = Array(table.body.rows.map { row in Array(row.cells.map { inline(of: $0) }) })
            return .table(header: header, rows: rows)
        case let code as CodeBlock:
            return .codeBlock(code: code.code.trimmingCharacters(in: .newlines),
                              language: code.language)
        case let quote as BlockQuote:
            return .blockquote(quote.children.compactMap { convertBlock($0) })
        case is ThematicBreak:
            return .thematicBreak
        case let html as HTMLBlock:
            // 원문 md의 드문 HTML은 평문으로 강등(렌더 불능보다 정보 보존).
            let text = html.rawHTML.trimmingCharacters(in: .whitespacesAndNewlines)
            return .paragraph(KBInline(attributed: AttributedString(text), plain: text))
        default:
            // 미지 블록은 평문 폴백(전방 호환).
            let text = markup.format().trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            return .paragraph(KBInline(attributed: AttributedString(text), plain: text))
        }
    }

    /// 인라인 마크업 → AttributedString(+plain). 강조·인라인코드·링크만 반영(미니멀).
    /// 파라미터 타입은 swift-markdown 0.8.0 실제 API 기준 `any PlainTextConvertibleMarkup`
    /// (brief 원안의 `Markup`은 `plainText`를 선언하지 않아 컴파일 불가 — Task 5 리포트 참조).
    private static func inline(of container: any PlainTextConvertibleMarkup) -> KBInline {
        var attributed = AttributedString()
        appendInlines(container.children, to: &attributed, bold: false, italic: false, link: nil)
        return KBInline(attributed: attributed, plain: container.plainText)
    }

    private static func appendInlines(
        _ children: MarkupChildren, to attributed: inout AttributedString,
        bold: Bool, italic: Bool, link: URL?
    ) {
        for child in children {
            switch child {
            case let text as Markdown.Text:
                attributed.append(styled(text.string, bold: bold, italic: italic, link: link))
            case let strong as Strong:
                appendInlines(strong.children, to: &attributed, bold: true, italic: italic, link: link)
            case let emphasis as Emphasis:
                appendInlines(emphasis.children, to: &attributed, bold: bold, italic: true, link: link)
            case let code as InlineCode:
                var run = AttributedString(code.code)
                run.inlinePresentationIntent = .code
                attributed.append(run)
            case let anchor as Markdown.Link:
                let url = anchor.destination.flatMap(URL.init(string:))
                appendInlines(anchor.children, to: &attributed, bold: bold, italic: italic, link: url)
            case let image as Markdown.Image:
                // 인라인 이미지는 alt 텍스트로 강등(단독 이미지는 블록에서 처리).
                attributed.append(styled(image.plainText, bold: bold, italic: italic, link: link))
            case is SoftBreak, is LineBreak:
                attributed.append(AttributedString(" "))
            default:
                // 미지 인라인(Strikethrough·InlineHTML·SymbolLink 등)은 InlineMarkup.plainText로 강등.
                // `Markup`(기저 프로토콜) 자체엔 plainText가 없어(swift-markdown 0.8.0 실측) 하위 프로토콜로 캐스팅.
                let text = (child as? InlineMarkup)?.plainText ?? child.format()
                attributed.append(styled(text, bold: bold, italic: italic, link: link))
            }
        }
    }

    private static func styled(_ string: String, bold: Bool, italic: Bool, link: URL?) -> AttributedString {
        var run = AttributedString(string)
        switch (bold, italic) {
        case (true, true): run.inlinePresentationIntent = [.stronglyEmphasized, .emphasized]
        case (true, false): run.inlinePresentationIntent = .stronglyEmphasized
        case (false, true): run.inlinePresentationIntent = .emphasized
        case (false, false): break
        }
        if let link { run.link = link }
        return run
    }
}
