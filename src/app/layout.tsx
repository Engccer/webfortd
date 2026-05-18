import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "장애인교원 교육전념 여건 지원",
    template: "%s | 장애인교원 교육전념 여건 지원",
  },
  description:
    "장애인교원의 교육활동을 보호하고 교육활동에 전념할 수 있는 여건 및 기반을 마련합니다.",
  keywords: [
    "장애인교원",
    "교육전념",
    "지원제도",
    "편의지원",
    "보조공학기기",
    "근로지원인",
  ],
  authors: [{ name: "장애인교원 교육전념 여건 지원" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "장애인교원 교육전념 여건 지원",
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-contrast="default" data-underline-links="false" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
