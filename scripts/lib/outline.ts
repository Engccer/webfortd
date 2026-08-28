/**
 * 2층 v4 제목 번호 파서 — decompose-source.ts(주소 생성)와 slug-migration.ts(제목 정규화)가 공유.
 * 규칙 정본: docs/DECOMPOSE_V2_DESIGN.md §3.1.
 */

export type OutlineKind =
  | 'roman' | 'dot' | 'paren-close' | 'paren' | 'circled' | 'kor-circled'
  | 'kor-dot' | 'kor-close' | 'alpha' | 'appendix-root' | 'appendix' | 'none'

export interface OutlineNumber {
  kind: OutlineKind
  /** 정규화된 번호(부록 루트·번호 없음은 undefined) */
  value?: number
  /** `[부록 1-2]` 처럼 두 번째 번호가 있으면 */
  sub?: number
}

const ROMAN_MAP: Record<string, number> = {
  'Ⅰ': 1, 'Ⅱ': 2, 'Ⅲ': 3, 'Ⅳ': 4, 'Ⅴ': 5, 'Ⅵ': 6, 'Ⅶ': 7, 'Ⅷ': 8, 'Ⅸ': 9, 'Ⅹ': 10, 'Ⅺ': 11, 'Ⅻ': 12,
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
}
const KOREAN_ORDER = '가나다라마바사아자차카타파하'

export function parseOutlineNumber(rawText: string): OutlineNumber {
  const text = rawText.replace(/^[◇□■◆●○▶▷·\s]+/, '').trim()
  let m: RegExpMatchArray | null
  if ((m = text.match(/^\[?부록\s*(\d+)\s*[-–]\s*(\d+)\]?/))) {
    return { kind: 'appendix', value: Number(m[1]), sub: Number(m[2]) }
  }
  if ((m = text.match(/^[<〈\[]?부록\s*(\d+)[>〉\]]?\s*[.:]?/))) {
    return { kind: 'appendix', value: Number(m[1]) }
  }
  if (/^부\s*록\s*$/.test(text)) return { kind: 'appendix-root' }
  if ((m = text.match(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]|X{0,1}(?:IX|IV|V?I{0,3}))\.\s*/)) && m[1]) {
    const v = ROMAN_MAP[m[1]]
    if (v) return { kind: 'roman', value: v }
  }
  if ((m = text.match(/^(\d{1,2})\.\s+/))) return { kind: 'dot', value: Number(m[1]) }
  if ((m = text.match(/^(\d{1,2})\)\s*/))) return { kind: 'paren-close', value: Number(m[1]) }
  if ((m = text.match(/^\((\d{1,2})\)\s*/))) return { kind: 'paren', value: Number(m[1]) }
  if ((m = text.match(/^([①-⑳])/))) return { kind: 'circled', value: m[1].charCodeAt(0) - '①'.charCodeAt(0) + 1 }
  if ((m = text.match(/^([㉠-㉭])/))) return { kind: 'kor-circled', value: m[1].charCodeAt(0) - '㉠'.charCodeAt(0) + 1 }
  if ((m = text.match(/^([가나다라마바사아자차카타파하])\.\s*/))) return { kind: 'kor-dot', value: KOREAN_ORDER.indexOf(m[1]) + 1 }
  if ((m = text.match(/^([가나다라마바사아자차카타파하])\)\s*/))) return { kind: 'kor-close', value: KOREAN_ORDER.indexOf(m[1]) + 1 }
  if ((m = text.match(/^([A-Za-z])[.)]\s+/))) return { kind: 'alpha', value: m[1].toUpperCase().charCodeAt(0) - 64 }
  return { kind: 'none' }
}

/** 제목 텍스트에서 번호 표지를 떼어낸 이름(중복 해소 접두·관련 페이지 표시용) */
export function stripOutlineNumber(text: string): string {
  const t = text.replace(/^[◇□■◆●○▶▷·\s]+/, '').trim()
  return t
    .replace(/^\[?부록\s*\d+\s*[-–]\s*\d+\]?\s*/, '')
    .replace(/^[<〈\[]?부록\s*\d+[>〉\]]?\s*[.:]?\s*/, '')
    .replace(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]|X{0,1}(?:IX|IV|V?I{0,3}))\.\s*/, '')
    .replace(/^\d{1,2}[.)]\s*/, '')
    .replace(/^\(\d{1,2}\)\s*/, '')
    .replace(/^[①-⑳㉠-㉭]\s*/, '')
    .replace(/^[가나다라마바사아자차카타파하][.)]\s+/, '')
    .replace(/^[A-Za-z][.)]\s+/, '')
    .trim() || t
}

