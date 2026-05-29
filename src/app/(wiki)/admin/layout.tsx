import { redirect } from "next/navigation"
import { getCurrentUserAdminStatus } from "@/lib/auth/admin"

/**
 * (wiki)/admin/* 권한 게이트.
 * server-side admin 체크 (단일 진실). 비-admin은 root로 redirect.
 *
 * AdminBar(wiki layout)는 본 layout보다 상위에 마운트되어 admin 정보가
 * 게이트 통과 후에도 그대로 노출됨.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const status = await getCurrentUserAdminStatus()
  if (!status.isAdmin) {
    redirect("/")
  }
  return <>{children}</>
}
