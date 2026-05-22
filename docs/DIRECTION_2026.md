# webfortd 진행 방향 (2026-05-19 결정)

## 배경

2026-05-19 위원장과 Claude 대화를 통해 합의된 향후 개발 방향. 같은 날 교육부 회의(사업 전반)와 일정 미정인 웹사이트 구축 회의를 앞두고, Phase 1.5b PR A까지 머지된 상태에서 *Phase 2 이후의 큰 그림*을 미리 박아둔다.

이 문서는 변경되지 않는 결정의 기록이 아니라, 다음 회의 결과·중부대 협의 결과에 따라 *갱신될 수 있는 현재 시점의 최선 결정*이다. 변경 시 본 문서를 갱신하고 CLAUDE.md 변경 이력에 한 줄 남긴다.

## 1. UI 전략 — 두 방향 병행 (Route Groups)

### 결정

위키+챗봇 중심 UI(위원장 비전)와 전통 관공서 랜딩 페이지(중부대·교육부 기대) 두 방향을 **단일 코드베이스 + Next.js 16 Route Groups**로 병행 유지한다. Git 브랜치 분리는 채택하지 않는다.

### 근거

- Git 브랜치는 시간 분기 도구이지 동시 운영 도구가 아니다. DB가 같은데 UI만 다른 두 상태를 영구 병행하면 cherry-pick·merge 충돌 비용이 시간 따라 기하급수로 늘어남. 위원장 1인 운영 측면에서도 부담 큼.
- Next.js 16 Route Groups는 같은 repo·같은 DB·같은 컴포넌트 일부 공유하면서 라우트별로 layout과 정보 구조를 완전히 다르게 가져갈 수 있는 정식 기능.
- atomic 페이지(`/disability-types/[slug]` 등) 535개는 양쪽 그룹이 공유 — 콘텐츠 중복 없음.

### 구조

```
app/
├── (gov)/                  # 관공서용 — 전통 랜딩 + 메뉴 트리
│   ├── page.tsx            # 현재 홈 그대로
│   ├── support/...
│   └── ...
├── (wiki)/                 # 위원장 비전 — 위키+챗봇+소셜 피드
│   ├── wiki/page.tsx       # 검색 prominent 홈
│   ├── chat/page.tsx       # 챗봇
│   ├── feed/page.tsx       # 소셜 피드
│   └── ...
├── disability-types/[slug] # atomic 페이지 — 양쪽 공유
├── policies/[slug]         # atomic 페이지 — 양쪽 공유
└── layout.tsx              # 최상위 ThemeProvider/Footer 등
```

### 회의용 entry 선택

- 교육부·중부대 회의(보수적 청중): `https://webfortd-khudt-s-projects.vercel.app/`(현재 도메인 = `(gov)` 그룹)
- 위원장 비전 시연: `https://webfortd-khudt-s-projects.vercel.app/wiki`

도메인 단위 분리(별 deployment)는 채택하지 않는다 — 빌드 2배·환경변수 관리 부담이 명료성 이점보다 큼.

## 2. DB — Supabase 유지 + 대안 시나리오

### 결정

1차는 Supabase 유지. *외부 DB 금지* 조건이 중부대·교육부 협의에서 명시되면 우선순위에 따라 대안으로 전환.

### 대안 시나리오

| 우선순위 | 대안 | 트레이드오프 |
|---------|------|-------------|
| 1 | Self-hosted Supabase (Docker Compose) | Supabase가 오픈소스라 통째 설치 가능. `@supabase/supabase-js`·RLS·Storage·pgvector 그대로 작동해 **코드 0~최소 변경**으로 전환. 운영 책임(백업·TLS·업데이트)은 중부대 운영실 또는 외주 유지보수에 이전 |
| 2 | Pure PostgreSQL 17 + pgvector + 자체 auth 레이어 | 외주가 PHP/MySQL 배경이면 운영 인계 가장 쉬움. RLS·Storage·실시간은 직접 구현 — Phase 3(RAG) 진입 전에 결정해야 폐기 비용 최소 |
| (참고) | PocketBase (SQLite + sqlite-vec) | 시범 모델·트래픽 적으면 매력적이지만 동시 편집·대용량 RAG 한계. 시범 단계 한정 백업안, **권장 안 함** |

### 결정 분기점

중부대가 인계받을 운영 주체가 *내부 운영실*인가 *외주 유지보수*인가에 따라 1번/2번 사이 분기.

## 3. 인증

### 결정

**Supabase Auth** 사용. DB가 Supabase로 결정됐으므로 jwt와 RLS 키가 자동 연결되는 정합성이 큰 이점.

### 대상 사용자

장교조 조합원 + α. α의 정의(예: 자문위원, 외부 협력 교사, 일반 시민)는 Phase 2 spec 작성 시점에 결정.

### 적용 범위

- `(gov)` 그룹: **인증 게이트 없음** — 익명 정부 사이트로 유지. 로그인 게이트가 끼면 관공서 측 거부감 큼.
- `(wiki)` 그룹: 위키 reading은 익명 허용. 피드 작성·챗봇 사용 이력 저장 등 기능은 로그인 요구.

## 4. 챗봇

### 결정

