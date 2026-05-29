/**
 * Phase 3 M7.1 — Deepgram Nova-2 Speech-to-Text 프록시.
 *
 * 출처: dodo-planet src/app/api/speech-to-text/route.ts (i18n 제거 + language=ko 강제).
 *
 * 흐름: FormData {audio, locale?} → Deepgram Nova-2 → {text, language_code, confidence}.
 *
 * PIPA (spec §5):
 *   - transcript 본문은 로그 X. 길이·언어·confidence만.
 *   - 오디오는 서버 메모리에서 fetch 호출 후 즉시 폐기 (디스크 0).
 *
 * 모델: nova-2-conversationalai (단일 화자 + smart_format).
 * 언어: language=ko 강제 (정책 채팅은 한국어 단일).
 */
import 'server-only'

export const runtime = 'nodejs'
export const maxDuration = 30 // 오디오 업로드(최대 25MB) + Deepgram 응답 마진

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

interface DeepgramWord {
  word: string
  start: number
  end: number
  confidence: number
}
interface DeepgramAlternative {
  transcript: string
  confidence: number
  words: DeepgramWord[]
}
interface DeepgramChannel {
  alternatives: DeepgramAlternative[]
  detected_language?: string
}
interface DeepgramResponse {
  results?: { channels: DeepgramChannel[] }
}

export async function POST(req: Request): Promise<Response> {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return json400('요청 본문이 FormData가 아니에요.')
  }

  const audio = formData.get('audio')
  if (!audio || !(audio instanceof Blob)) {
    return json400('오디오 파일이 필요해요.')
  }

  if (audio.size > MAX_SIZE) {
    return json400('오디오 파일이 너무 큽니다. (최대 25MB)')
  }

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    console.error('[transcribe] DEEPGRAM_API_KEY 미설정')
    return json500('서버 설정 오류예요.')
  }

  const buffer = await audio.arrayBuffer()
  const params = new URLSearchParams({
    model: 'nova-2-conversationalai',
    smart_format: 'true',
    punctuate: 'true',
    diarize: 'false',
    language: 'ko', // 정책 채팅은 한국어 강제 (dodo-planet과 차이)
  })

  let response: Response
  try {
    response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': audio.type || 'audio/webm',
      },
      body: buffer,
    })
  } catch (err) {
    console.error('[transcribe] Deepgram fetch 실패:', err instanceof Error ? err.message : String(err))
    return json500('음성 인식 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')
  }

  if (!response.ok) {
    console.error('[transcribe] Deepgram 응답 오류:', response.status)
    return json500('음성 인식 중 오류가 발생했어요.')
  }

  const result = (await response.json()) as DeepgramResponse
  const channel = result.results?.channels?.[0]
  const alternative = channel?.alternatives?.[0]

  if (!alternative?.transcript) {
    return json400('음성을 인식할 수 없어요. 좀 더 또렷하게 다시 말씀해 주세요.')
  }

  // PIPA: transcript 본문 로그 X — 길이·언어·confidence만
  console.log('[transcribe] success', {
    textLength: alternative.transcript.length,
    language: channel?.detected_language ?? 'ko',
    confidence: alternative.confidence,
  })

  return new Response(
    JSON.stringify({
      text: alternative.transcript,
      language_code: channel?.detected_language ?? 'ko',
      confidence: alternative.confidence,
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}

function json400(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function json500(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
