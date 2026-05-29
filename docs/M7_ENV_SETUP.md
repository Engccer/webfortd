# Phase 3 M7 환경변수 등록 가이드

> M7(파일 첨부 + 음성 받아쓰기) 머지 직전 위원장 명시 액션. 환경변수 2개를 Vercel·로컬 양쪽에 등록한다.

## 신규 환경변수

| 변수 | 용도 | 발급처 | 무료 tier |
|---|---|---|---|
| `DEEPGRAM_API_KEY` | 음성 받아쓰기 (Nova-2 STT) | https://console.deepgram.com | $200 크레딧, 시범 단계 충분 |
| `UPSTAGE_API_KEY` | HWP/HWPX 파싱 (Document Parse) | https://console.upstage.ai | 위원장 보유 키 재사용 가능 |

## 등록 절차

### 1. Deepgram 발급 (신규)

1. https://console.deepgram.com 가입 (Google 로그인 가능)
2. **Sign Up** 후 자동 발급된 API Key 또는 **API Keys → Create a New API Key**
3. 권한: **Member** (기본). 키 이름: `webfortd-prod`
4. 키 값 복사 (한 번만 노출됨)

### 2. Vercel Dashboard 등록

```
https://vercel.com/khudt-s-projects/webfortd/settings/environment-variables
```

1. **Add New** → Key: `DEEPGRAM_API_KEY`, Value: (1번에서 복사한 값)
2. Environments: **Production** + **Preview** 모두 체크
3. Save
4. 동일 절차로 `UPSTAGE_API_KEY` (위원장 보유 키 사용)

### 3. 로컬 동기화

webfortd 디렉터리에서:

```bash
vercel env pull .env.local --yes
```

KHUDT 토큰(direnv)이 자동 export되어 본인 프로젝트 env만 받음.

### 4. 확인

```bash
grep -E "DEEPGRAM|UPSTAGE" .env.local
# 두 줄이 채워져 있어야 함
```

## 검증 (선택, 위원장 명시 후)

### Deepgram 음성 smoke

```bash
# 1. 짧은 한국어 webm 녹음 파일 준비
ls tests/api/fixtures/sample-ko.webm

# 2. RUN_SMOKE=1로 실 API 호출
RUN_SMOKE=1 npm test -- transcribe.smoke
```

### Upstage 문서 smoke

```bash
# 1. HWPX 정책 문서 fixture 배치
ls tests/api/fixtures/sample.hwpx

# 2. RUN_SMOKE=1로 실 API 호출
RUN_SMOKE=1 npm test -- chat-attachment.smoke
```

## 비용 가드 (spec §7)

시범 단계 월 100건 채팅 + 10건 음성 + 5건 첨부 = 약 **$0.64/월**.

본격 단계 월 1000건 채팅 + 100건 음성 + 50건 첨부 = 약 **$6.40/월**.

운영 모니터링:
- Deepgram dashboard usage 페이지
- Upstage dashboard usage 페이지
- Vercel function logs (`vercel logs --since 1d`)

## PIPA 정합 (spec §5)

- 음성/파일 데이터는 서버 메모리에서 외부 API 호출 후 즉시 폐기 (디스크 0, DB 0)
- 로그: 길이·confidence만 (transcript 본문 X, file 본문 X)
- 사용자 안내 카피: MicrophonePermissionPrompt 모달 + AttachmentChip 본문에 "외부 서비스 전송 + 처리 후 즉시 폐기" 명시
