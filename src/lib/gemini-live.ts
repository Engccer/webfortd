/**
 * Phase 7 — Gemini Live (실시간 음성) 서버 클라이언트 팩토리.
 *
 * Live API는 Vercel AI Gateway를 경유하지 않고 @google/genai 직결이다.
 * 임베딩(scripts/lib/gemini-embed.ts)과 동일한 GOOGLE_GENERATIVE_AI_API_KEY 직접 키 경로.
 * authTokens.create()로 발급한 ephemeral 토큰만 클라이언트에 내려가며,
 * raw 키는 절대 브라우저에 노출되지 않는다.
 */
import { GoogleGenAI } from '@google/genai'

/** native audio 양방향 Live 모델. dodo MODELS.live 정렬. */
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview'

/** ephemeral 토큰 발급용 서버 클라이언트. v1alpha (Live/authTokens 필수). */
export function getLiveAuthClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error('Missing required environment variable: GOOGLE_GENERATIVE_AI_API_KEY')
  }
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } })
}
