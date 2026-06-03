'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/Button'

/**
 * 인증 코드(OTP) 2단계 로그인.
 *
 * 1) 이메일 입력 → requestOtp → 코드 발송
 * 2) 이메일로 받은 코드 입력 → verifyOtp(type:'email') → 로그인
 *
 * 코드를 *같은 브라우저*에 입력하면 세션이 그 브라우저에 생성되므로, 매직링크가
 * 메일앱 인앱 브라우저 등 다른 컨텍스트에서 열려 세션이 유실되던 "재방문 시 재로그인"
 * 문제가 사라진다. 코드 검증은 PKCE code_verifier가 불필요하다.
 */
export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { requestOtp, verifyOtp } = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)

  // 모달이 닫힐 때 상태 초기화 (effect 내 동기 setState 회피 — 닫기 핸들러에서 처리).
  // 다음 오픈 시 깨끗한 1단계부터 시작.
  function handleDialogOpenChange(next: boolean) {
    if (!next) {
      setStep('email')
      setEmail('')
      setCode('')
      setBusy(false)
      setMessage('')
      setErrorMsg('')
    }
    onOpenChange(next)
  }

  // 코드 단계 진입 시 코드 입력칸으로 포커스 이동 (스크린리더 사용자 흐름).
  useEffect(() => {
    if (step === 'code') {
      const t = setTimeout(() => codeInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [step])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrorMsg('')
    setMessage('')
    const { error } = await requestOtp(email)
    setBusy(false)
    if (error) {
      setErrorMsg(`오류: ${error.message}`)
      return
    }
    setStep('code')
    setMessage('이메일로 보내드린 인증 코드를 입력해 주세요.')
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrorMsg('')
    const { error } = await verifyOtp(email, code)
    setBusy(false)
    if (error) {
      // Supabase 영어 오류를 사용자 친화 한국어로 치환.
      setErrorMsg('코드가 올바르지 않거나 만료되었어요. 코드를 다시 확인하거나 새 코드를 받아 주세요.')
      return
    }
    // 성공: onAuthStateChange가 user를 채우고, 여기서 모달을 닫는다.
    handleDialogOpenChange(false)
  }

  function backToEmail() {
    setStep('email')
    setCode('')
    setErrorMsg('')
    setMessage('')
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent aria-describedby="auth-desc">
        <DialogHeader>
          <DialogTitle>이메일로 로그인</DialogTitle>
          <DialogDescription id="auth-desc">
            {step === 'email'
              ? '이메일 주소를 입력하시면 인증 코드를 보내드립니다. 받은 코드를 이 화면에 입력하면 로그인됩니다.'
              : `${email} 으로 보낸 인증 코드를 입력해 주세요.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'email' ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="이메일 주소 입력"
              disabled={busy}
            />
            <Button type="submit" disabled={busy}>
              {busy ? '발송 중...' : '인증 코드 받기'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="인증 코드"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="인증 코드 입력"
              disabled={busy}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || code.trim().length === 0}>
                {busy ? '확인 중...' : '로그인'}
              </Button>
              <Button type="button" variant="outline" onClick={backToEmail} disabled={busy}>
                이메일 다시 입력
              </Button>
            </div>
          </form>
        )}

        <div aria-live="polite" className="min-h-[1.5rem] text-sm">
          {errorMsg ? <span className="text-destructive">{errorMsg}</span> : message}
        </div>
      </DialogContent>
    </Dialog>
  )
}
