# M3 Smoke 절차

Phase 3 M3 Route Handler(`/api/chat`)를 실 Gemini + Supabase로 검증하는 절차 문서입니다.

## 사전 조건

- impl worktree 위치: `/Users/hunyongkim/Mac-Projects/webfortd-phase-3-m3-impl`
- 글로벌 env에 `GEMINI_API_KEY` 존재 확인
  ```bash
  printenv | grep GEMINI_API_KEY
  ```
- `.env.local`에 Supabase 키 설정됨 (M2 셋업 이후)
  ```bash
  cat .env.local | grep SUPABASE
  ```
- AI Gateway 활성화 + OIDC 토큰 구성 완료 (Task 8 완료 후)
  - 미완 시 OIDC 인증 실패 가능. 이 경우 직접 provider fallback 가능 (gateway → google로 변경 1줄 hotfix)

## 실행

### 옵션 1 — 단위 테스트 형식 (권장)

```bash
cd /Users/hunyongkim/Mac-Projects/webfortd-phase-3-m3-impl

# RUN_SMOKE=1 플래그로 smoke 테스트만 활성화
GOOGLE_GENERATIVE_AI_API_KEY="$GEMINI_API_KEY" RUN_SMOKE=1 \
  npm test -- --test-only tests/rag/m3-smoke.test.ts
```

**기대 결과**: 4개 테스트 PASS

- `POST 200 + SSE 스트림 수신` — 응답 상태 200 + content-type 스트림
- `응답 본문에 "참고용" 면책 안내 키워드` — 시스템 프롬프트 회귀 가드
- `messageMetadata에 sourceRefs 포함` — AI SDK v6 메타데이터 검증
- `다중 턴 히스토리 처리` — 대화 이력 5턴 clamp 확인

### 옵션 2 — Next.js dev 서버 + curl

dev 서버로 직접 테스트하려면:

```bash
# 터미널 1: dev 서버 시작
cd /Users/hunyongkim/Mac-Projects/webfortd-phase-3-m3-impl
GOOGLE_GENERATIVE_AI_API_KEY="$GEMINI_API_KEY" npm run dev

# 터미널 2: 스트림 요청
curl -N -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{
    "messages": [
      {
        "id": "u1",
        "role": "user",
        "parts": [{"type": "text", "text": "장애인교원에게 보조인력 지원이 있나요?"}]
      }
    ]
  }'
```

**기대 결과**: SSE 스트림으로 응답 토큰 도착 (줄 단위 실시간 표시)

## 비용 측정

단위 smoke 테스트는 매우 저비용입니다:

- 단위 smoke 1회: ~$0.001 (~1.3원)
- 3개 테스트 완전 실행: ~$0.003 (~4원)
- 회의용 시연 10회: ~$0.01 (~13원)

## 추천 질의 (좋은 결과를 받을 가능성)

다음 질의들은 webfortd 콘텐츠에 강한 관련성이 있어 좋은 응답을 받을 가능성이 높습니다:

- `장애인교원에게 보조인력 지원이 있나요?`
- `편의지원 조례를 제정한 시도교육청은 어디인가요?`
- `특수 마우스에는 어떤 종류가 있나요?`
- `휠체어 사용자를 위한 환경 개선 사항은?`
- `시각장애인 교사를 위한 보조기구 지원 범위`

## 트러블슈팅

| 증상 | 원인 | 대응 |
|------|------|------|
| `Authorization required` / 401 | OIDC 토큰 미발급 또는 AI Gateway 미활성화 | `vercel env pull .env.local --yes` 재실행 또는 Task 8 완료 확인 |
| `Model not found: google/gemini-3.5-flash` | 모델 ID 변경 또는 provider 설정 오류 | plan §D2 fallback 후보 순차 시도 (`gemini-2.0-flash`, `gemini-1.5-flash`) |
| `match_chunks RPC 실패` / 401 | Supabase 키 만료 또는 권한 부족 | `.env.local` `SUPABASE_SECRET_KEY` 갱신 + `kb:sync:dry-run` 재확인 |
| 스트림이 즉시 끊김 또는 빈 응답 | retrieval 결과 0건 (또는 모델 응답이 매우 짧음) | 다른 질의로 재시도 (추천 질의 목록 참조) |
| `GOOGLE_GENERATIVE_AI_API_KEY` 환경변수 인식 안 됨 | 전역 env 미설정 | `export GEMINI_API_KEY="..."` 후 다시 시도 또는 `.env.local`에 직접 입력 |
| 테스트가 계속 skip됨 | RUN_SMOKE 플래그 누락 | 명시적으로 `RUN_SMOKE=1` 앞에 붙여야 함 |

