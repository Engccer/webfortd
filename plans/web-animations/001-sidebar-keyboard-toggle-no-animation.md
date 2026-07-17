# 001 — 사이드바 Cmd+B 토글에서 데스크탑 애니메이션 제거

- **Status**: TODO
- **Commit**: 76d6f21
- **Severity**: HIGH
- **Category**: 1 목적·빈도 (+5 성능)
- **Estimated scope**: 2 files, 클래스 문자열 2곳 수정

## Problem

데스크탑 사이드바 토글은 `Cmd+B` 키보드 단축키(`src/components/layout/AppShell.tsx:81`의 `useKeyboardShortcut({ key: "b", mod: true })`)와 헤더 햄버거 버튼으로 구동되는 고빈도 액션이다. 감사 기준상 키보드 단축키로 발동되는 100+회/일 액션에는 애니메이션을 걸지 않는다. 게다가 현재 애니메이션 대상이 `width`(사이드바)와 `padding-left`(본문 래퍼)라는 레이아웃 속성이라 전환 프레임마다 페이지 전체 layout+paint가 발생한다.

```tsx
// src/components/layout/AppSidebar.tsx:99-102 — 현재 (데스크탑 분기)
: cn(
    "fixed top-0 left-0 z-30 h-[100dvh] transition-[width] duration-200 ease-out motion-reduce:transition-none",
    isOpen ? "w-72" : "w-0 overflow-hidden",
  ),
```

```tsx
// src/components/layout/AppShell.tsx:146-151 — 현재 (본문 래퍼)
<div
  className={cn(
    "flex flex-col min-h-screen transition-[padding-left] duration-200 ease-out motion-reduce:transition-none",
    !isMobile && isExpanded ? "xl:pl-72" : "pl-0",
  )}
  inert={contentInert}
>
```

## Target

데스크탑 토글은 즉각 전환(무애니메이션). 모바일 오버레이 드로어(`AppSidebar.tsx:96`의 `transition-transform duration-300 ease-out`)와 backdrop(`AppSidebar.tsx:115`)은 터치 제스처 맥락이므로 **그대로 유지**.

```tsx
// src/components/layout/AppSidebar.tsx — 목표 (데스크탑 분기)
: cn(
    "fixed top-0 left-0 z-30 h-[100dvh]",
    isOpen ? "w-72" : "w-0 overflow-hidden",
  ),
```

```tsx
// src/components/layout/AppShell.tsx — 목표 (본문 래퍼)
className={cn(
  "flex flex-col min-h-screen",
  !isMobile && isExpanded ? "xl:pl-72" : "pl-0",
)}
```

## Repo conventions to follow

- 클래스 결합은 기존처럼 `cn(...)` 유지, 문자열 순서 외 변경 금지.
- 모바일 분기 예시(유지 대상): `AppSidebar.tsx:96` `"fixed top-0 left-0 z-50 h-[100dvh] w-72 shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none"`.

## Steps

1. `src/components/layout/AppSidebar.tsx` 데스크탑 분기(약 100행)에서 `transition-[width] duration-200 ease-out motion-reduce:transition-none`을 제거한다. `fixed top-0 left-0 z-30 h-[100dvh]`만 남긴다.
2. `src/components/layout/AppShell.tsx` 본문 래퍼(약 148행)에서 `transition-[padding-left] duration-200 ease-out motion-reduce:transition-none`을 제거한다. `flex flex-col min-h-screen`만 남긴다.

## Boundaries

- 모바일 분기(`AppSidebar.tsx:96`)와 backdrop(`AppSidebar.tsx:115`)은 건드리지 않는다.
- 마크업·상태 로직·접근성 속성(`aria-hidden`, `inert`, `role`) 변경 금지.
- 새 의존성 금지.
- 커밋 스탬프 이후 코드가 달라져 있으면 STOP 후 보고.

## Verification

- **Mechanical**: `npm run lint` 통과, `npm run test:components` 통과(사이드바 vitest 포함), `npm run test:a11y` 통과.
- **Feel check**: `npm run dev` → 데스크탑 뷰포트(≥1280px)에서 Cmd+B 연타 — 사이드바와 본문이 지연 없이 즉각 스냅하고 tween이 전혀 없어야 한다. 모바일 뷰포트에서 햄버거 열기 — 드로어 슬라이드(300ms)와 backdrop 페이드는 이전과 동일해야 한다.
- **Done when**: 데스크탑 토글 무애니메이션 + 모바일 드로어 모션 불변 + 테스트 그린.
