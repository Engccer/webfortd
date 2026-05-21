import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Browser-safe Supabase client (publishable anon key 사용, 쿠키 기반 세션).
 * @supabase/ssr의 createBrowserClient — server/middleware와 cookie storage 공유.
 * RLS 정책에 따라 status='published' documents/chunks/backlinks만 read 가능.
 */
export function getBrowserClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      )
    }
    _client = createBrowserClient(url, anonKey)
  }
  return _client
}

/**
 * 기존 호환 alias — getAnonClient 호출자들이 영향받지 않도록 유지.
 * 신규 코드는 getBrowserClient 사용.
 */
export const getAnonClient = getBrowserClient
