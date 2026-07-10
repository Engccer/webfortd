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
    /// slug → (lower: 소문자 매칭용, original: 원본 대소문자 보존) plain 텍스트 쌍
    /// (파싱 후, 코드블록·이미지·구분선 제외). raw 마크다운이 아니라 이 캐시로
    /// 검색·발췌한다 — 접근성·검색은 plain이 정본(KBBlock 원칙).
    /// 매칭(AND 토큰 포함 여부)은 lower로, snippet 발췌는 original에서 해
    /// 대문자 약어(NEIS 등)가 소문자로 노출되는 것을 막는다.
    /// 첫 검색에서 1회 구축(535건 전량 파싱, 약 1초 소요).
    private var bodyCache: [String: (lower: String, original: String)]?

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
            let body = bodies[doc.slug] ?? (lower: "", original: "")
            var titleHits = 0
            var allMatch = true
            var firstBodyToken: String?
            for token in tokens {
                let inTitle = title.contains(token)
                let inBody = body.lower.contains(token)
                if inTitle { titleHits += 1 }
                if !inTitle && !inBody { allMatch = false; break }
                if inBody && firstBodyToken == nil { firstBodyToken = token }
            }
            guard allMatch else { continue }
            let snippet = firstBodyToken.flatMap { Self.snippet(around: $0, in: body.original) }
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

    private func loadBodiesIfNeeded() -> [String: (lower: String, original: String)] {
        if let bodyCache { return bodyCache }
        var cache: [String: (lower: String, original: String)] = [:]
        for doc in store.documents {
            // 로드 실패 문서는 제목-만 검색 대상(best-effort).
            guard let raw = try? store.loadBody(slug: doc.slug) else {
                cache[doc.slug] = (lower: "", original: "")
                continue
            }
            let original = MarkdownBlockParser.parse(raw).plainLines
                .joined(separator: "\n")
            cache[doc.slug] = (lower: original.lowercased(), original: original)
        }
        bodyCache = cache
        return cache
    }

    /// 첫 매치가 포함된 라인을 80자 내로 발췌. `original`은 plain 캐시(원본 대소문자
    /// 보존)라 마크다운 마커(`<br/>`·파이프·`**`·`\r`)만 이미 제거된 상태다.
    /// 매칭은 대소문자 무시(호출측 token은 소문자일 수 있음), 발췌는 원문 그대로.
    static func snippet(around token: String, in original: String) -> String? {
        guard let range = original.range(of: token, options: .caseInsensitive) else { return nil }
        let lineStart = original[..<range.lowerBound].lastIndex(of: "\n")
            .map { original.index(after: $0) } ?? original.startIndex
        let lineEnd = original[range.upperBound...].firstIndex(of: "\n") ?? original.endIndex
        var line = String(original[lineStart..<lineEnd])
            .trimmingCharacters(in: .whitespaces)
        if line.count > 80 {
            line = String(line.prefix(80)) + "…"
        }
        return line.isEmpty ? nil : line
    }
}
