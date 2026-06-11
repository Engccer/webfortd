import Link from "next/link"

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* 운영 주체 */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              운영 주체
            </h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {/* 실제 운영 주체 정보 확정 전까지 가짜 연락처(이메일·전화) 노출 금지 */}
              <p>운영 주체 정보와 연락처는 준비 중이에요.</p>
            </div>
          </section>

          {/* 관련 사이트 */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              관련 사이트
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              관련 사이트 안내는 준비 중입니다.
            </p>
          </section>

          {/* 정책 */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              정책
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/sitemap"
                  className="text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                >
                  사이트맵
                </Link>
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © {year} 장애인교원 교육전념 여건 지원
        </div>
      </div>
    </footer>
  )
}
