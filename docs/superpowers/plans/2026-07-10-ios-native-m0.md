# webfortd iOS 네이티브 M0 구현 계획 (+ M1~M5 로드맵)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ios/` 신규 트리에 WebfortdKit(SPM, UI 비의존)과 SwiftUI 앱 골격을 세우고, 오프라인 번들 위키(축 목록 → 문서 목록 → 문서 렌더링, 표 포함)를 실기기 비행기 모드에서 동작시킨다(M0). M1~M5는 로드맵으로 고정하고 각 마일스톤 경계에서 상세 plan을 새로 쓴다.

**Architecture:** 순수 API 클라이언트 + 오프라인 콘텐츠 번들. M0은 네트워크 코드가 전혀 없다. 빌드 파이프라인이 `content/` 마크다운(published만)과 kb-index를 WebfortdKit SPM 리소스로 복사하고, Kit가 인덱스 디코딩·문서 스토어·위키링크 전처리·마크다운 블록 AST를 제공하며, 앱 타깃은 SwiftUI 렌더러·화면만 얹는다. spec: `docs/superpowers/specs/2026-07-10-ios-native-app-design.md`.

**Tech Stack:** Swift 6 + SwiftUI + `@Observable` + `NavigationStack` + Swift Testing. 의존성: `swift-markdown` 0.8.0(Apple 공식, 표 렌더링 필수: 161개 문서가 표 사용)만. supabase-swift는 M3에서 추가.

## Global Constraints (spec §2 전사)

- 최소 지원 버전 **iOS 26**. availability guard 금지(잉여).
- 의존성은 spec 확정 2개(swift-markdown, supabase-swift/M3) 외 추가 금지.
- WebfortdKit은 UIKit/SwiftUI import 금지(macOS에서 `swift test` 가능해야 함).
- Bundle ID `kr.khudt.webfortd`, 표시명 **"장애인교원 위키 베타"**, iPhone 세로 고정.
- base URL(이미지): 릴리스 `https://webfortd.vercel.app`, 디버그 주입 가능.
- 접근성 정본 `~/.claude/ACCESSIBILITY.md`: 한 줄=한 객체는 `accessibilityElement(children: .combine)`, 헤딩은 `.accessibilityAddTraits(.isHeader)`, 통지는 `AccessibilityNotification.Announcement` 단일 채널.
- UI 라벨 이모지 금지, em dash 금지, 주석·문서 한국어.
- 커밋은 의도 파일 pathspec만(`git add -A` 금지). `git add <경로>` 후 같은 턴에 `git commit -- <경로>` 원자 실행. 브랜치 `ios-native-app`(이미 생성, spec 커밋 존재), 마일스톤 완료 시 PR.
- 번들 콘텐츠는 **published 문서만**. 웹 published-only 게이트와 동일 의미론.

## 파일 구조 (M0 완료 시점)

```text
ios/
├── .gitignore
├── scripts/
│   └── bundle-content.mjs               ← content/ + kb-index → Kit 리소스 (결정적)
├── WebfortdKit/
│   ├── Package.swift
│   ├── Sources/WebfortdKit/
│   │   ├── KB/
│   │   │   ├── KBIndex.swift            ← 인덱스·frontmatter 디코딩 모델
│   │   │   ├── KBStore.swift            ← 로드·축/문서 조회·본문 로드
│   │   │   └── WikilinkRewriter.swift   ← [[slug]] → webfortd-wiki:// 전처리
│   │   ├── Markdown/
│   │   │   ├── KBBlock.swift            ← 블록 AST 값 타입
│   │   │   └── MarkdownBlockParser.swift← swift-markdown → [KBBlock]
│   │   └── Resources/KB/                ← 번들 산출물 (git 제외, .gitkeep만)
│   └── Tests/WebfortdKitTests/
│       ├── Fixtures/                    ← 실제 kb-index·문서 md 축소 캡처
│       ├── KBIndexTests.swift
│       ├── KBStoreTests.swift
│       ├── WikilinkRewriterTests.swift
│       └── MarkdownBlockParserTests.swift
├── Webfortd.xcodeproj/project.pbxproj   ← objectVersion 77 폴더 동기화 그룹(수동 최소)
└── Webfortd/
    ├── WebfortdApp.swift                ← 진입점 + NavigationStack 라우팅
    ├── AppConfig.swift                  ← base URL
    ├── WikiHomeView.swift               ← 축 카드 목록(문서 있는 축만)
    ├── AxisListView.swift               ← 축별 문서 목록(가나다 정렬)
    ├── DocumentView.swift               ← 문서 화면(렌더러 + 출처 푸터)
    └── BlockRenderer.swift              ← [KBBlock] → SwiftUI
```

분해 원칙: 인덱스 모델·스토어·전처리·파서·렌더러·화면이 각각 한 책임. Kit는 CLI(`swift test --package-path ios/WebfortdKit`)만으로 개발 가능하다(Task 1~5는 Xcode 불필요).

## M1~M5 로드맵 (고정, 상세 plan은 각 경계에서)

| M | 내용 |
|---|------|
| M1 | 오프라인 검색(제목 가중+전문) + 백링크 섹션 + FAQ 홈 노출 + 위키 홈 완성(오늘의 위키 등가) |
| M2 | RAG 채팅(익명): AI SDK v6 UIMessage SSE 파서 + 출처 카드(번들 문서 연결) + 첨부 |
| M3 | 인증(supabase-swift OTP) + 서버 Bearer 승격 + 이력(신규 `GET /api/chat/threads/[id]`) |
| M4 | 자료실·미디어(카탈로그 JSON 추출 확장) + 설정·About + TestFlight 준비(**Developer Program $99 = 비용 하드 스톱 상신**) |
| M5 (보류) | 라이브 음성 채팅(dodo-planet `Core/Live/` 이식 + `search_policy` 배선). dodo-planet Live 오류 수정·검증 후 이식(위원장 지시 2026-07-10) |

---

### Task 0: 환경 확인 (조작 없음, 확인만)

**Files:** 없음

