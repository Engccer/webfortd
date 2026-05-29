/**
 * Phase 3 M7.2 — Upstage Document Parse 클라이언트.
 *
 * HWP/HWPX 파일 → markdown 추출. 정책 문서 본문을 system prompt에 추가 컨텍스트로.
 *
 * spec §D1: Upstage Document Parse API 사용. 위원장 보유 키 UPSTAGE_API_KEY 재사용.
 * spec §M7.2: PDF/이미지는 Gemini multimodal로 직접, HWP/HWPX만 Upstage 위임.
 *
 * 응답 처리: content.markdown만 추출. 표·이미지 위치는 markdown으로 흡수.
 */

import 'server-only'

const UPSTAGE_ENDPOINT = 'https://api.upstage.ai/v1/document-digitization'
const REQUEST_TIMEOUT_MS = 30_000 // spec §6 리스크

interface UpstageResponse {
  content?: { markdown?: string }
  error?: string
}

export async function parseHwpToMarkdown(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.UPSTAGE_API_KEY
  if (!apiKey) {
    throw new Error('UPSTAGE_API_KEY 미설정 — 관리자에게 환경변수 추가 요청')
  }

  const formData = new FormData()
  formData.append('document', new Blob([buffer], { type: mimeType }), 'document')
  formData.append('output_formats', JSON.stringify(['markdown']))
  formData.append('ocr', 'force') // 이미지 포함 HWP 대비

  let response: Response
  try {
    response = await fetch(UPSTAGE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const reason = err instanceof Error && err.name === 'TimeoutError'
      ? '파싱 시간이 초과되었어요. 더 작은 파일로 다시 시도해 주세요.'
      : '문서 파싱 서버에 연결할 수 없어요.'
    throw new Error(reason)
  }

  if (!response.ok) {
    console.error('[upstage-parse] 응답 오류:', response.status)
    throw new Error('정책 문서 파싱 중 오류가 발생했어요. 다른 형식(PDF)으로 다시 시도해 보세요.')
  }

  const data = (await response.json()) as UpstageResponse
  const markdown = data.content?.markdown?.trim()
  if (!markdown) {
    throw new Error('첨부 문서에서 추출된 텍스트가 없어요. 다른 파일을 시도해 보세요.')
  }
  return markdown
}
