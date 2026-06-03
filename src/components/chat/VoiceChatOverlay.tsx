"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
import { useGeminiLive } from "@/hooks/useGeminiLive";
import type { SourceRef } from "@/lib/voice/types";

interface VoiceChatOverlayProps {
  open: boolean;
  onClose: () => void;
}

const STATE_LABEL: Record<string, string> = {
  idle: "대기 중",
  connecting: "연결 중이에요…",
  connected: "연결됐어요",
  listening: "듣고 있어요. 말씀해 주세요.",
  speaking: "답하고 있어요…",
  processing: "자료를 찾고 있어요…",
  reconnecting: "다시 연결하고 있어요…",
  error: "문제가 생겼어요.",
};

export function VoiceChatOverlay({ open, onClose }: VoiceChatOverlayProps) {
  const [sources, setSources] = useState<SourceRef[]>([]);
  const onSourceRefs = useCallback((s: SourceRef[]) => setSources(s), []);
  const {
    state,
    connect,
    disconnect,
    toggleMute,
    isMuted,
    transcripts,
    errorMessage,
  } = useGeminiLive({ onSourceRefs });

  const dialogRef = useRef<HTMLDivElement>(null);

  // 오버레이 오픈 시 연결 시작
  // (warmup은 ChatUI 진입 버튼의 사용자 제스처 체인에서 이미 호출됨)
  // 닫힐 때 disconnect + 출처 초기화
  // 포커스는 종료 버튼이 아니라 dialog 컨테이너로 — 전역 Space 핸들러가
  // 버튼의 네이티브 Space 활성화를 가로채지 않도록 (C-1). 닫기는 Esc가 1차 경로.
  useEffect(() => {
    if (open) {
      setSources([]);
      void connect();
      dialogRef.current?.focus();
    } else {
      disconnect();
      setSources([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 새 사용자 발화가 시작되면 이전 답변의 출처 카드를 비운다 (stale 인용 방지).
  // 마지막 transcript가 user 역할로 바뀌는 순간을 새 질문 시작으로 본다.
  const lastRole =
    transcripts.length > 0 ? transcripts[transcripts.length - 1].role : null;
  useEffect(() => {
    if (lastRole === "user") setSources([]);
  }, [lastRole]);

  // 키보드: Esc=종료, Space=mute (modifier 가드 — 다른 단축키 충돌 방지)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === " " || e.code === "Space") {
        // 버튼이 포커스돼 있으면 그 버튼의 네이티브 Space 활성화를 유지 (C-1)
        if (document.activeElement instanceof HTMLButtonElement) return;
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, toggleMute]);

  // 포커스 트랩 (간단형 — dialog 밖으로 나가면 dialog 컨테이너로 되돌림)
  useEffect(() => {
    if (!open) return;
    const onFocus = (e: FocusEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        dialogRef.current.focus();
      }
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="음성으로 정책 안내 받기"
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background/95 p-6 backdrop-blur outline-none"
    >
      <p aria-live="polite" className="text-lg font-medium text-foreground">
        {errorMessage ?? STATE_LABEL[state] ?? state}
      </p>

      <div
        aria-hidden
        className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10"
      >
        {state === "connecting" ||
        state === "reconnecting" ||
        state === "processing" ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : isMuted ? (
          <MicOff className="h-10 w-10 text-muted-foreground" />
        ) : (
          <Mic className="h-10 w-10 text-primary" />
        )}
      </div>

      <div
        className="max-h-48 w-full max-w-md overflow-y-auto text-sm"
        aria-live="polite"
      >
        {transcripts.map((t, i) => (
          <p
            key={i}
            className={
              t.role === "user" ? "text-foreground" : "text-muted-foreground"
            }
          >
            <span className="sr-only">{t.role === "user" ? "나: " : "안내: "}</span>
            {t.text}
          </p>
        ))}
      </div>

      {sources.length > 0 && (
        <nav aria-label="인용 출처" className="w-full max-w-md">
          <ul className="flex flex-col gap-1 text-sm">
            {sources.map((s) => (
              <li key={s.slug}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {s.title}
                  <span className="sr-only"> (새 탭에서 열림)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={isMuted}
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border px-4 py-2"
        >
          {isMuted ? (
            <MicOff aria-hidden className="h-5 w-5" />
          ) : (
            <Mic aria-hidden className="h-5 w-5" />
          )}
          {isMuted ? "음소거 해제" : "음소거"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground"
        >
          <X aria-hidden className="h-5 w-5" />
          종료
        </button>
      </div>
    </div>
  );
}
