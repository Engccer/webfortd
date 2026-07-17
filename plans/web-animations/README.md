# 웹 애니메이션 개선 플랜 (2026-07-17 감사 기반)

`improve-animations` 스킬 감사(commit 76d6f21)로 확정한 파인딩 9건의 실행 플랜. dodo-planet 웹 트랙(R175~R179)과 동형 사이클이되 **단일 세션 완결**, 배치는 커밋·리뷰 단위로만 쓴다. 실행 절차: 플랜 실행 → `review-animations` 기준 diff 리뷰 → `npm test`·`test:components`·`test:a11y` 그린 → feature 브랜치 PR(khudt-org/webfortd 관례) → 머지 후 Vercel 배포 확인.

## 감사 요약 (정찰 결과)

모션 표면은 tw-animate-css + Tailwind 4 유틸리티(shadcn/Radix 프리미티브)이고 자체 keyframe·모션 토큰은 0. 글로벌 reduced-motion 전면 차단(globals.css:115-132, WCAG 2.3.3 확정 결정)이 CSS는 다 잡지만 **JS 스크롤은 못 잡는 공백**이 최대 접근성 파인딩. 물리성 축은 전반 무결(transform-origin 전부 트리거 앵커, scale(0) 0건). framer-motion@12는 import 0건의 미사용 의존성.

## 실행 순서 (커밋 배치)

| 배치 | 플랜 | 성격 |
| --- | --- | --- |
| **B1** | 001 → 002 → 003 | HIGH: 키보드 토글 무애니메이션 + JS 스크롤 reduced-motion 게이트 + 진행률 바 scaleX |
| **B2** | 005 → 004 → 006 | MEDIUM 기반공사: 죽은 자산 제거 → transition-all 스윕(+눌림 피드백) → ease-out 강화 |
| **B3** | 007 → 008 → 009 | 폴리시: 검색 진입 모션 + 드로어 이징 + 체브론 정리 |

## 플랜 목록

| # | 제목 | 심각도 | Status |
| --- | --- | --- | --- |
| 001 | 사이드바 Cmd+B 토글 데스크탑 애니메이션 제거 | HIGH | TODO |
| 002 | JS 스무스 스크롤 reduced-motion 게이트 (채팅·TOC) | HIGH | TODO |
| 003 | 레거시 진행률 바 width→scaleX | HIGH | TODO |
| 004 | transition-all 명시 속성 전환 + Button 눌림 피드백 | MEDIUM | TODO |
| 005 | 미사용 모션 자산 제거 (framer-motion·sources·navigation-menu) | MEDIUM | TODO |
| 006 | --ease-out 토큰 강화 + 오버레이 진입 이징 명시 | MEDIUM | TODO |
| 007 | 검색 결과 listbox 진입 모션 | MEDIUM | TODO |
| 008 | ThreadDrawer 시트 이징·비대칭 지속 | LOW | TODO |
| 009 | 인기 페이지 체브론 hover 이동 제거 | LOW | TODO |

## 의존 관계

- 004 ← 005 (005가 `navigation-menu.tsx`를 삭제해야 004의 잔여 transition-all 검증이 깔끔 — 같은 배치에서 005 먼저)
- 007·008 ← 006 (강화된 `--ease-out` 곡선을 전제로 feel check — 없어도 동작은 함)
- 나머지 독립.

## 감사 시 기각된 항목 (재론 방지, 근거 포함)

- **globals.css reduced-motion 전면 차단(0.001ms)**: WCAG 2.3.3 주석이 달린 확정 결정. "opacity만 남기는 섬세한 게이트"보다 시각장애 사용자 중심 서비스에선 전면 즉시화가 안전한 디폴트.
- **tooltip 등 오버레이의 keyframe 진입(중단가능성 축)**: 표준 shadcn/Radix 관용구, occasional 오버레이라 mid-motion 반전 빈도가 낮음. 유일한 실사용 위반 후보였던 `sources.tsx`의 Collapsible keyframe은 죽은 코드로 판명 — 플랜 005가 파일째 제거.
- **CopyButton copied 상태 마이크로 전환**: 상태는 이미 `aria-live`로 낭독되고, crisp 즉시 전환도 미니멀리즘 관점에서 방어 가능. 과투자 기각.
- **레거시 FAQ `<details>` height 애니메이션 / 설문↔결과 crossfade**: 레거시 참고 트리(저트래픽 정적 안내)에 기능 추가 성격 — YAGNI 기각.
- **테마(라이트/다크/고대비) 전환 crossfade**: 스크린리더 사용자 다수 + 차분한 정책 서비스에서 즉시 전환이 더 신뢰감 있는 디폴트.
- **모션 duration 토큰 체계 신설**: 001 실행 후 잔여 duration이 모바일 드로어 300·다이얼로그 200·시트 300/200(008)뿐이라 패턴별로 이미 일관 — 토큰화는 과공학.
- **실용 리스트 진입 stagger**: dodo-planet 웹 트랙과 동일 계열 — 미니멀리즘 원칙과 충돌해 불채택.
- **navigation-menu chevron duration-300**: 죽은 컴포넌트(005 삭제로 해소).
