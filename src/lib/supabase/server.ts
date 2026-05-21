import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client (Server Components / Route Handlers / Server Actions).
 * @supabase/ssr — Next.js cookies()를 통해 세션 쿠키 read/write.
 * Next.js 16: cookies()는 async 이므로 await 필수.
 *
 * RLS 정책에 따라 anon 사용자는 status='published'만 read 가능.
 * 인증된 사용자는 access policy에 따라 추가 권한.
 */
export async function getServerClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Server Component에서 호출되면 cookie set은 silently ignore.
          // proxy.ts(updateSession)가 매 요청마다 세션을 갱신하므로 무해.
        }
      },
    },
  })
}
