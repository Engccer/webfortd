import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '로그인 링크 오류 | 장애인교원 위키',
}

/**
 * Supabase 매직링크 실패 안내 페이지.
 * auth/callback에서 code 교환 실패(만료·재사용) 시 이곳으로 redirect된다.
 * 이전에는 이 페이지가 없어 404가 떴음 — 사용자에게 행동 가능한 안내 제공.
 */
export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        로그인 링크를 사용할 수 없어요
      </h1>
      <p className="text-muted-foreground">
        이메일 링크가 만료됐거나 이미 사용된 링크예요. 홈으로 이동한 뒤
        로그인 버튼을 눌러 이메일로 받은 인증 코드를 입력하면 바로 로그인할 수 있어요.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        홈으로 이동
      </Link>
    </main>
  )
}
