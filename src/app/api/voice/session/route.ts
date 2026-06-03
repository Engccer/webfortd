/**
 * Phase 7 M1 — Live 음성 세션 ephemeral 토큰 발급.
 * 흐름: Supabase 세션 검증(비로그인 401) → 음성 시스템 프롬프트 조립
 *       → search_policy 도구 선언 → authTokens.create() → { token, model, voiceConfig }
 * 설계: docs/superpowers/specs/2026-06-03-live-voice-chat-design.md §4.1
 * 불변식: raw Gemini 키 미노출(token.name만), 로그인 필수, AI Gateway 미경유(직접 키).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Modality, StartSensitivity, EndSensitivity } from '@google/genai'
import { getLiveAuthClient, LIVE_MODEL } from '@/lib/gemini-live'
import { getServerClient } from '@/lib/supabase/server'
import { buildVoiceSystemPrompt } from '@/lib/voice/voice-prompt'
import { SEARCH_POLICY_DECLARATION } from '@/lib/voice/search-policy'

export const runtime = 'nodejs'
export const maxDuration = 30

const VOICE_NAME = 'Puck'
const LANGUAGE_CODE = 'ko-KR'

const SessionRequestSchema = z.object({
  resumeHandle: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = SessionRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { resumeHandle } = parsed.data

  try {
    const systemInstruction = buildVoiceSystemPrompt()
    const ai = getLiveAuthClient()

    const token = await ai.authTokens.create({
      config: {
        httpOptions: { apiVersion: 'v1alpha' },
        uses: 0,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
            },
            systemInstruction: { parts: [{ text: systemInstruction }] },
            tools: [{ functionDeclarations: [SEARCH_POLICY_DECLARATION] }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 20,
                silenceDurationMs: 300,
              },
            },
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
            contextWindowCompression: {
              triggerTokens: '10000',
              slidingWindow: { targetTokens: '512' },
            },
          },
        },
      },
    })

    return NextResponse.json({
      token: token.name,
      model: LIVE_MODEL,
      voiceConfig: { voice: VOICE_NAME, locale: LANGUAGE_CODE },
    })
  } catch (error) {
    console.error('Voice session error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
