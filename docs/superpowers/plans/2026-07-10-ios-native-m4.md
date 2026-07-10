# webfortd iOS 네이티브 M4 구현 계획: 자료실·미디어 + 설정 + TestFlight 준비

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1 마지막 코딩 범위: 자료실(PDF 다운로드·캐시·QuickLook)·미디어 화면과 설정 탭(계정·About)을 붙여 5탭을 완성하고, Apple Developer Program 가입 이후 절차를 문서화한다(가입 자체는 비용 하드 스톱, 위원장 결정 대기).

**Architecture:** 번들 파이프라인 확장(library.json·media.json 추출) + Kit Catalog 모델 + 앱 화면 3종. 네트워크는 PDF 다운로드(URLSession downloadTask + 로컬 캐시)와 이미지 AsyncImage뿐.

**Tech Stack:** 기존과 동일. 신규 의존성 없음(QuickLook은 시스템 프레임워크).

## Global Constraints

- 기존 전 항목(iOS 26·Kit UIKit 금지, 단 **QuickLook 표시는 앱 타깃**·이모지·em dash 금지·주석 한국어·pathspec·44pt·3-state) + 브랜치 `ios-native-m4`.
- 카탈로그 정본은 웹 TS 배열(`src/lib/library-catalog.ts`·`src/lib/media-curation.ts`): 수동 복제 금지, 추출 스크립트로만. published 필터 미러(status 미지정 = published 취급, 웹 `filterLibraryItems` 의미론 대조).
- PDF 캐시: 한 번 받으면 오프라인 열람(Caches 디렉터리, slug 키). 다운로드 중·실패·완료 상태 분리.
- 미디어 이미지는 온라인 로드 + alt 정본(오프라인 시 alt 텍스트).

## 파일 구조 (M4 신규/수정)

```text
ios/scripts/bundle-content.mjs                         ← library.json·media.json 추출 확장
ios/WebfortdKit/Sources/WebfortdKit/Catalog/Catalog.swift ← 모델+디코딩(LibraryItem·MediaItem)+스토어
ios/WebfortdKit/Tests/WebfortdKitTests/CatalogTests.swift ← 신규
ios/Webfortd/Library/LibraryView.swift                 ← 자료실 목록+다운로드+QuickLook
ios/Webfortd/Media/MediaView.swift                     ← 미디어 목록+상세
ios/Webfortd/Settings/SettingsView.swift               ← 계정·About·버전·콘텐츠 기준일
ios/Webfortd/WebfortdApp.swift                         ← 5탭 완성(위키·채팅·자료실·미디어·설정)
docs/IOS_DISTRIBUTION.md                               ← TestFlight 준비 절차(가입 후 실행용)
```

---

### Task 1: 파이프라인 확장 + Kit Catalog

**Files:**
- Modify: `ios/scripts/bundle-content.mjs`
- Create: `ios/WebfortdKit/Sources/WebfortdKit/Catalog/Catalog.swift`
- Test: `ios/WebfortdKit/Tests/WebfortdKitTests/CatalogTests.swift` (fixture = 추출 실산출 축소)

**파이프라인 확장** (bundle-content.mjs 끝에 추가):
- `npx tsx`로 임시 추출 스크립트 실행 대신, node에서 직접 `npx tsx -e` 자식 프로세스로 JSON을 stdout 출력받아 파일로 쓴다:
```js
import { execSync } from "node:child_process"
const catalogs = JSON.parse(execSync(
  `npx tsx -e "import { LIBRARY_ITEMS } from './src/lib/library-catalog'; import { MEDIA_ITEMS } from './src/lib/media-curation'; console.log(JSON.stringify({ library: LIBRARY_ITEMS.filter(i => (i.status ?? 'published') === 'published'), media: MEDIA_ITEMS.filter(i => (i.status ?? 'published') === 'published') }))"`,
  { cwd: ROOT, encoding: "utf8" },
))
fs.writeFileSync(path.join(OUT_DIR, "library.json"), JSON.stringify(catalogs.library, null, 1))
fs.writeFileSync(path.join(OUT_DIR, "media.json"), JSON.stringify(catalogs.media, null, 1))
console.log(`bundle-content: library ${catalogs.library.length}건, media ${catalogs.media.length}건`)
```
(웹 filterLibraryItems/filterMediaItems의 published 의미론을 구현 전에 실제 파일에서 확인하고 다르면 그쪽을 미러, 확인 결과를 리포트에 기록.)

