# webfortd iOS 네이티브 M3 구현 계획: 인증(OTP) + 서버 Bearer 승격 + 채팅 이력

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS가 정식 인증 클라이언트가 된다: 웹 서버에 Bearer 이중 지원(dodo-planet 검증 패턴)과 이력 복원 API를 추가하고, iOS에 supabase-swift OTP 로그인·대화 목록·이어가기를 붙인다.

**Architecture:** 서버는 `getRequestUser()`(Bearer 우선, 쿠키 폴백) 헬퍼 1개 + 신규 `GET /api/chat/threads/[id]`. iOS는 supabase-swift(앱 타깃 전용, Kit 무의존 유지) AuthStore + Kit ThreadsAPI(토큰 주입은 클로저).

**Tech Stack:** 서버 TypeScript(기존 레인), iOS Swift 6. 신규 의존성: supabase-swift 2.50.0(앱 타깃, spec 확정분).

## Global Constraints

- 기존 전 항목(iOS 26·Kit 순수·이모지·em dash 금지·주석 한국어·pathspec·44pt) + 브랜치 `ios-native-m3`.
- **Kit는 supabase-swift를 import하지 않는다** — 토큰은 `tokenProvider: (() async -> String?)?` 주입.
- 서버: Bearer 무효 토큰은 **쿠키로 폴백하지 않고 거부**(dodo 원칙 — 잘못된 토큰이 조용히 성공하는 혼동 차단). 헤더 없으면 쿠키 경로.
- 웹 기존 동작 무회귀: 쿠키 사용자 흐름(웹 UI)은 변경 없음. `npm test` 게이트.
- 익명 iOS 흐름 무회귀: 로그인 없이 위키·검색·채팅 전부 기존대로.
- 매직링크 재도입 금지(2026-06-04 영구 결정) — OTP 코드 방식만.

## 파일 구조 (M3 신규/수정)

```text
src/lib/supabase/request-auth.ts               ← 신규: Bearer 우선 사용자·클라이언트 해석
src/app/api/chat/route.ts                      ← user 검출을 request-auth로 교체
src/app/api/chat/threads/route.ts              ← Bearer 지원(request 인자)
src/app/api/chat/threads/[id]/route.ts         ← 신규: thread 메시지 복원
tests/chat/request-auth.test.ts                ← 신규(웹 unit)
ios/Webfortd.xcodeproj/project.pbxproj         ← supabase-swift remote package 추가
ios/WebfortdKit/Sources/WebfortdKit/Chat/ChatAPI.swift    ← tokenProvider 주입
ios/WebfortdKit/Sources/WebfortdKit/Chat/ThreadsAPI.swift ← 신규
ios/Webfortd/Auth/AuthStore.swift              ← 신규 (supabase-swift)
ios/Webfortd/Auth/AuthSheet.swift              ← 신규 (이메일→코드 2단계)
ios/Webfortd/Chat/ThreadListSheet.swift        ← 신규 (대화 목록·복원)
ios/Webfortd/Chat/ChatStore.swift·ChatView.swift ← threadId·이력 연동
ios/Webfortd/WebfortdApp.swift                 ← AuthStore 주입
```

---

### Task 1: 서버 Bearer 승격 + 이력 복원 API (웹 레인)

**Files:**
- Create: `src/lib/supabase/request-auth.ts`
- Modify: `src/app/api/chat/route.ts`(user 검출부), `src/app/api/chat/threads/route.ts`
- Create: `src/app/api/chat/threads/[id]/route.ts`
- Test: `tests/chat/request-auth.test.ts` (기존 tests/ node:test 관례)

**Interfaces (Produces):**

