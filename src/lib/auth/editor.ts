import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from '../supabase/server.ts'

export interface EditorStatus {
  canEdit: boolean
  userId: string | null
  email: string | null
}

/**
 * 편집 권한(editor 또는 admin) server-side 판정. 기존 admin 게이트는 건드리지 않는다.
 * RSC / Route Handler / Server Action에서 사용. AuthContext(client-side)는 UI hint 용도이며
 * 권한 게이트의 단일 진실은 본 헬퍼.
 *
 * Fail-safe: Supabase env 미설정 시(빌드/CI/a11y 테스트 등) silent 비-editor 반환.
 * AuthContext(client-side)의 tryGetClient 패턴과 정합.
 */
export async function getCurrentUserEditorStatus(): Promise<EditorStatus> {
  let supabase
  try {
    supabase = await getServerClient()
  } catch {
    return { canEdit: false, userId: null, email: null }
  }
  return getCurrentUserEditorStatusWith(supabase)
}

/**
 * Dependency injection 버전 - 테스트는 mock client 주입.
 */
export async function getCurrentUserEditorStatusWith(
  supabase: SupabaseClient,
): Promise<EditorStatus> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user ?? null
  if (!user) {
    return { canEdit: false, userId: null, email: null }
  }

  const { data: roles, error } = await supabase
    .from('editor_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['editor', 'admin'])

  // RLS denial / network error - fail-safe로 canEdit=false
  // user 정보는 보존해서 UI hint(이메일 표시)로 사용 가능하도록.
  if (error) {
    return { canEdit: false, userId: user.id, email: user.email ?? null }
  }

  return {
    canEdit: (roles ?? []).length > 0,
    userId: user.id,
    email: user.email ?? null,
  }
}

/**
 * 공개 커밋용 가명 식별자 - 개인 이메일·실명은 public repo에 남기지 않는다(spec §4).
 */
export function editorIdShort(userId: string): string {
  return userId.slice(0, 8)
}
