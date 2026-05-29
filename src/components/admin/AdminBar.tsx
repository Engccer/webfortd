import { getCurrentUserAdminStatus } from "@/lib/auth/admin"
import { getDraftModeEnabled } from "@/lib/admin/preview"
import { AdminBarView } from "./AdminBarView"

/**
 * Server data fetcher (RSC). 일반 사용자는 status.isAdmin=false → AdminBarView가 null 반환.
 * Phase B M2: draftMode().isEnabled를 읽어 토글 상태를 client view에 주입.
 */
export async function AdminBar() {
  const status = await getCurrentUserAdminStatus()
  const previewEnabled = await getDraftModeEnabled()
  return <AdminBarView status={status} previewEnabled={previewEnabled} />
}

export { AdminBarView } from "./AdminBarView"