`src/lib/supabase/request-auth.ts` (dodo-planet `src/lib/supabase/server.ts` 패턴 이식):
```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getServerClient } from '@/lib/supabase/server'

/** Authorization 헤더에서 Bearer JWT 추출. 없으면 null. */
export function getBearerJwt(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

/** anon key 클라이언트에 Bearer를 심어 PostgREST가 auth.uid() RLS 의미론을 갖게 한다. */
export function createBearerClient(jwt: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase env 미설정')
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * 요청 사용자 + 그 사용자 권한의 클라이언트.
 * Bearer 우선: 토큰이 명시됐는데 무효면 쿠키로 폴백하지 않는다(혼동 차단, dodo 원칙).
 * 헤더 없으면 쿠키 SSR 경로(웹 기존 동작 그대로).
 */
export async function getRequestAuth(
  request: Request,
): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const jwt = getBearerJwt(request)
  if (jwt) {
    const supabase = createBearerClient(jwt)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(jwt)
    if (error || !user) return { supabase, user: null }
    return { supabase, user }
  }
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}
```

**라우트 수정:**
- `src/app/api/chat/route.ts`: 기존 `const supabaseSSR = await getServerClient(); ... auth.getUser()` 부분(약 203행)을 `const { user } = await getRequestAuth(request)`로 교체(이후 로직의 user 사용은 동일 — admin RPC 저장 경로 무변경). request 객체는 핸들러 인자로 이미 존재.
- `src/app/api/chat/threads/route.ts`: `GET(request: Request)`로 시그니처 변경, `const { supabase, user } = await getRequestAuth(request)` 사용(이후 select는 동일 — bearer 클라이언트도 RLS로 본인 것만).
- 신규 `src/app/api/chat/threads/[id]/route.ts`:
```ts
/**
 * M3(iOS) — thread 메시지 복원. 웹 이력 복원 UX에도 재사용될 공용 자산.
 * RLS가 본인 thread·메시지만 반환 보장. 비로그인 401, 남의 thread는 RLS로 404.
 */
import { getRequestAuth } from '@/lib/supabase/request-auth'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const { supabase, user } = await getRequestAuth(request)
  if (!user) {
    return Response.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }
  const { data: thread, error: threadError } = await supabase
    .from('chat_threads')
    .select('id, title')
    .eq('id', id)
    .maybeSingle()
  if (threadError) {
    console.error('[chat/threads/[id]] thread select 실패:', threadError.message)
    return Response.json({ error: '대화를 불러오지 못했어요.' }, { status: 500 })
  }
  if (!thread) {
    return Response.json({ error: '대화를 찾을 수 없어요.' }, { status: 404 })
  }
  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('id, role, content, source_refs, created_at')
    .eq('thread_id', id)
    .order('created_at', { ascending: true })
  if (msgError) {
    console.error('[chat/threads/[id]] messages select 실패:', msgError.message)
    return Response.json({ error: '대화를 불러오지 못했어요.' }, { status: 500 })
  }
  return Response.json({ thread, messages: messages ?? [] })
}
```
(uuid 형식 검증: 잘못된 형식은 supabase가 22P02 오류를 내므로 threadError 경로에서 500이 아니라 404로 처리하고 싶으면 `id` 정규식 사전 검증을 추가 — 구현 시 `/^[0-9a-f-]{36}$/i` 불일치 시 404 반환.)

**테스트** (`tests/chat/request-auth.test.ts`, node:test): `getBearerJwt` 4케이스(정상/없음/비Bearer/빈 토큰). `createBearerClient`는 env 없을 때 throw. (getUser 실호출은 통합 영역이라 제외 — 기존 관례.)

- [ ] Step 1: 테스트 작성 → FAIL → 헬퍼 구현 → PASS
- [ ] Step 2: 라우트 3개 수정·신설, `npm test` 전체 green + `npm run build` 성공(정적 라우트 회귀 확인)
- [ ] Step 3: 커밋 `feat(api): Bearer 이중 인증 + thread 메시지 복원 API(iOS 정식 클라이언트 지원)` (pathspec: src/lib/supabase/request-auth.ts src/app/api/chat tests/chat)

### Task 2: Kit — tokenProvider + ThreadsAPI

