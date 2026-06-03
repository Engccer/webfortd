# Phase 7 라이브 음성 채팅 — 환경 셋업 & 수동 smoke 체크리스트

> Phase 7 M5 산출물. 위원장 명시 확인 후 production 반영.

---

## 1. 환경변수

### 로컬 (`.env.local`)

`GOOGLE_GENERATIVE_AI_API_KEY`는 Phase 3 임베딩(`kb:embed`) 시점에 이미 `.env.local`에 등록되어 있습니다. Live 음성도 동일 키를 **재사용**하므로 로컬 추가 작업은 없습니다.

```bash
# 확인
grep GOOGLE_GENERATIVE_AI_API_KEY .env.local
```

### Vercel production 런타임

Live API(`/api/voice/session`)는 **Vercel AI Gateway를 경유하지 않고** `@google/genai`로 직결됩니다. 따라서 `GOOGLE_GENERATIVE_AI_API_KEY`가 Vercel production 런타임에 등록되어 있어야 합니다.

> **현황 (2026-06-03 실측)**: `vercel env ls`로 확인한 결과 Production·Preview·Development 세 환경 모두에 `GOOGLE_GENERATIVE_AI_API_KEY`가 Encrypted 상태로 등록되어 있음 → **추가 등록 불필요**.

#### 미등록인 경우 (향후 환경 재구성 시 참고)

임베딩이 CI/로컬에서만 실행되는 구조라면 production 런타임 env가 비어 있을 수 있습니다. 그 경우 PR #73(Deepgram) 등록 절차를 동일하게 따릅니다.

1. **현재 등록 여부 확인**

   ```bash
   # /tmp 등 direnv 미적용 디렉터리에서 실행
   cd /tmp
   npx vercel env ls 2>&1 | grep -i GOOGLE_GENERATIVE_AI_API_KEY
   ```

   출력에 `Production`이 없으면 아래 절차를 진행합니다.

2. **임시 디렉터리에서 link + 등록**

   ```bash
   # direnv가 KHUDT VERCEL_TOKEN을 덮어쓰지 않는 위치에서 실행
   cd /tmp/webfortd-env-setup   # 임시 디렉터리
   npx vercel link --yes --project webfortd   # --scope 금지: personal/engccer Hobby
   npx vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
   # stdin 입력 → 키 값 붙여넣기 (화면 비노출)
   ```

3. **런타임 반영**

   ```bash
   npx vercel redeploy https://webfortd.vercel.app
   ```

4. **KHUDT 팀 결제 복구 시** — 동일 키를 KHUDT scope 프로젝트에도 등록합니다.

---

## 2. 모델

| 항목 | 값 |
|------|----|
| 모델 ID | `gemini-3.1-flash-live-preview` |
| 정의 위치 | `src/lib/gemini-live.ts` → `LIVE_MODEL` 상수 |
| API 경로 | `@google/genai` v1alpha (Vercel AI Gateway 미경유) |
| 키 | `GOOGLE_GENERATIVE_AI_API_KEY` (임베딩과 동일) |
| 보안 경계 | `authTokens.create()`로 발급한 ephemeral 토큰만 브라우저로 내려감. raw 키는 서버 전용(`src/lib/gemini-live.ts`에 `import 'server-only'` 적용). |

---

## 3. 수동 smoke 체크리스트 (위원장 실 기기)

아래 항목을 순서대로 확인합니다. 통과 = ✅, 미통과 = ❌(현상 메모).

### 기본 동작

1. **로그인 후 음성 세션 진입**
   - `/chat` 접속 → "실시간 음성 대화" 버튼 클릭 → 브라우저 마이크 권한 허용
   - 오버레이가 정상 노출되고 "듣고 있어요" 상태 표시 확인

2. **RAG 연동 응답**
   - "장애인교원 편의지원 어떻게 신청해?" 발화
   - 모델이 "잠깐만요, 찾아볼게요" 류의 ack 후 제도·정책 근거 기반 답변 반환
   - 출처 카드(위키 페이지 링크)가 함께 표시되는지 확인

3. **끼어들기(barge-in)**
   - 모델 발화 중 다른 질문 발화
   - 모델 응답이 중단되고 새 질문을 재청취하는지 확인

### 접근성

4. **스크린 리더 + 키보드**
   - VoiceOver(iOS) 또는 TalkBack(Android)로 상태 알림 읽힘 확인
     - 예: `aria-live` 영역이 "듣고 있어요", "답변 중이에요" 등 한국어로 고지
   - `Esc` 키 → 오버레이 종료 확인
   - `Space` 키(버튼 미포커스 상태) → 음소거 토글 확인

### 인증 게이트

5. **비로그인 상태 안내 한국어 확인**
   - 로그아웃 후 `/chat` → "실시간 음성 대화" 클릭
   - 오버레이가 **한국어**로 "로그인이 필요해요. 음성 대화는 로그인한 뒤 이용할 수 있어요." 를 표시하는지 확인 (영어 안내 금지)

### 출처 카드 & 세션 유지

6. **출처 카드 링크 동작**
   - 답변에 포함된 출처 카드의 링크 클릭
   - **새 탭**에서 위키 페이지가 열리는지 확인
   - 원래 탭의 음성 세션이 유지(중단 없음)되는지 확인

---

## 4. 비용 메모

| 항목 | 내용 |
|------|------|
| 비용 특성 | Live native audio는 텍스트 채팅 대비 분당 비용이 큼 |
| 1차 통제 | 로그인 게이트 — `/api/voice/session`은 미인증 요청에 HTTP 401 반환 |
| 세션 cap | 현재 **미적용(YAGNI)** — 남용 관측 시 추가 |
| 모니터링 | Vercel function logs: `vercel logs --since 1d` |
| 향후 트리거 | 월간 세션 수가 예상 범위(시범 단계 50세션/월)를 초과하면 max_duration 제한 도입 검토 |
