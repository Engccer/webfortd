/**
 * Phase 3 M6.4 — 채팅 세션 4시간 자동 분리.
 *
 * 출처: dodo-planet `src/hooks/useChat.ts:126` `SESSION_TIMEOUT_MS`.
 * webfortd 사용: ChatUI mount 시 initialThreadId의 updated_at을 fetch해서
 * isStaleThread() true면 신규 thread로 분기 (이전 thread는 drawer에 그대로 유지).
 *
 * 4시간 = 위원장 1차 결정. 정책 안내 컨텍스트는 더 길게 유지 검토 carry (8/12/24h).
 */

export const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000

/**
 * thread의 마지막 활동 시점(`updated_at`)이 SESSION_TIMEOUT_MS를 초과했는지.
 * 미래 timestamp(clock skew)는 stale 아님으로 처리 (false).
 */
export function isStaleThread(updatedAt: string | Date): boolean {
  const lastMs =
    typeof updatedAt === 'string' ? Date.parse(updatedAt) : updatedAt.getTime()
  if (Number.isNaN(lastMs)) return false
  const now = Date.now()
  const elapsed = now - lastMs
  if (elapsed < 0) return false // 미래 timestamp — clock skew, stale 아님
  return elapsed > SESSION_TIMEOUT_MS
}
