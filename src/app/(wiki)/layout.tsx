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
  // admin 상태는 layout에서 1회만 조회해 AdminBar에 prop으로 주입 — 요청당 Supabase 중복 왕복 제거.
  const adminStatus = await getCurrentUserAdminStatus()
  return (
    <AuthProvider>
      {adminStatus.isAdmin && (
        <style>{`:root{--admin-bar-h:2.75rem}`}</style>
      )}
      {/* AdminBar는 AppShell topBar 슬롯으로 렌더 — 모바일 overlay focus trap(inert)
          범위에 포함되어 Tab이 AdminBar로 탈출하지 못한다 (WCAG 2.1.2). */}
      <AppShell
        initialExpanded={initialExpanded}
        topBar={<AdminBar status={adminStatus} />}
      >
        {children}
      </AppShell>
    </AuthProvider>
  )
}
