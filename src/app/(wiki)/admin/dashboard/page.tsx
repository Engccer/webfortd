import type { Metadata } from "next"
import {
  computeStatusCounts,
  computeAxisDistribution,
  computeReviewQueue,
} from "@/lib/admin/dashboard-stats"
import { getServerClient } from "@/lib/supabase/server"
import kbIndex from "@/lib/kb-index.generated.json"

export const metadata: Metadata = {
  title: "관리자 대시보드",
  robots: { index: false, follow: false },
}

// 항상 fresh — DB documents 카운트와 정합 검증을 위해 cache 비활성.
export const dynamic = "force-dynamic"

interface DbCounts {
  total: number | null
  byStatus: Record<string, number> | null
  error: string | null
}

async function fetchDbCounts(): Promise<DbCounts> {
  try {
    const supabase = await getServerClient()
    // admin role은 0013 RLS로 모든 status read 가능.
    // 비-admin이 layout 게이트를 우회해 도달해도 RLS가 published만 노출 → fail-safe.
    const { data, error } = await supabase.from("documents").select("status")
    if (error) {
      return { total: null, byStatus: null, error: error.message }
    }
    const byStatus: Record<string, number> = {}
    for (const row of data ?? []) {
      const s = (row as { status: string }).status
      byStatus[s] = (byStatus[s] ?? 0) + 1
    }
    return { total: (data ?? []).length, byStatus, error: null }
  } catch (e) {
    return { total: null, byStatus: null, error: String(e) }
  }
}

interface KbIndexShape {
  documents: Array<{
    slug: string
    axis: string
    frontmatter: { status?: string; reviewed_by?: string[]; title?: string }
  }>
  broken_wikilinks: Array<{ source: string; target: string; line: number }>
}

export default async function DashboardPage() {
  const data = kbIndex as unknown as KbIndexShape
  const statusCounts = computeStatusCounts(data.documents)
  const axisDist = computeAxisDistribution(data.documents)
  const reviewQueue = computeReviewQueue(data.documents)
  const brokenCount = data.broken_wikilinks.length
  const dbCounts = await fetchDbCounts()
  const indexTotal = data.documents.length
  const parityMismatch =
    dbCounts.total !== null && dbCounts.total !== indexTotal

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
    >
      <h1 className="mb-6 text-2xl font-bold">관리자 대시보드</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Phase A — 데이터 가시성 강화. Preview Mode와 일괄 publish는 Phase B에서 활성화됩니다.
      </p>

      <section aria-labelledby="status-counts" className="mb-10">
        <h2 id="status-counts" className="mb-3 text-lg font-semibold">
          페이지 상태 분포 (마크다운 정본 기준)
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Object.entries(statusCounts).map(([key, count]) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-4"
            >
              <dt className="text-sm text-muted-foreground">{key}</dt>
              <dd className="font-mono text-2xl">{count}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="axis-dist" className="mb-10">
        <h2 id="axis-dist" className="mb-3 text-lg font-semibold">
          축(axis)별 페이지 분포
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(axisDist).map(([key, count]) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-4"
            >
              <dt className="text-sm text-muted-foreground">{key}</dt>
              <dd className="font-mono text-2xl">{count}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="parity" className="mb-10">
        <h2 id="parity" className="mb-3 text-lg font-semibold">
          마크다운 ↔ DB 정합 검증
        </h2>
        <p className="text-sm text-muted-foreground">
          마크다운 정본:{" "}
          <span className="font-mono">{indexTotal}</span> 페이지
          {" / "}
          DB documents:{" "}
          <span className="font-mono">
            {dbCounts.error
              ? `오류(${dbCounts.error})`
              : dbCounts.total ?? "—"}
          </span>{" "}
          {parityMismatch && (
            <strong className="text-rose-700">
              불일치 ({Math.abs(indexTotal - (dbCounts.total ?? 0))} 차이)
            </strong>
          )}
        </p>
        {dbCounts.byStatus && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            {Object.entries(dbCounts.byStatus).map(([k, v]) => (
              <div key={k} className="rounded border border-border px-3 py-2">
                <dt className="text-muted-foreground">DB {k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="review-queue" className="mb-10">
        <h2 id="review-queue" className="mb-3 text-lg font-semibold">
          검수 대기 큐 ({reviewQueue.length}건)
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          draft 상태이면서 reviewed_by가 비어있는 페이지. Phase B의 bootstrap publish 대상.
        </p>
        <ul className="space-y-2">
          {reviewQueue.slice(0, 50).map((item) => (
            <li
              key={item.slug}
              className="rounded border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="font-mono">{item.slug}</span>
              <span className="ml-2 text-muted-foreground">({item.axis})</span>
            </li>
          ))}
          {reviewQueue.length > 50 && (
            <li className="text-sm text-muted-foreground">
              … 외 {reviewQueue.length - 50}건
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="broken-links" className="mb-10">
        <h2 id="broken-links" className="mb-3 text-lg font-semibold">
          깨진 위키링크 ({brokenCount}건)
        </h2>
        <p className="text-sm text-muted-foreground">
          빌드 파이프라인이 식별한 broken_wikilinks (kb-index.generated.json).
        </p>
      </section>
    </main>
  )
}
