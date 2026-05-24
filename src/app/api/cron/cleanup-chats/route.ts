/**
 * Phase 3 M5 — 90일 soft delete + 추가 30일 hard delete cron.
 *
 * Vercel cron이 매일 03:00 UTC (한국시간 12:00)에 호출 (vercel.json).
 * Bearer 토큰 검증 (CRON_SECRET 환경변수).
 *
 * 정책 (spec §5.3):
 *   - soft delete 90일: updated_at < now() - 90 days 이고 deleted_at is null
 *     → deleted_at = now(). 사용자 SELECT에서 제외 (RLS 정책).
 *   - hard delete 추가 30일: deleted_at < now() - 30 days
 *     → 실 DELETE. cascade로 chat_messages 자동 삭제.
 *     PIPA "수집 목적 소멸 후 즉시 파기" 정합 (90일 + 30일 = 총 120일 보존
 *     중 90일 후 사용자 접근 차단으로 의무 충족).
 *
 * Bearer 검증: timing-safe 비교 (codex P2 권고 — 시간 일치 attack 차단).
 */
import { getAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'

const DAY_MS = 24 * 60 * 60 * 1000

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  // length 다르면 timingSafeEqual throw — 사전 length check 후 비교
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export async function GET(req: Request): Promise<Response> {
  const expectedSecret = process.env.CRON_SECRET ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${expectedSecret}`

  if (!expectedSecret || !safeCompare(auth, expected)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = getAdminClient()
  const now = Date.now()
  const softCutoff = new Date(now - 90 * DAY_MS).toISOString()
  const hardCutoff = new Date(now - 30 * DAY_MS).toISOString()

  // 1. soft delete: 90일 경과 + 아직 deleted_at is null인 thread
  const { data: softDeleted, error: e1 } = await admin
    .from('chat_threads')
    .update({ deleted_at: new Date().toISOString() })
    .lt('updated_at', softCutoff)
    .is('deleted_at', null)
    .select('id')

  if (e1) {
    console.error('[cron/cleanup-chats] soft delete failed:', e1.message)
    return new Response(
      JSON.stringify({ error: 'soft delete failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  // 2. hard delete: deleted_at + 30일 경과 thread (cascade로 messages 자동 삭제)
  const { data: hardDeleted, error: e2 } = await admin
    .from('chat_threads')
    .delete()
    .lt('deleted_at', hardCutoff)
    .select('id')

  if (e2) {
    console.error('[cron/cleanup-chats] hard delete failed:', e2.message)
    return new Response(
      JSON.stringify({ error: 'hard delete failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  console.log('[cron/cleanup-chats] finish', {
    softDeleted: softDeleted?.length ?? 0,
    hardDeleted: hardDeleted?.length ?? 0,
  })

  return new Response(
    JSON.stringify({
      softDeleted: softDeleted?.length ?? 0,
      hardDeleted: hardDeleted?.length ?? 0,
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  )
}
