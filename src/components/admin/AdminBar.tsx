import { getCurrentUserAdminStatus } from "@/lib/auth/admin"
import { getDraftModeEnabled } from "@/lib/admin/preview"
import { AdminBarView } from "./AdminBarView"

/**
 * Server data fetcher (RSC). 일반 사용자는 status.isAdmin=false → AdminBarView가 null 반환.
 * Phase B M2: draftMode().isEnabled를 읽어 토글 상태를 client view에 주입.
 *
 * codex-rescue P1: 비-admin이면 getDraftModeEnabled()를 호출하지 않는다. 그렇지 않으면
 * 모든 wiki route가 admin 여부와 무관하게 draftMode()를 읽어, published 페이지의 정적
 * 렌더 불변식(M2 §invariant 3)이 layout 레벨에서 깨진다. 비-admin은 어차피 토글을 못
 * 쓰므로 previewEnabled=false면 충분하다.
 */
export async function AdminBar() {
  const status = await getCurrentUserAdminStatus()
  if (!status.isAdmin) {
    return <AdminBarView status={status} previewEnabled={false} />
  }
  const previewEnabled = await getDraftModeEnabled()
  return <AdminBarView status={status} previewEnabled={previewEnabled} />
}

export { AdminBarView } from "./AdminBarView"
