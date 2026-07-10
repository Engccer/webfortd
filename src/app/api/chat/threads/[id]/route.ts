/**
 * M3(iOS) — thread 메시지 복원. 웹 이력 복원 UX에도 재사용될 공용 자산.
 * RLS가 본인 thread·메시지만 반환 보장. 비로그인 401, 남의 thread는 RLS로 404.
 */
import { getRequestAuth } from '@/lib/supabase/request-auth'

export const runtime = 'nodejs'

// uuid 형식 사전 검증 — 잘못된 형식이 supabase까지 가면 22P02 오류로 500이 되므로,
// 여기서 걸러 404(조용한 미존재 취급)로 통일한다.
const UUID_RE = /^[0-9a-f-]{36}$/i

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return Response.json({ error: '대화를 찾을 수 없어요.' }, { status: 404 })
  }
  const { supabase, user } = await getRequestAuth(request)
  if (!user) {
    return Response.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }
  const { data: thread, error: threadError } = await supabase
    .from('chat_threads')
    .select('id, title')
    .eq('id', id)
    .maybeSingle()
  if (threadError) {
    console.error('[chat/threads/[id]] thread select 실패:', threadError.message)
    return Response.json({ error: '대화를 불러오지 못했어요.' }, { status: 500 })
  }
  if (!thread) {
    return Response.json({ error: '대화를 찾을 수 없어요.' }, { status: 404 })
  }
  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('id, role, content, source_refs, created_at')
    .eq('thread_id', id)
    .order('created_at', { ascending: true })
  if (msgError) {
    console.error('[chat/threads/[id]] messages select 실패:', msgError.message)
    return Response.json({ error: '대화를 불러오지 못했어요.' }, { status: 500 })
  }
  return Response.json({ thread, messages: messages ?? [] })
}
