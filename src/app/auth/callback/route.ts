import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'

/**
 * Supabase 매직링크 콜백.
 * 이메일 링크 클릭 → /auth/callback?code=...&next=/wiki/...
 * code → session 교환 후 next 경로로 redirect.
 * 실패 시 /auth/error (M5 또는 후속에서 별도 페이지 추가 예정).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/wiki'

  if (code) {
    const supabase = await getServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
