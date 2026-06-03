/**
 * Phase 7 — 바지인(끼어들기) 판정 순수 함수.
 * dodo useGeminiLive의 인라인 게이팅 로직을 추출해 회귀 테스트 가능화.
 * 글로벌 CLAUDE.md "Gemini Live 음성 씹힘" 교훈: 단일 프레임 스파이크(에코 transient)는
 * sustained로 인정하지 않고, 모델 재생 중에는 sustained 발화만 통과시킨다.
 */
export const BARGE_IN_THRESHOLD = 0.15
export const SUSTAINED_LOUD_FRAMES = 3
export const PLAYBACK_TAIL_MARGIN_MS = 200
export const INTERRUPTION_RECENT_SPEECH_MS = 500

/** 한 PCM 프레임 처리: 연속 큰소리 프레임 카운트 갱신 + sustained 여부. */
export function updateLoudFrames(
  prevCount: number,
  peakLevel: number,
): { count: number; sustained: boolean } {
  const count = peakLevel >= BARGE_IN_THRESHOLD ? prevCount + 1 : 0
  return { count, sustained: count >= SUSTAINED_LOUD_FRAMES }
}

/** 마이크 PCM을 서버로 보낼지 결정. mute거나, 모델 재생 중 sustained 아니면 차단. */
export function shouldSendAudio(args: {
  isMuted: boolean
  modelStillPlaying: boolean
  sustained: boolean
}): boolean {
  if (args.isMuted) return false
  if (args.modelStillPlaying && !args.sustained) return false
  return true
}

/** 서버 interrupted 메시지 수용 여부 — 최근 sustained 발화가 있었을 때만. */
export function shouldAcceptInterruption(msSinceLoud: number): boolean {
  return msSinceLoud < INTERRUPTION_RECENT_SPEECH_MS
}
