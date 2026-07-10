import Foundation

/// KB 콘텐츠 축: 웹 `src/types/kb.ts` CONTENT_AXES 미러.
public enum KBAxis: String, Codable, CaseIterable, Sendable {
    case disabilityTypes = "disability-types"
    case domains, regions, policies, agreements, faq, stories, resources, uncategorized
}

/// 문서 상태: 웹 StatusSchema 미러. 번들에는 published만 오지만 방어적으로 전체 수용.
public enum KBStatus: String, Codable, Sendable {
    case draft, inReview = "in_review", published, archived, deprecated
}

public struct KBSource: Codable, Equatable, Sendable {
    public let organization: String
    public let citation: String
    public let url: String?
}

/// 앱이 사용하는 frontmatter 부분집합. 미지 필드는 무시(전방 호환).
public struct KBFrontmatter: Codable, Equatable, Sendable {
    public let title: String
    public let type: String
    public let year: Int
    public let status: KBStatus
    public let source: KBSource
    public let subtitle: String?
}

public struct KBDocumentSummary: Codable, Equatable, Sendable {
    public let slug: String
    public let axis: KBAxis
    public let filePath: String
    public let frontmatter: KBFrontmatter
}

public struct KBBacklink: Codable, Equatable, Sendable {
    public let from: String
    public let anchor: String?
    public let linkText: String?
    enum CodingKeys: String, CodingKey {
        case from, anchor
        case linkText = "link_text"
    }
}

/// 번들 축소 인덱스: ios/scripts/bundle-content.mjs 산출 스키마.
public struct KBIndex: Codable, Sendable {
    public let generatedAt: String?
    public let sourceCount: Int
    public let documents: [KBDocumentSummary]
    public let wikiBacklinks: [String: [KBBacklink]]
    public let slugIndex: [String: String]
    enum CodingKeys: String, CodingKey {
        case generatedAt = "generated_at"
        case sourceCount = "source_count"
        case documents
        case wikiBacklinks = "wiki_backlinks"
        case slugIndex = "slug_index"
    }
}
