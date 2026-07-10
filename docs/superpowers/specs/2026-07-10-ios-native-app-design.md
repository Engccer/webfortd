# webfortd iOS 네이티브 앱 설계 (v1)

> 작성: 2026-07-10. 웹(Next.js 16)의 위키·검색·RAG 채팅·라이브 음성·자료실·미디어를 iOS 네이티브(Swift 6 + SwiftUI)로 제공하는 정본 스펙.
> 근거: 3갈래 병렬 조사(webfortd API 계약 인벤토리 / dodo-planet iOS 인증·스트리밍·Gemini Live 구현 / gildongmu iOS 재개발 설계·관례) + dodo-planet `docs/IOS-NATIVE-APP-SPEC.md`의 2026-07 플랫폼 동향 조사 재사용.

---

## 1. 목적과 측정 가능한 성과

1. 웹 v1 기능(위키+검색, RAG 채팅, 라이브 음성 채팅, 자료실·미디어)을 iOS 네이티브에서 동등 제공한다. 기능 패리티가 기본, UI 패리티는 아니다(iOS HIG 관례로 재설계).
2. 네이티브 고유 가치: **오프라인 위키**(웹은 서비스 워커조차 없음). 설치 직후 비행기 모드에서 535+ 문서 열람·검색이 동작한다.
3. VoiceOver 사용자가 화면을 보지 않고 전 기능을 완주할 수 있다(위원장 본인이 1차 검증자, 실기기 게이트).
4. 배포: TestFlight(장교조 임원·연구진 소수). 개발 단계는 무료 Personal Team 사이드로드.

| 성과 | 측정 |
|------|------|
| 오프라인 위키 | 비행기 모드에서 문서 열람 + 검색 완주(실기기) |
| 기능 패리티 | §7 마일스톤별 체크리스트 100% |
| VoiceOver 완주 | 마일스톤별 실기기 시나리오(문서 탐색 → 검색 → 채팅 질문 → 음성 대화 → PDF 열람) |
| 계약 안정성 | WebfortdKit 계약 테스트(prod 실응답 fixture) 매 커밋 green |

## 2. 확정 결정

| 영역 | 결정 | 근거 |
|------|------|------|
| 스택 | Swift 6(strict concurrency, main actor 기본) + SwiftUI + `@Observable` + `NavigationStack` | dodo·gildongmu 검증 스택. Liquid Glass는 표준 컴포넌트로 무료 획득 |
| 최소 지원 | **iOS 26** | dodo·gildongmu 동일. availability guard 전면 생략(잉여) |
| 구조 | **WebfortdKit**(SPM, UI 비의존, macOS 지원 → CLI `swift test`) + 앱 타깃. 같은 repo `ios/` 트리 | gildongmu 구조 직이식. Kit는 Xcode 없이 개발 가능 |
| 아키텍처 | **순수 API 클라이언트**(A안). 기존 Vercel `/api/*` 소비, 콘텐츠는 빌드 시 번들 | "마크다운이 정본" 원칙과 정합. DB 직접 접근은 인증·이력 외 없음 |
| 의존성 | **2개만**: `supabase-swift`(인증 전용, dodo 2.50.0 검증) + `swift-markdown`(Apple 공식, 위키 렌더링) | 완전 무의존(B안) 대비: 토큰 refresh 수제 구현 회피 + 표 렌더링(161개 문서가 표 사용 → `AttributedString(markdown:)` 불가) |
| Xcode 프로젝트 | 수동 최소 pbxproj, objectVersion 77 폴더 동기화 그룹(파일 추가 시 pbxproj 무변경) | gildongmu 검증. 병렬 편집 지뢰 구조 회피 |
| 서명 | Personal Team 자동 서명(개발) → Developer Program(배포 시점, §10 하드 스톱) | 비용 0으로 개발 완주 가능 |
| Bundle ID / 표시명 | `kr.khudt.webfortd` / **"장애인교원 위키 베타"** | 위키 브랜드 영구 결정(2026-05-24) + gildongmu "길동무 베타" 관례 |
| base URL | 릴리스 `https://webfortd.vercel.app`(2026-07-10 실측 200), 디버그 주입 가능 | KHUDT URL은 결제 락 402. 복귀 시 Config 상수 1곳 수정 |
| 지원 기기 | iPhone 세로 고정(TARGETED_DEVICE_FAMILY 1) | gildongmu 동일. iPad는 장기 과제 |

