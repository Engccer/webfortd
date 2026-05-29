/**
 * Phase 3 M7.2 — 첨부 파일 검증.
 *
 * spec §D3: 파일당 ≤10MB, 동시 1개.
 *
 * MIME 화이트리스트 (Q1=C):
 *   - PDF: application/pdf
 *   - HWP: application/x-hwp 또는 application/vnd.hancom.hwp
 *   - HWPX: application/vnd.hancom.hwpx (구버전은 application/zip 흡수)
 *   - 이미지: image/png · image/jpeg · image/webp
 *
 * HEIC는 첫 버전 X (Safari iOS 자동 변환 의존).
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (spec §D3)

export const ALLOWED_MIMES: readonly string[] = [
  'application/pdf',
  'application/x-hwp',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx',
  'image/png',
  'image/jpeg',
  'image/webp',
]

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

export function validateAttachment(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: '파일이 너무 커요. 10MB 이하만 가능해요.' }
  }
  // application/zip은 HWPX 구버전 흡수 — 위원장 실 사용 패턴 누적 후 strict 검토 carry
  const isAllowed = ALLOWED_MIMES.includes(file.type) || file.type === 'application/zip'
  if (!isAllowed) {
    return {
      ok: false,
      reason: `지원하지 않는 파일 형식이에요. PDF · HWP · HWPX · 이미지(PNG/JPEG/WEBP)만 첨부해 주세요. (현재: ${file.type || '알 수 없음'})`,
    }
  }
  return { ok: true }
}
