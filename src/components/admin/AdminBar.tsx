import { getCurrentUserAdminStatus } from "@/lib/auth/admin"
import { AdminBarView } from "./AdminBarView"

/**
 * Server data fetcher (RSC). 일반 사용자는 null 반환 → DOM에 들어가지 않음.
 * (wiki)/layout.tsx에서 마운트.
 *
 * Presentational view는 AdminBarView.tsx (server-only 비의존)로 분리하여
 * vitest jsdom 테스트가 모듈을 안전하게 로드할 수 있도록 한다.
 */
export async function AdminBar() {
  const status = await getCurrentUserAdminStatus()
  return <AdminBarView status={status} />
}

export { AdminBarView } from "./AdminBarView"