- [ ] **Step 1: Xcode 26 확인** (gildongmu가 이미 빌드 중이므로 설치되어 있어야 정상)

Run: `xcodebuild -version`
Expected: `Xcode 26.x`. 아니면 STOP 후 사용자 보고(App Store 설치는 사용자 몫).

- [ ] **Step 2: 브랜치 확인**

Run: `git -C /Users/hunyongkim/Mac-Projects/webfortd branch --show-current`
Expected: `ios-native-app`

### Task 1: ios/ 골격 + WebfortdKit 패키지

**Files:**
- Create: `ios/.gitignore`, `ios/WebfortdKit/Package.swift`
- Create: `ios/WebfortdKit/Sources/WebfortdKit/KB/KBIndex.swift` (자리표시 타입 1개)
- Create: `ios/WebfortdKit/Sources/WebfortdKit/Resources/KB/.gitkeep`
- Test: `ios/WebfortdKit/Tests/WebfortdKitTests/KBIndexTests.swift`

**Interfaces:**
- Produces: SPM 패키지 `WebfortdKit`, 테스트 경로 `swift test --package-path ios/WebfortdKit`

- [ ] **Step 1: .gitignore와 Package.swift 작성**

`ios/.gitignore`:
```gitignore
DerivedData/
*.xcuserdatad/
xcuserdata/
.swiftpm/
.build/
# 번들 산출물은 파이프라인 생성물 (ios/scripts/bundle-content.mjs)
WebfortdKit/Sources/WebfortdKit/Resources/KB/*
!WebfortdKit/Sources/WebfortdKit/Resources/KB/.gitkeep
```

`ios/WebfortdKit/Package.swift`:
```swift
// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "WebfortdKit",
    defaultLocalization: "ko",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [.library(name: "WebfortdKit", targets: ["WebfortdKit"])],
    dependencies: [
        .package(url: "https://github.com/swiftlang/swift-markdown", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "WebfortdKit",
            dependencies: [.product(name: "Markdown", package: "swift-markdown")],
            resources: [.copy("Resources/KB")]
        ),
        .testTarget(
            name: "WebfortdKitTests",
            dependencies: ["WebfortdKit"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
```

- [ ] **Step 2: 실패하는 스모크 테스트**

`ios/WebfortdKit/Tests/WebfortdKitTests/KBIndexTests.swift`:
```swift
import Testing
@testable import WebfortdKit

@Suite struct KBIndexTests {
    @Test func 자리표시_타입이_존재한다() {
        let axis = KBAxis.agreements
        #expect(axis.rawValue == "agreements")
    }
}
```

Run: `swift test --package-path ios/WebfortdKit`
Expected: FAIL (`KBAxis` 미정의 컴파일 오류)

- [ ] **Step 3: 자리표시 구현**

`ios/WebfortdKit/Sources/WebfortdKit/KB/KBIndex.swift`:
```swift
/// KB 콘텐츠 축: 웹 `src/types/kb.ts` CONTENT_AXES 미러.
public enum KBAxis: String, Codable, CaseIterable, Sendable {
    case disabilityTypes = "disability-types"
    case domains, regions, policies, agreements, faq, stories, resources, uncategorized
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `swift test --package-path ios/WebfortdKit`
Expected: PASS (Fixtures 디렉터리 미존재 경고가 나면 빈 `Fixtures/.gitkeep` 추가)

- [ ] **Step 5: 커밋**

```bash
git add ios/.gitignore ios/WebfortdKit
git commit -m "feat(ios): WebfortdKit SPM 골격 + KBAxis" -- ios/.gitignore ios/WebfortdKit
```

### Task 2: 콘텐츠 번들 파이프라인

**Files:**
- Create: `ios/scripts/bundle-content.mjs`

**Interfaces:**
- Produces: `ios/WebfortdKit/Sources/WebfortdKit/Resources/KB/kb-index.json`(축소·published만) + `Resources/KB/content/<axis>/<slug>.md`(published만). 산출 인덱스 스키마: `{ generated_at, source_count, documents: [{slug, axis, filePath, frontmatter}], wiki_backlinks: {slug: [{from, anchor?, link_text?}]}, slug_index: {slug: filePath} }`. `body_excerpt`·`broken_wikilinks`·`wikilink_adjacency`·`content_hash`는 앱 미사용이라 제외.

- [ ] **Step 1: 파이프라인 스크립트 작성**

`ios/scripts/bundle-content.mjs`:
```js
// content/ 마크다운(published만) + kb-index를 WebfortdKit 리소스로 복사하는 결정적 파이프라인.
// 실행: node ios/scripts/bundle-content.mjs  (repo 루트 기준)
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..", "..")
const INDEX_SRC = path.join(ROOT, "src", "lib", "kb-index.generated.json")
const OUT_DIR = path.join(ROOT, "ios", "WebfortdKit", "Sources", "WebfortdKit", "Resources", "KB")

const index = JSON.parse(fs.readFileSync(INDEX_SRC, "utf8"))
const published = index.documents.filter((d) => d.frontmatter.status === "published")
const publishedSlugs = new Set(published.map((d) => d.slug))

// 산출 디렉터리 초기화(.gitkeep 보존)
fs.rmSync(path.join(OUT_DIR, "content"), { recursive: true, force: true })
fs.rmSync(path.join(OUT_DIR, "kb-index.json"), { force: true })

// published 문서만 복사
for (const doc of published) {
  const src = path.join(ROOT, doc.filePath)
  const dst = path.join(OUT_DIR, doc.filePath) // filePath = content/<axis>/<slug>.md
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
}

