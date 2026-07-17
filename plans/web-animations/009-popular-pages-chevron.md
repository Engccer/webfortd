# 009 — 위키 홈 인기 페이지 카드의 체브론 hover 이동 제거

- **Status**: TODO
- **Commit**: 76d6f21
- **Severity**: LOW
- **Category**: 1 목적·빈도 (+6 접근성: 터치 false hover)
- **Estimated scope**: 1 file, 클래스 문자열 1곳

## Problem

위키 홈(루트 `/`)의 인기 페이지 카드는 수십 회/일 노출되는 고빈도 표면인데, hover마다 화살표가 오른쪽으로 2px 이동하는 장식성 모션이 걸려 있다. 감사 기준 "Tens of times/day → Remove or drastically reduce" + 이 모션은 `@media (hover: hover)` 게이트가 없어 터치 탭에서도 오발동한다. 공공 정책 서비스의 crisp 성격상 색상 피드백만으로 충분하다.

```tsx
// src/components/wiki/PopularPages.tsx:32-35 — 현재
<ArrowRight
  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
  aria-hidden="true"
/>
```

## Target

이동 모션 삭제, 색 전환만 유지(전환 속성도 색으로 좁힘):

```tsx
// 목표
<ArrowRight
  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
  aria-hidden="true"
/>
```

## Repo conventions to follow

- 같은 카드의 `Card` 컴포넌트 hover(`transition-colors hover:border-primary hover:bg-primary/5`, PopularPages.tsx:25)가 이미 색-전용 관례 — 그에 정렬.

## Steps

1. `src/components/wiki/PopularPages.tsx` 33행 클래스에서 `transition-transform group-hover:translate-x-0.5` 제거, `transition-colors` 삽입.

## Boundaries

- 카드 구조·링크·Badge·CardTitle 불변. `aria-hidden` 유지.

## Verification

- **Mechanical**: `npm run lint` + `npm run test:components` 통과.
- **Feel check**: 루트 페이지 카드 hover — 화살표가 밀리지 않고 색만 primary로 전환. 터치 에뮬레이션 탭 시 튀는 요소 없음.
- **Done when**: 이동 모션 0 + 색 전환 유지 + 테스트 그린.
