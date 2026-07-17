# 002 — JS 스무스 스크롤에 reduced-motion 게이트 (채팅·TOC)

- **Status**: TODO
- **Commit**: 76d6f21
- **Severity**: HIGH
- **Category**: 6 접근성
- **Estimated scope**: 4 files (신규 1 + 수정 3) + 단위 테스트 1

## Problem

`src/app/globals.css:115-132`의 reduced-motion 전면 차단(0.001ms)은 CSS `animation/transition`만 잡는다. JS로 구동되는 스무스 스크롤은 이 게이트를 우회하므로 OS "동작 줄이기" 사용자와 앱 내 "동작 줄이기" 토글(`src/lib/accessibility.ts:68-71`이 `<html>`에 `reduce-motion` 클래스를 부여) 사용자에게 모션이 그대로 노출된다. 4곳:

```tsx
// src/components/ai-elements/conversation.tsx:13-21 — 현재
export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);
```
`resize="smooth"`는 스트리밍으로 응답이 자랄 때마다 발동하는 상시 JS 스크롤 — 영향 최대.

```tsx
// src/components/chat/ChatUI.tsx:180 — 현재 (새 메시지 자동 스크롤)
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
// src/components/chat/ChatUI.tsx:401 — 현재 ("새 응답" 점프 버튼)
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
```

```tsx
// src/components/mdx/TableOfContents.tsx:70 — 현재 (목차 앵커 클릭)
target.scrollIntoView({ behavior: "smooth" })
```

## Target

공용 헬퍼 1개를 신설하고 4곳 모두 그 값으로 분기한다. OS 미디어 쿼리와 앱 내 `reduce-motion` 클래스를 **둘 다** 존중한다.

```ts
// 신규 파일: src/lib/motion.ts
/** OS "동작 줄이기" 또는 앱 내 접근성 설정(reduce-motion 클래스) 중 하나라도 켜져 있으면 true. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("reduce-motion")
  )
}

/** JS 스크롤용 behavior — reduced-motion이면 즉시 점프. */
export function motionScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "instant" : "smooth"
}
```

```tsx
// conversation.tsx — 목표 (Conversation만 변경)
import { motionScrollBehavior } from "@/lib/motion";

export const Conversation = ({ className, ...props }: ConversationProps) => {
  // 클라이언트 컴포넌트 + 호출 시점 평가. ChatUI가 스트리밍 중 상시 재렌더하므로
  // 설정 변경도 자연 반영된다. prop 값이라 hydration mismatch 없음.
  const behavior = motionScrollBehavior();
  return (
    <StickToBottom
      className={cn("relative flex-1 overflow-y-hidden", className)}
      initial={behavior}
      resize={behavior}
      role="log"
      {...props}
    />
  );
};
```
`use-stick-to-bottom@1.1`의 `initial`/`resize`는 `Animation | boolean = ScrollBehavior | SpringAnimation`을 받으므로 `"instant"`가 유효하다(`node_modules/use-stick-to-bottom/dist/useStickToBottom.d.ts:57-58`).

```tsx
// ChatUI.tsx 180·401 — 목표 (두 곳 동일)
messagesEndRef.current?.scrollIntoView({ behavior: motionScrollBehavior() })
```

```tsx
// TableOfContents.tsx:70 — 목표
target.scrollIntoView({ behavior: motionScrollBehavior() })
```

## Repo conventions to follow

- 헬퍼는 `src/lib/`에 소문자 파일명(기존 `src/lib/sound.ts`, `src/lib/navigation.ts` 형태), import는 `@/lib/motion`.
- 주석은 한국어.
- 단위 테스트는 `tests/lib/` 하위 node:test 스타일(기존 `tests/lib/**/*.test.ts` glob이 npm test에 이미 포함됨).

## Steps

1. `src/lib/motion.ts` 신설 — 위 Target 코드 그대로.
2. `src/components/ai-elements/conversation.tsx`의 `Conversation`을 위 Target대로 수정(다른 export는 불변).
3. `src/components/chat/ChatUI.tsx` 180행·401행의 `{ behavior: 'smooth' }`를 `{ behavior: motionScrollBehavior() }`로 교체하고 상단 import에 `import { motionScrollBehavior } from '@/lib/motion'` 추가.
4. `src/components/mdx/TableOfContents.tsx` 70행 동일 교체 + import 추가.
5. `tests/lib/motion.test.ts` 신설: ① `window` 부재(SSR)에서 `prefersReducedMotion() === false` ② matchMedia matches=true mock 시 `motionScrollBehavior() === "instant"` ③ `document.documentElement.classList`에 `reduce-motion` 있을 때 `"instant"` ④ 둘 다 아니면 `"smooth"`. (기존 tests/lib의 mock 스타일을 따라 globalThis 주입.)

## Boundaries

- `globals.css`의 reduced-motion 블록은 건드리지 않는다(확정 결정).
- `useChatCompletionFocus`, live region, 포커스 로직 변경 금지.
- `ConversationScrollButton`(conversation.tsx 내 `scrollToBottom()`)은 StickToBottom 기본 동작이 initial/resize 설정을 따르므로 별도 수정하지 않는다.
- 새 의존성 금지.
- 커밋 스탬프 이후 코드 드리프트 시 STOP 후 보고.

## Verification

- **Mechanical**: `npm run lint` + `npm test`(신규 motion.test.ts 포함) + `npm run test:components` 통과.
- **Feel check**: `npm run dev` → 채팅에서 질문 전송. ① 기본 상태: 스트리밍 중 부드러운 추적 스크롤 유지. ② DevTools Rendering 패널에서 `prefers-reduced-motion: reduce` 에뮬레이션 후 재전송: 스크롤이 즉시 점프(부드러운 tween 없음). ③ 접근성 도구모음(Alt+0)의 "동작 줄이기" 토글 ON으로도 동일하게 즉시 점프. ④ 위키 문서에서 TOC 링크 클릭 — reduced-motion 시 즉시 점프 + 헤딩 포커스는 기존대로 이동.
- **Done when**: 4곳 모두 게이트 적용 + 신규 테스트 그린 + reduced-motion 에뮬레이션에서 스무스 스크롤 0건.
