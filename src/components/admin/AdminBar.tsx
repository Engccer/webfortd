import { getDraftModeEnabled } from "@/lib/admin/preview"
import type { AdminStatus } from "@/lib/auth/admin-types"
import { AdminBarView } from "./AdminBarView"

/**
 * Server data fetcher (RSC). 일반 사용자는 status.isAdmin=false → AdminBarView가 null 반환.
 * Phase B M2: draftMode().isEnabled를 읽어 토글 상태를 client view에 주입.
 *
 * status는 (wiki)/layout이 1회 조회해 prop으로 주입한다 — getCurrentUserAdminStatus가
 * React cache() 미적용이라 자체 재조회 시 요청당 Supabase 왕복이 2배가 되기 때문.
 *
 * codex-rescue P1: 비-admin이면 getDraftModeEnabled()를 호출하지 않는다. 그렇지 않으면
 * 모든 wiki route가 admin 여부와 무관하게 draftMode()를 읽어, published 페이지의 정적
 * 렌더 불변식(M2 §invariant 3)이 layout 레벨에서 깨진다. 비-admin은 어차피 토글을 못
 * 쓰므로 previewEnabled=false면 충분하다.
 */
export async function AdminBar({ status }: { status: AdminStatus }) {
  if (!status.isAdmin) {
    return <AdminBarView status={status} previewEnabled={false} />
  }
  const previewEnabled = await getDraftModeEnabled()
  return <AdminBarView status={status} previewEnabled={previewEnabled} />
}

export { AdminBarView } from "./AdminBarView"
