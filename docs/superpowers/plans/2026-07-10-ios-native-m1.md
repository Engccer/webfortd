# webfortd iOS 네이티브 M1 구현 계획: 오프라인 검색 + 백링크 + 위키 홈 완성

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 번들 인덱스 기반 완전 오프라인 검색, 문서 백링크 섹션, 오늘의 위키 홈 섹션을 붙여 위키 축을 완성한다(spec §7 M1).

**Architecture:** M0 구조 그대로. KBSearch는 WebfortdKit(UI 비의존)에, UI는 앱 타깃에. 네트워크 코드 없음.

**Tech Stack:** M0과 동일(Swift 6 + SwiftUI + Swift Testing, 의존성 swift-markdown만).

## Global Constraints (M0 plan 전사, 동일 적용)

- iOS 26, availability guard 금지. WebfortdKit UIKit/SwiftUI import 금지.
- 접근성: 한 줄=한 객체(combine, 쉼표 구분), 통지는 `AccessibilityNotification.Announcement` 단일 채널(polite 등가), 3-state 분리, 터치 타깃 44pt, 이모지·em dash 금지, 주석 한국어.
- 커밋 pathspec 원자 방식. 브랜치 `ios-native-m1`(master에서 신규), 완료 시 PR.
- 검색 대상은 번들 published 문서만(자동 충족: 번들 자체가 published-only).

## M0에서 이월된 보강 (Task 1에 포함)

- 전량 파싱 스모크 assertion 강화: plain에 태그 노이즈 잔존 검사(`<page_header`·`<br`·`</` 0건 — `<개정 ...>` 한국어 표기는 오탐 없도록 이 3패턴만).

## 파일 구조 (M1 완료 시점 신규/수정)

```text
ios/WebfortdKit/Sources/WebfortdKit/KB/KBSearch.swift          ← 신규: 검색 엔진
ios/WebfortdKit/Tests/WebfortdKitTests/KBSearchTests.swift     ← 신규
ios/WebfortdKit/Tests/WebfortdKitTests/MarkdownBlockParserTests.swift ← 스모크 강화
ios/Webfortd/WikiHomeView.swift                                ← .searchable + 검색 결과 + 오늘의 위키
ios/Webfortd/DocumentView.swift                                ← 백링크 섹션
```

---

### Task 1: KBSearch 엔진 + 스모크 강화 (Kit)

**Files:**
- Create: `ios/WebfortdKit/Sources/WebfortdKit/KB/KBSearch.swift`
- Modify: `ios/WebfortdKit/Tests/WebfortdKitTests/MarkdownBlockParserTests.swift` (스모크 1개 강화)
- Test: `ios/WebfortdKit/Tests/WebfortdKitTests/KBSearchTests.swift`

**Interfaces:**
- Consumes: `KBStore`(`documents`·`loadBody(slug:)`), `KBAxis`, `KBDocumentSummary`
- Produces:
  - `KBSearchResult`(struct, Equatable·Sendable): `slug: String`, `title: String`, `axis: KBAxis`, `snippet: String?`
  - `KBSearch`(final class): `init(store: KBStore)`, `func search(_ query: String, limit: Int = 50) -> [KBSearchResult]`
- 검색 의미론(웹 SiteSearch와 동일 정신, 구현 독립):
  - 질의를 공백으로 토큰화, 소문자 비교. **모든 토큰**이 (제목 ∪ 본문)에 나타나는 문서만 매치(AND).
  - 정렬: 제목에 매치된 토큰 수 내림차순 → 제목 가나다(ko locale) → slug. 결정적.
  - `snippet`: 본문 첫 매치 주변 발췌(라인 기준, 앞뒤 합쳐 최대 80자). 제목만 매치면 nil.
  - 본문은 첫 검색 시 전량 로드 후 소문자 캐시(535건 약 4MB, 인메모리 수용). 빈 질의·공백 질의는 빈 배열.

