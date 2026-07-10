import Foundation

/// 번들 KB 스토어 — 인덱스 로드·조회·본문 로드. UI 비의존.
public final class KBStore: Sendable {
    public let index: KBIndex
    private let contentRootURL: URL
    private let knownSlugs: Set<String>

    public init(indexURL: URL, contentRootURL: URL) throws {
        self.index = try JSONDecoder().decode(KBIndex.self, from: Data(contentsOf: indexURL))
        self.contentRootURL = contentRootURL
        self.knownSlugs = Set(index.slugIndex.keys)
    }

    /// 앱 리소스(Resources/KB)에서 로드. 파이프라인 미실행 시 throw.
    public static func bundled() throws -> KBStore {
        guard let root = Bundle.module.url(forResource: "KB", withExtension: nil) else {
            throw KBStoreError.bundleMissing
        }
        return try KBStore(
            indexURL: root.appendingPathComponent("kb-index.json"),
            contentRootURL: root)
    }

    public var documents: [KBDocumentSummary] { index.documents }

    /// 웹 sortDocsForList 미러: 제목 가나다(ko) 1차, slug 2차 안정 정렬.
    public func documents(in axis: KBAxis) -> [KBDocumentSummary] {
        index.documents
            .filter { $0.axis == axis }
            .sorted {
                let byTitle = $0.frontmatter.title.compare(
                    $1.frontmatter.title, options: [], range: nil,
                    locale: Locale(identifier: "ko"))
                if byTitle != .orderedSame { return byTitle == .orderedAscending }
                return $0.slug < $1.slug
            }
    }

    public func summary(slug: String) -> KBDocumentSummary? {
        index.documents.first { $0.slug == slug }
    }

    public func backlinks(slug: String) -> [KBBacklink] {
        index.wikiBacklinks[slug] ?? []
    }

    /// slug로 본문 로드(frontmatter 제거 + 위키링크 전처리).
    public func loadBody(slug: String) throws -> String {
        guard let filePath = index.slugIndex[slug] else { throw KBStoreError.unknownSlug(slug) }
        return try loadBody(atRelativePath: filePath)
    }

    /// contentRoot 기준 상대 경로 로드 — 테스트 주입용 공개.
    public func loadBody(atRelativePath relativePath: String) throws -> String {
        let url = contentRootURL.appendingPathComponent(relativePath)
        let raw = try String(contentsOf: url, encoding: .utf8)
        let body = Self.strippingFrontmatter(raw)
        return WikilinkRewriter.rewrite(body, isKnownSlug: { self.knownSlugs.contains($0) })
    }

    /// 선두 `---` ... `---` frontmatter 블록 제거.
    static func strippingFrontmatter(_ raw: String) -> String {
        let lines = raw.split(separator: "\n", omittingEmptySubsequences: false)
        guard lines.first?.trimmingCharacters(in: .whitespaces) == "---" else { return raw }
        guard let end = lines.dropFirst().firstIndex(where: {
            $0.trimmingCharacters(in: .whitespaces) == "---"
        }) else { return raw }
        return lines[(end + 1)...].joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

public enum KBStoreError: Error, Equatable {
    case bundleMissing
    case unknownSlug(String)
}