**Kit 모델** (`Catalog.swift`):
```swift
import Foundation

/// 자료실 항목: 웹 src/lib/library-catalog.ts LIBRARY_ITEMS 미러(번들 library.json).
public struct LibraryItem: Codable, Equatable, Sendable, Identifiable {
    public let slug: String
    public let title: String
    public let year: Int
    public let organization: String
    public let category: String
    public let summary: String
    public let fileSize: String
    public let mimeType: String
    public let downloadUrl: String
    public var id: String { slug }
}

/// 미디어 항목: 웹 src/lib/media-curation.ts MEDIA_ITEMS 미러(번들 media.json).
public struct MediaItem: Codable, Equatable, Sendable, Identifiable {
    public let slug: String
    public let imagePath: String
    public let alt: String
    public let caption: String
    public let sourceDocSlug: String
    public let sourceDocTitle: String
    public let sourceAxis: String
    public var id: String { slug }
}

/// 번들 카탈로그 로더. KBStore와 동일한 Resources/KB 루트 사용.
public enum CatalogStore {
    public static func libraryItems() throws -> [LibraryItem]
    public static func mediaItems() throws -> [MediaItem]
    // 구현: Bundle.module KB 루트에서 library.json·media.json 디코딩.
    // 테스트 주입용 오버로드: (from url: URL)
}
```
- 테스트: 추출 실산출에서 각 1건 축소 캡처 fixture 디코딩 + 미지 필드 무시.

- [ ] Step 1: 파이프라인 확장 → 실행(`node ios/scripts/bundle-content.mjs`) → library 4·media 1 산출 확인
- [ ] Step 2: fixture 캡처 + 실패 테스트 → 모델 구현 → swift test green(45 + 신규 ≥2)
- [ ] Step 3: 커밋 `feat(ios): 카탈로그 번들 추출(library·media) + Kit 모델` (pathspec: ios/scripts/bundle-content.mjs ios/WebfortdKit)

### Task 2: 자료실·미디어 화면 + 5탭 완성

**Files:**
- Create: `ios/Webfortd/Library/LibraryView.swift`, `ios/Webfortd/Media/MediaView.swift`
- Modify: `ios/Webfortd/WebfortdApp.swift`

**LibraryView 명세:**
- 목록 행: "제목, 연도년, 기관, 파일 크기" 결합 텍스트 + summary 보조 줄, combine 한 객체, 44pt.
- 행 탭 → 상세 없이 바로 동작 버튼 흐름이 아니라, 행에 상태별 트레일링 버튼: 미캐시 = "받기"(다운로드 시작), 다운로드 중 = ProgressView + "중단", 캐시됨 = "열기"(QuickLook `QLPreviewController` UIViewControllerRepresentable). 상태 3분리 + Announcement("다운로드 완료: <제목>", 실패 시 실패 문구).
- 다운로드: `URLSession.downloadTask`(async `download(from:)`) → `FileManager` Caches/`library/<slug>.pdf` 이동. 재실행 시 캐시 존재 확인으로 상태 복원. 실패 시 재시도 가능.
- "받은 파일 삭제" 컨텍스트 액션(swipe + 롱프레스 메뉴, VoiceOver 커스텀 액션 자동), 캐시 정리 수단.
- 다운로드 URL은 번들 `downloadUrl` 그대로(Supabase Storage public).

**MediaView 명세:**
- 목록: 각 항목 = 이미지(AsyncImage, 실패·오프라인 시 alt 텍스트 박스, BlockRenderer의 documentImage 패턴 재사용 가능하면 재사용) + 캡션 + "출처: <sourceDocTitle>" 버튼(`AppRoute.document(slug: sourceDocSlug)` push, 미디어 탭 NavigationStack에 destination 등록 필요).
- 이미지 accessibilityLabel = alt(전문). 캡션은 별도 텍스트(중복 아님, alt는 이미지 서술, 캡션은 큐레이션 문구).

