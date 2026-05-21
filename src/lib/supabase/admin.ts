import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminClient: SupabaseClient | null = null

/**
 * Service role admin client (RLS 우회).
 * 절대 browser/Server Component에서 import 금지. sync 스크립트·관리 도구 한정.
 * SUPABASE_SECRET_KEY는 NEXT_PUBLIC_ 접두사 없음 → Next.js 빌드 시 client bundle에서 제외.
 */
export function getAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getAdminClient는 server-side 전용 (browser import 금지)')
  }
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 미설정',
      )
    }
    _adminClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _adminClient
}
