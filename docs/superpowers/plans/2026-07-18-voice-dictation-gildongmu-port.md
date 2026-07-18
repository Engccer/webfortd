# 음성 받아쓰기 gildongmu 이식 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹 받아쓰기를 gildongmu 수준(효과음·견고화·단일 권한 경로)으로 전면 개선하고, iOS 앱 채팅에 온디바이스 받아쓰기를 신설한다.

**Architecture:** 웹은 gildongmu의 톤 합성 스택(tones → useTonePlayer → useRecordingSound)과 코드 기반 오류 계약(useVoiceRecorder → VoiceRecordButton 한국어 맵 → ChatUI role=alert)으로 교체. iOS는 gildongmu SpeechService(iOS 26 SpeechAnalyzer 온디바이스, ko-KR)를 앱 타깃에 그대로 이식해 ChatView inputBar에 토글 버튼을 단다.

**Tech Stack:** Next.js 16 / React 19 / Web Audio / Deepgram Nova-2(기존 유지) / SwiftUI + SpeechAnalyzer(iOS 26)

## Global Constraints

- spec: `docs/superpowers/specs/2026-07-18-voice-dictation-gildongmu-port-design.md`
- 웹 코드 스타일: 단일 인용부호·세미콜론 없음(webfortd 기존 관례) — gildongmu 원본(더블 인용·세미콜론)을 변환해 이식
- maxDuration 120초·한국어 단일 로케일·엔드포인트 `/api/transcribe` 유지
- 접근성 헌장: disabled 금지(aria-disabled), 44px 타깃, polite 단일 announcer, 오류는 부모 role=alert 단일 채널
- iOS: WebfortdKit 무의존 원칙 — SpeechService는 앱 타깃(`ios/Webfortd/Chat/`) 배치
- 커밋: pathspec 명시(`git add <경로>` + `git commit -- <경로>`), `git add -A` 금지

---

### Task 1: 톤 데이터 + 테스트 (웹)

**Files:**
- Create: `src/lib/tones.ts`, `src/lib/recording-tones.ts`
- Test: `tests/lib/recording-tones.test.ts` (node:test)

**Interfaces:**
- Produces: `Tone { freq, start, dur }`, `START_TONES/STOP_TONES/CANCEL_TONES: Tone[]`

- [ ] gildongmu `src/lib/tones.ts`·`src/lib/recording-tones.ts`를 webfortd 스타일로 이식(내용 동일: 시작 660→990 상승, 정지 990→660 하강, 취소 440 단음)
- [ ] `tests/lib/recording-tones.test.ts`: gildongmu vitest 테스트를 node:test+assert로 이식(상승·하강·단음·양수 invariant 4건)
- [ ] `npm test` 통과 확인 후 pathspec 커밋

### Task 2: 톤 플레이어 훅 (웹)

**Files:**
- Create: `src/hooks/useTonePlayer.ts`, `src/hooks/useRecordingSound.ts`

**Interfaces:**
- Consumes: Task 1의 `Tone`, 톤 시퀀스 3종
- Produces: `useTonePlayer(): { play(tones: Tone[]): void }`, `useRecordingSound(): { playStart, playStop, playCancel }`

- [ ] gildongmu 판 이식: lazy AudioContext(첫 재생=사용자 제스처 이후), closed-state 가드, suspended resume, sine + 12ms attack/release 게인 램프, 실패 시 graceful no-op
- [ ] lint 통과 확인 후 pathspec 커밋

### Task 3: useVoiceRecorder 교체 (웹)

**Files:**
- Modify: `src/hooks/useVoiceRecorder.ts` (전면 교체)

**Interfaces:**
- Produces: `VoiceRecorderErrorCode = 'mic_denied'|'mic_failed'|'no_audio'|'too_short'|'no_text'|'stt_failed'`, `startRecording(): Promise<boolean>`, `onError?: (code) => void`

- [ ] gildongmu 판 기반 교체: useSyncExternalStore 지원 감지, busyRef 더블탭 잠금, mountedRef 언마운트 가드(getUserMedia 대기 중 언마운트 시 트랙 즉시 정리), AbortController STT 취소, onstop/ondataavailable 해제, stopRecordingRef 순환 우회, ms 기준 300ms 최소 길이. webfortd 적응: 엔드포인트 `/api/transcribe`, locale 필드 제거, maxDuration 기본 120, 422→`no_text` 매핑
- [ ] pathspec 커밋 (다음 Task와 함께 가능)

