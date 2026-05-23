/**
 * Phase 3 M3 — RAG 채팅 Route Handler.
 *
 * 흐름:
 *   validateUIMessages → clampHistory(5턴) → extractUserText
 *   → retrieveChunks(topK=5) → buildSystemPrompt
 *   → convertToModelMessages → streamText(gateway('google/gemini-3.5-flash'))
 *   → toUIMessageStreamResponse + source_refs in messageMetadata
 *
 * 설계 결정:
 *   - runtime='nodejs': service_role + retrieval RPC (Edge 비호환)
 *   - maxDuration=60: streamText 60초 timeout
 *   - PIPA: user query 본문 로그 X, 토큰 사용량만 onFinish 로그
 *   - AI Gateway 인증은 Task 8 활성화 후 smoke (Task 4)에서 검증
 *
 * 참고: docs/superpowers/specs/2026-05-23-phase-3-rag-design.md §7.2
 */
import {
  streamText,
  gateway,
  convertToModelMessages,
  validateUIMessages,
  type UIMessage,
} from 'ai'
import { retrieveChunks } from '@/lib/rag/retrieval.ts'
import { buildSystemPrompt, clampHistory } from '@/lib/rag/prompt-builder.ts'

export const runtime = 'nodejs' // service_role + retrieval RPC (Edge 비호환)
export const maxDuration = 60 // streamText 60초 timeout

const HISTORY_MAX_TURNS = 5 // D5
const RETRIEVAL_TOP_K = 5 // RAG design §7.2

interface ChatRequestBody {
  messages?: unknown
}

export async function POST(req: Request): Promise<Response> {
  // 1. 요청 본문 파싱
  let body: ChatRequestBody
  try {
    body = (await req.json()) as ChatRequestBody
  } catch {
    return json400('요청 본문이 유효한 JSON이 아니에요.')
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json400('messages 배열이 비어 있어요.')
  }

  // 2. UIMessage 검증
  let validated: UIMessage[]
  try {
    validated = await validateUIMessages({ messages: body.messages as UIMessage[] })
  } catch (err) {
    return json400(`messages 형식이 올바르지 않아요: ${(err as Error).message}`)
  }

  // 3. history clamp (D5)
  let clamped: UIMessage[]
  try {
    clamped = clampHistory(validated, HISTORY_MAX_TURNS)
  } catch (err) {
    return json400((err as Error).message)
  }

  // 4. 마지막 user 메시지의 텍스트 추출
  const lastUser = clamped[clamped.length - 1]
  const queryText = extractUserText(lastUser)
  if (!queryText.trim()) {
    return json400('질의 텍스트가 비어 있어요.')
  }

  // 5. RAG retrieval (M2)
  let retrieval
  try {
    retrieval = await retrieveChunks(queryText, { topK: RETRIEVAL_TOP_K })
  } catch (err) {
    console.error('[chat] retrieval failed:', (err as Error).message)
    return json500('자료 검색 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
  }

  // 6. 시스템 프롬프트 조립
  const systemPrompt = buildSystemPrompt(retrieval.chunks)

  // 7. AI SDK v6 model messages 변환
  const systemMessage: UIMessage = {
    id: 'sys',
    role: 'system',
    parts: [{ type: 'text', text: systemPrompt }],
  }
  const modelMessages = await convertToModelMessages([systemMessage, ...clamped])

  // 8. streaming 응답
  const result = streamText({
    model: gateway('google/gemini-3.5-flash'),
    messages: modelMessages,
    onFinish: ({ usage }) => {
      // 비용·토큰 로그 (PIPA — user query 본문은 로그 X)
      console.log('[chat] finish', {
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
        chunksUsed: retrieval.chunks.length,
        sourcesCount: retrieval.sources.length,
      })
    },
  })

  // 9. UI message stream + source_refs를 message metadata로 전달
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return { sourceRefs: retrieval.sources }
      }
      return undefined
    },
  })
}

/**
 * UIMessage.parts에서 text 파트만 추출·결합 (AI SDK v6 형식).
 * image 등 non-text 파트는 skip.
 */
export function extractUserText(message: UIMessage): string {
  const textParts = (message.parts ?? []).filter(
    (p): p is { type: 'text'; text: string } =>
      p.type === 'text' && typeof (p as { text?: unknown }).text === 'string',
  )
  return textParts
    .map((p) => p.text)
    .join('\n')
    .trim()
}

export function json400(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function json500(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