// 축소 인덱스: 앱이 쓰는 필드만 + published만 + 백링크는 from도 published인 것만
const bundleIndex = {
  generated_at: index.generated_at,
  source_count: published.length,
  documents: published
    .map(({ slug, axis, filePath, frontmatter }) => ({ slug, axis, filePath, frontmatter }))
    .sort((a, b) => a.slug.localeCompare(b.slug)),
  wiki_backlinks: Object.fromEntries(
    Object.entries(index.wiki_backlinks)
      .filter(([target]) => publishedSlugs.has(target))
      .map(([target, links]) => [target, links.filter((l) => publishedSlugs.has(l.from))])
      .filter(([, links]) => links.length > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  ),
  slug_index: Object.fromEntries(
    published.map((d) => [d.slug, d.filePath]).sort(([a], [b]) => a.localeCompare(b)),
  ),
}
fs.writeFileSync(path.join(OUT_DIR, "kb-index.json"), JSON.stringify(bundleIndex, null, 1))

console.log(`bundle-content: ${published.length}/${index.documents.length} published 문서, ` +
  `backlink 대상 ${Object.keys(bundleIndex.wiki_backlinks).length}건 → ${path.relative(ROOT, OUT_DIR)}`)
```

- [ ] **Step 2: 실행·산출 검증**

Run: `node ios/scripts/bundle-content.mjs && ls ios/WebfortdKit/Sources/WebfortdKit/Resources/KB/ && du -sh ios/WebfortdKit/Sources/WebfortdKit/Resources/KB/`
Expected: `bundle-content: 535/544 published 문서 ...` + `content/`·`kb-index.json` 존재, 약 5MB 내외.

- [ ] **Step 3: git 제외 확인**

Run: `git status --porcelain ios/ | grep Resources/KB | grep -v gitkeep`
Expected: 출력 없음(산출물이 ignore됨).

- [ ] **Step 4: 커밋**

```bash
git add ios/scripts/bundle-content.mjs
git commit -m "feat(ios): 콘텐츠 번들 파이프라인(published만, 축소 인덱스)" -- ios/scripts/bundle-content.mjs
```

### Task 3: KB 인덱스 디코딩 모델 + 실캡처 fixture

**Files:**
- Modify: `ios/WebfortdKit/Sources/WebfortdKit/KB/KBIndex.swift`
- Create: `ios/WebfortdKit/Tests/WebfortdKitTests/Fixtures/kb-index-mini.json` (실데이터 추출)
- Test: `ios/WebfortdKit/Tests/WebfortdKitTests/KBIndexTests.swift`

**Interfaces:**
- Produces: `KBIndex`(Decodable: `generatedAt`·`sourceCount`·`documents`·`wikiBacklinks`·`slugIndex`), `KBDocumentSummary`(`slug`·`axis`·`filePath`·`frontmatter`), `KBFrontmatter`(`title`·`type`·`year`·`status`·`source: KBSource{organization, citation, url?}`), `KBBacklink`(`from`·`anchor?`·`linkText?`)

- [ ] **Step 1: fixture 캡처 (프로드 정본 축소: 계약의 근거)**

```bash
node -e '
const j = require("/Users/hunyongkim/Mac-Projects/webfortd/src/lib/kb-index.generated.json");
const pick = ["2020-ca-1-2", "accommodation-refused"];
const docs = j.documents.filter(d => pick.includes(d.slug)).map(({slug,axis,filePath,frontmatter}) => ({slug,axis,filePath,frontmatter}));
const bl = Object.fromEntries(Object.entries(j.wiki_backlinks).filter(([k]) => pick.includes(k)));
const out = { generated_at: null, source_count: docs.length, documents: docs,
  wiki_backlinks: bl, slug_index: Object.fromEntries(docs.map(d => [d.slug, d.filePath])) };
require("fs").writeFileSync("/Users/hunyongkim/Mac-Projects/webfortd/ios/WebfortdKit/Tests/WebfortdKitTests/Fixtures/kb-index-mini.json", JSON.stringify(out, null, 1));
console.log("captured", docs.length);
'
```
Expected: `captured 2`. 파일 첫 줄 주석 불가(JSON)이므로 캡처 근거는 테스트 파일 주석에 기록.

- [ ] **Step 2: 실패하는 디코딩 테스트**

`KBIndexTests.swift`에 추가(기존 자리표시 테스트 교체):
```swift
import Foundation
import Testing
@testable import WebfortdKit

// Fixtures/kb-index-mini.json: 2026-07-10 kb-index.generated.json에서 slug 2건 추출(프로드 정본 축소).
@Suite struct KBIndexTests {
    func loadFixture() throws -> Data {
        let url = try #require(Bundle.module.url(
            forResource: "Fixtures/kb-index-mini", withExtension: "json"))
        return try Data(contentsOf: url)
    }

    @Test func 인덱스를_디코딩한다() throws {
        let index = try JSONDecoder().decode(KBIndex.self, from: loadFixture())
        #expect(index.sourceCount == 2)
        let doc = try #require(index.documents.first { $0.slug == "2020-ca-1-2" })
        #expect(doc.axis == .agreements)
        #expect(doc.filePath == "content/agreements/2020-ca-1-2.md")
        #expect(doc.frontmatter.title == "제1조【유효기간】")
        #expect(doc.frontmatter.status == .published)
        #expect(doc.frontmatter.source.organization.contains("교육부"))
        #expect(index.slugIndex["accommodation-refused"] != nil)
    }

    @Test func 미지_frontmatter_필드는_무시한다() throws {
        // fixture에는 accessibility·references 등 앱 미사용 필드가 실데이터 그대로 있다.
        _ = try JSONDecoder().decode(KBIndex.self, from: loadFixture())
    }
}
```

Run: `swift test --package-path ios/WebfortdKit`
Expected: FAIL (`KBIndex` 미정의)

- [ ] **Step 3: 모델 구현**

`KBIndex.swift` 전체 교체:
```swift
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `swift test --package-path ios/WebfortdKit`
Expected: PASS 전부

- [ ] **Step 5: 커밋**

```bash
git add ios/WebfortdKit/Sources/WebfortdKit/KB/KBIndex.swift ios/WebfortdKit/Tests/WebfortdKitTests
git commit -m "feat(ios): KB 인덱스 디코딩 모델 + 실캡처 fixture" -- ios/WebfortdKit
```

### Task 4: WikilinkRewriter + KBStore

