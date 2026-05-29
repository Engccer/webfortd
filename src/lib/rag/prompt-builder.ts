import 'server-only'

import type { RetrievedChunk } from './types.ts'
import type { UIMessage } from 'ai'

/**
 * 시스템 프롬프트 템플릿. {retrievedChunksFormatted} placeholder가 buildSystemPrompt에서 치환됨.
 *
 * 정체성·톤·균형은 위원장 영구 원칙. 변경 시 명시 결정 필요.
 * 기준: docs/superpowers/specs/2026-05-23-phase-3-rag-design.md §10.3 #1
 *       webfortd/CLAUDE.md §앱 정체성과 채팅의 역할
 *       docs/DIRECTION_2026.md §4
 */
export const SYSTEM_PROMPT_TEMPLATE = `당신은 대한민국 장애인교원 관련 제도와 정책을 안내하는 AI예요.
"장애인교원 교육전념 여건 지원" 사업의 일환으로 운영되고 있어요.

[역할]
장애인교원, 예비교사, 장애학생 부모, 정책 입안자 등 다양한 분들에게
관련 제도와 정책을 이해하기 쉽게 안내해요.

[톤]
다정하고 명료한 말투를 사용해요. 격식체나 관공서 어투는 피하고,
평이한 표현을 우선해요. "~예요/이에요", "~해요" 같은 친근한 종결어미를
자연스럽게 사용하지만, 정책의 정확성은 절대 양보하지 않아요.

[답변 원칙]
1. 쉬운 글을 기본으로 하되, 정책의 핵심 정보와 세부 정보가 누락되지 않고
   정확하게 전달되도록 균형을 맞춰요.
2. 평이한 설명을 먼저 제시하고, 출처 인용으로 정확성을 보강해요.
3. 제공된 [참고 자료] 안의 내용을 근거로 답변해요.
   참고 자료에 없는 내용은 추측하지 말고
   "이 부분은 제공된 자료로 확인할 수 없어요. 소속 교육청에 문의해 보세요"
   와 같이 안내해요.
4. 장애인교원 관련 제도·정책과 무관한 질문은 정중히 안내해요.
   예: "이 채팅은 장애인교원 관련 제도와 정책을 안내해요.
        ○○과 관련된 정책이나 지원 제도라면 안내해 드릴 수 있어요."
5. 답변 말미에 반드시 다음 면책 안내를 포함해요:
   "본 답변은 참고용이에요. 실제 적용 절차는 소속 교육청·관할 기관에
    확인해 주세요."

[참고 자료]
{retrievedChunksFormatted}`

/**
 * RetrievedChunk[]를 시스템 프롬프트에 주입할 텍스트로 직렬화.
 * 빈 배열이면 "(관련 자료를 찾지 못했어요. 답변 시 이 점을 안내해 주세요.)" 형식 fallback.
 */
export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(관련 자료를 찾지 못했어요. 답변 시 이 점을 안내해 주세요.)'
  }

  return chunks
    .map(
      (chunk, index) =>
        `${index + 1}. [출처: ${chunk.documentSlug} / 제목: ${chunk.documentTitle} / 분류: ${chunk.documentAxis}]\n${chunk.chunkText}`,
    )
    .join('\n\n')
}

/**
 * SYSTEM_PROMPT_TEMPLATE의 {retrievedChunksFormatted}를
 * formatRetrievedChunks(chunks) 결과로 치환한 최종 시스템 프롬프트 반환.
 *
 * M7.2: attachmentMarkdown 옵션이 있으면 "## 사용자 첨부 문서" 섹션을 추가.
 * HWP/HWPX를 Upstage로 markdown 추출한 결과를 추가 컨텍스트로 주입.
 */
export function buildSystemPrompt(chunks: RetrievedChunk[], attachmentMarkdown?: string): string {
  const formatted = formatRetrievedChunks(chunks)
  const base = SYSTEM_PROMPT_TEMPLATE.replace('{retrievedChunksFormatted}', formatted)
  if (!attachmentMarkdown) return base
  return `${base}\n\n[사용자 첨부 문서]\n${attachmentMarkdown}\n\n위 첨부 문서를 응답의 추가 컨텍스트로 활용하세요. 참고 자료보다 사용자 첨부가 더 구체적이면 첨부 내용을 우선해 답변해요.`
}

/**
 * 최근 maxTurns 턴(user+assistant 쌍)을 슬라이스. 마지막 user 메시지는 반드시 포함.
 * messages 배열은 [user, assistant, user, assistant, ..., user] 순서가 정상.
 * maxTurns=5 → 최대 11 messages (5쌍 10개 + 마지막 user).
 *
 * @param messages UIMessage[] — 클라이언트가 보낸 대화 히스토리 (시스템 메시지 포함 금지, 별도 prepend)
 * @param maxTurns 기본 5. D5 결정.
 * @throws 마지막이 user가 아니거나 user 메시지가 없으면 throw
 */
export function clampHistory(messages: UIMessage[], maxTurns: number = 5): UIMessage[] {
  // 마지막 메시지가 user여야 함 (정상 흐름)
  if (messages.length === 0) {
    throw new Error('clampHistory: no user message found')
  }

  if (messages[messages.length - 1].role !== 'user') {
    throw new Error(`clampHistory: last message must be user role, got '${messages[messages.length - 1].role}'`)
  }

  // 최대 (maxTurns * 2 + 1) 개의 메시지를 유지 (maxTurns 쌍 + 마지막 user)
  const maxMessages = maxTurns * 2 + 1
  const startIndex = Math.max(0, messages.length - maxMessages)

  return messages.slice(startIndex)
}
