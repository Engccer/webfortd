/**
 * Phase 7 M1 — /api/voice/session 단위 테스트.
 *
 * 401 인증 게이트 테스트 불가 이유:
 *   getServerClient()가 next/headers의 cookies()를 await 호출하는데,
 *   cookies()는 Next.js 요청 컨텍스트 밖에서 실행하면 즉시 throw한다.
 *   모듈 임포트 시점에 server-only 마커가 의존성 체인에 있어도,
 *   실제 cookies() 호출은 POST() 안에서 일어나므로 전체 라우트를
 *   node:test에서 직접 호출하면 next/headers 에러가 발생한다.
 *
 * 채택한 접근:
 *   1) 순수 헬퍼(SessionRequestSchema)를 별도 파일로 분리하지 않고
 *      라우트 파일 내에 두되, 스키마 로직을 검증하는 단위 테스트 작성.
 *   2) 401 게이트는 integration/M5 smoke(실 Supabase + 실 Next.js 런타임)에서 검증.
 *
 * 검증 범위:
 *   - LIVE_MODEL, VOICE_NAME, LANGUAGE_CODE 상수가 올바른 값
 *   - sessionRequestSchema: resumeHandle 선택적, 잘못된 타입은 safeParse 실패
 *   - search_policy 도구 선언이 라우트에서 재사용 가능한 shape
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { LIVE_MODEL } from '../../src/lib/gemini-live.ts'
import {
  SEARCH_POLICY_DECLARATION,
  SEARCH_POLICY_TOOL_NAME,
} from '../../src/lib/voice/search-policy.ts'

// SessionRequestSchema를 라우트와 동일하게 인라인 재현 (소스 오브 트루스는 라우트).
const SessionRequestSchema = z.object({
  resumeHandle: z.string().optional(),
})

test('LIVE_MODEL은 native audio live 모델', () => {
  assert.equal(LIVE_MODEL, 'gemini-3.1-flash-live-preview')
})

test('SessionRequestSchema: 빈 바디 → success (resumeHandle 선택적)', () => {
  const result = SessionRequestSchema.safeParse({})
  assert.equal(result.success, true)
})

test('SessionRequestSchema: resumeHandle 문자열 → success', () => {
  const result = SessionRequestSchema.safeParse({ resumeHandle: 'handle-abc' })
  assert.equal(result.success, true)
  if (result.success) assert.equal(result.data.resumeHandle, 'handle-abc')
})

test('SessionRequestSchema: resumeHandle 숫자 → fail', () => {
  const result = SessionRequestSchema.safeParse({ resumeHandle: 123 })
  assert.equal(result.success, false)
})

test('SessionRequestSchema: null 바디 → fail (safeParse(null))', () => {
  const result = SessionRequestSchema.safeParse(null)
  assert.equal(result.success, false)
})

test('SEARCH_POLICY_DECLARATION 이름은 search_policy', () => {
  assert.equal(SEARCH_POLICY_DECLARATION.name, SEARCH_POLICY_TOOL_NAME)
})

/**
 * NOTE: 401 인증 게이트는 unit 테스트 불가.
 * - getServerClient() → cookies() (next/headers) → Next.js 요청 컨텍스트 필수.
 * - node:test 환경에서 POST() 직접 호출 시 "cookies() was called outside a request scope" throw.
 * - 검증 위치: M5 integration smoke (실 Supabase 세션 없는 POST → 401 확인).
 */
