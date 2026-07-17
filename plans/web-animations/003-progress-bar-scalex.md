# 003 — 레거시 체크리스트 진행률 바를 scaleX 전환으로

- **Status**: DONE
- **Commit**: 76d6f21
- **Severity**: HIGH
- **Category**: 5 성능
- **Estimated scope**: 1 file, 1 블록

## Problem

`transition-all` + 인라인 `width` 변경의 이중 위반 — 답변 체크마다 진행률 바가 layout+paint를 태우며 늘어난다. 코드베이스에서 레이아웃 속성을 실제로 tween하는 유일한 진행형 UI.

```tsx
// src/app/(gov)/legacy/participate/check/page.tsx:110-115 — 현재
<div className="h-2 flex-1 mx-4 rounded-full bg-gray-200">
  <div
    className="h-full rounded-full bg-blue-500 transition-all"
    style={{ width: `${(answeredCount / questions.length) * 100}%` }}
  />
</div>
```

## Target

GPU 합성 속성(`transform: scaleX`)으로 등가 시각 결과. 트랙에 `overflow-hidden`을 더해 스케일 중에도 둥근 모서리를 유지한다.

```tsx
// 목표
<div className="h-2 flex-1 mx-4 overflow-hidden rounded-full bg-gray-200">
  <div
    className="h-full w-full origin-left rounded-full bg-blue-500 transition-transform duration-200 ease-out"
    style={{ transform: `scaleX(${answeredCount / questions.length})` }}
  />
</div>
```

## Repo conventions to follow

- 이 페이지는 레거시 정적 안내 트리(`(gov)/legacy`) — Tailwind 유틸리티 직접 기입 관례 유지, 컴포넌트 추출 금지.
- duration·easing은 200ms `ease-out`(사이드바·다이얼로그와 동일 계열).

## Steps

1. `src/app/(gov)/legacy/participate/check/page.tsx` 110-115행 블록을 Target 코드로 교체한다. `answeredCount / questions.length`는 0~1 비율이므로 `* 100` 제거에 주의.

## Boundaries

- 같은 파일의 설문↔결과 콘텐츠 스왑(`!showResults` 분기)은 건드리지 않는다(감사에서 기각된 별건).
- 이 파일의 다른 `transition-all`(카드 hover 49행 등)은 플랜 004 담당 — 여기서 건드리지 않는다.
- 새 의존성 금지. 드리프트 시 STOP.

## Verification

- **Mechanical**: `npm run lint` 통과, `npm run build` 통과.
- **Feel check**: `/legacy/participate/check`에서 체크박스를 하나씩 토글 — 바가 부드럽게 늘고 줄며(역방향 체크 해제 포함), DevTools Performance 녹화에서 보라색 Layout 이벤트가 전환 중 발생하지 않아야 한다. 빠르게 연속 체크해도 transition이라 현재 위치에서 retarget(0부터 재시작 없음).
- **Done when**: 시각 결과 동일 + width tween 소멸 + lint/build 그린.
