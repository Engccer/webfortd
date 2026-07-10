import SwiftUI
import WebfortdKit

/// [KBBlock] → SwiftUI. 접근성: 헤딩 로터, 리스트 항목·표 행 = 한 객체.
struct BlockRenderer: View {
    let blocks: [KBBlock]

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                BlockView(block: block)
            }
        }
    }
}

private struct BlockView: View {
    let block: KBBlock

    var body: some View {
        switch block {
        case .heading(let level, let content):
            Text(content.attributed)
                .font(headingFont(level))
                .bold()
                .accessibilityAddTraits(.isHeader)
                .padding(.top, 8)
        case .paragraph(let inline):
            Text(inline.attributed)
        case .bulletList(let items):
            listView(items: items, marker: { _ in "•" })
        case .orderedList(let items, let start):
            listView(items: items, marker: { index in "\(start + index)." })
        case .table(let header, let rows):
            tableView(header: header, rows: rows)
        case .codeBlock(let code, _):
            ScrollView(.horizontal) {
                Text(code).font(.body.monospaced()).padding(8)
            }
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
        case .blockquote(let blocks):
            HStack(alignment: .top, spacing: 8) {
                Rectangle().fill(.tertiary).frame(width: 3)
                BlockRenderer(blocks: blocks)
            }
        case .image(let source, let alt):
            documentImage(source: source, alt: alt)
        case .thematicBreak:
            Divider()
        }
    }

    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: .title
        case 2: .title2
        case 3: .title3
        default: .headline
        }
    }

    private func listView(items: [[KBBlock]], marker: @escaping (Int) -> String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                HStack(alignment: .top, spacing: 6) {
                    Text(marker(index)).accessibilityHidden(true)
                    BlockRenderer(blocks: item)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    /// 표: 행 단위 접근성 객체. "헤더 값, 헤더 값" 순으로 낭독.
    private func tableView(header: [KBInline], rows: [[KBInline]]) -> some View {
        ScrollView(.horizontal) {
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                GridRow {
                    ForEach(Array(header.enumerated()), id: \.offset) { _, cell in
                        Text(cell.attributed).bold()
                    }
                }
                .accessibilityElement(children: .combine)
                Divider()
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    GridRow {
                        ForEach(Array(row.enumerated()), id: \.offset) { column, cell in
                            Text(cell.attributed)
                                .accessibilityLabel(rowCellLabel(header: header, column: column, cell: cell))
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func rowCellLabel(header: [KBInline], column: Int, cell: KBInline) -> String {
        guard column < header.count, !header[column].plain.isEmpty else { return cell.plain }
        return "\(header[column].plain) \(cell.plain)"
    }

    private func documentImage(source: String, alt: String) -> some View {
        let url = URL(string: source, relativeTo: AppConfig.webBaseURL)
        return AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFit()
            default:
                // 오프라인·로드 실패: alt 텍스트가 정본(멀티미디어 작성 원칙).
                Text(alt.isEmpty ? "이미지" : alt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .accessibilityLabel(alt.isEmpty ? "이미지" : alt)
    }
}