## 위원장 톤 검수 항목

응답을 청취·검수할 때 다음 항목을 확인해 주세요:

- **톤**: 다정하고 명료한가? (격식체 일색이 아닌지)
- **면책 안내**: "참고용", "정확한 정보는 담당 부서 확인" 등이 자연스럽게 포함되었는가?
- **무관 질문 대응**: 정책과 무관한 질문에 정중하게 유도하는가?
- **정책 정확성**: 핵심 정보(편의지원, 신청 절차, 시도별 차이 등)가 정확한가?
- **길이**: 너무 길거나 짧지 않은가?

검수 결과는 plan `docs/superpowers/plans/` 변경 이력에 기록합니다.

## AI Gateway 미활성화 시 직접 provider 사용

Task 8이 아직 미완료되어 AI Gateway OIDC 토큰이 없는 경우, 임시로 직접 Google provider를 사용할 수 있습니다:

**`src/app/api/chat/route.ts` 수정 (1줄, 임시)**:

```typescript
// 변경 전:
model: gateway('google/gemini-3.5-flash'),

// 변경 후 (임시):
model: google('gemini-3.5-flash'),
```

그 후 import 추가:

```typescript
import { google } from '@ai-sdk/google'
```

다시 smoke 실행:

```bash
GOOGLE_GENERATIVE_AI_API_KEY="$GEMINI_API_KEY" RUN_SMOKE=1 npm test -- --test-only tests/rag/m3-smoke.test.ts
```

**주의**: 이 수정은 임시용입니다. Task 8 완료 후 `gateway()` 형태로 복원해야 합니다.

## Task 8 완료 후 절차

Task 8에서 AI Gateway가 활성화되면:

1. `.env.local`에 Vercel AI Gateway 토큰 추가 (`VERCEL_AI_GATEWAY_AUTH_TOKEN` 또는 OIDC 설정)
2. `vercel env pull .env.local --yes` 재실행
3. Route Handler 코드 확인 (gateway() 호출이 그대로 있는지)
4. smoke 재실행 (이번엔 최종 형태로)

## 실행 로그 예시

성공한 smoke 실행의 예상 로그:

```
$ RUN_SMOKE=1 npm test -- --test-only tests/rag/m3-smoke.test.ts

 ✔ tests/rag/m3-smoke.test.ts > rag/m3-smoke — POST /api/chat Route Handler (실 Gemini) > POST 200 + SSE 스트림 수신 (2500ms)
   [m3-smoke] elapsed: 2487ms, chunks: 15, body size: 1234
   
 ✔ tests/rag/m3-smoke.test.ts > rag/m3-smoke — POST /api/chat Route Handler (실 Gemini) > 응답 본문에 "참고용" 면책 안내 키워드 (1800ms)
   [m3-smoke] 면책 키워드 검증 PASS
   
 ✔ tests/rag/m3-smoke.test.ts > rag/m3-smoke — POST /api/chat Route Handler (실 Gemini) > messageMetadata에 sourceRefs 포함 (1600ms)
   [m3-smoke] sourceRefs 메타데이터 검증 PASS
   
 ✔ tests/rag/m3-smoke.test.ts > rag/m3-smoke — POST /api/chat Route Handler (실 Gemini) > 다중 턴 히스토리 처리 (2100ms)
   [m3-smoke] 다중 턴 히스토리 처리 PASS

4 tests pass (8s)
```
