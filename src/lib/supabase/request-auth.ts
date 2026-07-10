import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getServerClient } from '@/lib/supabase/server'

/** Authorization 헤더에서 Bearer JWT 추출. 없으면 null. RFC 7235 스킴 대소문자 무관. */
export function getBearerJwt(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() || null : null
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
