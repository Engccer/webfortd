import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from '../supabase/server.ts'

export interface AdminStatus {
  isAdmin: boolean
  userId: string | null
  email: string | null
}

/**
 * Production helper — getServerClient를 통해 현재 요청의 admin 권한을 server-side에서 조회.
 * RSC / Route Handler / Server Action에서 사용. AuthContext(client-side)는 UI hint 용도이며
 * 권한 게이트의 단일 진실은 본 헬퍼.
 */
export async function getCurrentUserAdminStatus(): Promise<AdminStatus> {
  const supabase = await getServerClient()
  return getCurrentUserAdminStatusWith(supabase)
}

/**
 * Dependency injection 버전 — 테스트는 mock client 주입.
 */
export async function getCurrentUserAdminStatusWith(
  supabase: SupabaseClient,
): Promise<AdminStatus> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user ?? null
  if (!user) {
    return { isAdmin: false, userId: null, email: null }
  }

  const { data: roles, error } = await supabase
    .from('editor_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')

  // RLS denial / network error → fail-safe로 isAdmin=false
  // user 정보는 보존해서 UI hint(이메일 표시)로 사용 가능하도록.
  if (error) {
    return { isAdmin: false, userId: user.id, email: user.email ?? null }
  }

  return {
    isAdmin: (roles ?? []).length > 0,
    userId: user.id,
    email: user.email ?? null,
  }
}
