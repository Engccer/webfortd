# 004 — transition-all 명시 속성 전환 + Button 눌림 피드백

- **Status**: DONE
- **Commit**: 76d6f21
- **Severity**: MEDIUM
- **Category**: 5 성능 (+3 물리성: 눌림 피드백)
- **Estimated scope**: 11 files, 클래스 문자열 12곳

## Problem

`transition-all`은 의도 외 속성(레이아웃 포함)까지 off-GPU로 전환한다 — 감사 기준 "항상 finding". 실제 변하는 속성은 전부 색·그림자 계열이므로 명시 목록으로 좁힌다. 또한 코드베이스 전체에 `:active` 눌림 피드백이 0건이라(`grep ":active\|active:scale" src` 무일치) Button 기본형에 subtle 피드백을 함께 넣는다.

대상 12곳 (플랜 003의 진행률 바, 플랜 005에서 삭제되는 `navigation-menu.tsx:132`는 제외):

```
공용 컴포넌트 2곳:
src/components/ui/Button.tsx:8         "... font-medium transition-all disabled:pointer-events-none ..."
src/components/ui/switch.tsx:16        "... border border-transparent shadow-xs transition-all outline-none ..."

레거시 hover 카드 — border+shadow 계열 7곳:
src/app/(gov)/legacy/participate/page.tsx:49       transition-all hover:border-blue-300 hover:shadow-lg
src/app/(gov)/legacy/resources/page.tsx:55         transition-all hover:border-blue-300 hover:shadow-lg
src/app/(gov)/legacy/about/page.tsx:26             transition-all hover:border-blue-300 hover:shadow-lg
src/app/(gov)/legacy/about/page.tsx:41             transition-all hover:border-blue-300 hover:shadow-lg
src/app/(gov)/legacy/stories/page.tsx:72           transition-all hover:border-blue-300 hover:shadow-lg
src/app/(gov)/legacy/rights/page.tsx:62            transition-all hover:border-blue-300 hover:shadow-lg
src/app/(gov)/legacy/support/page.tsx:49           transition-all hover:border-blue-300 hover:shadow-lg

레거시 hover 카드 — border+background 계열 2곳:
src/app/(gov)/legacy/resources/research-guide/page.tsx:75   transition-all hover:border-green-400 hover:bg-green-100
src/app/(gov)/legacy/resources/law-guide/page.tsx:113       transition-all hover:border-blue-300 hover:bg-blue-50
```

## Target

각 위치에서 `transition-all`을 아래로 치환 (다른 클래스는 전부 그대로):

| 위치 | 치환 |
| --- | --- |
| `Button.tsx:8` | `transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.97]` |
| `switch.tsx:16` | `transition-colors` |
| 레거시 border+shadow 7곳 | `transition-[border-color,box-shadow]` |
| 레거시 border+bg 2곳 | `transition-colors` |

Button 근거: 변하는 속성 = 텍스트/배경/보더 색(variant hover), focus ring(box-shadow 기반), 신규 `active:scale-[0.97]`(transform). 기본 duration 150ms가 눌림 피드백 예산(100–160ms)에 부합하므로 duration 유틸리티는 추가하지 않는다. `switch`는 배경·보더 색만 변한다(thumb은 별도 `transition-transform` 보유 — 불변).

## Repo conventions to follow

- 명시 속성 목록의 기존 예시: `src/components/ui/select.tsx:40`의 `transition-[color,box-shadow]`.
- 클래스 문자열 내 위치는 기존 `transition-all` 자리 그대로 교체(diff 최소화).

## Steps

1. `src/components/ui/Button.tsx:8` — `transition-all` → `transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.97]`.
2. `src/components/ui/switch.tsx:16` — `transition-all` → `transition-colors`.
3. 레거시 border+shadow 7곳 각각 — `transition-all` → `transition-[border-color,box-shadow]`.
4. 레거시 border+bg 2곳 각각 — `transition-all` → `transition-colors`.
5. `grep -rn "transition-all" src` 실행 — 잔여는 플랜 003 대상(진행률 바, 이미 처리됐다면 0건)과 플랜 005 삭제 대상(`navigation-menu.tsx:132`)뿐이어야 한다.

## Boundaries

- hover 색·그림자 값 자체(디자인)는 변경 금지 — 전환 속성 목록만 좁힌다.
- `active:scale`은 Button 기본형에만 — 개별 커스텀 버튼(AppSidebar 토글, VoiceRecordButton 등)에 개별 추가 금지(Button 미사용 버튼은 이번 스코프 밖).
- 새 의존성 금지. 드리프트 시 STOP.

## Verification

- **Mechanical**: `npm run lint` + `npm run test:components`(Button 관련 vitest 포함) + `npm run build` 통과. `grep -rn "transition-all" src` 결과가 위 Steps 5 기대와 일치.
- **Feel check**: ① 아무 페이지에서 버튼 클릭·홀드 — 97%로 살짝 눌리고 뗄 때 복귀(과하지 않아야 함). 아이콘 버튼(채팅 복사 등)에서도 어색하지 않은지 확인. ② 스위치 토글(접근성 도구모음) — thumb 슬라이드 기존과 동일. ③ 레거시 카드 hover — 보더/그림자 페이드 기존과 시각 동일. ④ DevTools에서 버튼의 computed transition-property에 `all`이 없음을 확인.
- **Done when**: src 내 `transition-all`이 플랜 005 삭제 파일 외 0건 + 테스트 그린 + 눌림 피드백 subtle 동작.