**RAG 기반 챗봇** — 정책 문서·atomic 페이지 임베딩 → 검색 → Claude/Gemini로 응답. dodo-planet의 function-calling 방식은 webfortd 도메인(정책·법령·사례)에 맞지 않아 채택하지 않는다.

### 구성

- 임베딩: 마크다운 535개 → 청크 → 임베딩 → Supabase pgvector
- 검색: 사용자 질의 임베딩 → top-k 청크 + 메타데이터 retrieval
- 응답: AI SDK + Vercel AI Elements 채팅 UI. 출처 인용(원문 atomic 페이지 링크) 필수 — 정책 문서 신뢰성의 핵심
- 접근성: `aria-live` 영역으로 스트리밍 응답 알림 (위원장 본인이 스크린리더 사용자)

### dodo-planet 자산 활용

라우트 구조와 클라이언트 훅 *패턴*만 참고. 시스템 프롬프트·함수 선언·도메인 모델은 webfortd용으로 신규 작성.

## 5. 소셜 피드

### 결정

`(wiki)` 그룹에만 도입. `(gov)` 그룹에는 부착하지 않는다 — 관공서 랜딩과 소셜 피드는 톤이 부조화.

### 대상

장교조 조합원 + α의 학교생활 소소한 공유. 인증 게이트 의무.

### dodo-planet 자산 활용

스키마(`feed_posts`, `feed_comments`, `feed_likes`)와 Storage 패턴 거의 그대로 복사 가능. UI 컴포넌트는 webfortd 디자인으로 리스타일.

## 6. 확장성 — 사용자 피드백 기반 기능 추가

### 결정

`(wiki)` 그룹의 정체성은 *유연하게 확장 가능한 구조*. 사용자 피드백 통해 기능을 점진 추가하되, 다음 원칙 준수.

- 새 기능은 **별도 도메인 모듈**로 시작. atomic 페이지·피드·챗봇과 명확한 도메인 경계.
- **Feature flag** 도입 검토 — Vercel Flags 또는 자체 토글. 작은 변경을 `(wiki)` 그룹에 빠르게 출시·검증한 후 확장.
- 도입 결정 기록은 본 문서를 갱신해 추적.

## 7. dodo-planet 자산 재사용 매핑

| 자산 | 위치 | 재사용성 | webfortd 적용 |
|------|------|---------|--------------|
| 인증 | `middleware.ts`, `AuthContext.tsx`, `AuthModal.tsx` | 직접 복사 + 도메인 모델 재작성 | `traveler` → `조합원/사용자` 모델로 재작성 |
| 피드 | `useFeedPosts.ts`, `FeedPost.tsx`, `supabase/migrations/20260105_*.sql` | 스키마 그대로, UI 리스타일 | `(wiki)/feed`에 적용 |
| 챗봇 | `api/chat/route.ts`, `useChat.ts` (Gemini function-calling) | 라우트 구조·훅 *패턴*만 | RAG 신규 작성 |
| 라이브 채팅 | (없음) | dodo-planet에 패턴 없음 | Supabase Realtime 필요 시 신규 구축 |

## 8. 회의별 시연 범위

### 오늘 교육부 회의 (사업 전반)

범위 (b) — Route Groups 분리 + `(wiki)` 그룹 entry 페이지 신규 디자인 + 챗봇 mock UI(응답은 더미). 시연 동선은 `docs/`에 별도 cheat sheet 없이 plan에 포함.

### 웹사이트 구축 회의 (일정 미정)

챗봇 작동본(RAG 실연) + 인증/피드 stub. Phase 3 정식 PR 단위로 진행하므로 시연 대상은 *현재 production 상태*가 곧 demo.

## 9. Phase 로드맵 갱신 (CLAUDE.md와 정합)

CLAUDE.md의 Phase 표를 본 문서와 정합하게 갱신한다.

| Phase | 상태 | 범위 |
|-------|------|------|
| 1 | 완료 | 콘텐츠 정본·빌드 파이프라인 |
| 1.5 / 1.5b | 진행 중 | 이미지 매핑 자동화 |
| **2 (개정)** | 대기 | Supabase 연결 + 인증(Supabase Auth) + Route Groups 분리 + `(wiki)` 그룹 entry 페이지 |
| **3 (개정)** | 대기 | 임베딩 파이프라인 + RAG 챗봇 + AI Elements 채팅 UI |
| **4 (개정)** | 대기 | 소셜 피드(`(wiki)` 그룹) |
| 5 | 대기 | TTS·이미지 alt 자동생성 |
| 6 | — | 다국어·정책 통계 시각화 |

Phase 2 spec은 본 문서 작성 후 *작업 계획* 단계에서 별도 plan으로 작성한다.

## 10. 다음 단계

1. **오늘 데모 plan 작성** — `(b)` 범위 (Route Groups 분리 + `(wiki)` entry + 챗봇 mock).
2. **plan 실행** — Claude가 끝까지 구현.
3. **회의 결과 반영** — 교육부 회의 후 본 문서 §1·§2 갱신 필요 여부 판단.
4. **Phase 2 본격 spec 작성** — 웹사이트 구축 회의 일정 잡힌 후, 또는 위원장 명시 신호 후.

## 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-19 | 초기 작성 — 2026-05-19 대화 결정 사항 통합 정리 |
