"use client";

import { useState, useRef, useCallback } from "react";
import { arrayBufferToBase64 } from "@/lib/voice/pcm-base64";

interface UseAudioIOReturn {
  /** 사용자 제스처(클릭) 체인 내에서 호출 — AudioContext를 미리 생성/resume (iOS/Chrome 필수) */
  warmup: () => Promise<void>;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  enqueuePlayback: (pcmData: ArrayBuffer) => void;
  flushPlayback: () => void;
  /** 소프트 flush: 버퍼를 즉시 비우지 않고 최대 150ms만 남기고 나머지 삭제 */
  softFlush: () => void;
  isCapturing: boolean;
  /** PCM 청크 콜백 — (base64, peakLevel 0..1) 바지인 감지 가능 */
  onPcmData: React.MutableRefObject<((base64: string, peakLevel: number) => void) | null>;
  /** 재생 큐가 비고 grace period가 경과한 시점에 호출 (워클릿의 playbackEnded 메시지) */
  onPlaybackEnded: React.MutableRefObject<(() => void) | null>;
  /** 현재까지 enqueue된 PCM을 모두 재생했을 때의 Date.now() 추정치.
   * softFlush 시 최대 150ms로 축소, flush 시 0으로 초기화. 재생 진행 상황을 나타내는
   * 데이터 기반 타임라인으로, 워클릿의 playbackEnded 메시지 없이도 게이팅 로직에
   * 활용할 수 있다. */
  playbackEndAt: React.MutableRefObject<number>;
  cleanup: () => void;
}

