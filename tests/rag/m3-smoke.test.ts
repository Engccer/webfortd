/**
 * Phase 3 M3 Task 4 — POST /api/chat Route Handler smoke 테스트 (실 Gemini + Supabase).
 *
 * 전제:
 *   - M1 임베딩 파이프라인 + 2766 청크 존재
 *   - M2 retrieval API 작동
 *   - M3 Route Handler 구현 완료
 *   - .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY + GOOGLE_GENERATIVE_AI_API_KEY
 *   - Task 8 완료 후 AI Gateway 활성화 (현재 미완 시 OIDC fail 가능, direct provider fallback 가능)
 *
 * 분류: 명시 RUN_SMOKE=1 실행. 일반 `npm test` 에서는 skip되어 실 API 비용 차단.
 *
 * 실행:
 *   RUN_SMOKE=1 npm test -- --test-only tests/rag/m3-smoke.test.ts
 *
 * 검증:
 *   - POST 200 응답 + SSE 스트림 content-type
 *   - 응답 본문에 "참고용" 면책 키워드 포함 (시스템 프롬프트 회귀 가드)
 *   - messageMetadata에 sourceRefs 직렬화 포함 (AI SDK v6 stream 형식)
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { loadDotEnvLocalOverrides } from '../../scripts/lib/env-loader.ts'
import { POST } from '../../src/app/api/chat/route.ts'
import type { UIMessage } from 'ai'

// .env.local을 명시 RUN 전에 미리 로드
loadDotEnvLocalOverrides()

const skipReason =
  process.env.RUN_SMOKE !== '1'
    ? 'RUN_SMOKE=1 미설정 — smoke은 명시 실행 필요 (예: RUN_SMOKE=1 npm test -- --test-only tests/rag/m3-smoke.test.ts)'
    : (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY || !process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      ? 'env 미설정 (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY + GOOGLE_GENERATIVE_AI_API_KEY 필수)'
      : false

function makeRequest(messages: UIMessage[]): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
}

function makeUserMessage(text: string): UIMessage {
  return {
    id: `u-${Date.now()}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

describe('rag/m3-smoke — POST /api/chat Route Handler (실 Gemini)', { skip: skipReason }, () => {
  test('POST 200 + SSE 스트림 수신', async () => {
    const start = Date.now()
    const req = makeRequest([makeUserMessage('장애인교원에게 보조인력 지원이 있나요?')])

    const res = await POST(req)

    assert.strictEqual(res.status, 200, `200 응답 기대, 실제: ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    assert.ok(
      contentType.includes('text/event-stream') || contentType.includes('application/octet-stream'),
      `스트림 content-type 기대, 실제: ${contentType}`,
    )

    // SSE 스트림 본문 수신
    const reader = res.body?.getReader()
    assert.ok(reader, 'response body reader 없음')

    let received = ''
    let chunks = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        received += new TextDecoder().decode(value)
        chunks++

        // safety limit
        if (chunks > 500) {
          console.log('[m3-smoke] safety limit 500 chunks 도달, 스트림 중단')
          break
        }
      }
    } finally {
      reader.cancel().catch(() => {
        // ignore cancel errors
      })
    }

    const elapsed = Date.now() - start

    console.log(`[m3-smoke] elapsed: ${elapsed}ms, chunks: ${chunks}, body size: ${received.length}`)
    console.log('[m3-smoke] body preview:', received.slice(0, 500))

    assert.ok(received.length > 0, '응답 본문이 비어 있음')
    assert.ok(chunks >= 1, '청크 1개 이상 받아야 함')
  })

  test('응답 본문에 "참고용" 면책 안내 키워드', async () => {
    const req = makeRequest([makeUserMessage('편의지원 조례를 제정한 시도교육청은 어디인가요?')])

    const res = await POST(req)

    assert.strictEqual(res.status, 200, `기대: 200, 실제: ${res.status}`)

    const text = await res.text()

    // 면책 안내 키워드 검증 (시스템 프롬프트 §답변 원칙 #5 회귀 가드)
    assert.match(
      text,
      /참고용|참고|유의|면책/,
      '응답 본문에 "참고용" 등 면책 키워드 누락 — 시스템 프롬프트 회귀 의심',
    )

    console.log('[m3-smoke] 면책 키워드 검증 PASS')
  })

  test('messageMetadata에 sourceRefs 포함', async () => {
    const req = makeRequest([makeUserMessage('특수 마우스에는 어떤 종류가 있나요?')])

    const res = await POST(req)

    assert.strictEqual(res.status, 200, `기대: 200, 실제: ${res.status}`)

    const text = await res.text()

    // UI message stream의 metadata에 sourceRefs가 직렬화되어 있어야 함.
    // AI SDK v6 streamText().toUIMessageStreamResponse()의 출력 형식:
    // - 개별 토큰은 'text' 필드 + optional 'toolUseId' 등
    // - finish 이벤트에 messageMetadata 포함 (sourceRefs가 여기 들어감)
    // 간단히 "sourceRefs" 문자열이 응답에 포함되는지 확인
    assert.match(
      text,
      /sourceRefs/,
      'metadata에 sourceRefs 없음 — UI message stream metadata 누락 의심',
    )

    // slug 패턴도 대략 확인 (예: "hr-guide-2023" 같은 형태)
    // sourceRefs가 빈 배열일 수도 있으므로 엄격한 검증은 하지 않음
    console.log('[m3-smoke] sourceRefs 메타데이터 검증 PASS')
  })

  test('다중 턴 히스토리 처리', async () => {
    const messages: UIMessage[] = [
      {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: '장애인교원을 위한 편의지원에는 어떤 종류가 있나요?' }],
      },
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'text', text: '장애인교원을 위한 편의지원에는 보조인력, 특수 장비 등이 있습니다.' }],
      },
      {
        id: 'u2',
        role: 'user',
        parts: [{ type: 'text', text: '그 중 보조인력 지원의 신청 절차는 어떻게 되나요?' }],
      },
    ]

    const req = makeRequest(messages)
    const res = await POST(req)

    assert.strictEqual(res.status, 200, `기대: 200, 실제: ${res.status}`)

    const text = await res.text()

    assert.ok(text.length > 0, '다중 턴 응답이 비어 있음')
    console.log('[m3-smoke] 다중 턴 히스토리 처리 PASS')
  })
})
