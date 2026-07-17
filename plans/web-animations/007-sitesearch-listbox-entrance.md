# 007 — 검색 결과 listbox 진입 모션 (팝오버 언어 정합)

- **Status**: TODO
- **Commit**: 76d6f21
- **Severity**: MEDIUM
- **Category**: 8 누락 기회 (+7 응집)
- **Estimated scope**: 1 file, 클래스 문자열 1곳

## Problem

Cmd+K/사이트 검색의 결과 패널은 입력창에 공간적으로 앵커된(`absolute top-full`) 팝오버인데, 형제 팝오버(dropdown·select·tooltip·hover-card)가 전부 `fade+slide/zoom` 진입을 갖는 것과 달리 유일하게 텔레포트로 등장한다 — 앱의 모션 언어와 불일치하고 어디서 나왔는지 단서가 없다.

```tsx
// src/components/search/SiteSearch.tsx:264-273 — 현재
{open && results.length > 0 && (
  <ul
    id={listboxId}
    role="listbox"
    aria-label="검색 결과"
    className={cn(
      "absolute top-full z-50 mt-1 max-h-96 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg",
      isHero ? "inset-x-0 w-full" : "right-0 w-[min(28rem,90vw)]",
    )}
  >
```

## Target

dropdown-menu와 동일 계열의 진입만 추가(퇴장은 조건부 렌더 unmount라 presence 관리 없이는 불가 — 추가하지 않는다). 타이핑 중 결과가 갱신될 때는 `<ul>`이 mount 상태를 유지하므로 재애니메이션되지 않고, 결과 0→N 등장 시에만 발동한다.

```tsx
// 목표 — 클래스 문자열에 진입 유틸리티 추가
className={cn(
  "absolute top-full z-50 mt-1 max-h-96 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg ease-out animate-in fade-in-0 slide-in-from-top-2",
  isHero ? "inset-x-0 w-full" : "right-0 w-[min(28rem,90vw)]",
)}
```

지속은 tw-animate 기본 150ms(팝오버 예산 125–200ms 내), 이징은 `ease-out`(플랜 006의 강화 토큰이 있으면 그 곡선, 없어도 내장 ease-out으로 동작).

## Repo conventions to follow

- 진입 유틸리티 조합 예시: `src/components/ui/dropdown-menu.tsx:45`의 `fade-in-0 ... slide-in-from-top-2`.
- reduced-motion은 전역 nuke(globals.css)가 keyframe duration을 0.001ms로 잡으므로 별도 게이트 불요(shadcn 파일들과 동일 관례).

## Steps

1. `src/components/search/SiteSearch.tsx` 약 269행 클래스 문자열에 `ease-out animate-in fade-in-0 slide-in-from-top-2` 추가.

## Boundaries

- listbox의 role·aria 속성, 키보드 내비게이션(onKeyDown), 결과 항목 렌더 변경 금지.
- 퇴장 애니메이션 추가 금지(mount 관리 대수술 — 스코프 밖).
- sr-only 상태 영역(261행 근처) 불변.

## Verification

- **Mechanical**: `npm run lint` + `npm run test:components`(SiteSearch vitest 존재 시) 통과.
- **Feel check**: ① 헤더 검색에 타이핑 — 첫 결과 등장 시 위에서 살짝 내려오며 페이드 인(150ms, 산만하지 않게 짧아야 함). ② 계속 타이핑해 결과가 바뀔 때는 재애니메이션 없음(mount 유지 확인 — 만약 키 입력마다 깜빡이면 STOP 후 보고). ③ reduced-motion 에뮬레이션 시 즉시 등장.
- **Done when**: 등장 모션이 dropdown과 동일 언어 + 타이핑 중 재발동 없음 + 테스트 그린.
