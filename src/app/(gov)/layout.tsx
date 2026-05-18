import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { SkipLink } from "@/components/accessibility/SkipLink"
import { FocusManager } from "@/components/accessibility/FocusManager"

export default function GovLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SkipLink />
      <FocusManager />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </>
  )
}
