'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { AuthModal } from './AuthModal'

export function SignInButton() {
  const { user, loading, signOut } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) {
    return <div aria-live="polite" className="text-sm">로그인 상태 확인 중...</div>
  }

  if (user) {
    return (
      <Button variant="outline" onClick={signOut} aria-label={`로그아웃 (${user.email})`}>
        로그아웃
      </Button>
    )
  }

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>로그인</Button>
      <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