**WebfortdApp**: 탭 5개 완성. 위키(books.vertical)·채팅(bubble)·자료실(tray.full)·미디어(photo.on.rectangle)·설정(gearshape, Task 3 자리는 임시 빈 SettingsView 스텁 포함). 각 탭 독립 NavigationStack + 공용 destination(미디어 탭 포함). openURL 분기에 신규 탭 추가.

- [ ] Step 1: 화면 2종 + 5탭, 빌드
- [ ] Step 2: 시뮬 스모크: 자료실 다운로드 실호출(가장 작은 PDF 1건) → QuickLook 열림 → 비행기 모드 재열람(캐시), 미디어 이미지 로드 + 출처 push. 스크린샷 `/tmp/webfortd-m4-library.png`·`/tmp/webfortd-m4-media.png`
- [ ] Step 3: swift test 유지 green + 커밋 `feat(ios): 자료실(다운로드·캐시·QuickLook)·미디어 + 5탭 완성` (pathspec: ios/Webfortd)

### Task 3: 설정 탭 + TestFlight 준비 문서

**Files:**
- Create: `ios/Webfortd/Settings/SettingsView.swift` (Task 2 스텁 교체)
- Create: `docs/IOS_DISTRIBUTION.md`

**SettingsView 명세 (List 섹션 구조):**
- 계정: 로그인 상태(이메일 표시) / "로그인" 버튼(AuthSheet 재사용) / "로그아웃"(confirmationDialog, ChatView 로그아웃과 동일 동작: ChatStore 리셋 포함. ChatStore 접근이 필요하므로 WebfortdApp에서 주입 구조 확인).
- 콘텐츠: "문서 N건, 기준일 <generated_at 날짜>"(KBStore.index) 단일 텍스트.
- 정보: "이 앱은 장애인교원 교육전념 여건 지원 사업의 시범 자산으로, 대한민국 장애인교원 관련 제도·정책 정보를 제공합니다."(앱 정체성 영구 원칙 문구, 장교조 브랜드 아님), 버전(`CFBundleShortVersionString`), "웹사이트 열기"(Link → AppConfig.webBaseURL), "개인정보처리방침"(Link → webBaseURL/privacy).
- 전부 44pt, 이모지 금지.

**docs/IOS_DISTRIBUTION.md** (가입 후 실행용 절차 문서, 한국어):
1. 전제: Apple Developer Program 가입($99/년, **비용 하드 스톱, 위원장 승인 후**). 가입 주체 논점: 개인(법적 이름 노출) vs 조직(D-U-N-S 필요), 장교조 명의 조직 가입 검토 포인트 기재.
2. 준비물 체크리스트: 앱 아이콘 1024×1024(현재 미제작, 위원장 결정 필요 항목으로 명기), 스크린샷(6.9"·6.5"), 개인정보처리방침 URL(웹 /privacy 재사용), 지원 URL.
3. 절차: Xcode 서명 팀 전환 → App Store Connect 앱 생성(번들 ID kr.khudt.webfortd) → Archive → Organizer 업로드 → TestFlight 내부 테스터 → 외부 테스터(심사 필요).
4. 심사 대비: Privacy Nutrition Label 항목(수집: 이메일(인증)·대화 내용(로그인 시 저장), 최소 수집), Accessibility Nutrition Labels(VoiceOver 지원 선언), 로그인 필요 기능 시연 계정(OTP라 심사용 안내 필요, 데모 영상 대안), AI 생성 콘텐츠 고지(채팅 면책 문구 이미 포함).
5. gildongmu 배포 준비 spec(2026-06-21)과의 차이 요약.

- [ ] Step 1: SettingsView 구현 + 빌드 + 스모크 스크린샷 `/tmp/webfortd-m4-settings.png`
- [ ] Step 2: IOS_DISTRIBUTION.md 작성
- [ ] Step 3: swift test green + 커밋 `feat(ios): 설정 탭(계정·About) + TestFlight 준비 문서` (pathspec: ios/Webfortd/Settings ios/Webfortd/WebfortdApp.swift docs/IOS_DISTRIBUTION.md)
