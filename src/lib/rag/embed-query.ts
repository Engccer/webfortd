import 'server-only'
import { embedTexts } from '../../../scripts/lib/gemini-embed.ts'

/**
 * Phase 3 M2 — 사용자 질의 단일 임베딩 호출.
 *
 * scripts/lib/gemini-embed.ts 의 embedTexts() 를 length=1 wrapper로 재사용.
 * scripts/ 디렉터리 import는 의도된 cross-boundary: gemini-embed.ts 는
 * CLI(embed-content.ts)와 Route Handler 둘 다에서 호출되며 server-only 가드가
 * 호출 chain 어딘가에 박혀 있다 (이 파일이 그 가드).
 *
 * 모델·dim env override는 자동 반영 (getEmbedModel/getEmbedDim getter 통과).
 */
export async function embedQuery(queryText: string): Promise<number[]> {
  if (!queryText || queryText.trim().length === 0) {
    throw new Error('embedQuery: queryText is empty')
  }

  const results = await embedTexts([{ refId: 'query', text: queryText }])
  if (results.length !== 1) {
    throw new Error(
      `embedQuery: expected 1 result, got ${results.length}`,
    )
  }
  return results[0].embedding
}
