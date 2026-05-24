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
import { getServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs' // service_role + retrieval RPC (Edge 비호환)
export const maxDuration = 60 // streamText 60초 timeout

const HISTORY_MAX_TURNS = 5 // D5
const RETRIEVAL_TOP_K = 5 // RAG design §7.2
const TITLE_MAX_CHARS = 30 // M5 D1 — thread title은 첫 user 메시지 첫 30자 truncate

interface ChatRequestBody {
  messages?: unknown
  /** M5 — 클라이언트가 기존 thread 이어가기. 신규 thread는 undefined. */
  threadId?: string
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
    // D4 (plan §1): retrieveChunks default includeDrafts=true 그대로 사용.
    // 근거: M2 baseline 535 docs 중 published 8건 / draft 527건.
    // published-only로 제한하면 채팅 정보 자산 활용 불가.
    // draft는 자동 sync된 atomic 페이지의 *기본 상태*(승인 대기)이지 "오류 의심" 아님.
    // 0009 화이트리스트 + retrieval.ts:99 runtime guard로 archived/deprecated 누설 차단.
    // M5 검수 자동화로 published 비중 증가 시 default 재검토 (Phase 3 M5 carry-over).
    retrieval = await retrieveChunks(queryText, { topK: RETRIEVAL_TOP_K })
  } catch (err) {
    // retrieval.ts:92가 이미 formatSupabaseError로 마스킹된 Error 객체를 throw
    // (`match_chunks RPC 실패: [code] 한국어 description` 형태).
    // 여기서는 그대로 .message 사용 — PII 노출 없음 + catch unknown 타입 강제 캐스트 회피.
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[chat] retrieval failed:', errorMessage)
    return json500('자료 검색 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
  }

  // 6. 시스템 프롬프트 조립
  const systemPrompt = buildSystemPrompt(retrieval.chunks)

  // 7. AI SDK v6 model messages 변환
  // AI SDK v6 권장: system은 별도 파라미터로 분리 (UIMessage system role prepend는 비표준).
  const modelMessages = await convertToModelMessages(clamped)

  // M5: 서버측 user 검증 (cookies 기반 SSR auth, 클라이언트 hint 신뢰 X).
  // 비로그인 사용자는 user=null → onFinish DB 저장 분기 skip.
  const supabaseSSR = await getServerClient()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()

  // newThreadId 클로저 변수 — route handler stateless. onFinish set → messageMetadata read.
  let newThreadId: string | null = null

  // 8. streaming 응답
  const result = streamText({
    model: gateway('google/gemini-3.5-flash'),
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ usage, text }) => {
      // 비용·토큰 로그 (PIPA — user query 본문은 로그 X)
      console.log('[chat] finish', {
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
        chunksUsed: retrieval.chunks.length,
        sourcesCount: retrieval.sources.length,
        loggedIn: !!user,
      })

      // M5: 로그인 사용자만 DB 저장. 비로그인은 클라이언트 useState 휘발 모드.
      if (!user) return

      const admin = getAdminClient()
      const sourceRefsJson = JSON.stringify(retrieval.sources)
      const tokenUsageJson = JSON.stringify({
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
      })

      try {
        if (!body.threadId) {
          // M5 D2: 신규 thread (assistant 응답 성공 후 INSERT — partial state 회피)
          // M5 D3: 단일 RPC atomic (thread + 2 메시지)
          const title = queryText.slice(0, TITLE_MAX_CHARS)
          const { data, error } = await admin.rpc('create_thread_with_messages', {
            p_user_id: user.id,
            p_title: title,
            p_user_content: queryText,
            p_assistant_content: text,
            p_source_refs: sourceRefsJson,
            p_token_usage: tokenUsageJson,
          })
          if (error) throw error
          newThreadId = data as string
        } else {
          // M5 D4: 기존 thread append (DB가 user_id 소유권 검증)
          const { error } = await admin.rpc('append_messages', {
            p_thread_id: body.threadId,
            p_user_id: user.id,
            p_user_content: queryText,
            p_assistant_content: text,
            p_source_refs: sourceRefsJson,
            p_token_usage: tokenUsageJson,
          })
          if (error) throw error
        }
      } catch (err) {
        // PIPA: error.message는 retrieval.ts 패턴대로 마스킹된 형태로만 노출.
        // 사용자 응답은 이미 streaming 완료 — silent (M6 retry UI 검토).
        const masked = err instanceof Error ? err.message : String(err)
        console.error('[chat] history save failed:', masked)
      }
    },
  })

  // 9. UI message stream + source_refs + (신규) threadId를 message metadata로 전달
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return {
          sourceRefs: retrieval.sources,
          ...(newThreadId ? { threadId: newThreadId } : {}),
        }
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
