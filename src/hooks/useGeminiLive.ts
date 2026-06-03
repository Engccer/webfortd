"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioIO } from "./useAudioIO";
import { setVoiceCallSession, restoreAudioSession } from "@/lib/voice/audio-session";
import { base64ToArrayBuffer } from "@/lib/voice/pcm-base64";
import {
  updateLoudFrames,
  shouldSendAudio,
  shouldAcceptInterruption,
  PLAYBACK_TAIL_MARGIN_MS,
} from "@/lib/voice/barge-in";
import type { SourceRef } from "@/lib/voice/types";

export type LiveState =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "processing"
  | "reconnecting"
  | "error";

interface Transcript {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

interface FunctionStatus {
  name: string;
  status: "executing" | "done" | "error";
}

interface UseGeminiLiveReturn {
  state: LiveState;
  /** 사용자 제스처(클릭) 체인 내에서 호출 — AudioContext 사전 초기화 (iOS/Chrome 필수) */
  warmupAudio: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  isMuted: boolean;
  transcripts: Transcript[];
  functionStatus: FunctionStatus | null;
  errorMessage: string | null;
}

/**
 * useGeminiLive options — 호출 시 한 번만 전달, 콜백은 ref로 안정화.
 */
interface UseGeminiLiveOptions {
  /** search_policy 결과의 출처(sources)를 부모(오버레이)에 전달 — 인용 카드 표시용. */
  onSourceRefs?: (sources: SourceRef[]) => void;
}

/** 연결 타임아웃 (밀리초) — live.connect()가 무한 대기하는 것을 방지 */
const CONNECT_TIMEOUT_MS = 20_000;

/**
 * Gemini Live API 세션 관리 훅
 * - 서버에서 ephemeral token 발급 → 브라우저에서 직접 WebSocket 연결
 * - Function Calling은 서버 프록시 (/api/voice/execute)로 실행 (search_policy 단일 RAG 툴)
 */
export function useGeminiLive(options?: UseGeminiLiveOptions): UseGeminiLiveReturn {
  const [state, setState] = useState<LiveState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [functionStatus, setFunctionStatus] = useState<FunctionStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const resumeHandleRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMutedRef = useRef(false);
  // onSourceRefs를 ref로 안정화: connect/handleServerMessage가 useCallback으로
  // 메모이제이션되어 있어 매 렌더 새 함수 인스턴스가 와도 connect를 재구성하면 안 됨.
  const onSourceRefsRef = useRef<UseGeminiLiveOptions["onSourceRefs"]>(options?.onSourceRefs);
  useEffect(() => {
    onSourceRefsRef.current = options?.onSourceRefs;
  }, [options?.onSourceRefs]);
  // 연속으로 임계치 이상 피크가 유지된 프레임 수 (40ms 프레임 기준)
  // 단일 프레임 스파이크는 에코 transient일 가능성이 높으므로, 실제 사용자 발화는
  // 여러 프레임에 걸쳐 유지되어야 한다는 판정 기준으로 사용.
  const consecutiveLoudFramesRef = useRef(0);
  // 마지막으로 **연속 N프레임 이상** 유지된 고피크가 관측된 시각 (sustained user speech).
  // interrupted가 도착했을 때 진짜 바지인인지 판단하는 근거. 단일 프레임으로는
  // 갱신하지 않아, 피크가 임계치를 뚫는 에코 transient가 자가 승인되는 현상을 방지.
  const lastLoudAudioAtRef = useRef(0);
  // 비동기 레이스 방지: disconnect/unmount 후 비동기 작업이 상태를 변경하지 않도록
  const disposedRef = useRef(false);
  // 타이머 정리용 ref
  const functionStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audio = useAudioIO();

  // isMuted를 ref에도 동기화 (콜백 내에서 최신값 참조)
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  /** 모든 타이머 정리 */
  const clearTimers = useCallback(() => {
    if (functionStatusTimerRef.current) {
      clearTimeout(functionStatusTimerRef.current);
      functionStatusTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /** 트랜스크립트 추가 */
  const addTranscript = useCallback((role: "user" | "model", text: string) => {
    if (!text.trim()) return;
    setTranscripts((prev) => {
      // 같은 role의 마지막 항목에 이어붙이기 (스트리밍)
      const last = prev[prev.length - 1];
      if (last && last.role === role && Date.now() - last.timestamp < 3000) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { role, text, timestamp: Date.now() }];
    });
  }, []);

  /** search_policy 실행 프록시 호출 (/api/voice/execute) */
  const executeSearchPolicy = useCallback(
    async (query: string, signal: AbortSignal): Promise<unknown> => {
      const res = await fetch("/api/voice/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "search_policy", args: { query } }),
        signal,
      });
      if (!res.ok) throw new Error(`search_policy failed: ${res.status}`);
      return res.json();
    },
    []
  );

  /** 연결 — 외부에서 disposedRef를 먼저 false로 설정해야 함 (reconnect 안전성) */
  const connect = useCallback(
    async () => {
      // disposed 체크: disconnect 후 goAway 타이머가 지연 호출할 수 있으므로 방어
      if (disposedRef.current) return;
      setErrorMessage(null);
      setTranscripts([]);
      setState("connecting");

      try {
        // 1. 서버에서 ephemeral token 발급
        const sessionRes = await fetch("/api/voice/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeHandle: resumeHandleRef.current || undefined,
          }),
        });

        // 비동기 작업 중 dispose 확인
        if (disposedRef.current) return;

        if (!sessionRes.ok) {
          const err = await sessionRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create session");
        }

        const { token, model } = await sessionRes.json();

        // 2. 브라우저에서 직접 Gemini Live API 연결
        const { GoogleGenAI } = await import("@google/genai");
        if (disposedRef.current) return;

        const clientAi = new GoogleGenAI({
          apiKey: token,
          httpOptions: { apiVersion: "v1alpha" },
        });

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // session resumption handle은 서버 토큰에 포함됨 → client config에서 제거
        // 연결 타임아웃 — live.connect()가 무한 대기하는 것을 방지
        const connectPromise = clientAi.live.connect({
          model,
          callbacks: {
            onopen: () => {
              if (disposedRef.current) return;
              setState("connected");
              // 마이크 캡처 시작 (.catch 필수 — 실패 시 state 복구)
              audio.startCapture().then(() => {
                if (!disposedRef.current) {
                  setState("listening");
                }
              }).catch((err) => {
                if (disposedRef.current) return;
                console.error("Audio capture failed:", err);
                setErrorMessage(
                  err instanceof Error && err.name === "NotAllowedError"
                    ? "Microphone permission denied"
                    : "Failed to start audio capture"
                );
                setState("error");
              });
            },
            onmessage: (message) => {
              if (disposedRef.current) return;
              handleServerMessage(message);
            },
            onerror: (e) => {
              if (disposedRef.current) return;
              console.error("Live API error:", e);
              audio.stopCapture();
              setErrorMessage("Connection error");
              setState("error");
            },
            onclose: () => {
              if (!disposedRef.current) {
                // 마이크 캡처 정리 — 연결 종료 시 자동으로 멈추지 않으면 리소스 누수
                audio.stopCapture();
                setState((prev) => (prev !== "idle" ? "idle" : prev));
              }
            },
          },
          // resumeHandle은 서버 토큰의 sessionResumption에 포함됨 (lockAdditionalFields 미사용 시 모든 필드 잠금)
        });

        // 타임아웃 레이스 — 연결이 무한 대기하면 에러로 전환
        let connectTimeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<never>((_, reject) => {
          connectTimeoutId = setTimeout(() => reject(new Error("Connection timeout")), CONNECT_TIMEOUT_MS);
        });
        let session;
        try {
          session = await Promise.race([connectPromise, timeoutPromise]);
        } finally {
          clearTimeout(connectTimeoutId!);
        }

        if (disposedRef.current) {
          // connect 도중에 dispose된 경우 즉시 정리
          try { session.close(); } catch { /* ignore */ }
          return;
        }

        sessionRef.current = session;

        // 오디오 데이터 → Gemini로 전송
        // 게이팅 규칙 (barge-in.ts 순수 함수로 추출):
        //   1) "모델이 말하는 중" 판정은 **실제 재생 종료 예정 시각**(audio.playbackEndAt)
        //      기준. 청크 수신 시각이 아니라 각 청크의 재생 duration을 누적해 산정하므로,
        //      빠른 버스트로 도착하고 천천히 재생되는 경우에도 정확. PLAYBACK_TAIL_MARGIN_MS는
        //      스피커 하드웨어 지연 및 잔여 에코를 덮는다.
        //   2) 말하는 중이면 sustained 사용자 발화만 통과 (updateLoudFrames + shouldSendAudio).
        //      단일 프레임 스파이크는 에코 transient로 간주해 차단.
        //   3) lastLoudAudioAtRef도 sustained 조건 충족 시에만 갱신 → interrupted 수용
        //      판정이 "임계치를 뚫은 프레임 자체"로 자가 승인되는 것을 방지.
        audio.onPcmData.current = (base64: string, peakLevel: number) => {
          if (isMutedRef.current || !sessionRef.current || disposedRef.current) return;
          const { count, sustained } = updateLoudFrames(consecutiveLoudFramesRef.current, peakLevel);
          consecutiveLoudFramesRef.current = count;
          if (sustained) lastLoudAudioAtRef.current = Date.now();
          const modelStillPlaying = Date.now() < audio.playbackEndAt.current + PLAYBACK_TAIL_MARGIN_MS;
          if (!shouldSendAudio({ isMuted: isMutedRef.current, modelStillPlaying, sustained })) return;
          try {
            sessionRef.current.sendRealtimeInput({ audio: { data: base64, mimeType: "audio/pcm;rate=16000" } });
          } catch { /* 연결 끊김 무시 */ }
        };
      } catch (error) {
        if (disposedRef.current) return;
        console.error("Live connect error:", error);
        setErrorMessage(error instanceof Error ? error.message : "Connection failed");
        setState("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audio.startCapture]
  );

  /** 서버 메시지 처리 */
  const handleServerMessage = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (message: any) => {
      // 오디오 응답 — enqueuePlayback이 audio.playbackEndAt을 자동으로 연장하므로
      // 별도 플래그/ref가 필요 없다. 재생이 진행되는 동안 게이트는 닫힌 상태를 유지하고,
      // 모든 청크가 재생 완료된 뒤 PLAYBACK_TAIL_MARGIN_MS가 경과하면 스스로 열린다.
      if (message.serverContent?.modelTurn?.parts) {
        let audioChunkCount = 0;
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            setState("speaking");
            const pcmBuffer = base64ToArrayBuffer(part.inlineData.data);
            audio.enqueuePlayback(pcmBuffer);
            audioChunkCount++;
          }
        }
        if (audioChunkCount > 0 && process.env.NODE_ENV !== "production") {
          console.debug("[voice] audio chunk", { count: audioChunkCount });
        }
      }

      // 모델 턴 완료 — UI 상태만 전환. 마이크 게이트는 playbackEndAt 기반으로 스스로
      // 경과하므로 별도 타이머 불필요.
      if (message.serverContent?.turnComplete) {
        setState("listening");
        if (process.env.NODE_ENV !== "production") {
          console.debug("[voice] turn complete");
        }
      }

      // 사용자 입력 인터럽션 (바지인)
      // 레벨 게이팅을 뚫고 에코가 서버에 도달해 VAD 오인을 일으킨 경우 방어:
      // 최근 sustained 사용자 오디오가 없었으면 에코로 간주하고 무시 (shouldAcceptInterruption).
      if (message.serverContent?.interrupted) {
        if (shouldAcceptInterruption(Date.now() - lastLoudAudioAtRef.current)) {
          // 바지인 즉시 반영: softFlush가 playbackEndAt을 now+150ms로 축소 →
          // 150ms 뒤 게이트 자동 개방
          audio.softFlush();
          setState("listening");
        }
        // else: 에코 추정 — 재생 보호, 게이트 유지 (playbackEndAt 변경 없음)
      }

      // 입력 트랜스크립션
      if (message.serverContent?.inputTranscription?.text) {
        const chunk = message.serverContent.inputTranscription.text;
        addTranscript("user", chunk);
      }

      // 출력 트랜스크립션
      if (message.serverContent?.outputTranscription?.text) {
        addTranscript("model", message.serverContent.outputTranscription.text);
      }

      // Function Calling — search_policy 단일 RAG 툴
      if (message.toolCall?.functionCalls) {
        setState("processing");
        const functionCalls = message.toolCall.functionCalls;
        const currentSignal = abortControllerRef.current?.signal;

        const responses = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          functionCalls.map(async (fc: any) => {
            setFunctionStatus({ name: fc.name, status: "executing" });

            // 함수별 8초 데드라인 — 외부 RAG 검색 hang 방지
            const FUNCTION_TIMEOUT_MS = 8_000;
            const fnAbort = new AbortController();
            const timeoutId = setTimeout(() => fnAbort.abort(), FUNCTION_TIMEOUT_MS);
            // 세션 중단 시 함수 타임아웃도 연동
            currentSignal?.addEventListener("abort", () => fnAbort.abort(), { once: true });

            try {
              const result = await executeSearchPolicy(
                typeof fc.args?.query === "string" ? fc.args.query : "",
                fnAbort.signal
              );
              clearTimeout(timeoutId);
              if (disposedRef.current) return { id: fc.id, name: fc.name, response: { error: "disposed" } };
              setFunctionStatus({ name: fc.name, status: "done" });
              // search_policy 결과의 출처(sources)를 부모(오버레이)에 전달 — 인용 카드 표시용
              const sources = (result as { sources?: SourceRef[] })?.sources;
              if (Array.isArray(sources) && sources.length > 0) {
                onSourceRefsRef.current?.(sources);
              }
              return { id: fc.id, name: fc.name, response: result };
            } catch (error) {
              clearTimeout(timeoutId);
              if (disposedRef.current) return { id: fc.id, name: fc.name, response: { error: "disposed" } };
              setFunctionStatus({ name: fc.name, status: "error" });
              return {
                id: fc.id,
                name: fc.name,
                response: { error: error instanceof Error ? error.message : "Failed" },
              };
            }
          })
        );

        // 함수 결과를 Gemini에 전송 (취소/dispose되지 않은 경우에만)
        const wasAborted = currentSignal?.aborted;
        if (sessionRef.current && !wasAborted && !disposedRef.current) {
          sessionRef.current.sendToolResponse({
            functionResponses: responses.map(
              (r: { id: string; name: string; response: unknown }) => ({
                id: r.id,
                name: r.name,
                response: r.response,
              })
            ),
          });
        }

        // 3초 후 함수 상태 초기화 (타이머 추적)
        if (functionStatusTimerRef.current) clearTimeout(functionStatusTimerRef.current);
        functionStatusTimerRef.current = setTimeout(() => {
          functionStatusTimerRef.current = null;
          if (!disposedRef.current) setFunctionStatus(null);
        }, 3000);
      }