- [ ] **Step 1: 실패하는 테스트 작성**

`KBSearchTests.swift`:
```swift
import Foundation
import Testing
@testable import WebfortdKit

// kb-index-mini.json(2건) + doc-sample.md 실캡처 fixture 재사용.
@Suite struct KBSearchTests {
    func makeSearch() throws -> KBSearch {
        let indexURL = try #require(Bundle.module.url(
            forResource: "Fixtures/kb-index-mini", withExtension: "json"))
        let store = try KBStore(indexURL: indexURL,
                                contentRootURL: indexURL.deletingLastPathComponent())
        return KBSearch(store: store)
    }

    @Test func 제목_토큰_매치가_우선한다() throws {
        let results = try makeSearch().search("유효기간")
        #expect(results.first?.slug == "2020-ca-1-2")
    }

    @Test func 모든_토큰_AND_매치만_반환한다() throws {
        let search = try makeSearch()
        #expect(search.search("유효기간 존재하지않는토큰XYZ").isEmpty)
    }

    @Test func 빈_질의는_빈_배열() throws {
        let search = try makeSearch()
        #expect(search.search("").isEmpty)
        #expect(search.search("   ").isEmpty)
    }
}
```
주의: fixture 인덱스의 filePath(`content/agreements/2020-ca-1-2.md`)가 Fixtures 평면 구조와 다르므로, 테스트가 도는 fixture 세팅은 KBStoreTests의 기존 방식과 동일하게 body 로드 실패를 허용해야 한다. **KBSearch는 body 로드에 실패한 문서를 제목-만 검색 대상으로 취급한다**(3-state 뭉개기 아님: 검색은 가용 정보 기반 best-effort, 문서 열람은 별도 오류 처리) — 이 동작 자체가 위 테스트의 전제다.

- [ ] **Step 2: FAIL 확인** — `swift test --package-path ios/WebfortdKit`

- [ ] **Step 3: 구현**

`KBSearch.swift`:
```swift
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
```
주의: `KBSearch`는 `bodyCache` 가변 상태가 있어 Sendable이 아니다 — 앱에서는 MainActor(기본 격리) 위에서만 사용한다. Kit는 main actor 기본이 아니므로 클래스에 `@MainActor` 붙이지 말 것(테스트는 그대로 동작).

- [ ] **Step 4: 스모크 강화** — `MarkdownBlockParserTests.swift`의 `번들_전량_파싱_스모크`에서, 파싱된 모든 블록의 plain을 수집해 다음 3패턴 잔존 0건 assertion 추가: `"<page_header"`, `"<br"`, `"</"`. (paragraph·heading·table 셀·리스트 항목을 재귀 수집하는 private 헬퍼를 테스트 파일 안에 작성.)

- [ ] **Step 5: PASS 확인** — `node ios/scripts/bundle-content.mjs && swift test --package-path ios/WebfortdKit` (기존 21 + 신규 3 = 24)

- [ ] **Step 6: 커밋**

```bash
git add ios/WebfortdKit/Sources/WebfortdKit/KB/KBSearch.swift ios/WebfortdKit/Tests/WebfortdKitTests
git commit -m "feat(ios): KBSearch 오프라인 검색 엔진 + 파싱 스모크 태그 잔존 검사 강화" -- ios/WebfortdKit
```

### Task 2: 검색 UI + 오늘의 위키 (홈)

**Files:**
- Modify: `ios/Webfortd/WikiHomeView.swift`

**Interfaces:**
- Consumes: `KBSearch`, `KBSearchResult`, `AppRoute`, `BrowsableAxis.all`, `KBStore`
- Produces: 홈 화면 최종형 — `.searchable` 검색창, 검색 중엔 결과 목록이 홈 콘텐츠를 대체, 평시엔 "오늘의 위키" 섹션 + 축 카드 목록.

