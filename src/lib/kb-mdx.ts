/**
 * KB 본문 MDX 변환의 단일 정본.
 * KbPageLayout(프로덕션 렌더)·편집기 프리뷰·반영 전 검증이 모두 이 모듈을 쓴다.
 * escape가 MDX 활성 구문(JSX·표현식·import)을 구조적으로 무력화하는 보안 계층이기도
 * 하므로, 세 소비자의 변환이 갈라지면 안 된다.
 */
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'

export function escapeKbContent(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/</g, '&lt;')
    // LaTeX `\frac{...}` 등을 MDX가 JSX expression으로 오해해 acorn 오류이므로 `{`도 escape.
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

// next-mdx-remote/serialize → @mdx-js/mdx → estree-walker는 순수 ESM(require 불가) 체인이라
// 동적 import로 로드한다. 정적 top-level import는 CJS로 로드되는 소비자(node:test)에서
// tsx가 require()로 트랜스파일해 ERR_PACKAGE_PATH_NOT_EXPORTED를 낸다.
// Next.js 번들러 경로(프로덕션 렌더)에서는 정적/동적 어느 쪽이든 동일하게 동작해 회귀가 없다.
export async function serializeKbContent(
  content: string,
): Promise<MDXRemoteSerializeResult> {
  const [{ serialize }, { default: remarkGfm }, { default: rehypeSlug }] =
    await Promise.all([
      import('next-mdx-remote/serialize'),
      import('remark-gfm'),
      import('rehype-slug'),
    ])
  return serialize(escapeKbContent(content), {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    },
  })
}
