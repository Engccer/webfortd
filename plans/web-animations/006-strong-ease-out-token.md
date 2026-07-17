# 006 — --ease-out 토큰 강화 + 오버레이 진입 이징 명시

- **Status**: TODO
- **Commit**: 76d6f21
- **Severity**: MEDIUM
- **Category**: 2 이징·지속 + 7 응집·토큰
- **Estimated scope**: 1 CSS + 6 컴포넌트 클래스 문자열

## Problem

두 겹의 문제:

1. **토큰 부재**: `src/app/globals.css:42`의 `@theme inline` 블록에 색·radius 토큰은 있으나 모션 토큰이 없어, 모든 전환이 Tailwind 내장 곡선에 의존한다. 내장 `ease-out`(`cubic-bezier(0, 0, 0.2, 1)`)은 의도적 모션엔 약하다.
2. **오버레이 진입이 기본 `ease`**: tw-animate-css의 `animate-in`/`animate-out`은 `var(--tw-ease, ease)`를 읽는데(node_modules/tw-animate-css/dist/tw-animate.css의 `--animate-in` 정의), dialog·dropdown·select·tooltip·hover-card 클래스에는 `ease-*` 유틸리티가 없어 전부 약한 내장 `ease`로 뜬다. 감사 기준: 진입·퇴장은 ease-out.

```css
/* src/app/globals.css:75-78 — 현재 @theme inline 끝부분 (모션 토큰 없음) */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
```

```tsx
// src/components/ui/dialog.tsx:63 — 현재 (duration-200만 있고 ease 없음)
"bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg"
```

## Target

1. `@theme inline` 블록에 강한 ease-out 오버라이드 1줄 추가 — Tailwind 4에서 `ease-out` 유틸리티는 `var(--ease-out)`을 참조하므로, 이 한 줄로 **기존·신규의 모든 `ease-out` 사용처가 일괄 강화**된다(모바일 드로어 포함):

```css
/* src/app/globals.css @theme inline 블록 안, radius 토큰들 다음 줄 */
  /* 모션: UI 진입·퇴장용 강한 ease-out (내장 곡선은 의도적 모션에 약함) */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
```

2. 오버레이 6곳 클래스 문자열에 `ease-out` 유틸리티 추가 — Tailwind 4의 `ease-out`은 `transition-timing-function`과 함께 `--tw-ease`를 세팅하므로 tw-animate keyframe 이징까지 함께 잡는다. 각 위치의 `animate-in` 직전에 `ease-out `를 삽입:

```
src/components/ui/dialog.tsx:41    (오버레이 backdrop fade)
src/components/ui/dialog.tsx:63    (다이얼로그 content)
src/components/ui/dropdown-menu.tsx:45   (DropdownMenuContent)
src/components/ui/dropdown-menu.tsx:233  (DropdownMenuSubContent)
src/components/ui/select.tsx:65    (SelectContent)
src/components/ui/tooltip.tsx:49   (TooltipContent)
src/components/ui/hover-card.tsx:35 (HoverCardContent)
```
(7개 클래스 문자열 / 6파일. duration은 현행 유지 — tooltip·dropdown·select 150ms, dialog 200ms 모두 예산 내.)

## Repo conventions to follow

- 토큰은 기존 `@theme inline` 블록에 합류(신규 블록 생성 금지), 주석은 한국어.
- 클래스 삽입 위치는 각 문자열의 `data-[state=open]:animate-in`(tooltip은 `animate-in`) 바로 앞 — diff 가독성.

## Steps

1. `src/app/globals.css` `@theme inline` 블록 radius 토큰 아래에 `--ease-out` 오버라이드 + 한국어 주석 1줄 추가.
2. 위 7곳 클래스 문자열에 `ease-out` 추가.
3. `npm run build` 후 `.next` 산출 CSS(또는 dev에서 DevTools)에서 `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`이 실제 반영됐는지 확인. 만약 `ease-out` 유틸리티가 `--tw-ease`를 세팅하지 않는 Tailwind 버전이라면(컴파일 CSS에서 `--tw-ease` 부재) STOP 후 보고 — 임의 우회 금지.

## Boundaries

- `--ease-in-out`·duration 토큰은 추가하지 않는다(현재 실사용처가 없어 YAGNI — 플랜 008이 sheet의 ease-in-out을 ease-out으로 바꾸면 in-out 사용처 0).
- `sheet.tsx`는 플랜 008 담당 — 건드리지 않는다.
- tw-animate-css·Tailwind 설정 파일 추가 금지.

## Verification

- **Mechanical**: `npm run lint` + `npm run test:components` + `npm run build` 통과.
- **Feel check**: DevTools Animations 패널 10% 속도로 ① 드롭다운(헤더 계정 메뉴) 열기 — 초반이 빠르고 끝이 길게 감속하는 궤적(강한 ease-out) ② 다이얼로그(로그인 모달) 열기 동일 ③ 모바일 사이드바 드로어 슬라이드가 이전보다 또렷하게 감속. ④ reduced-motion 에뮬레이션 시 여전히 즉시(전역 nuke 유지).
- **Done when**: 토큰 반영 + 오버레이 7곳 ease-out + 테스트·빌드 그린.