### Task 4: transcribe 422 정합 (웹)

**Files:**
- Modify: `src/app/api/transcribe/route.ts` (no-transcript 400→422)

- [ ] `if (!alternative?.transcript)` 분기를 status 422로 변경(전용 json422 헬퍼 또는 status 인자화)
- [ ] pathspec 커밋

### Task 5: VoiceRecordButton 교체 + 권한 모달 삭제 (웹)

**Files:**
- Modify: `src/components/chat/VoiceRecordButton.tsx` (전면 교체)
- Delete: `src/components/chat/MicrophonePermissionPrompt.tsx`, `src/hooks/useMicrophonePermission.ts`
- Test: `tests/components/chat/voice-record-button.test.tsx` (전면 갱신)

**Interfaces:**
- Consumes: Task 2 `useRecordingSound`, Task 3 코드 계약
- Produces: `VoiceRecordButton({ onTranscribed, onError?: (message: string) => void, disabled? })` — ChatUI 배선 무변경. `VOICE_ERROR_MESSAGES: Record<VoiceRecorderErrorCode, string>` export(테스트용)

- [ ] spec §트랙 1 그대로: 효과음+라벨 변화(시작/정지 음성 안내 제거), 시작 성공 후에만 playStart+버튼 재포커스, Esc는 playCancel+announce 병행(`e.isComposing` 무시), polite announcer는 마일스톤 2건+자동 정지+성공 통지 전용, 오류는 코드→`VOICE_ERROR_MESSAGES` 번역 후 onError(문자열)로만, 120초 타이머 배지 유지, aria-disabled 패턴 유지
- [ ] 권한 모달·훅 삭제(`git rm`), import 잔존 검색으로 무참조 확인
- [ ] 컴포넌트 테스트 갱신: 미지원 라벨+aria-disabled / disabled prop / polite announcer / VOICE_ERROR_MESSAGES 6코드 완전성 / dialog 부재 테스트 제거
- [ ] `npm run test:components` 통과 후 pathspec 커밋

### Task 6: iOS SpeechService + ChatView (iOS)

**Files:**
- Create: `ios/Webfortd/Chat/SpeechService.swift` (gildongmu 판 그대로)
- Modify: `ios/Webfortd/Chat/ChatView.swift` (mic 버튼·toggleMic·alert·onDisappear)
- Modify: `ios/Webfortd.xcodeproj/project.pbxproj` (INFOPLIST_KEY_NSMicrophoneUsageDescription, Debug/Release 양쪽)

- [ ] SpeechService.swift 이식(수정 0 — `@Sendable` 탭 가드·MicBufferForwarder 포함)
- [ ] ChatView: `@State private var speech = SpeechService()`, inputBar TextField와 전송 버튼 사이 마이크 버튼(라벨 "음성 입력"↔"입력 중지", iconOnly, 44pt), `toggleMic()` append(`inputText.isEmpty ? text : inputText + " " + text`), body에 denied/failed alert + `speech.reset()`, `.onDisappear { Task { await speech.cancel() } }`
- [ ] pbxproj: `INFOPLIST_KEY_NSMicrophoneUsageDescription = "질문을 음성으로 입력하기 위해 마이크를 사용합니다.";`
- [ ] 시뮬레이터 빌드 통과 후 pathspec 커밋

### Task 7: 통합 검증 + 문서

- [ ] `npm test` / `npm run test:components` / `npm run lint` / `npm run build` 전부 통과
- [ ] `xcodebuild -project ios/Webfortd.xcodeproj -scheme Webfortd -destination 'platform=iOS Simulator,name=iPhone 17' build` 통과
- [ ] PROGRESS.md 갱신(받아쓰기 트랙 완료 + 위원장 실기기·실마이크 스모크 잔여 명시)
- [ ] code-reviewer 서브에이전트 리뷰 → fix 반영
- [ ] push + `gh pr create` + squash merge + 기기 연결 시 `ios/deploy-device.sh`
