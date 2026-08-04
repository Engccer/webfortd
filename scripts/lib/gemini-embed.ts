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

// ─── 상수 / env override ───────────────────────────────────────────────────
const DEFAULT_MODEL = 'gemini-embedding-2-preview'
const DEFAULT_DIM = 1536

export function getEmbedModel(): string {
  return process.env.EMBED_MODEL ?? DEFAULT_MODEL
}

export function getEmbedDim(): number {
  const raw = process.env.EMBED_DIM
  if (raw === undefined) return DEFAULT_DIM
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 8192) {
    throw new Error(`Invalid EMBED_DIM env: "${raw}" — must be integer 1..8192`)
  }
  return n
}

export const BATCH_SIZE = 100

// RPM 한도 방어(2026-08-04): 배치 간 최소 간격 + 쿼터 초과 시 한도 창 리셋 대기 재시도
const INTER_BATCH_DELAY_MS = 2500
const QUOTA_RETRY_MAX = 2
const QUOTA_RETRY_WAIT_MS = 65_000

// backward compat re-exports — load-time evaluated, stale if env changes after import.
// 주의: OUTPUT_DIMENSIONALITY는 모듈 로드 시점에 getEmbedDim()을 호출하므로,
// 잘못된 EMBED_DIM 값이 설정되어 있으면 이 파일을 import하는 모든 모듈이 로드 실패함.
export const MODEL_NAME = getEmbedModel()
export const OUTPUT_DIMENSIONALITY = getEmbedDim()

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

  const modelName = getEmbedModel()
  const dim = getEmbedDim()
  const model = google.embedding(modelName)
  const results: EmbeddingResult[] = []

  // 100건 단위 배치로 순차 처리
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE)
    const values = batch.map((inp) => inp.text)

    // Change 1: Wrap embedMany call in try/catch with batch context
    // 배치 간 지연: CI 러너처럼 빠른 네트워크에서 분당 요청 한도(RPM)를 넘지 않게
    // 완만하게 보낸다(2026-08-04 GitHub Actions 실측: 21배치/25초에 quota exceeded).
    if (i > 0) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
    }

    let embeddings: number[][] | null = null
    let lastErr: unknown = null
    for (let attempt = 0; attempt <= QUOTA_RETRY_MAX; attempt++) {
      try {
        const response = await embedMany({
          model,
          values,
          providerOptions: {
            google: {
              outputDimensionality: dim,
            },
          },
        })
        embeddings = response.embeddings
        break
      } catch (err) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        // 쿼터(RPM) 초과는 일시 상태다: 한도 창이 리셋되도록 대기 후 같은 배치를 재시도
        if (/quota exceeded|resource_exhausted|429/i.test(msg) && attempt < QUOTA_RETRY_MAX) {
          console.warn(
            `[gemini-embed] 쿼터 초과 감지 (batch start=${i}, 시도 ${attempt + 1}/${QUOTA_RETRY_MAX}) — ${QUOTA_RETRY_WAIT_MS / 1000}초 대기 후 재시도`,
          )
          await new Promise((r) => setTimeout(r, QUOTA_RETRY_WAIT_MS))
          continue
        }
        break
      }
    }
    if (embeddings === null) {
      const firstRef = batch[0]?.refId ?? '(empty)'
      throw new Error(
        `embedMany 실패 (model=${modelName}, batch start=${i}, first refId=${firstRef}): ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
      )
    }

    // Change 2: Length-mismatch guard
    if (embeddings.length !== batch.length) {
      const firstRef = batch[0]?.refId ?? '(empty)'
      throw new Error(
        `embedMany 응답 길이 불일치 (batch start=${i}, first refId=${firstRef}): expected ${batch.length}, got ${embeddings.length}`,
      )
    }

    // Change 3: First-batch dimensionality guard
    if (i === 0 && embeddings[0]?.length !== dim) {
      throw new Error(
        `embedMany 임베딩 차원 불일치: expected ${dim}, got ${embeddings[0]?.length}. providerOptions.google.outputDimensionality가 무시됐을 가능성. (model=${modelName})`,
      )
    }

    for (let j = 0; j < batch.length; j++) {
      results.push({ refId: batch[j].refId, embedding: embeddings[j] })
    }
  }

  return results
}
