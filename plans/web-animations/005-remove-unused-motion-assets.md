# 005 — 미사용 모션 자산 제거 (framer-motion·sources·navigation-menu)

- **Status**: TODO
- **Commit**: 76d6f21
- **Severity**: MEDIUM
- **Category**: 7 응집·토큰 (죽은 관습 제거)
- **Estimated scope**: 2 파일 삭제 + package.json 의존성 2개 제거

## Problem

애니메이션 표면에 실사용과 무관한 죽은 자산 3종이 존재하고, 그중 둘은 실사용 관습과 어긋나는 모션 값(500ms·`duration-300` 등)을 내장해 후일 채택 시 분열을 만든다:

1. **framer-motion@12.23.24** — `package.json:64`에 있으나 src·scripts·tests 전체 import 0건(grep 검증). 미사용 의존성.
2. **`src/components/ai-elements/sources.tsx`** — `SourcesTrigger`/`SourcesContent` 등 심볼 사용 0건. Collapsible에 keyframe 진입·퇴장(`animate-in`/`animate-out`)을 거는 감사 위반 코드가 죽은 채로 남아 있음(카테고리 4 파인딩이 이 파일 때문에 오탐될 뻔함).
3. **`src/components/ui/navigation-menu.tsx`** — 앱 레벨 import 0건. `transition-all`(132행)·chevron `duration-300`(78행) 내장. 이 파일만이 `@radix-ui/react-navigation-menu`를 쓰므로 의존성도 함께 제거 가능.

## Target

세 자산 모두 제거. shadcn 컴포넌트는 필요 시 `npx shadcn@latest add navigation-menu`로 언제든 재추가 가능하므로 손실 없음(YAGNI).

## Repo conventions to follow

- 의존성 제거는 `npm uninstall`로 package.json과 package-lock.json을 함께 갱신.
- 삭제 전 심볼 단위 grep으로 사용처 0건 재확인(멀티라인 import 함정 — 경로 문자열이 아니라 심볼명으로 검색).

## Steps

1. 사용처 재확인 (전부 0건이어야 함):
   ```bash
   grep -rn "framer-motion" src scripts tests
   grep -rn "SourcesTrigger\|SourcesContent\|ai-elements/sources" src --include="*.tsx" | grep -v "ai-elements/sources.tsx"
   grep -rn "NavigationMenu" src --include="*.tsx" | grep -v "ui/navigation-menu.tsx"
   ```
   하나라도 매치가 나오면 STOP 후 보고.
2. `git rm src/components/ai-elements/sources.tsx src/components/ui/navigation-menu.tsx`
3. `npm uninstall framer-motion @radix-ui/react-navigation-menu`
4. `npm run build`로 참조 깨짐 없음 확인.

## Boundaries

- `sheet.tsx`는 삭제 금지 — `ThreadDrawer`가 실사용(모션 값은 플랜 008이 수정).
- 다른 ai-elements(conversation·message·prompt-input·suggestion)는 전부 실사용 — 건드리지 않는다.
- package.json의 다른 의존성·스크립트 변경 금지.

## Verification

- **Mechanical**: `npm run lint` + `npm test` + `npm run test:components` + `npm run build` 전부 통과. `node_modules/framer-motion` 부재 확인.
- **Feel check**: 해당 없음(죽은 코드 제거 — 런타임 표면 불변). 채팅 화면 로드로 ai-elements 잔여 4종 정상 렌더만 확인.
- **Done when**: 2 파일 + 2 의존성 제거, 빌드·테스트 그린.
