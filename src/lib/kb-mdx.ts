/**
 * KB 본문 MDX 변환의 단일 정본.
 * KbPageLayout(프로덕션 렌더)·편집기 프리뷰·반영 전 검증이 모두 이 모듈을 쓴다.
 * escape가 MDX 활성 구문(JSX·표현식·import)을 구조적으로 무력화하는 보안 계층이기도
 * 하므로, 세 소비자의 변환이 갈라지면 안 된다.
 *
 * 2026-08 3층 재생성부터 두 가지가 더해졌다.
 *  - 위키링크 `[[slug]]`·`[[slug|표시명]]`을 마크다운 링크로 바꾼다. 슬러그 → href 해석은
 *    호출자가 주입한다(이 모듈은 인덱스·fs에 의존하지 않는다). 해석 실패(끊긴 링크)는
 *    표시명(없으면 슬러그)만 평문으로 남긴다.
 *  - 2층 정본이 남기는 허용 태그(`<br>`·`<mark>`·`<sub>`·`<sup>`, 속성 없음)만 escape 뒤에
 *    정규형으로 되살린다. 속성이 붙은 태그·그 밖의 태그·`{}` 표현식은 여전히 무력화된다.
 */
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'

export interface KbContentOptions {
  /** 위키링크 대상 슬러그 → href. null이면 끊긴 링크로 취급. */
  resolveWikilink?: (slug: string) => string | null
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g

export function escapeKbContent(content: string, options: KbContentOptions = {}): string {
  const { resolveWikilink } = options
  const linked = content.replace(WIKILINK_RE, (_m, slug: string, anchor: string | undefined, text: string | undefined) => {
    const target = slug.trim()
    const label = (text ?? target).trim()
    const href = resolveWikilink ? resolveWikilink(target) : null
    if (!href) return label
    return `[${label}](${href}${anchor ? `#${anchor.trim()}` : ''})`
  })
  return linked
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/</g, '&lt;')
    // LaTeX `\frac{...}` 등을 MDX가 JSX expression으로 오해해 acorn 오류이므로 `{`도 escape.
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    // 허용 태그 복원(속성 없는 정규형만). `&lt;br>`·`&lt;br/>`·`&lt;br />` → `<br />`
    // 소문자 정규형만 복원한다. 대문자 시작 태그(`<Mark>`)를 살리면 MDX가 컴포넌트 참조로
    // 컴파일해 prerender가 깨진다(리뷰 실측).
    .replace(/&lt;br\s*\/?>/g, '<br />')
    .replace(/&lt;(\/?)(mark|sub|sup)>/g, '<$1$2>')
}

// next-mdx-remote/serialize → @mdx-js/mdx → estree-walker는 순수 ESM(require 불가) 체인이라
// 동적 import로 로드한다. 정적 top-level import는 CJS로 로드되는 소비자(node:test)에서
// tsx가 require()로 트랜스파일해 ERR_PACKAGE_PATH_NOT_EXPORTED를 낸다.
// Next.js 번들러 경로(프로덕션 렌더)에서는 정적/동적 어느 쪽이든 동일하게 동작해 회귀가 없다.
export async function serializeKbContent(
  content: string,
  options: KbContentOptions = {},
): Promise<MDXRemoteSerializeResult> {
  const [{ serialize }, { default: remarkGfm }, { default: rehypeSlug }] =
    await Promise.all([
      import('next-mdx-remote/serialize'),
      import('remark-gfm'),
      import('rehype-slug'),
    ])
  return serialize(escapeKbContent(content, options), {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    },
  })
}
