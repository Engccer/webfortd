'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { AuthModal } from './AuthModal'

export function SignInButton() {
  const { user, loading, signOut } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  // 로그아웃 알림 (스크린리더용 — 버튼이 "로그인"으로 교체될 때 무알림 방지)
  const [announcement, setAnnouncement] = useState('')
  const loginButtonRef = useRef<HTMLButtonElement>(null)
  // 로그아웃 직후 교체된 "로그인" 버튼으로 포커스를 옮기기 위한 플래그
  const pendingFocusRef = useRef(false)

  async function handleSignOut() {
    pendingFocusRef.current = true
    await signOut()
    setAnnouncement('로그아웃했어요')
  }

  // 로그아웃으로 user가 비워져 "로그인" 버튼이 렌더되면 그 버튼으로 포커스 유지.
  useEffect(() => {
    if (!user && pendingFocusRef.current) {
      pendingFocusRef.current = false
      loginButtonRef.current?.focus()
    }
  }, [user])

  return (
    <>
      {/* role="status"는 aria-live="polite"를 암시 — 명시 속성 생략 */}
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {loading ? (
        <div aria-live="polite" className="text-sm">로그인 상태 확인 중...</div>
      ) : user ? (
        <Button variant="outline" onClick={handleSignOut} aria-label={`로그아웃 (${user.email})`}>
          로그아웃
        </Button>
      ) : (
        <>
          <Button ref={loginButtonRef} onClick={() => setModalOpen(true)}>로그인</Button>
          <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
        </>
      )}
    </>
  )
}