/** AudioContext를 생성하고 resume하여 running 상태로 만듦 */
async function createAndResumeCtx(): Promise<AudioContext> {
  const ctx = new AudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

/** 기존 AudioContext가 유효하면 resume, 아니면 새로 생성 */
async function ensureRunningCtx(
  ref: React.MutableRefObject<AudioContext | null>
): Promise<AudioContext> {
  const existing = ref.current;
  if (existing && existing.state !== "closed") {
    if (existing.state === "suspended") await existing.resume();
    return existing;
  }
  const ctx = await createAndResumeCtx();
  ref.current = ctx;
  return ctx;
}

/**
 * 오디오 입출력 관리 훅
 * - 캡처: 마이크 → PCM 16kHz Int16 → base64
 * - 재생: PCM 24kHz Int16 → 스피커
 *
 * ⚠️ iOS Safari / Chrome Autoplay Policy 대응:
 *   반드시 사용자 제스처(클릭) 체인 내에서 warmup()을 호출해야
 *   AudioContext가 suspended 상태에 빠지지 않습니다.
 */
export function useAudioIO(): UseAudioIOReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const isCapturingRef = useRef(false); // 클로저 안전 가드 (state보다 즉시 갱신)

  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onPcmData = useRef<((base64: string, peakLevel: number) => void) | null>(null);
  const onPlaybackEnded = useRef<(() => void) | null>(null);
  /** 재생 큐 전체가 소진될 예정 시각 (Date.now 기준). 청크 enqueue 시 duration 누적,
   * softFlush 시 now + 150ms로 축소, flush 시 0으로 초기화. */
  const playbackEndAt = useRef<number>(0);
  /** 마지막 enqueuePlayback 호출 시각. worklet의 playbackEnded 메시지가 stale인지
   * 판정하는 데 사용 (최근 enqueue가 있으면 playbackEnded는 이전 재생분에 대한 것이므로
   * playbackEndAt을 clamp하지 않음). */
  const lastEnqueueAt = useRef<number>(0);
  // 재생 AudioContext의 sampleRate (재생 duration 계산용)
  const PLAYBACK_SAMPLE_RATE = 24000;

  /** 재생용 AudioContext — 24kHz 고정 (Gemini 출력과 일치, 리샘플링 불필요)
   * 브라우저가 24kHz→하드웨어 출력 변환을 내부적으로 처리 */
  const ensurePlaybackRunningCtx = useCallback(async (): Promise<AudioContext> => {
    const existing = playbackCtxRef.current;
    if (existing && existing.state !== "closed") {
      if (existing.state === "suspended") await existing.resume();
      return existing;
    }
    const ctx = new AudioContext({ sampleRate: 24000 });
    if (ctx.state === "suspended") await ctx.resume();
    playbackCtxRef.current = ctx;
    return ctx;
  }, []);

  /**
   * AudioContext 사전 초기화 — 사용자 제스처(클릭) 체인 내에서 호출 필수!
   * iOS Safari는 사용자 제스처 밖에서 생성된 AudioContext를 영구 suspended 시킴.
   * Chrome도 Autoplay Policy로 동일 제약.
   */
  const warmup = useCallback(async () => {
    await ensureRunningCtx(captureCtxRef);
    await ensurePlaybackRunningCtx();
  }, []);

  /** 마이크 캡처 시작 */
  const startCapture = useCallback(async () => {
    if (isCapturingRef.current) return;
    // 즉시 가드 설정 — await 전에 설정해야 동시 호출 방지 (재연결 시 이중 호출 가능)
    isCapturingRef.current = true;

    try {
    // 마이크 스트림 획득 (sampleRate 제약 제거 — iOS Safari 비호환)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
    streamRef.current = stream;

    // warmup에서 생성된 AudioContext 재사용, 없으면 새로 생성 + resume
    // (sampleRate 지정 안 함 — iOS 무시함. Worklet이 device→16kHz 리샘플링 처리)
    const captureCtx = await ensureRunningCtx(captureCtxRef);

    // Worklet 등록 (이미 등록된 경우 무시됨)
    try {
      await captureCtx.audioWorklet.addModule("/worklets/pcm-capture-processor.js");
    } catch {
      // DOMException: already registered — 재연결 시 정상
    }
    const captureNode = new AudioWorkletNode(captureCtx, "pcm-capture-processor");
    captureNodeRef.current = captureNode;

    // PCM 데이터 수신 콜백 — 피크 레벨 계산 (바지인 감지용)
    captureNode.port.onmessage = (e) => {
      if (e.data.type === "pcm" && onPcmData.current) {
        const int16 = new Int16Array(e.data.data);
        let peak = 0;
        for (let i = 0; i < int16.length; i++) {
          const abs = int16[i] < 0 ? -int16[i] : int16[i];
          if (abs > peak) peak = abs;
        }
        const peakLevel = peak / 32768; // 0..1
        const base64 = arrayBufferToBase64(e.data.data);
        onPcmData.current(base64, peakLevel);
      }
    };

    // 마이크 → captureNode 연결
    const source = captureCtx.createMediaStreamSource(stream);
    source.connect(captureNode);
    captureNode.connect(captureCtx.destination); // output 연결 필요 (process 호출용)

    setIsCapturing(true);
    } catch (err) {
      // 가드 해제 — 다음 시도에서 재진입 가능하도록
      isCapturingRef.current = false;
      throw err;
    }
  }, []);

  /** 마이크 캡처 중지 (AudioContext는 닫지 않음 — 재연결 시 재사용) */
  const stopCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    captureNodeRef.current?.disconnect();
    captureNodeRef.current = null;

    isCapturingRef.current = false;
    setIsCapturing(false);
  }, []);

  /** 재생용 AudioContext + Worklet 초기화 */
  const ensurePlaybackCtx = useCallback(async () => {
    const ctx = await ensurePlaybackRunningCtx();

    // 이미 playbackNode가 있으면 스킵
    if (playbackNodeRef.current) return;

    try {
      await ctx.audioWorklet.addModule("/worklets/pcm-playback-processor.js");
    } catch {
      // already registered
    }
    const playbackNode = new AudioWorkletNode(ctx, "pcm-playback-processor");
    playbackNodeRef.current = playbackNode;
    playbackNode.port.onmessage = (e) => {
      if (e.data?.type === "playbackEnded") {
        // duration 기반 추정이 과추정일 수 있는 경우(워클릿 큐 capacity drop, 기타)를
        // 대비해 실제 재생 종료 시각으로 clamp. 단, 최근 300ms 내에 새 청크가 enqueue된
        // 경우에는 이 playbackEnded가 **이전 재생분**에 대한 stale 메시지이므로(메시지
        // 전달 지연 중에 새 재생이 시작됨) clamp를 건너뛴다. 그렇지 않으면 새 재생의
        // playbackEndAt이 과거로 잘려 게이트가 잘못 열릴 수 있다.
        const now = Date.now();
        const STALE_MESSAGE_WINDOW_MS = 300;
        const recentEnqueue = now - lastEnqueueAt.current < STALE_MESSAGE_WINDOW_MS;
        if (!recentEnqueue && playbackEndAt.current > now) {
          playbackEndAt.current = now;
        }
        if (onPlaybackEnded.current) {
          onPlaybackEnded.current();
        }
      }
    };
    playbackNode.connect(ctx.destination);
  }, []);

  /** PCM 청크를 재생 큐에 추가 — 실제 postMessage가 성공한 뒤에만 playbackEndAt과
   * lastEnqueueAt을 갱신한다. ensurePlaybackCtx가 실패하거나 노드가 null이면 청크는
   * 재생되지 않으므로 타임라인을 전진시키지 않아야 함 (실제 재생 없이 마이크 게이트가
   * 닫히는 것 방지). 레퍼런스 live-api-web-console도 source.start() 호출 이후에만
   * scheduledTime을 갱신하는 동일 원칙을 따름.
   * Int16 samples / 24000Hz = 실제 재생 시간(초). 이전 end 이후에 이어 붙이되,
   * 이전 end가 과거면 now부터 시작 (gap이 있었던 경우). */
  const enqueuePlayback = useCallback(
    (pcmData: ArrayBuffer) => {
      const samples = pcmData.byteLength / 2; // Int16Array
      const durationMs = (samples / PLAYBACK_SAMPLE_RATE) * 1000;

      ensurePlaybackCtx()
        .then(() => {
          const node = playbackNodeRef.current;
          if (!node) return; // 실제 재생 불가 — 타임라인 갱신 없이 드롭

          // postMessage가 먼저 성공해야 타임라인을 전진. postMessage가 throw하면
          // 아래 갱신 라인은 실행되지 않고 catch로 빠져 playbackEndAt은 불변.
          node.port.postMessage({ type: "pcm", data: pcmData }, [pcmData]);
          const now = Date.now();
          const start = Math.max(now, playbackEndAt.current);
          playbackEndAt.current = start + durationMs;
          lastEnqueueAt.current = now;
        })
        .catch((err) => {
          console.warn("Playback context unavailable:", err);
          // playbackEndAt / lastEnqueueAt 미갱신 — 실제 재생 없으니 게이트 닫히지 않음
        });
    },
    [ensurePlaybackCtx]
  );

  /** 재생 버퍼 플러시 (전체 삭제) */
  const flushPlayback = useCallback(() => {
    playbackNodeRef.current?.port.postMessage({ type: "flush" });
    playbackEndAt.current = 0;
  }, []);

  /** 소프트 flush: 버퍼의 최대 150ms만 남기고 나머지 삭제
   * → 에코 오인 시 씹힘 최소화, 바지인 시 빠른 응답.
   * 워클릿과 동일하게 남는 150ms에 맞춰 playbackEndAt도 축소. */
  const softFlush = useCallback(() => {
    playbackNodeRef.current?.port.postMessage({ type: "softFlush" });
    const cap = Date.now() + 150;
    if (playbackEndAt.current > cap) {
      playbackEndAt.current = cap;
    }
  }, []);

  /** 전체 정리 */
  const cleanup = useCallback(() => {
    stopCapture();

    playbackNodeRef.current?.disconnect();
    playbackNodeRef.current = null;

    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;

    captureCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;

    playbackEndAt.current = 0;
    lastEnqueueAt.current = 0;
  }, [stopCapture]);

  return {
    warmup,
    startCapture,
    stopCapture,
    enqueuePlayback,
    flushPlayback,
    softFlush,
    isCapturing,
    onPcmData,
    onPlaybackEnded,
    playbackEndAt,
    cleanup,
  };
}
