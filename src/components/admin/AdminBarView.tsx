import Link from "next/link"
import type { AdminStatus } from "@/lib/auth/admin-types"

/**
 * Presentational view — server fetch와 분리되어 테스트 가능.
 * Phase A: dashboard 진입점 + Preview Toggle placeholder(disabled).
 * Phase B: Preview Toggle 활성화 예정.
 */
export function AdminBarView({ status }: { status: AdminStatus }) {
  if (!status.isAdmin) return null

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
            disabled
            title="미리보기 모드는 Phase B에서 활성화됩니다"
            className="rounded border border-amber-300 px-3 py-1 text-amber-700 opacity-60"
          >
            미리보기 OFF
          </button>
        </div>
      </div>
    </div>
  )
}
