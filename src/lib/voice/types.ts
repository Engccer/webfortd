/**
 * Phase 7 — 음성 채팅 클라이언트·서버 공유 타입 (값 없음, 타입만).
 */
import type { SourceRef } from '@/lib/rag/types'

/** /api/voice/session 응답 */
export interface VoiceSessionResponse {
  token: string
  model: string
  voiceConfig: { voice: string; locale: string }
}

/** /api/voice/execute search_policy 응답 — Live 모델이 functionResponse로 읽는 shape. */
export interface SearchPolicyResult {
  results: Array<{ text: string; slug: string; title: string }>
  sources: SourceRef[]
}

export type { SourceRef }