**동작 명세:**
- `.searchable(text:prompt: "정책·제도 검색")`을 NavigationStack 안 List에 부착. iOS 표준 검색 UX(취소·클리어 무료 획득).
- 검색 실행은 **submit 시**(`.onSubmit(of: .search)`)로 한다. 타이핑마다 실행하지 않는다(VoiceOver 사용자에게 결과 갱신 소음 방지, 미니멀).
- 결과 행: `Text("\(result.title), \(axisLabel)")` + snippet이 있으면 아래 줄 `.secondary`. 행 전체 `.accessibilityElement(children: .combine)` + `minHeight 44`. 탭 → `AppRoute.document(slug:)`.
- 결과 상태 통지(단일 채널): submit 처리 직후 `AccessibilityNotification.Announcement("검색 결과 \(count)건").post()`. 0건이면 "검색 결과가 없습니다" + 화면에도 `ContentUnavailableView.search` 표시(3-state: 검색 전 ≠ 0건).
- 검색어를 지우면(빈 문자열) 홈 콘텐츠로 복귀.
- **오늘의 위키**: 평시 홈 최상단 섹션. `day = Calendar.current.ordinality(of: .day, in: .year, for: Date())`로 `store.documents`(slug 정렬본)에서 `day % count` 문서 1건. 행 구성은 검색 결과 행과 동일 규칙(제목+축, combine). 섹션 헤더 `Text("오늘의 위키")`는 List Section header로(자동 heading 취급).
- `KBSearch` 인스턴스는 `@State private var search: KBSearch?`로 뷰 최초 task에서 생성(본문 캐시가 첫 검색 시 1회 로드).

- [ ] **Step 1: 구현** (위 명세대로. List를 `List { if 검색중 { 결과 섹션 } else { 오늘의위키 섹션; 축카드 섹션 } }` 구조로 재구성)
- [ ] **Step 2: 빌드 + 시뮬레이터 스모크** — 검색("보조공학" 등 실단어) 결과 표시·문서 이동·검색어 클리어 복귀를 확인, 스크린샷 `/tmp/webfortd-m1-search.png`
- [ ] **Step 3: 커밋** — `git add ios/Webfortd/WikiHomeView.swift && git commit -m "feat(ios): 홈 검색(.searchable submit) + 오늘의 위키 섹션" -- ios/Webfortd/WikiHomeView.swift`

### Task 3: 백링크 섹션 (문서 화면)

**Files:**
- Modify: `ios/Webfortd/DocumentView.swift`

**Interfaces:**
- Consumes: `KBStore.backlinks(slug:)`(`[KBBacklink]`, `from` = 참조하는 문서 slug), `KBStore.summary(slug:)`, `AppRoute`
- Produces: 출처 푸터 아래 "이 문서를 참조하는 문서" 섹션.

**동작 명세:**
- `store.backlinks(slug: slug)`가 비어 있으면 섹션 자체를 렌더하지 않는다(빈 헤딩 금지 — 미니멀).
- 있으면: `Text("이 문서를 참조하는 문서").font(.headline).accessibilityAddTraits(.isHeader)` + 각 backlink의 `from` slug를 `summary(slug:)`로 해석해 제목 행(NavigationLink → `AppRoute.document`). summary 미해석(이론상 없음 — 번들 필터가 보장)이면 해당 행 생략.
- 행: 제목 단일 Text, minHeight 44.

- [ ] **Step 1: 구현**
- [ ] **Step 2: 빌드 + 백링크 보유 문서(예: kb-index의 wiki_backlinks 상위 항목) 시뮬레이터 확인**, 스크린샷 `/tmp/webfortd-m1-backlinks.png`
- [ ] **Step 3: 전체 검증** — `swift test --package-path ios/WebfortdKit` 24/24 + xcodebuild BUILD SUCCEEDED
- [ ] **Step 4: 커밋** — `git add ios/Webfortd/DocumentView.swift && git commit -m "feat(ios): 문서 백링크 섹션(참조하는 문서 목록)" -- ios/Webfortd/DocumentView.swift`
