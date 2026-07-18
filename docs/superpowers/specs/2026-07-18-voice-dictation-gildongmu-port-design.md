# 음성 받아쓰기 gildongmu 이식 설계 (웹 전면 개선 + iOS 신설)

- 일자: 2026-07-18
- 승인: 위원장 ("둘 다" + "전면 gildongmu화" + append·마일스톤 유지 2건 포함 전체 승인, 이후 자율 진행 위임)
- 배경: gildongmu의 음성 받아쓰기가 웹·iOS 모두에서 매끄럽게 작동 중. webfortd 웹 받아쓰기(M7.1, dodo-planet 계열)는 production 작동하나 ① 효과음 훅이 무음 no-op ② 권한 사전 모달 이중 경로 ③ 훅 견고화 부재로 UX가 뒤떨어지고, iOS 앱 채팅에는 받아쓰기가 아예 없다(M5 라이브 음성만 보류 상태 — 받아쓰기는 별개 기능).

## 트랙 1: 웹 — 받아쓰기 전면 gildongmu화

### 이식 (gildongmu → webfortd, 한국어 단일 로케일 적응)

| 파일 | 내용 |
|------|------|
| `src/lib/tones.ts` | Tone 타입(순수 데이터) |
| `src/lib/recording-tones.ts` | 상승음=시작·하강음=정지·단음=취소 시퀀스 |
| `src/hooks/useTonePlayer.ts` | Web Audio 합성 코어(lazy AudioContext, closed 가드) |
| `src/hooks/useRecordingSound.ts` | 녹음 도메인 바인딩(playStart/playStop/playCancel) |

### 교체

**`src/hooks/useVoiceRecorder.ts`** — gildongmu 판 기반 재작성:
- 오류는 `VoiceRecorderErrorCode` 코드로만 반환(mic_denied/mic_failed/no_audio/too_short/no_text/stt_failed) — 문자열 번역은 소비 컴포넌트 담당
- busyRef in-flight 잠금(더블탭 중복 getUserMedia 차단), mountedRef 언마운트 가드, AbortController STT fetch 취소, onstop/ondataavailable 핸들러 해제, getUserMedia 대기 중 언마운트 시 트랙 즉시 정리(마이크 누수 차단), `startRecording(): Promise<boolean>`(실제 시작 성공 반환), useSyncExternalStore 지원 감지(hydration-safe), stopRecordingRef 순환 참조 우회
- webfortd 유지: 엔드포인트 `/api/transcribe`, maxDuration 기본 120초, locale 파라미터 없음(서버 ko 강제), 최소 녹음 300ms(ms 기준)

**`src/components/chat/VoiceRecordButton.tsx`** — gildongmu 판 기반 + webfortd 유지분 병합:
- 시작/정지 음성 안내 제거 → 효과음 + aria-label 변화("음성으로 질문 시작"↔"녹음 정지")가 상태 신호(미니멀 접근성)
- 시작 성공 후에만 시작음(권한 실패 시 신호 역전 방지) + 버튼 명시 재포커스(getUserMedia 대기 중 SR 커서 이탈 복원)
- Esc 취소: 효과음 + 음성 통지 병행(전역 키·음소거 사각 대비), `e.isComposing` 무시(IME 충돌 방지)
- 오류: 코드→한국어 상수 맵 번역 후 ChatUI `voiceError`(role=alert) 단일 채널로만 전달 — 버튼 내 별도 assertive announcer 제거(이중 낭독 방지)
- **유지(gildongmu와 의도적 차이)**: 120초 시각 타이머 배지(aria-hidden), 마일스톤 안내 2건("1분이 지났어요"·"10초 후 자동으로 멈춰요") + 자동 정지 안내, 성공 시 "받아쓰기를 입력창에 추가했어요" — polite role=status announcer 1개로 통지(시간 정보는 라벨 변화로 전달 불가한 필수 정보이지 잉여가 아님)
- 미지원 브라우저: 비활성 버튼(aria-disabled) + MicOff 안내 유지