**Files:**
- Create: `ios/WebfortdKit/Sources/WebfortdKit/KB/WikilinkRewriter.swift`
- Create: `ios/WebfortdKit/Sources/WebfortdKit/KB/KBStore.swift`
- Create: `ios/WebfortdKit/Tests/WebfortdKitTests/Fixtures/doc-sample.md` (실문서 캡처)
- Test: `WikilinkRewriterTests.swift`, `KBStoreTests.swift`

**Interfaces:**
- Consumes: `KBIndex`, `KBAxis`, `KBDocumentSummary` (Task 3)
- Produces:
  - `WikilinkRewriter.rewrite(_ markdown: String, isKnownSlug: (String) -> Bool) -> String`: `[[slug]]`·`[[slug#anchor]]`·`[[slug|라벨]]` → `[라벨](webfortd-wiki://slug)`, 미지 slug는 라벨 평문, 펜스 코드블록 내부는 불변.
  - `KBStore`(final class, Sendable): `init(indexURL: URL, contentRootURL: URL) throws`, `static func bundled() throws -> KBStore`, `var documents: [KBDocumentSummary]`, `func documents(in axis: KBAxis) -> [KBDocumentSummary]`(제목 가나다·slug 안정 정렬: 웹 `sortDocsForList` 미러), `func summary(slug: String) -> KBDocumentSummary?`, `func loadBody(slug: String) throws -> String`(frontmatter 제거 + 위키링크 전처리 완료).
  - 내부 링크 스킴 상수: `public enum KBLink { public static let scheme = "webfortd-wiki" }`

- [ ] **Step 1: 실문서 fixture 캡처**

```bash
cp /Users/hunyongkim/Mac-Projects/webfortd/content/agreements/2020-ca-1-2.md \
   /Users/hunyongkim/Mac-Projects/webfortd/ios/WebfortdKit/Tests/WebfortdKitTests/Fixtures/doc-sample.md
```

- [ ] **Step 2: 실패하는 테스트 작성**

`WikilinkRewriterTests.swift`:
```swift
import Testing
@testable import WebfortdKit

@Suite struct WikilinkRewriterTests {
    let known: (String) -> Bool = { ["target-a", "b-2"].contains($0) }

    @Test func 기본_위키링크를_내부_링크로_바꾼다() {
        #expect(WikilinkRewriter.rewrite("전문은 [[target-a]] 참조.", isKnownSlug: known)
            == "전문은 [target-a](webfortd-wiki://target-a) 참조.")
    }

    @Test func 라벨과_앵커를_처리한다() {
        #expect(WikilinkRewriter.rewrite("[[target-a|협약 전문]]과 [[b-2#조항]]", isKnownSlug: known)
            == "[협약 전문](webfortd-wiki://target-a)과 [b-2](webfortd-wiki://b-2)")
    }

    @Test func 미지_slug는_평문으로_남긴다() {
        #expect(WikilinkRewriter.rewrite("[[unknown|라벨]] [[unknown2]]", isKnownSlug: known)
            == "라벨 unknown2")
    }

    @Test func 펜스_코드블록_내부는_건드리지_않는다() {
        let md = "```\n[[target-a]]\n```\n[[target-a]]"
        #expect(WikilinkRewriter.rewrite(md, isKnownSlug: known)
            == "```\n[[target-a]]\n```\n[target-a](webfortd-wiki://target-a)")
    }
}
```

`KBStoreTests.swift`:
```swift
import Foundation
import Testing
@testable import WebfortdKit

// Fixtures/doc-sample.md: 2026-07-10 content/agreements/2020-ca-1-2.md 실캡처.
@Suite struct KBStoreTests {
    func makeStore() throws -> KBStore {
        let indexURL = try #require(Bundle.module.url(
            forResource: "Fixtures/kb-index-mini", withExtension: "json"))
        // fixture 문서는 Fixtures/ 평면에 있으므로 contentRoot를 우회 주입해 검증한다.
        let contentRoot = indexURL.deletingLastPathComponent()
        return try KBStore(indexURL: indexURL, contentRootURL: contentRoot)
    }

    @Test func 축별_문서를_가나다_정렬로_돌려준다() throws {
        let store = try makeStore()
        let docs = store.documents(in: .agreements)
        #expect(docs.map(\.slug) == ["2020-ca-1-2"])
        #expect(store.documents(in: .stories).isEmpty)
    }

    @Test func 본문은_frontmatter가_제거되어_있다() throws {
        let store = try makeStore()
        // doc-sample.md 이름으로 로드하도록 slug_index 경로 대신 직접 파일 로드 검증
        let body = try store.loadBody(atRelativePath: "doc-sample.md")
        #expect(!body.hasPrefix("---"))
        #expect(!body.contains("status: published"))
        #expect(!body.isEmpty)
    }
}
```

Run: `swift test --package-path ios/WebfortdKit`
Expected: FAIL (타입 미정의)

- [ ] **Step 3: 구현**