**Files:**
- Modify: `ios/WebfortdKit/Sources/WebfortdKit/Chat/ChatAPI.swift`
- Create: `ios/WebfortdKit/Sources/WebfortdKit/Chat/ThreadsAPI.swift`
- Test: `ChatAPITests.swift`(헤더 부착 검증 추가), `ThreadsAPITests.swift` 신규

**Interfaces (Produces):**
```swift
// ChatAPI 변경: 생성자에 토큰 주입 클로저 추가(기본 nil = 익명 무변경)
public init(baseURL: URL, session: URLSession = .shared,
            tokenProvider: (@Sendable () async -> String?)? = nil)
// stream() 요청 조립 시 토큰이 있으면 "Authorization: Bearer <token>" 부착

public struct ChatThreadSummary: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let updatedAt: String   // CodingKey "updated_at"
}
public struct ChatThreadMessage: Codable, Equatable, Sendable {
    public let role: String        // "user" | "assistant"
    public let content: String
    public let sourceRefs: [ChatSourceRef]  // CodingKey "source_refs", 없으면 []
}
public struct ThreadsAPI {
    public init(baseURL: URL, session: URLSession = .shared,
                tokenProvider: @escaping @Sendable () async -> String?)
    public func list() async throws -> [ChatThreadSummary]          // GET /api/chat/threads
    public func messages(threadId: String) async throws
        -> (title: String, messages: [ChatThreadMessage])           // GET /api/chat/threads/{id}
}
public enum ThreadsAPIError: Error, Equatable {
    case unauthorized      // 401
    case notFound          // 404
    case server(status: Int)
}
```
- 테스트: ChatStubURLProtocol 재사용(필요 시 공용 헬퍼 파일로 승격) — (a) tokenProvider 있으면 Authorization 헤더 부착·없으면 미부착, (b) threads 목록 디코딩(fixture는 서버 응답 shape 손작성 — 서버 코드가 정본이므로 shape을 Task 1 라우트 코드와 대조해 작성, 주석에 근거 명시), (c) 401→unauthorized.

- [ ] Step 1: 실패 테스트 → 구현 → 전체 swift test green(36 + 신규 ≥4)
- [ ] Step 2: 커밋 `feat(ios): ThreadsAPI + ChatAPI Bearer 토큰 주입(Kit는 supabase 무의존)` (pathspec: ios/WebfortdKit)

### Task 3: 앱 — supabase-swift 인증 + 이력 UI

**Files:**
- Modify: `ios/Webfortd.xcodeproj/project.pbxproj` (remote package 추가)
- Create: `ios/Webfortd/Auth/AuthStore.swift`, `ios/Webfortd/Auth/AuthSheet.swift`, `ios/Webfortd/Chat/ThreadListSheet.swift`
- Modify: `ios/Webfortd/WebfortdApp.swift`, `ios/Webfortd/Chat/ChatStore.swift`, `ios/Webfortd/Chat/ChatView.swift`

**pbxproj 변경(정확히 이 3곳 — 폴더 동기화 그룹 구조라 파일 추가는 무변경):**
1. `XCRemoteSwiftPackageReference` 섹션 신설:
```text
/* Begin XCRemoteSwiftPackageReference section */
		B70001 /* XCRemoteSwiftPackageReference "supabase-swift" */ = {
			isa = XCRemoteSwiftPackageReference;
			repositoryURL = "https://github.com/supabase/supabase-swift";
			requirement = {
				kind = upToNextMajorVersion;
				minimumVersion = 2.50.0;
			};
		};
/* End XCRemoteSwiftPackageReference section */
```
2. `XCSwiftPackageProductDependency`에 `AC0002 /* Supabase */ = { isa = XCSwiftPackageProductDependency; package = B70001; productName = Supabase; };` 추가, 타깃 `packageProductDependencies`에 AC0002 추가.
3. `PBXBuildFile`에 `AA0002 /* Supabase in Frameworks */ = {isa = PBXBuildFile; productRef = AC0002; };` + Frameworks build phase files에 AA0002 추가. 프로젝트 `packageReferences`에 B70001 추가.

