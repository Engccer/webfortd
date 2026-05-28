import { AppShell } from "@/components/layout/AppShell"
import { readSidebarCookieServer } from "@/lib/sidebar-cookie"
import { AuthProvider } from "@/contexts/AuthContext"

export default async function WikiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialExpanded = await readSidebarCookieServer()
  return (
    <AuthProvider>
      <AppShell initialExpanded={initialExpanded}>{children}</AppShell>
    </AuthProvider>
  )
}
