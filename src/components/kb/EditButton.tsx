'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getBrowserClient } from '@/lib/supabase/client'

interface EditButtonProps {
  slug: string
}

/**
 * KB 문서 페이지 sticky 헤더의 편집 진입점. 권한자(editor_roles에 자기 행이
 * 있는 로그인 사용자)에게만 노출한다. 판정은 client-side — RLS "editor read
 * own role"이 본인 행만 SELECT를 허용하므로 조회 자체가 안전하다.
 *
 * 비로그인·로딩 중·조회 실패는 모두 null 렌더(깜빡임 없는 미니멀). 직접 URL
 * 접근 시의 권한 없음 안내는 /admin/editor 페이지가 담당한다.
 */
export function EditButton({ slug }: EditButtonProps) {
  const { user } = useAuth()
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    if (!user) {
      // AuthContext.tryGetClient 케이스와 동일 패턴 — effect 본문 내 동기 setState
      // 회피(react-hooks/set-state-in-effect)를 위해 microtask로 미룬다.
      queueMicrotask(() => setCanEdit(false))
      return
    }
    let cancelled = false
    getBrowserClient()
      .from('editor_roles')
      .select('role')
      .eq('user_id', user.id)
      .then(({ data, error }: { data: unknown[] | null; error: unknown }) => {
        if (cancelled) return
        setCanEdit(!error && (data ?? []).length > 0)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!canEdit) return null

  return (
    <Link
      href={`/admin/editor?slug=${slug}`}
      className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      편집
    </Link>
  )
}