`WikilinkRewriter.swift`:
```swift
import Foundation

/// 웹 scripts/sync-content.ts WIKILINK_RE 등가 전처리.
/// `[[slug]]` `[[slug#anchor]]` `[[slug|라벨]]` → 표준 마크다운 링크(webfortd-wiki:// 스킴).
public enum WikilinkRewriter {
    // group1 = slug, group2 = anchor(미사용), group3 = 라벨
    private static let pattern = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/

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
```

`KBStore.swift`:
```swift
import Foundation

/// 번들 KB 스토어: 인덱스 로드·조회·본문 로드. UI 비의존.
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

    /// contentRoot 기준 상대 경로 로드: 테스트 주입용 공개.
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `swift test --package-path ios/WebfortdKit`
Expected: PASS 전부

- [ ] **Step 5: 커밋**

```bash
git add ios/WebfortdKit/Sources/WebfortdKit/KB ios/WebfortdKit/Tests/WebfortdKitTests
git commit -m "feat(ios): KBStore + 위키링크 전처리(웹 WIKILINK_RE 등가)" -- ios/WebfortdKit
```

### Task 5: 마크다운 블록 AST (swift-markdown)

**Files:**
- Create: `ios/WebfortdKit/Sources/WebfortdKit/Markdown/KBBlock.swift`
- Create: `ios/WebfortdKit/Sources/WebfortdKit/Markdown/MarkdownBlockParser.swift`
- Test: `MarkdownBlockParserTests.swift`

**Interfaces:**
- Consumes: `KBLink.scheme` (Task 4)
- Produces:
  - `KBInline`(struct: `attributed: AttributedString`(강조·인라인코드·링크 반영), `plain: String`(접근성·검색용))
  - `KBBlock`(indirect enum, Equatable·Sendable): `.heading(level: Int, content: KBInline)` `.paragraph(KBInline)` `.bulletList([[KBBlock]])` `.orderedList([[KBBlock]], start: Int)` `.table(header: [KBInline], rows: [[KBInline]])` `.codeBlock(code: String, language: String?)` `.blockquote([KBBlock])` `.image(source: String, alt: String)` `.thematicBreak`
  - `MarkdownBlockParser.parse(_ markdown: String) -> [KBBlock]`

- [ ] **Step 1: 실패하는 테스트 작성**

`MarkdownBlockParserTests.swift`:
```swift
import Foundation
import Testing
@testable import WebfortdKit

@Suite struct MarkdownBlockParserTests {
    @Test func 헤딩과_문단을_파싱한다() {
        let blocks = MarkdownBlockParser.parse("## 제1조\n\n본 협약의 유효기간.")
        guard case let .heading(level, h) = blocks[0], case let .paragraph(p) = blocks[1] else {
            Issue.record("블록 종류 불일치: \(blocks)"); return
        }
        #expect(level == 2)
        #expect(h.plain == "제1조")
        #expect(p.plain == "본 협약의 유효기간.")
    }

    @Test func 표를_헤더와_행으로_파싱한다() {
        let md = "| 구분 | 내용 |\n|---|---|\n| 기간 | 2년 |\n| 대상 | 전체 |"
        let blocks = MarkdownBlockParser.parse(md)
        guard case let .table(header, rows) = blocks[0] else {
            Issue.record("table 아님: \(blocks)"); return
        }
        #expect(header.map(\.plain) == ["구분", "내용"])
        #expect(rows.count == 2)
        #expect(rows[0].map(\.plain) == ["기간", "2년"])
    }

    @Test func 내부_링크가_attributed에_반영된다() {
        let blocks = MarkdownBlockParser.parse("[협약 전문](webfortd-wiki://target-a) 참조")
        guard case let .paragraph(inline) = blocks[0] else {
            Issue.record("paragraph 아님"); return
        }
        #expect(inline.plain == "협약 전문 참조")
        let links = inline.attributed.runs.compactMap(\.link)
        #expect(links == [URL(string: "webfortd-wiki://target-a")])
    }

    @Test func 리스트_항목을_파싱한다() {
        let blocks = MarkdownBlockParser.parse("- 첫째\n- 둘째")
        guard case let .bulletList(items) = blocks[0] else {
            Issue.record("bulletList 아님"); return
        }
        #expect(items.count == 2)
        guard case let .paragraph(first) = items[0][0] else {
            Issue.record("항목 내부가 paragraph 아님"); return
        }
        #expect(first.plain == "첫째")
    }

    @Test func 단독_이미지는_image_블록이_된다() {
        let blocks = MarkdownBlockParser.parse("![조직도 설명](/source-images/a.png)")
        guard case let .image(source, alt) = blocks[0] else {
            Issue.record("image 아님: \(blocks)"); return
        }
        #expect(source == "/source-images/a.png")
        #expect(alt == "조직도 설명")
    }
}
```

Run: `swift test --package-path ios/WebfortdKit`
Expected: FAIL (타입 미정의)

- [ ] **Step 2: KBBlock 값 타입**

`KBBlock.swift`:
```swift
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
```

- [ ] **Step 3: 파서 구현**

`MarkdownBlockParser.swift`:
```swift
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
            let header = table.head.cells.map { inline(of: $0) }
            let rows = table.body.rows.map { row in row.cells.map { inline(of: $0) } }
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
    private static func inline(of container: Markup) -> KBInline {
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
                attributed.append(styled(child.plainText, bold: bold, italic: italic, link: link))
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `swift test --package-path ios/WebfortdKit`
Expected: PASS 전부. 표 파싱이 실패하면(Document가 table을 인식 못 하면) swift-markdown의 GFM 표 지원 여부를 `Document(parsing:)` 옵션에서 재확인하고 결과를 plan에 기록 후 조정.

- [ ] **Step 5: 실데이터 전량 파싱 스모크 테스트**

`MarkdownBlockParserTests.swift`에 추가(번들 리소스가 파이프라인 산출물일 때만 실행: fixture green ≠ 실데이터 검증이라는 spec §9 원칙의 M0 적용):
```swift
    @Test func 번들_전량_파싱_스모크() throws {
        // 파이프라인 미실행 환경(fresh clone)에서는 조용히 통과.
        guard let store = try? KBStore.bundled(), !store.documents.isEmpty else { return }
        var emptySlugs: [String] = []
        for doc in store.documents {
            let blocks = MarkdownBlockParser.parse(try store.loadBody(slug: doc.slug))
            if blocks.isEmpty { emptySlugs.append(doc.slug) }
        }
        #expect(emptySlugs.isEmpty, "빈 파싱 결과: \(emptySlugs)")
    }
```

Run: `node ios/scripts/bundle-content.mjs && swift test --package-path ios/WebfortdKit`
Expected: PASS (535개 문서 전량 파싱, 빈 결과 0건)

- [ ] **Step 6: 커밋**

```bash
git add ios/WebfortdKit/Sources/WebfortdKit/Markdown ios/WebfortdKit/Tests/WebfortdKitTests
git commit -m "feat(ios): 마크다운 블록 AST 파서(표·리스트·내부링크·이미지 alt)" -- ios/WebfortdKit
```

### Task 6: Xcode 프로젝트 + 앱 진입점

**Files:**
- Create: `ios/Webfortd.xcodeproj/project.pbxproj`
- Create: `ios/Webfortd/WebfortdApp.swift`, `ios/Webfortd/AppConfig.swift`

**Interfaces:**
- Consumes: `KBStore.bundled()` (Task 4)
- Produces: 시뮬레이터에서 빌드되는 앱 타깃 `Webfortd`, `AppRoute` enum(`.axis(KBAxis)` `.document(slug: String)`). Task 7 화면들이 사용.

- [ ] **Step 1: pbxproj 작성** (gildongmu 검증 최소 구조 이식, objectVersion 77)

`ios/Webfortd.xcodeproj/project.pbxproj`:
```text
// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 77;
	objects = {

/* Begin PBXBuildFile section */
		AA0001 /* WebfortdKit in Frameworks */ = {isa = PBXBuildFile; productRef = AC0001 /* WebfortdKit */; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		AB0001 /* Webfortd.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Webfortd.app; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */

/* Begin PBXFileSystemSynchronizedRootGroup section */
		AD0001 /* Webfortd */ = {
			isa = PBXFileSystemSynchronizedRootGroup;
			path = Webfortd;
			sourceTree = "<group>";
		};
/* End PBXFileSystemSynchronizedRootGroup section */

/* Begin PBXFrameworksBuildPhase section */
		AE0001 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
				AA0001 /* WebfortdKit in Frameworks */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		AF0001 = {
			isa = PBXGroup;
			children = (
				AD0001 /* Webfortd */,
				AF0002 /* Products */,
			);
			sourceTree = "<group>";
		};
		AF0002 /* Products */ = {
			isa = PBXGroup;
			children = (
				AB0001 /* Webfortd.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		B00001 /* Webfortd */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = B40002 /* Build configuration list for PBXNativeTarget "Webfortd" */;
			buildPhases = (
				B10001 /* Sources */,
				AE0001 /* Frameworks */,
				B20001 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			fileSystemSynchronizedGroups = (
				AD0001 /* Webfortd */,
			);
			name = Webfortd;
			packageProductDependencies = (
				AC0001 /* WebfortdKit */,
			);
			productName = Webfortd;
			productReference = AB0001 /* Webfortd.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		B30001 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastUpgradeCheck = 2600;
			};
			buildConfigurationList = B40001 /* Build configuration list for PBXProject "Webfortd" */;
			developmentRegion = ko;
			hasScannedForEncodings = 0;
			knownRegions = (
				ko,
				Base,
			);
			mainGroup = AF0001;
			packageReferences = (
				B50001 /* XCLocalSwiftPackageReference "WebfortdKit" */,
			);
			preferredProjectObjectVersion = 77;
			productRefGroup = AF0002 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				B00001 /* Webfortd */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		B20001 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		B10001 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		B60001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CLANG_ANALYZER_NONNULL = YES;
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_TESTABILITY = YES;
				GCC_OPTIMIZATION_LEVEL = 0;
				IPHONEOS_DEPLOYMENT_TARGET = 26.0;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
				SWIFT_VERSION = 6.0;
			};
			name = Debug;
		};
		B60002 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				IPHONEOS_DEPLOYMENT_TARGET = 26.0;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				SWIFT_VERSION = 6.0;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		B60003 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_GENERATE_ASSET_SYMBOL_EXTENSIONS = YES;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 72JQ7VD4V5;
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_CFBundleDisplayName = "장애인교원 위키 베타";
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				INFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 0.1.0;
				PRODUCT_BUNDLE_IDENTIFIER = kr.khudt.webfortd;
				PRODUCT_NAME = "$(TARGET_NAME)";
				TARGETED_DEVICE_FAMILY = 1;
			};
			name = Debug;
		};
		B60004 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_GENERATE_ASSET_SYMBOL_EXTENSIONS = YES;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 72JQ7VD4V5;
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_CFBundleDisplayName = "장애인교원 위키 베타";
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				INFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 0.1.0;
				PRODUCT_BUNDLE_IDENTIFIER = kr.khudt.webfortd;
				PRODUCT_NAME = "$(TARGET_NAME)";
				TARGETED_DEVICE_FAMILY = 1;
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		B40001 /* Build configuration list for PBXProject "Webfortd" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				B60001 /* Debug */,
				B60002 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		B40002 /* Build configuration list for PBXNativeTarget "Webfortd" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				B60003 /* Debug */,
				B60004 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */

/* Begin XCLocalSwiftPackageReference section */
		B50001 /* XCLocalSwiftPackageReference "WebfortdKit" */ = {
			isa = XCLocalSwiftPackageReference;
			relativePath = WebfortdKit;
		};
/* End XCLocalSwiftPackageReference section */

/* Begin XCSwiftPackageProductDependency section */
		AC0001 /* WebfortdKit */ = {
			isa = XCSwiftPackageProductDependency;
			productName = WebfortdKit;
		};
/* End XCSwiftPackageProductDependency section */
	};
	rootObject = B30001 /* Project object */;
}
```

- [ ] **Step 2: 앱 진입점 + Config**

`ios/Webfortd/AppConfig.swift`:
```swift
import Foundation

enum AppConfig {
    /// 문서 내 이미지의 원격 base. 오프라인이면 alt 텍스트가 정본.
    #if DEBUG
    static let webBaseURL = URL(string:
        ProcessInfo.processInfo.environment["WEBFORTD_BASE_URL"] ?? "https://webfortd.vercel.app")!
    #else
    static let webBaseURL = URL(string: "https://webfortd.vercel.app")!
    #endif
}
```

`ios/Webfortd/WebfortdApp.swift`:
```swift
import SwiftUI
import WebfortdKit

/// 내비게이션 목적지: 위키 축 목록과 문서.
enum AppRoute: Hashable {
    case axis(KBAxis)
    case document(slug: String)
}

@main
struct WebfortdApp: App {
    private let store: KBStore?
    @State private var path: [AppRoute] = []

    init() {
        // 파이프라인 미실행 등 번들 결함은 홈에서 안내(3-state: 실패를 빈 목록과 뭉개지 않음).
        store = try? KBStore.bundled()
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $path) {
                WikiHomeView(store: store)
                    .navigationDestination(for: AppRoute.self) { route in
                        switch route {
                        case .axis(let axis):
                            AxisListView(store: store, axis: axis)
                        case .document(let slug):
                            DocumentView(store: store, slug: slug)
                        }
                    }
            }
            .environment(\.openURL, OpenURLAction { url in
                // 문서 본문 내부 위키링크 → 앱 내 push.
                guard url.scheme == KBLink.scheme, let slug = url.host() else {
                    return .systemAction
                }
                path.append(.document(slug: slug))
                return .handled
            })
        }
    }
}
```

Task 6 빌드를 위해 임시 화면 3종 스텁도 같은 커밋에 포함(Task 7에서 본 구현으로 교체):

`ios/Webfortd/WikiHomeView.swift` (스텁):
```swift
import SwiftUI
import WebfortdKit

