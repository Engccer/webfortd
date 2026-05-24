'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getBrowserClient } from '@/lib/supabase/client'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * SSG prerender 안전 client 초기화.
 * env 누락(빌드 시) 또는 SSR 시점에는 null 반환 → caller가 stub 처리.
 * 런타임에는 정상 초기화.
 */
function tryGetClient(): SupabaseClient | null {
  try {
    return getBrowserClient()
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = tryGetClient()
    if (!supabase) {
      // env 미설정 — silent no-op (빌드 통과용 defensive).
      // microtask로 미뤄 set-state-in-effect cascading render 룰 정합 — early return path.
      queueMicrotask(() => setLoading(false))
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signInWithMagicLink(email: string) {
    const supabase = tryGetClient()
    if (!supabase) {
      return { error: new Error('Supabase 미설정 — 관리자에게 환경변수 추가 요청') }
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    })
    return { error: error as Error | null }
  }

  async function signOut() {
    const supabase = tryGetClient()
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
