/**
 * gemini-embed.ts
 * Vercel AI SDK (@ai-sdk/google v3 + ai v6) 래퍼
 *
 * 모델: gemini-embedding-2-preview (Matryoshka, 최대 3072dim)
 *   → outputDimensionality=1536 로 Supabase vector(1536) 컬럼에 맞춤
 *
 * 설계 결정:
 * - embedMany()는 batch당 순차 호출(Promise.all 미사용):
 *   병렬화 시 per-minute rate limit(RPM) 초과 위험.
 *   시범 단계(535 docs / 1청크당 1초 미만)에서는 순차가 충분히 빠름.
 * - assertEmbedEnv()는 embedTexts() 진입 시 항상 호출(defense in depth).
 * - `import 'server-only'` 가드 없음: 이 모듈은 CLI 스크립트용.
 */

import { google } from '@ai-sdk/google'
import { embedMany } from 'ai'

// ─── 상수 ───────────────────────────────────────────────────────────────────
export const MODEL_NAME = 'gemini-embedding-2-preview'
export const OUTPUT_DIMENSIONALITY = 1536
export const BATCH_SIZE = 100

// ─── 타입 ───────────────────────────────────────────────────────────────────
export interface EmbeddingInput {
  /** 임베딩 대상 텍스트 */
  text: string
  /** 호출자가 제공하는 추적 식별자. 예: `${slug}::${chunk_index}` */
  refId: string
}

export interface EmbeddingResult {
  refId: string
  embedding: number[]
}

// ─── env 가드 ────────────────────────────────────────────────────────────────
/**
 * GOOGLE_GENERATIVE_AI_API_KEY 환경변수가 없으면 즉시 throw.
 * @ai-sdk/google는 이 키를 자동으로 읽지만, 누락 시 런타임 에러 대신
 * 명확한 메시지로 조기 실패하도록 명시적으로 검증한다.
 */
export function assertEmbedEnv(): void {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      'Missing required environment variable: GOOGLE_GENERATIVE_AI_API_KEY'
    )
  }
}

// ─── 임베딩 래퍼 ─────────────────────────────────────────────────────────────
/**
 * 텍스트 배열을 BATCH_SIZE(100) 단위로 나눠 임베딩하고 EmbeddingResult[]를 반환.
 *
 * - 0건 입력 → API 호출 없이 즉시 빈 배열 반환.
 * - refId 순서는 입력 순서와 동일하게 보존.
 * - outputDimensionality=1536 은 providerOptions.google 로 전달
 *   (모델 팩토리 옵션이 아닌 호출 시점 옵션, @ai-sdk/google v3 API).
 */
export async function embedTexts(
  inputs: EmbeddingInput[]
): Promise<EmbeddingResult[]> {
  // 0건 fast path — SDK 호출 전에 env 가드는 건너뜀
  if (inputs.length === 0) return []

  assertEmbedEnv()

  const model = google.embedding(MODEL_NAME)
  const results: EmbeddingResult[] = []

  // 100건 단위 배치로 순차 처리
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE)
    const values = batch.map((inp) => inp.text)

    const { embeddings } = await embedMany({
      model,
      values,
      providerOptions: {
        google: {
          outputDimensionality: OUTPUT_DIMENSIONALITY,
        },
      },
    })

    for (let j = 0; j < batch.length; j++) {
      results.push({ refId: batch[j].refId, embedding: embeddings[j] })
    }
  }

  return results
}
