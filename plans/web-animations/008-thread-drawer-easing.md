# 008 — ThreadDrawer 시트 이징·비대칭 지속 교정

- **Status**: DONE
- **Commit**: 76d6f21
- **Severity**: LOW
- **Category**: 2 이징·지속
- **Estimated scope**: 1 file, 클래스 문자열 1곳

## Problem

채팅 이력 드로어(`ThreadDrawer` → `src/components/ui/sheet.tsx`)가 shadcn 기본값을 그대로 써서 ① 진입·퇴장에 `ease-in-out`(감사 기준: 진입·퇴장은 ease-out — in-out은 시작이 느려 반응성이 죽는다) ② 열림 500ms > 닫힘 300ms(사용자 요청에 대한 시스템 응답인 열림이 더 느린 역비대칭).

```tsx
// src/components/ui/sheet.tsx:59-62 — 현재
className={cn(
  "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  ...
```

## Target

```tsx
// 목표 — ease-in-out → ease-out, 열림 300ms/닫힘 200ms
"bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-out data-[state=open]:duration-300 data-[state=closed]:duration-200",
```

열림 300ms(드로어 예산 200–500ms 내, 강한 ease-out이면 충분히 우아함), 닫힘 200ms(치우는 동작은 더 빠르게). `duration-*`가 `--tw-duration`을, `ease-out`이 `--tw-ease`를 세팅해 tw-animate keyframe에 그대로 전달된다.

## Repo conventions to follow

- 플랜 006이 `--ease-out`을 `cubic-bezier(0.23, 1, 0.32, 1)`로 강화한 상태를 전제(없어도 동작은 함).
- 클래스 문자열 내 다른 부분(방향별 slide 분기 63-69행) 불변.

## Steps

1. `src/components/ui/sheet.tsx` 61행에서 `ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500` → `ease-out data-[state=open]:duration-300 data-[state=closed]:duration-200`.

## Boundaries

- SheetOverlay(39행) fade는 불변.
- ThreadDrawer 쪽 코드 변경 금지 — sheet 프리미티브만.
- 방향 variant·마크업 불변.

## Verification

- **Mechanical**: `npm run lint` + `npm run test:components` 통과.
- **Feel check**: 로그인 상태 채팅에서 이력 드로어 열기/닫기 — 열림이 기민하게 감속하며 도착(끌리는 느낌 소멸), 닫힘이 더 빠릿. DevTools Animations 10% 속도로 초반 가속 없음(ease-out) 확인.
- **Done when**: 열림 300/닫힘 200 + ease-out + 테스트 그린.
