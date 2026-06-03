/**
 * Phase 7 — Live 세션이 RAG를 호출하는 단일 함수 선언.
 * dodo의 travel 함수 14종을 정책 검색 1종으로 대체.
 */
import { Type, type FunctionDeclaration } from '@google/genai'

export const SEARCH_POLICY_TOOL_NAME = 'search_policy'

/** voice/execute가 search_policy 결과 청크 텍스트를 자를 상한 (TTS 스트림 안정). */
export const MAX_CHUNK_CHARS = 500
/** search_policy 검색 topK. */
export const SEARCH_POLICY_TOP_K = 5

export const SEARCH_POLICY_DECLARATION: FunctionDeclaration = {
  name: SEARCH_POLICY_TOOL_NAME,
  description:
    '대한민국 장애인교원 관련 제도·정책·지원·법령 자료를 검색해 관련 내용을 가져온다. ' +
    '사용자가 제도/정책/지원/법령에 대해 물으면 답하기 전에 반드시 호출한다.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: '검색할 정책 질의 — 사용자 발화에서 추출한 핵심 키워드/질문.',
      },
    },
    required: ['query'],
  },
}