struct WikiHomeView: View {
    let store: KBStore?
    var body: some View {
        Text(store.map { "문서 \($0.documents.count)건" } ?? "콘텐츠 번들을 찾지 못했습니다")
            .navigationTitle("장애인교원 위키")
    }
}
```

`ios/Webfortd/AxisListView.swift` (스텁):
```swift
import SwiftUI
import WebfortdKit

struct AxisListView: View {
    let store: KBStore?
    let axis: KBAxis
    var body: some View { Text(axis.rawValue) }
}
```

`ios/Webfortd/DocumentView.swift` (스텁):
```swift
import SwiftUI
import WebfortdKit

struct DocumentView: View {
    let store: KBStore?
    let slug: String
    var body: some View { Text(slug) }
}
```

- [ ] **Step 3: 시뮬레이터 빌드 확인**

Run:
```bash
node ios/scripts/bundle-content.mjs
xcodebuild -project ios/Webfortd.xcodeproj -scheme Webfortd \
  -destination 'platform=iOS Simulator,name=iPhone 17' build 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **`. 스킴 미인식이면 Xcode가 자동 생성하도록 `xcodebuild -project ios/Webfortd.xcodeproj -list` 먼저 실행. pbxproj 자체를 거부하면 gildongmu 관례대로 Xcode GUI 폴백(사용자 보고 후).

- [ ] **Step 4: 커밋**

```bash
git add ios/Webfortd.xcodeproj/project.pbxproj ios/Webfortd
git commit -m "feat(ios): Xcode 프로젝트(폴더 동기화 그룹) + 앱 진입점·라우팅" -- ios/Webfortd.xcodeproj ios/Webfortd
```

### Task 7: 위키 3화면 (홈 · 축 목록 · 문서 렌더러)

**Files:**
- Modify: `ios/Webfortd/WikiHomeView.swift`, `ios/Webfortd/AxisListView.swift`, `ios/Webfortd/DocumentView.swift` (스텁 교체)
- Create: `ios/Webfortd/BlockRenderer.swift`

**Interfaces:**
- Consumes: `KBStore`, `KBAxis`, `KBBlock`, `KBInline`, `MarkdownBlockParser.parse`, `AppRoute`, `AppConfig.webBaseURL`
- Produces: M0 완성 화면. 축 라벨·설명은 웹 `src/lib/kb-axis.ts` BROWSABLE_AXES 미러(아래 상수).

- [ ] **Step 1: 홈 축 카드 목록**

`WikiHomeView.swift` 교체:
```swift
import SwiftUI
import WebfortdKit

