import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _anonClient: SupabaseClient | null = null

/**
 * Browser-safe anon client (publishable key 사용).
 * RLS 정책에 따라 status='published' documents/chunks/backlinks만 read 가능.
 */
export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      )
    }
    _anonClient = createClient(url, anonKey)
  }
  return _anonClient
}
