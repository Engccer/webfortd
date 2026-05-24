/**
 * Phase 3 M6.1 — 마크다운 → 평문 변환.
 *
 * dodo-planet `src/lib/utils.ts:9-42` 그대로. CopyButton 듀얼 모드에서 사용.
 * 정규식 기반이라 nested table·복잡한 GFM은 손실 가능 — webfortd 채팅 응답은
 * 단순 markdown(헤딩/리스트/링크/bold) 위주라 충분.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '')
      return code.trim()
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // 이미지(!\[…])를 링크(\[…])보다 먼저 처리 — 그렇지 않으면 ![alt](url)의 [alt](url) 부분이 링크 정규식에 먼저 매치되어 "!alt"가 남음 (dodo-planet 동일 버그).
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
