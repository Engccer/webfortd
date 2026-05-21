// Supabase JS / PostgREST 에러 객체를 사람이 읽을 수 있는 형식으로 변환.
// row 데이터·user_id 같은 PII가 .message/.details/.hint에 노출될 가능성을 차단하는
// production-default가 핵심. DEBUG=1 또는 DEBUG=true 환경변수에서만 full payload 노출.

interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

const KNOWN_CODES: Record<string, string> = {
  '42501': 'RLS 정책 거부 (insufficient_privilege)',
  P0001: '트리거 raise exception (status 전이 등)',
  '23502': 'NOT NULL constraint violation',
  '23503': 'FK constraint violation',
  '23505': 'unique constraint violation',
  '23514': 'CHECK constraint violation',
}

export function formatSupabaseError(err: SupabaseLikeError): string {
  const debug = process.env.DEBUG === '1' || process.env.DEBUG === 'true'
  const code = err.code ?? 'unknown'
  if (debug) {
    return `[${code}] ${err.message ?? ''} (details: ${err.details ?? '-'}, hint: ${err.hint ?? '-'})`
  }
  const desc = KNOWN_CODES[code] ?? `(code ${code})`
  return `[${code}] ${desc}`
}