## 3. 아키텍처

```text
ios/
├── WebfortdKit/                 # SPM. UI 비의존. swift test로 개발
│   ├── Sources/WebfortdKit/
│   │   ├── KB/                  # KBIndex 디코딩·문서 스토어·위키링크 해석·검색
│   │   ├── Markdown/            # swift-markdown → 블록 AST(값 타입). 렌더링은 앱 몫
│   │   ├── Chat/                # AI SDK v6 UIMessage stream SSE 파서 + 모델
│   │   ├── Voice/               # Live 메시지 DTO·세션 규칙(dodo LiveMessages/Rules 이식)
│   │   ├── Catalog/             # 자료실·미디어 카탈로그 모델
│   │   └── APIClient.swift      # Bearer 부착·오류 정규화(dodo BFFClient 패턴)
│   └── Tests/WebfortdKitTests/  # Swift Testing + prod 실응답 Fixtures
├── Webfortd/                    # 앱 타깃 (SwiftUI)
│   ├── Resources/KB/            # 번들 산출물: content/**.md + kb-index + 카탈로그 JSON
│   ├── Stores/                  # @Observable: AuthStore·ChatStore·VoiceStore
│   ├── Wiki/ Chat/ Voice/ Library/ Media/ Settings/
│   └── Live/                    # LiveSocket·LiveAudioEngine·LiveSessionController(dodo 이식)
└── scripts/bundle-content.mjs   # 결정적 번들 파이프라인(아래)
```

### 3.1 콘텐츠 번들 파이프라인 (오프라인의 핵심)

`ios/scripts/bundle-content.mjs`(node, dodo `countries-to-json.mjs` 패턴):
- `content/**/*.md`(4.1MB) + `src/lib/kb-index.generated.json`(1.2MB) → `ios/Webfortd/Resources/KB/` 복사.
- `src/lib/library-catalog.ts`·`src/lib/media-curation.ts`를 `npx tsx`로 실제 import → `library.json`·`media.json` 추출(TS 배열이 정본, 수동 복제 금지).
- 결정적 출력(정렬·해시). 실행 시점 = 콘텐츠 갱신 시 수동 + 앱 릴리스 전 필수.
- **published만 번들**: status ≠ published 문서는 제외(웹의 published-only 게이트와 동일 의미론).
- 번들 크기 예산 약 +6MB. **이미지는 번들하지 않는다**(`public/source-images` 223MB): 문서 내 이미지는 production URL `AsyncImage` 온라인 로드, 오프라인에서는 alt 텍스트가 낭독 정본(멀티미디어 작성 원칙이 이미 alt를 의무화).

### 3.2 서버 변경 (소폭, 웹과 공용 자산)

dodo-planet `src/lib/supabase/server.ts`의 Bearer 이중 지원 패턴을 이식:
1. **`getCurrentUser()` 헬퍼**: `Authorization: Bearer <jwt>` 우선(`supabase.auth.getUser(jwt)`, 무효 시 쿠키 폴백 없이 거부) → 없으면 쿠키 SSR. 적용 라우트: `/api/chat`(이력 저장 식별), `/api/chat/threads`, `/api/voice/session`, `/api/voice/execute`, 신규 라우트.
2. **신규 `GET /api/chat/threads/[id]`**: thread의 과거 메시지 반환(현재 웹에도 복원 API 부재, 웹 이력 복원 UX에도 재사용될 공용 자산). RLS 의미론(본인 thread만) 유지.

