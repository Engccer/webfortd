import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 3 M2 — RAG retrieval 전용 service_role Supabase client.
 *
 * - service_role 키 사용 → RLS 우회
 * - persistSession=false → server-side 호출이라 세션 불필요
 * - 호출자(retrieval.ts / Route Handler)가 매 호출 시 새 인스턴스 생성
 *   (Next.js Route Handler는 짧은 생명 — singleton 캐싱 이득 미미 + 테스트 격리 우위)
 *
 * 절대 client 번들에 포함되면 안 됨 — `import 'server-only'` 가드.
 */
export function createRagAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url) {
    throw new Error('createRagAdminClient: NEXT_PUBLIC_SUPABASE_URL 미설정')
  }
  if (!secretKey) {
    throw new Error('createRagAdminClient: SUPABASE_SECRET_KEY 미설정')
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
