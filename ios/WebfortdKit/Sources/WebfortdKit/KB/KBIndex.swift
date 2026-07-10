/// KB 콘텐츠 축 — 웹 `src/types/kb.ts` CONTENT_AXES 미러.
public enum KBAxis: String, Codable, CaseIterable, Sendable {
    case disabilityTypes = "disability-types"
    case domains, regions, policies, agreements, faq, stories, resources, uncategorized
}