/// 웹 src/lib/kb-axis.ts BROWSABLE_AXES 미러: 순서·라벨·안내문 동일.
struct BrowsableAxis {
    let axis: KBAxis
    let label: String
    let description: String

    static let all: [BrowsableAxis] = [
        .init(axis: .disabilityTypes, label: "장애유형별",
              description: "시각·청각·지체 등 장애유형에 따른 편의지원과 보조공학 안내"),
        .init(axis: .domains, label: "영역별",
              description: "수업·평가·행정·연수 등 교육활동 영역별 지원 내용"),
        .init(axis: .policies, label: "정책·법령",
              description: "장애인교원에 관한 법령·정책·제도 안내"),
        .init(axis: .agreements, label: "단체협약",
              description: "교원노조 단체협약 속 장애인교원 관련 조항"),
        .init(axis: .regions, label: "지역별",
              description: "시·도 교육청별 조례·지침과 지역 지원 현황"),
        .init(axis: .faq, label: "자주 묻는 질문",
              description: "편의지원 신청·인사·권리구제 등 장애인교원이 자주 묻는 질문과 답변"),
    ]
}

struct WikiHomeView: View {
    let store: KBStore?

    var body: some View {
        Group {
            if let store {
                List(visibleAxes(store), id: \.axis) { entry in
                    NavigationLink(value: AppRoute.axis(entry.axis)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(entry.label), \(store.documents(in: entry.axis).count)개 문서")
                                .font(.headline)
                            Text(entry.description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                    .frame(minHeight: 44)
                }
            } else {
                // 3-state: 번들 결함은 "문서 0건"이 아니라 실패로 알린다.
                ContentUnavailableView(
                    "콘텐츠를 불러오지 못했습니다",
                    systemImage: "exclamationmark.triangle",
                    description: Text("앱 콘텐츠 번들이 없습니다. 개발 중이라면 node ios/scripts/bundle-content.mjs 실행 후 다시 빌드하세요."))
            }
        }
        .navigationTitle("장애인교원 위키")
    }

    /// 웹 visibleAxisCards 미러: published 0건 축 숨김.
    private func visibleAxes(_ store: KBStore) -> [BrowsableAxis] {
        BrowsableAxis.all.filter { !store.documents(in: $0.axis).isEmpty }
    }
}
```

- [ ] **Step 2: 축 목록 화면**

`AxisListView.swift` 교체:
```swift
import SwiftUI
import WebfortdKit

struct AxisListView: View {
    let store: KBStore?
    let axis: KBAxis

    private var axisLabel: String {
        BrowsableAxis.all.first { $0.axis == axis }?.label ?? axis.rawValue
    }

    var body: some View {
        Group {
            if let store {
                let docs = store.documents(in: axis)
                List(docs, id: \.slug) { doc in
                    NavigationLink(value: AppRoute.document(slug: doc.slug)) {
                        // 한 줄 = 한 객체: 제목과 연도를 단일 텍스트로.
                        Text("\(doc.frontmatter.title), \(doc.frontmatter.year)년")
                    }
                    .frame(minHeight: 44)
                }
            } else {
                ContentUnavailableView("콘텐츠를 불러오지 못했습니다",
                    systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle(axisLabel)
        .navigationBarTitleDisplayMode(.inline)
    }
}
```

- [ ] **Step 3: 블록 렌더러**

`BlockRenderer.swift`:
```swift
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

    private func listView(items: [[KBBlock]], marker: (Int) -> String) -> some View {
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
```

- [ ] **Step 4: 문서 화면**

`DocumentView.swift` 교체:
```swift
import SwiftUI
import WebfortdKit

struct DocumentView: View {
    let store: KBStore?
    let slug: String
    @State private var blocks: [KBBlock]?
    @State private var loadFailed = false

    var body: some View {
        Group {
            if let store, let summary = store.summary(slug: slug) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(summary.frontmatter.title)
                            .font(.largeTitle).bold()
                            .accessibilityAddTraits(.isHeader)
                        if let blocks {
                            BlockRenderer(blocks: blocks)
                        } else if loadFailed {
                            Text("본문을 불러오지 못했습니다.")
                        } else {
                            ProgressView("불러오는 중")
                        }
                        sourceFooter(summary)
                    }
                    .padding()
                }
            } else {
                // 미지 slug(깨진 내부 링크 등)와 로드 실패를 구분해 알린다.
                ContentUnavailableView("문서를 찾을 수 없습니다", systemImage: "questionmark.circle",
                    description: Text("링크가 가리키는 문서가 아직 공개되지 않았을 수 있습니다."))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: slug) {
            guard let store else { return }
            do {
                let body = try store.loadBody(slug: slug)
                blocks = MarkdownBlockParser.parse(body)
            } catch {
                loadFailed = true
            }
        }
    }

    private func sourceFooter(_ summary: KBDocumentSummary) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Divider()
            // 한 줄 = 한 객체: 출처 전체를 단일 텍스트로.
            Text("출처: \(summary.frontmatter.source.citation), \(summary.frontmatter.source.organization)")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let urlString = summary.frontmatter.source.url, let url = URL(string: urlString) {
                Link("원문 보기", destination: url)
                    .font(.footnote)
                    .frame(minHeight: 44)
            }
        }
        .padding(.top, 16)
    }
}
```

- [ ] **Step 5: 빌드 + 시뮬레이터 스모크**

Run:
```bash
xcodebuild -project ios/Webfortd.xcodeproj -scheme Webfortd \
  -destination 'platform=iOS Simulator,name=iPhone 17' build 2>&1 | tail -3
```
Expected: `** BUILD SUCCEEDED **`. 이어서 시뮬레이터 부팅·설치·실행으로 홈 → 축 → 문서(표 있는 문서 `2023-hr-p-010` 등) 열람 확인, 스크린샷 캡처:
```bash
xcrun simctl boot "iPhone 17" 2>/dev/null || true
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/Webfortd-*/Build/Products/Debug-iphonesimulator/Webfortd.app
xcrun simctl launch booted kr.khudt.webfortd
```

- [ ] **Step 6: 커밋**

```bash
git add ios/Webfortd
git commit -m "feat(ios): 위키 3화면(홈 축카드·목록·문서 렌더러, 표 행 단위 a11y)" -- ios/Webfortd
```

### Task 8: 실기기 게이트 + PR (사용자 참여)

**Files:** 없음 (검증·배포 절차)

- [ ] **Step 1: 실기기 빌드 안내** (사용자 iPhone 연결, Personal Team 자동 서명, gildongmu와 동일 팀)

Xcode에서 기기 선택 후 Run, 또는:
```bash
xcodebuild -project ios/Webfortd.xcodeproj -scheme Webfortd \
  -destination 'platform=iOS,name=<기기명>' -allowProvisioningUpdates build
```
주의: 무료 Personal Team 동시 설치 3개 제한: dodo·gildongmu·webfortd로 정확히 임계 도달(spec §10).

- [ ] **Step 2: 비행기 모드 게이트** (M0 완료 조건)

기기에서 비행기 모드 켜고: 홈 축 카드 → 축 목록 → 문서 열람(표 포함 문서), 위키링크 탭 → 내부 이동. 전부 네트워크 없이 동작해야 함.

- [ ] **Step 3: VoiceOver 게이트** (M0 완료 조건)

VoiceOver 켜고 확인:
- 로터 "헤딩"으로 문서 내 조항 점프
- 축 카드가 "라벨, N개 문서, 설명" 한 객체로 낭독
- 표가 행 단위로 "헤더 값, 헤더 값" 낭독되는지. 실패 시 `GridRow`의 `.combine`이 셀별로 분배된 것이므로 행 대표 요소(`accessibilityRepresentation` 또는 행 `HStack`) 방식으로 교체
- 문서 제목이 화면에 1회만 표시되고 로터 헤딩에도 1회만 나오는지(제목 중복 fix `c0313af` 검증)

발견 문제는 fix 커밋 후 재검증.

- [ ] **Step 4: PR 생성**

```bash
git push -u origin ios-native-app
gh pr create --title "feat(ios): iOS 네이티브 M0, 오프라인 위키(WebfortdKit + 3화면)" --body "..."
```
PR body에 spec·plan 링크, 게이트 결과(비행기 모드·VoiceOver), 테스트 수 명시. 마지막에:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_0118HHyS8KzkKwj8znZJBG8d
```
