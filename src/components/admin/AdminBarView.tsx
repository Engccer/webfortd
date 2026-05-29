"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { AdminStatus } from "@/lib/auth/admin-types"

/**
 * Phase B M2 — Preview Toggle 활성화.
 * feedback_rsc_event_handler_gap 교훈: onClick은 client 컴포넌트에서만.
 * 토글 상태(previewEnabled)는 server(draftMode().isEnabled)에서 prop으로 주입.
 * 클릭 → enable/disable POST → router.refresh()로 server 재렌더 → 상태 갱신.
 */
export function AdminBarView({
  status,
  previewEnabled,
}: {
  status: AdminStatus
  previewEnabled: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  if (!status.isAdmin) return null

  async function togglePreview() {
    if (pending) return
    setPending(true)
    const next = !previewEnabled
    try {
      const res = await fetch(
        next ? "/api/admin/preview/enable" : "/api/admin/preview/disable",
        { method: "POST" },
      )
      if (!res.ok) {
        setAnnouncement("미리보기 전환에 실패했어요. 다시 시도해 주세요.")
        return
      }
      setAnnouncement(
        next ? "관리자 미리보기를 켰습니다." : "관리자 미리보기를 껐습니다.",
      )
      router.refresh()
    } catch {
      setAnnouncement("미리보기 전환 중 오류가 발생했어요.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      role="region"
      aria-label="관리자 도구 모음"
      className="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold">관리자 모드</span>
          <span className="text-amber-800">
            {status.email ?? "(이메일 없음)"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="rounded px-3 py-1 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            대시보드
          </Link>
          <button
            type="button"
            onClick={togglePreview}
            disabled={pending}
            aria-pressed={previewEnabled}
            className="rounded border border-amber-300 px-3 py-1 text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:opacity-60"
          >
            {previewEnabled ? "미리보기 끄기" : "미리보기 켜기"}
          </button>
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
