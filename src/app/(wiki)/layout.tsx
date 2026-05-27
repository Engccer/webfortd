import Link from "next/link"
import { BookOpenText, MessageCircle } from "lucide-react"
import { SkipLink } from "@/components/accessibility/SkipLink"
import { FocusManager } from "@/components/accessibility/FocusManager"
import { AccessibilityToolbar } from "@/components/accessibility/AccessibilityToolbar"
import { EntryToggle } from "@/components/wiki/EntryToggle"
import { SiteSearch } from "@/components/search/SiteSearch"
import { AuthProvider } from "@/contexts/AuthContext"
import { SignInButton } from "@/components/auth/SignInButton"

export default function WikiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <SkipLink />
      <FocusManager />
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <BookOpenText className="h-5 w-5 text-primary" aria-hidden="true" />
                <span>장애인교원 위키</span>
              </Link>
              <nav aria-label="위키 메뉴" className="hidden md:block">
                <ul className="flex items-center gap-1 text-sm">
                  <li>
                    <Link
                      href="/"
                      className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      위키
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/chat"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      채팅
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <EntryToggle />
              <SiteSearch />
              <AccessibilityToolbar />
              <SignInButton />
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border bg-muted/30 py-6 text-center text-xs text-muted-foreground">
          <p>
            장애인교원 위키 · 정책·법령·사례 통합 안내 ·{" "}
            <Link href="/legacy" className="underline hover:text-foreground">
              이전 버전 보기
            </Link>
          </p>
        </footer>
      </div>
    </AuthProvider>
  )
}