### 삭제

- `src/components/chat/MicrophonePermissionPrompt.tsx`, `src/hooks/useMicrophonePermission.ts` — 받아쓰기 전용(타 사용처 없음 확인). 권한은 getUserMedia 네이티브 프롬프트 단일 경로로 통일, NotAllowedError 기준 mic_denied/mic_failed 정확 분류(gildongmu "codex 잔여 #3" 교훈)

### 유지·소폭 수정

- `src/hooks/useSound.ts`: CopyButton 사용처가 있어 존치(VoiceRecordButton만 useRecordingSound로 전환)
- `src/app/api/transcribe/route.ts`: "음성을 인식할 수 없어요" 400 → **422**(훅의 no_text 분기 정합, gildongmu 계약 통일). 그 외(rate limit·Deepgram 파라미터) 무변경
- `src/components/chat/ChatUI.tsx`: onError 시그니처가 코드→메시지 문자열로 이미 번역된 값을 받으므로 배선 유지(append 동작 무변경)

### 테스트

- `tests/components/chat/voice-record-button.test.tsx` 전면 갱신(새 계약: 효과음 모킹·코드 기반 오류·재포커스)
- `tests/recording-tones.test.ts` 신설(node:test) — gildongmu 순수 데이터 테스트 이식(시작=상승·정지=하강·취소=단음 불변식)

## 트랙 2: iOS — 온디바이스 받아쓰기 신설

- `ios/Webfortd/Chat/SpeechService.swift`: gildongmu 판 그대로 이식 — iOS 26 SpeechAnalyzer + SpeechTranscriber(ko-KR 고정, 자동 언어 감지 금지), 시작·정지 소리+햅틱 이중 통지, `@Sendable` 탭 클로저(MainActor 격리 상속 시 SIGTRAP 크래시 — gildongmu 실기기 실측 가드), MicBufferForwarder 포맷 변환. **서버 왕복 0** — Deepgram 키·네트워크 불필요, "순수 API 클라이언트" 아키텍처 원칙과 무충돌. UIKit 의존(햅틱)이라 앱 타깃 배치(WebfortdKit 무의존 원칙 유지). pbxproj는 폴더 동기화라 파일 추가만으로 인식.
- `ios/Webfortd/Chat/ChatView.swift` inputBar: 마이크 버튼(라벨 "음성 입력"↔"입력 중지" 변화가 상태 신호, disabled 금지, 44pt), denied/failed alert + reset, 화면 이탈 시 `speech.cancel()`
- **gildongmu와 의도적 차이**: 전사 텍스트를 draft에 **append**(gildongmu는 대체) — 타이핑 초안 보존, webfortd 웹과 동형(`prev ? prev + " " + text : text`)
- `INFOPLIST_KEY_NSMicrophoneUsageDescription` = "질문을 음성으로 입력하기 위해 마이크를 사용합니다." (음성인식 권한 키는 온디바이스 SpeechAnalyzer에 불필요 — gildongmu 실증)

## 검증

- 웹: `npm test` + `npm run test:components` + `npm run lint` + `npm run build`. 실 마이크 스모크는 위원장 몫(효과음·재포커스·Esc 취소)
- iOS: `xcodebuild` iPhone 17 시뮬레이터 빌드. Kit 무수정(swift test 회귀 없음). 리뷰·커밋 후 기기 연결 시 `ios/deploy-device.sh` 실기기 배포(한 사이클 원칙)

## 명시적 비범위

- 라이브 음성(M5): 별개 트랙, dodo-planet Live 수정 후 이식(위원장 지시 유지)
- iOS partial 텍스트 실시간 표시: gildongmu ChatView도 미표시 — 정지 시 최종 텍스트만
- 분산 rate limit·magic bytes: PR #78 의도적 보류 그대로