      // Tool call 취소
      if (message.toolCallCancellation) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        setFunctionStatus(null);
      }

      // Session resumption handle 저장
      if (message.sessionResumptionUpdate?.newHandle) {
        resumeHandleRef.current = message.sessionResumptionUpdate.newHandle;
      }

      // GoAway → 자동 재연결 (타이머 추적)
      if (message.goAway) {
        setState("reconnecting");
        if (!disposedRef.current) {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!disposedRef.current) connect();
          }, 1000);
        }
      }
    },
    [audio, addTranscript, executeSearchPolicy, connect]
  );

  /** 연결 종료 */
  const disconnect = useCallback(() => {
    disposedRef.current = true;
    lastLoudAudioAtRef.current = 0;
    consecutiveLoudFramesRef.current = 0;
    // 진행 중인 fetch 요청 취소
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    // 타이머 정리
    clearTimers();
    try {
      sessionRef.current?.close();
    } catch {
      // 이미 닫힌 경우 무시
    }
    sessionRef.current = null;
    audio.cleanup();
    setState("idle");
    setFunctionStatus(null);
    resumeHandleRef.current = null;
    // iOS audio session을 기본값으로 복원 (다른 미디어가 정상 ducking 정책 받도록)
    restoreAudioSession();
  }, [audio, clearTimers]);

  /** 외부에서 호출하는 연결 시작 — disposed 리셋 후 connect 호출.
   * iOS audio session을 `play-and-record`로 전환해 VoiceOver/시스템 사운드의
   * ducking을 막는다 (disconnect/unmount 시 `auto`로 복원). */
  const startSession = useCallback(
    async () => {
      disposedRef.current = false;
      setVoiceCallSession();
      return connect();
    },
    [connect]
  );

  /** AudioContext 사전 초기화 — 사용자 제스처(클릭) 체인 내에서 호출 필수 */
  const warmupAudio = useCallback(async () => {
    await audio.warmup();
  }, [audio]);

  /** 음소거 토글 */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      disposedRef.current = true;
      lastLoudAudioAtRef.current = 0;
      consecutiveLoudFramesRef.current = 0;
      abortControllerRef.current?.abort();
      clearTimers();
      try {
        sessionRef.current?.close();
      } catch {
        // ignore
      }
      audio.cleanup();
      // disconnect를 거치지 않고 unmount된 경우에도 audio session 복원
      restoreAudioSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    warmupAudio,
    connect: startSession,
    disconnect,
    toggleMute,
    isMuted,
    transcripts,
    functionStatus,
    errorMessage,
  };
}
