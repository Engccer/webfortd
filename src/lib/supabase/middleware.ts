import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 매 요청마다 세션 쿠키를 새로고침해 토큰 갱신을 유지한다.
 * Next.js 16 proxy.ts에서 호출 — proxy 함수가 이 헬퍼를 invoke.
 *
 * IMPORTANT: createServerClient 와 supabase.auth.getUser() 사이에 다른 로직을
 * 끼워 넣지 말 것. 세션이 갱신되지 않아 사용자가 임의로 로그아웃되는 버그가 발생할 수 있음.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    // env 미설정 — preview deployment 등에서 session refresh를 건너뛴다.
    // throw하면 모든 라우트 (gov 포함)가 500. defensive no-op으로 페이지 렌더 자체는 보존.
    // production env가 누락된 경우 매직링크 로그인 자체가 작동 안 함 (AuthContext 가드).
    return supabaseResponse
  }

  // Finding 2 (codex-rescue perf): sb-* auth cookie가 없으면 익명 트래픽이라
  // 어차피 getUser()가 빈 결과를 반환. createServerClient + getUser 비용을 스킵해
  // (gov) 익명 트래픽 + 향후 Phase 3 RAG public API 부담을 줄인다.
  // 로그인 사용자는 sb-access-token/sb-refresh-token 쿠키 보유 → 정상 refresh 경로 진입.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-'))
  if (!hasAuthCookie) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // 세션 갱신 트리거 — 결과는 사용하지 않지만 getUser() 호출 자체가 토큰 refresh를 유발.
  await supabase.auth.getUser()

  return supabaseResponse
}
