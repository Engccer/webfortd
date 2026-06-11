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

// Supabase 영어 오류를 사용자가 행동할 수 있는 한국어 안내로 치환.
function toKoreanRequestError(message: string): string {
  if (/security purposes|only request this|rate limit/i.test(message)) {
    return '요청이 너무 잦아요. 1분 후 다시 시도해 주세요.'
  }
  return '인증 코드를 보내지 못했어요. 이메일 주소를 확인한 뒤 잠시 후 다시 시도해 주세요.'
}

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { requestOtp, verifyOtp } = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const emailInputRef = useRef<HTMLInputElement>(null)
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
    // aria-disabled 패턴: 버튼을 disabled로 잠그지 않는 대신 여기서 중복 제출을 가드.
    if (busy) return
    setBusy(true)
    setErrorMsg('')
    setMessage('')
    const { error } = await requestOtp(email)
    setBusy(false)
    if (error) {
      setErrorMsg(toKoreanRequestError(error.message))
      // 에러 시 포커스를 이메일 입력으로 복귀 (스크린리더 사용자 흐름).
      emailInputRef.current?.focus()
      return
    }
    setStep('code')
    setMessage('이메일로 보내드린 인증 코드를 입력해 주세요.')
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    // aria-disabled 패턴: 제출 중이거나 코드가 비어 있으면 가드.
    if (busy || code.trim().length === 0) return
    setBusy(true)
    setErrorMsg('')
    const { error } = await verifyOtp(email, code)
    setBusy(false)
    if (error) {
      // Supabase 영어 오류를 사용자 친화 한국어로 치환.
      setErrorMsg('코드가 올바르지 않거나 만료되었어요. 코드를 다시 확인하거나 새 코드를 받아 주세요.')
      // 에러 시 포커스를 코드 입력으로 복귀.
      codeInputRef.current?.focus()
      return
    }
    // 성공: onAuthStateChange가 user를 채우고, 여기서 모달을 닫는다.
    handleDialogOpenChange(false)
  }

  function backToEmail() {
    if (busy) return
    setStep('email')
    setCode('')
    setErrorMsg('')
    setMessage('')
    // 이메일 입력으로 포커스 이동 (단계 전환 렌더 후).
    setTimeout(() => emailInputRef.current?.focus(), 50)
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
            <div className="space-y-2">
              <label htmlFor="auth-email" className="text-sm font-medium text-foreground">
                이메일 주소
              </label>
              <Input
                ref={emailInputRef}
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="이메일 주소 입력"
              />
            </div>
            <Button type="submit" aria-disabled={busy}>
              {busy ? '발송 중...' : '인증 코드 받기'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="auth-code" className="text-sm font-medium text-foreground">
                인증 코드
              </label>
              <Input
                ref={codeInputRef}
                id="auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="인증 코드 입력"
                aria-describedby="auth-code-hint"
              />
              <p id="auth-code-hint" className="text-xs text-muted-foreground">
                이메일로 받은 인증 코드를 입력해 주세요
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" aria-disabled={busy || code.trim().length === 0}>
                {busy ? '확인 중...' : '로그인'}
              </Button>
              <Button type="button" variant="outline" onClick={backToEmail} aria-disabled={busy}>
                이메일 다시 입력
              </Button>
            </div>
          </form>
        )}

        <div aria-live="polite" className="min-h-[1.5rem] text-sm">
          {errorMsg ? (
            <span className="text-destructive">{errorMsg}</span>
          ) : busy ? (
            <span>{step === 'email' ? '발송 중...' : '확인 중...'}</span>
          ) : (
            message
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
