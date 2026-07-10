import Foundation

/// 웹 scripts/sync-content.ts WIKILINK_RE 등가 전처리.
/// `[[slug]]` `[[slug#anchor]]` `[[slug|라벨]]` → 표준 마크다운 링크(webfortd-wiki:// 스킴).
public enum WikilinkRewriter {
    // group1 = slug, group2 = anchor(미사용), group3 = 라벨
    nonisolated(unsafe) private static let pattern = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/

    public static func rewrite(_ markdown: String, isKnownSlug: (String) -> Bool) -> String {
        var out: [Substring] = []
        var inFence = false
        for line in markdown.split(separator: "\n", omittingEmptySubsequences: false) {
            if line.trimmingCharacters(in: .whitespaces).hasPrefix("```") {
                inFence.toggle()
                out.append(line)
                continue
            }
            guard !inFence else { out.append(line); continue }
            out.append(Substring(rewriteLine(String(line), isKnownSlug: isKnownSlug)))
        }
        return out.joined(separator: "\n")
    }

    private static func rewriteLine(_ line: String, isKnownSlug: (String) -> Bool) -> String {
        line.replacing(pattern) { match in
            let slug = String(match.1).trimmingCharacters(in: .whitespaces)
            let label = match.3.map(String.init) ?? slug
            guard isKnownSlug(slug) else { return label }
            return "[\(label)](\(KBLink.scheme)://\(slug))"
        }
    }
}

public enum KBLink {
    public static let scheme = "webfortd-wiki"
}
