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
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
    )
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