이외 서버 변경 없음. 익명 채팅·rate limit(챗 20회/분·IP)·published-only 게이트는 그대로 소비.

### 3.3 인증 (supabase-swift, dodo AuthStore 이식)

- OTP 코드 플로우: `auth.signInWithOTP(email:)` → `auth.verifyOTP(email:token:type:.email)`. 웹의 2026-06-04 영구 결정(코드 방식)이 네이티브에 그대로 정합. 매직링크 컨텍스트 분리 문제가 앱에는 원천 부재.
- 세션: SDK가 Keychain 저장·자동 refresh. `AuthState = loading/signedOut/signedIn/bootstrapFailed`(dodo 4-state: 유효 세션을 네트워크 오류로 로그아웃시키지 않음).
- API 호출: `session.accessToken`을 Bearer로 부착(dodo `BFFClient.makeRequest` 순수 함수 이식).
- 익명 상태에서도 위키·검색·채팅(휘발) 전부 동작. 로그인은 이력·음성에만 요구(웹과 동일).

## 4. 기능별 설계

### 4.1 위키 (오프라인 코어)

- **탭 구조 5탭**: 위키 · 채팅 · 자료실 · 미디어 · 설정. 웹 사이드바 5진입의 미러이자 VoiceOver에 예측 가능한 고정 구조. FAQ는 위키 탭 내 axis 목록(웹과 동일).
- 위키 홈: 검색창(`.searchable`) + axis 진입(9축 중 문서 있는 축만, 웹의 0-count 숨김과 동일) + FAQ 섹션.
- 문서 화면: swift-markdown 블록 AST → SwiftUI 커스텀 렌더러. 헤딩은 `.accessibilityAddTraits(.isHeader)`(로터 점프), 표는 행 단위 접근성 객체, 위키링크 `[[slug]]`는 렌더 전 정규식(웹 `WIKILINK_RE` 등가)으로 내부 링크화 → `NavigationStack` push. 하단 출처(`source.citation`)·백링크 섹션(kb-index `wiki_backlinks`).
- 검색: 번들 인덱스 기반 인메모리(제목 가중 + 본문 전문, 535개 문서 규모라 충분). 완전 오프라인.

### 4.2 RAG 채팅

