'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/Button'

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await signInWithMagicLink(email)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="auth-desc">
        <DialogHeader>
          <DialogTitle>이메일로 로그인</DialogTitle>
          <DialogDescription id="auth-desc">
            이메일 주소를 입력하시면 매직링크를 보내드립니다. 링크를 클릭하면 로그인됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="이메일 주소 입력"
            disabled={status === 'sending' || status === 'sent'}
          />
          <Button type="submit" disabled={status === 'sending' || status === 'sent'}>
            {status === 'sending' ? '발송 중...' : '매직링크 보내기'}
          </Button>
        </form>

        <div aria-live="polite" className="min-h-[1.5rem] text-sm">
          {status === 'sent' && '이메일을 확인해 주세요.'}
          {status === 'error' && `오류: ${errorMsg}`}
        </div>
      </DialogContent>
    </Dialog>
  )
}
