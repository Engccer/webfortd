/**
 * W3C Audio Session API 헬퍼.
 *
 * iOS Safari는 기본적으로 Web Audio 출력을 "일반 미디어"로 분류해서
 * VoiceOver 효과음 / 볼륨 HUD chime / 시스템 알림이 울릴 때 우리 음성을
 * ducking(자동 음량 감소)한다. 시각장애 사용자가 여행 중 공공장소에서
 * 양방향 음성 대화를 사용하는 워크플로우에서는 응답 음성이 빈번하게
 * 줄어드는 문제가 보고됐다.
 *
 * `navigator.audioSession.type = "play-and-record"` 를 명시하면 iOS는 이를
 * 통화/음성 채팅 컨텍스트로 처리해 시스템 사운드의 ducking이 거의 발생하지
 * 않는다. 음성 대화 종료 시에는 반드시 `"auto"`로 복원해 다른 미디어
 * (피드 영상 등)가 정상 ducking 정책을 받도록 한다.
 *
 * 표준: https://www.w3.org/TR/audio-session/
 * 지원: Safari 16.4+, 일부 Chrome 빌드 (미지원 환경에서는 무해한 no-op)
 */

type AudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

interface AudioSessionLike {
  type: AudioSessionType;
}

function getAudioSession(): AudioSessionLike | null {
  if (typeof navigator === "undefined") return null;
  const ns = navigator as unknown as { audioSession?: AudioSessionLike };
  return ns.audioSession ?? null;
}

/** 음성 대화 시작 시 호출 — `play-and-record`로 전환해 OS의 시스템 사운드
 * ducking 우선순위를 통화 수준으로 낮춘다. */
export function setVoiceCallSession(): void {
  const session = getAudioSession();
  if (!session) return;
  try {
    session.type = "play-and-record";
  } catch {
    // 일부 환경/브라우저에서 setter가 throw할 수 있음 — 무시 (no-op)
  }
}

/** 음성 대화 종료 시 호출 — 기본값(`auto`)로 복원해 다른 미디어가 정상
 * ducking 정책을 받도록 한다. */
export function restoreAudioSession(): void {
  const session = getAudioSession();
  if (!session) return;
  try {
    session.type = "auto";
  } catch {
    // ignore
  }
}
