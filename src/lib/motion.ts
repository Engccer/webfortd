/**
 * JS 구동 모션(스무스 스크롤 등)의 reduced-motion 게이트.
 *
 * globals.css의 전면 차단(0.001ms)은 CSS animation/transition만 잡고
 * scrollIntoView({ behavior: 'smooth' }) 같은 JS 모션은 우회하므로,
 * JS 쪽은 호출 시점에 이 헬퍼로 분기해야 한다.
 */

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