**AuthStore** (`@Observable @MainActor`, dodo 4-state 슬림 이식):
```swift
enum AuthState { case loading, signedOut, signedIn(email: String) }
```
- `SupabaseClientProvider`(enum, static let shared = SupabaseClient(url:key:)) — URL·anon key는 AppConfig에 상수 추가(`NEXT_PUBLIC_*` 공개값: url `https://<웹과 동일 ref>.supabase.co`, anon key는 `src/lib/supabase/client.ts`가 읽는 `.env.local`/Vercel 값 — **구현 시 `.env.local`의 NEXT_PUBLIC_SUPABASE_URL·NEXT_PUBLIC_SUPABASE_ANON_KEY 실값을 읽어 상수로 박는다**. anon key는 공개 배포값이라 하드코딩 허용).
- `bootstrap()`: `try await client.auth.session` 복원 → signedIn/signedOut(세션 부재만 signedOut, 네트워크 오류는 기존 세션 유지).
- `requestOtp(email:)` → `client.auth.signInWithOTP(email:)`. `verifyOtp(email:code:)` → `client.auth.verifyOTP(email:token:type:.email)`. `signOut()`.
- `accessToken() async -> String?` — `try? await client.auth.session.accessToken`(SDK 자동 refresh). 이것이 ChatAPI·ThreadsAPI의 tokenProvider.

**AuthSheet** (웹 AuthModal 2단계 미러): 이메일 입력 → "인증 코드 받기" → 코드 입력(숫자 키패드) → "확인". 오류 한국어 표시, 진행 중 disabled 금지(가드+라벨 변화), 성공 시 시트 닫힘 + Announcement("로그인했습니다"). 취소 가능.

**연동:**
- `WebfortdApp`: `@State authStore` 생성, 환경 주입. ChatAPI·ThreadsAPI 생성 시 tokenProvider = `{ await authStore.accessToken() }`.
- `ChatView` 툴바: 비로그인 → "로그인" 버튼(AuthSheet). 로그인 → "대화 목록" 버튼(ThreadListSheet) + 계정 메뉴(이메일 표시·로그아웃, confirmationDialog).
- `ThreadListSheet`: `ThreadsAPI.list()` 목록(제목+상대시간 combine), 선택 → `ChatStore.loadThread(id:)`(messages 교체 + threadId 설정 + 시트 닫힘 + 첫 메시지로 포커스), 오류·빈 목록 3-state 분리.
- `ChatStore`: `threadId: String?` — metadata 이벤트의 threadId 채택, send 시 body에 포함. `loadThread`는 ThreadsAPI.messages → ChatMessage 배열로 변환(sourceRefs 포함). "새 대화" 버튼(threadId·messages 리셋) 툴바 추가.
- 로그아웃 시 threadId·이력 리셋(익명 휘발 모드 복귀).

**검증:**
- swift test 전체 green + xcodebuild BUILD SUCCEEDED(첫 빌드는 supabase-swift SPM 해석 수 분).
- 시뮬 스모크: 익명 회귀(위키·검색·채팅 동작) + 로그인 시트 열림·이메일 검증 문구까지(실제 OTP 수신은 위원장 실기기 게이트로 이월 — 명시 기록).
- 서버 신규 라우트 실계약: production 배포 전이므로 로컬 `npm run dev` + curl로 401 경로만 확인(비로그인 401, 형식 오류 404).

- [ ] Step 1: pbxproj + AppConfig 상수 + AuthStore/Provider, 빌드 성공
- [ ] Step 2: AuthSheet + 툴바 연동 + ThreadListSheet + ChatStore 연동
- [ ] Step 3: 스모크(익명 회귀 + 로그인 UI) 스크린샷 `/tmp/webfortd-m3-auth.png`
- [ ] Step 4: 커밋 `feat(ios): OTP 로그인·대화 이력(supabase-swift, Kit 무의존 유지)` (pathspec: ios/Webfortd.xcodeproj/project.pbxproj ios/Webfortd + workspace Package.resolved)
