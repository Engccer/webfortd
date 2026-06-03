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

## 3. 배포 페이지 수동 smoke (위원장 실 기기)

> 실 마이크 음성 왕복은 CI로 검증 불가 — 위원장 실 기기 테스트가 마지막 관문입니다. 단위·컴포넌트·axe·통합은 모두 통과한 상태입니다.

### 3.0 어디서 테스트하나 (먼저 결정)

음성 채팅 코드는 `feat/live-voice-chat` 브랜치(PR #74)에 있고 **아직 master에 머지되지 않았습니다.** 그래서 테스트 URL이 두 갈래입니다.

| 경로 | URL | 음성 기능 | 접근성(모바일·VoiceOver) | 비고 |
|------|-----|-----------|--------------------------|------|
| **production** (권장) | https://webfortd.vercel.app/chat | **머지 후** 노출 | 익명 공개 → 가장 편함 | master에 머지해야 "실시간 음성 대화" 버튼이 생김 |
| **preview** (지금 가능) | https://webfortd-git-feat-live-voice-chat-hunyong-kims-projects.vercel.app/chat | 지금 있음 | **Vercel 배포 보호로 401** | engccer Vercel 로그인 브라우저에서만 열림 |

**권장 경로 = production 머지 후 테스트.** 근거:
- 익명 공개라 휴대폰 VoiceOver/TalkBack 테스트가 매끄럽다 (preview는 Vercel SSO 벽 때문에 모바일에서 불편).
- 코드가 다층 리뷰(task별 2단계 + cross-cutting READY + coderabbit)를 모두 통과했고, 음성 실사용은 **로그인 게이트**라 익명 production 방문자는 영향 없음(버튼 눌러도 "로그인이 필요해요" 안내만).
- 위원장 기존 워크플로(PR #73 받아쓰기·PR #63 admin)와 동일한 "머지 → production smoke → 문제 시 fix-forward" 패턴.
- 머지는 **위원장 명시 결정** 필요. "머지해도 돼"라고 하면 Claude가 squash 머지 → production 자동 배포(약 1~2분) 후 아래 테스트 진행.

**머지 전에 preview에서 먼저 보고 싶다면** 둘 중 하나:
- (a) 데스크톱 크롬에서 engccer Vercel 계정으로 로그인한 상태로 preview URL 접속(소유자는 보호 통과). 단 모바일 VoiceOver엔 부적합.
- (b) Vercel 대시보드 → webfortd 프로젝트 → Settings → Deployment Protection 일시 해제(테스트 후 복구). 계정 설정 변경이라 위원장 직접 수행.

### 3.1 로그인

`/chat`은 익명도 열리지만 **음성 대화는 로그인 필수**입니다. 헤더의 로그인으로 **engccer@gmail.com 매직링크**를 받아 로그인합니다(받아쓰기·텍스트 채팅과 동일 계정).

### 3.2 테스트 항목 (순서대로, 통과 ✅ / 미통과 ❌+현상)

| # | 무엇을 | 어떻게 | 기대 결과 |
|---|--------|--------|-----------|
| 1 | **세션 진입** | 로그인 상태에서 `/chat` → "실시간 음성 대화" 클릭 → 마이크 권한 허용 | 풀스크린 오버레이가 열리고 잠시 후 "듣고 있어요. 말씀해 주세요." 표시 |
| 2 | **RAG 응답 + 출처** | "장애인교원 편의지원 어떻게 신청해?" 발화 | "잠깐만요, 찾아볼게요" 류 짧은 멘트 후 제도·정책 근거 음성 답변 + 화면 하단 **출처 카드**(위키 링크). 끝에 "참고용…소속 교육청 확인" 류 안내 |
| 3 | **끼어들기(barge-in)** | 모델이 답하는 도중 새 질문 발화 | 모델 응답이 끊기고 새 발화를 다시 듣기 시작 |
| 4 | **스크린리더 알림** | VoiceOver(iOS)/TalkBack(Android)로 진행 | 상태 변화가 한국어로 읽힘("연결 중이에요" → "듣고 있어요" → "답하고 있어요" 등). transcript도 "나:" / "안내:" 접두로 구분 |
| 5 | **키보드** | (블루투스 키보드 등) `Esc` / `Space` | `Esc` → 오버레이 종료. `Space`(버튼 미포커스 시) → 음소거 토글. 종료/음소거 버튼에 포커스 두고 `Space`/`Enter` → 그 버튼 동작(음소거가 아니라) |
| 6 | **비로그인 안내(한국어)** | 로그아웃 → `/chat` → "실시간 음성 대화" 클릭 | 오버레이가 **한국어**로 "로그인이 필요해요. 음성 대화는 로그인한 뒤 이용할 수 있어요." 표시 (영어 "Authentication required" 가 보이면 ❌) |
| 7 | **출처 링크 새 탭** | (로그인 상태, 답변 후) 출처 카드 링크 활성화 | **새 탭**에서 위키 페이지가 열리고, 원래 탭의 음성 세션은 끊기지 않음 |
| 8 | **마이크 권한 거부** | 1번에서 권한을 **거부**해 본다 | "마이크 권한이 필요해요. 브라우저에서 마이크 사용을 허용해 주세요." 한국어 안내 |

### 3.3 결과 회신

각 항목 ✅/❌ + ❌면 들린/보인 현상을 메모해 알려주시면, 머지 전이면 `feat/live-voice-chat`에서 바로 수정하고 머지 후면 follow-up PR로 처리합니다.

---

## 4. 비용 메모

| 항목 | 내용 |
|------|------|
| 비용 특성 | Live native audio는 텍스트 채팅 대비 분당 비용이 큼 |
| 1차 통제 | 로그인 게이트 — `/api/voice/session`은 미인증 요청에 HTTP 401 반환 |
| 세션 cap | 현재 **미적용(YAGNI)** — 남용 관측 시 추가 |
| 모니터링 | Vercel function logs: `vercel logs --since 1d` |
| 향후 트리거 | 월간 세션 수가 예상 범위(시범 단계 50세션/월)를 초과하면 max_duration 제한 도입 검토 |