- `POST /api/chat` 소비. 스트림은 **AI SDK v6 UIMessage stream(SSE)**: `URLSession.bytes.lines`로 `data:` 라인 파싱(dodo ChatAPI 패턴 + 프로토콜만 교체). 처리 청크: `text-delta`(본문 증분), `message-metadata`(`sourceRefs`·`threadId`), `finish`. 미지 타입 무시(전방 호환).
- 계약은 prod 실응답 캡처 fixture로 고정(gildongmu 관례). AI SDK 프로토콜 변경 리스크는 fixture 회귀로 감지.
- 출처 카드: `SourceRef.slug`로 **번들 위키 문서에 즉시 내부 이동**(웹은 링크, 네이티브는 오프라인 문서로: 차별화).
- 첨부: v1은 이미지·PDF(PhotosPicker + 파일 선택, 1개·10MB 제한 미러). HWP는 서버가 처리하므로 전송만.
- 받아쓰기: **iOS 시스템 키보드 받아쓰기로 대체**, `/api/transcribe` 미사용(잉여 구현 회피).
- a11y: 스트리밍 중 진행 통지는 단일 채널, 답변은 보이는 곳 한 군데(웹 PR #78 교훈 그대로), 완료 시 답변 포커스.

### 4.3 채팅 이력 (로그인)

- 목록: `GET /api/chat/threads`(Bearer). 복원: 신규 `GET /api/chat/threads/[id]`. 이어가기: body에 `threadId`.
- 웹에 없는 복원 UX가 iOS에 먼저 생긴다(웹은 목록만). 서버 자산은 공용.

### 4.4 라이브 음성 채팅 (dodo Live 스택 직이식: 보류, M5)

> **2026-07-10 위원장 지시**: dodo-planet 앱의 Live 구현에 오류가 있어 이 축은 보류. dodo-planet에서 먼저 수정하고 검증된 상태로 이식한다. 아래 설계는 이식 시점의 정본으로 유지.

- dodo-planet `Core/Live/` 검증 구현을 이식: `LiveSocket`(URLSessionWebSocketTask, `BidiGenerateContentConstrained` + ephemeral token) · `LiveAudioEngine`(AVAudioEngine, 16kHz 캡처/24kHz 재생, `.voiceChat` 하드웨어 AEC) · `LiveSessionController`.
- webfortd 고유 배선: `POST /api/voice/session` → `{ token, model(gemini-3.1-flash-live-preview), voiceConfig(Puck·ko-KR) }`. functionCall `search_policy` → `POST /api/voice/execute` 프록시 → `sendToolResponse` 회신.
- 로그인 필수(서버 401 게이트 그대로). 웹의 barge-in·transcription 계약 미러.

### 4.5 자료실·미디어

- 번들 `library.json` 목록 → PDF는 Supabase Storage public URL 다운로드 후 `QLPreviewController`(QuickLook) 표시 + 로컬 캐시(한 번 받으면 오프라인).
- 미디어: 번들 `media.json` + 이미지 온라인 로드(`AsyncImage`), alt·캡션·출처 문서 링크(번들 위키로 내부 이동).

## 5. 접근성 (글로벌 헌장 + gildongmu 패턴)

정본은 `~/.claude/ACCESSIBILITY.md`. iOS 등가물:
- 한 줄=한 객체: `accessibilityElement(children: .combine)`, 구분자 쉼표.
- 통지 단일 채널: `AccessibilityNotification.Announcement`(진행·오류·상태만, 본문 중복 금지).
- 3-state 불변식(없음/모름/실패 분리), 비동기 경계 포커스 보존(`aria-disabled` 등가 = 비활성화 대신 가드), 터치 타깃 44pt.
- 문서 헤딩 = `.isHeader`(로터), 표는 시각 분절이 아닌 논리 행 단위.
- 마일스톤 게이트 = 실기기 VoiceOver 시나리오(Accessibility Inspector는 보조).

## 6. API·데이터 계약 요약 (조사 확정치)

| 표면 | 계약 |
|------|------|
| `POST /api/chat` | body `{ messages: UIMessage[], threadId? }`, 익명 허용, 20회/분·IP, 응답 AI SDK v6 UIMessage SSE(`text-delta`/`message-metadata{sourceRefs,threadId}`/`finish`) |
| `GET /api/chat/threads` | Bearer(승격 후), `{ threads:[{id,title,updated_at}] }` 최대 20 |
| `GET /api/chat/threads/[id]` | **신규**. 본인 thread 메시지 배열 |
| `POST /api/voice/session` | 로그인 필수, `{ resumeHandle? }` → `{ token, model, voiceConfig }`(ephemeral, uses:1) |
| `POST /api/voice/execute` | 로그인 필수, `{ name:'search_policy', args:{query} }` → `{ results[], sources[] }` |
| kb-index | `documents[{slug,axis,filePath,frontmatter,body_excerpt}]`, `wiki_backlinks`, `slug_index` 등. 본문 전문은 md 파일 |
| 자료실/미디어 | `library-catalog.ts`·`media-curation.ts` TS 배열 정본 → 번들 시 JSON 추출 |
| 인증 | Supabase OTP(`signInWithOtp`/`verifyOtp type email`), URL·anon key는 공개값 상수 |

## 7. 마일스톤 (수직 슬라이스, 경계마다 상세 plan 신규 작성)

| M | 내용 | 게이트 |
|---|------|--------|
| M0 | `ios/` 골격 + WebfortdKit + 번들 파이프라인 + 위키 문서 열람(축 목록→문서 렌더링, 표 포함) | 실기기 비행기 모드 문서 열람 + VoiceOver 헤딩 점프 |
| M1 | 오프라인 검색 + 위키링크·백링크 내비 + FAQ + 위키 홈 완성 | 비행기 모드 검색 완주 |
| M2 | RAG 채팅(익명): SSE 파서 + 출처 카드(번들 문서 연결) + 첨부 | 실호출 스트리밍 + VoiceOver 채팅 완주 |
| M3 | 인증(OTP) + 서버 Bearer 승격 + 이력(신규 API 포함) | 로그인 → 이력 저장·복원 실증 |
| M4 | 자료실·미디어 + 설정·About + TestFlight 준비 문서 | PDF 오프라인 캐시 + 전 기능 회귀 |
| M5 (보류) | 라이브 음성 채팅(dodo Live 이식 + search_policy 배선). **dodo-planet Live 구현에 오류가 있어 위원장 지시(2026-07-10)로 보류. dodo-planet에서 먼저 수정·검증 후 이식** | dodo-planet 수정 완료 + 위원장 재개 신호 |

## 8. 실행 전략

- subagent-driven development(자율성 헌장 디폴트). 마일스톤 직전 codex-rescue(아키텍처·불변식), 커밋 직전 coderabbit(라인), 매 마일스톤 실기기 VoiceOver.
- git: webfortd는 **PR 플로**(웹 관례 그대로): 마일스톤 단위 feature 브랜치 + PR. 의도 파일 pathspec 커밋.
- 서버 변경(M3)은 웹 unit 테스트 동반(기존 `tests/` 레인).

## 9. 테스트 전략

- WebfortdKit: Swift Testing + **prod 실응답 fixture**(캡처 일자 주석 의무, gildongmu 관례). 네트워크는 StubURLProtocol. 매 커밋 `swift test` green.
- 앱 계층: 순수 로직(스토어 규칙·파서)은 단위 테스트, 화면은 실기기 검증이 머지 게이트(XCUITest는 스모크 최소).
- 실호출 게이트: fixture green ≠ 완료. 각 마일스톤에서 prod API 실호출로 실데이터 렌더 확인.

## 10. 리스크와 미결정

| 항목 | 처리 |
|------|------|
| **Apple Developer Program 미가입(연 $99)** | TestFlight 배포의 전제. **비용 하드 스톱**. M5 진입 시 위원장 승인 상신. 그전까지 Personal Team으로 전 기능 개발·검증 가능 |
| 무료 Personal Team 앱 3개 제한 | dodo·gildongmu·webfortd = 정확히 3개로 임계 도달. 초과 필요 시 Program 가입 논의를 앞당김 |
| AI SDK UIMessage stream 프로토콜 변동 | fixture 회귀로 감지. 서버 AI SDK 버전은 웹이 고정 관리 |
| swift-markdown 표·긴 문서 렌더 성능 | M0 실측 게이트(최장 문서로 검증). 미달 시 LazyVStack 청크 렌더 |
| 위키 콘텐츠 갱신 주기 | 앱 업데이트 시 번들 갱신(콘텐츠 변경 빈도 낮음). 원격 동기화는 YAGNI로 기각(§접근 C) |
| 음성 ephemeral token `uses:1` | 재연결 시 세션 재발급 필요: dodo와 동일 처리(재발급 플로) |

## 11. 기각한 대안

- **B. 완전 무의존(인증 수제)**: 토큰 refresh·Keychain·생명주기 수제 구현은 보안 민감 코드 300줄. dodo 검증 SDK 재사용이 우위.
- **C. WKWebView 래퍼**: 네이티브 가치(오프라인·VoiceOver 차별화) 전부 상실.
- **번들+원격 콘텐츠 동기화**: 동기화 프로토콜·버전 관리 복잡도 대비 콘텐츠 변경 빈도 낮음(YAGNI).
