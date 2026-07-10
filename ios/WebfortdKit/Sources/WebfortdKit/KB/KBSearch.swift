import Foundation

public struct KBSearchResult: Equatable, Sendable {
    public let slug: String
    public let title: String
    public let axis: KBAxis
    public let snippet: String?
}

/// 번들 published 문서 전용 오프라인 검색. 모든 토큰 AND 매치, 제목 가중 정렬.
public final class KBSearch {
    private let store: KBStore
    /// slug → 소문자 본문. 첫 검색에서 1회 구축(535건 약 4MB 수용).
    private var bodyCache: [String: String]?

    public init(store: KBStore) {
        self.store = store
    }

    public func search(_ query: String, limit: Int = 50) -> [KBSearchResult] {
        let tokens = query.lowercased()
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
        guard !tokens.isEmpty else { return [] }
        let bodies = loadBodiesIfNeeded()

        var scored: [(doc: KBDocumentSummary, titleHits: Int, snippet: String?)] = []
        for doc in store.documents {
            let title = doc.frontmatter.title.lowercased()
            let body = bodies[doc.slug] ?? ""
            var titleHits = 0
            var allMatch = true
            var firstBodyToken: String?
            for token in tokens {
                let inTitle = title.contains(token)
                let inBody = body.contains(token)
                if inTitle { titleHits += 1 }
                if !inTitle && !inBody { allMatch = false; break }
                if !inTitle && inBody && firstBodyToken == nil { firstBodyToken = token }
            }
            guard allMatch else { continue }
            let snippet = firstBodyToken.flatMap { Self.snippet(around: $0, in: bodies[doc.slug] ?? "") }
            scored.append((doc, titleHits, snippet))
        }

        let sorted = scored.sorted {
            if $0.titleHits != $1.titleHits { return $0.titleHits > $1.titleHits }
            let byTitle = $0.doc.frontmatter.title.compare(
                $1.doc.frontmatter.title, options: [], range: nil,
                locale: Locale(identifier: "ko"))
            if byTitle != .orderedSame { return byTitle == .orderedAscending }
            return $0.doc.slug < $1.doc.slug
        }
        return sorted.prefix(limit).map {
            KBSearchResult(slug: $0.doc.slug, title: $0.doc.frontmatter.title,
                           axis: $0.doc.axis, snippet: $0.snippet)
        }
    }

    private func loadBodiesIfNeeded() -> [String: String] {
        if let bodyCache { return bodyCache }
        var cache: [String: String] = [:]
        for doc in store.documents {
            // 로드 실패 문서는 제목-만 검색 대상(best-effort).
            cache[doc.slug] = (try? store.loadBody(slug: doc.slug))?.lowercased() ?? ""
        }
        bodyCache = cache
        return cache
    }

    /// 첫 매치가 포함된 라인을 80자 내로 발췌.
    static func snippet(around token: String, in lowerBody: String) -> String? {
        guard let range = lowerBody.range(of: token) else { return nil }
        let lineStart = lowerBody[..<range.lowerBound].lastIndex(of: "\n")
            .map { lowerBody.index(after: $0) } ?? lowerBody.startIndex
        let lineEnd = lowerBody[range.upperBound...].firstIndex(of: "\n") ?? lowerBody.endIndex
        var line = String(lowerBody[lineStart..<lineEnd])
            .trimmingCharacters(in: .whitespaces)
        // 마크다운 잔재 최소 정리(발췌 가독): 리스트 마커·헤딩 마커 제거
        while line.hasPrefix("#") || line.hasPrefix("-") || line.hasPrefix("*") {
            line = String(line.dropFirst()).trimmingCharacters(in: .whitespaces)
        }
        if line.count > 80 {
            line = String(line.prefix(80)) + "…"
        }
        return line.isEmpty ? nil : line
    }
}
