import { AppShell } from "@/components/layout/AppShell"
import { readSidebarCookieServer } from "@/lib/sidebar-cookie"
import { AuthProvider } from "@/contexts/AuthContext"
import { AdminBar } from "@/components/admin/AdminBar"
import { getCurrentUserAdminStatus } from "@/lib/auth/admin"

export default async function WikiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialExpanded = await readSidebarCookieServer()
  // codex-rescue P1 #1: KbPageLayout의 fixed inset-0 z-50이 AdminBar(z-40)을 덮는 문제.
  // admin 모드일 때만 CSS variable로 top offset 노출. KbPageLayout 같은 fixed overlay가
  // `style={{ top: 'var(--admin-bar-h, 0)' }}` 형태로 참조해 AdminBar 아래에서 시작.
  const { isAdmin } = await getCurrentUserAdminStatus()
  return (
    <AuthProvider>
      {isAdmin && (
        <style>{`:root{--admin-bar-h:2.75rem}`}</style>
      )}
      <AdminBar />
      <AppShell initialExpanded={initialExpanded}>{children}</AppShell>
    </AuthProvider>
  )
}
