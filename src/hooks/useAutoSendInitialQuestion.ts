"use client"

import { useEffect, useRef } from "react"

/**
 * 홈 옴니박스 [AI에게 질문]으로 `/chat?q=...`에 도착한 첫 질문을 1회 전송한다.
 *
 * 자동 전송의 위험은 재전송 하나뿐이라 가드도 두 겹이면 끝난다:
 *  - 리렌더·Strict Mode 이중 실행 → ref 가드(전송 여부는 렌더와 무관한 사실).
 *  - 주소에 질문이 남은 채 새로고침 → 전송 직후 q 파라미터 제거.
 *
 * 주소 정리에 `router.replace`가 아니라 `history.replaceState`를 쓰는 이유: 필요한 것은
 * 주소창 정리뿐인데 `router.replace`는 같은 세그먼트라도 RSC 왕복을 발생시킨다. App
 * Router는 `replaceState`를 패치해 캐노니컬 URL 갱신(ACTION_RESTORE)만 처리하고 RSC
 * 재요청·세그먼트 리마운트를 하지 않으므로, 스트리밍 중인 응답에 영향이 없다.
 *
 * 포커스는 건드리지 않는다. 응답 완료 시 마지막 질문 헤딩으로 옮기는 계약이
 * `useChatCompletionFocus`에 이미 있어, 자동 전송된 질문도 같은 경로로 안착한다
 * (접근성 헌장 §6 — 완료 시 이동, 중복 통지 금지).
 */
export function useAutoSendInitialQuestion({
  question,
  send,
}: {
  question?: string
  send: (text: string) => void
}) {
  const sentRef = useRef(false)
  // send는 렌더마다 새 함수일 수 있어 effect deps에 넣으면 재실행 판단이 흐려진다.
  // 전송 여부는 sentRef가 단독으로 판정하고, 여기서는 최신 함수만 유지한다.
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  }, [send])

  useEffect(() => {
    if (sentRef.current) return
    const text = question?.trim()
    if (!text) return
    sentRef.current = true
    sendRef.current(text)
    stripQuestionParam()
  }, [question])
}

/** 주소에서 q만 제거 — thread 등 다른 파라미터는 보존한다. */
function stripQuestionParam() {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (!url.searchParams.has("q")) return
  url.searchParams.delete("q")
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
}
