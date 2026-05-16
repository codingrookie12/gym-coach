'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'

function ErrorFromParams({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('error') === 'auth_callback_failed') {
      onError('Authentication failed. Please try again.')
    }
  }, [searchParams, onError])
  return null
}

type Step = 'email' | 'verify'

const RESEND_SECONDS = 30

export default function LoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const normalizedEmail = () => email.trim().toLowerCase()

  function mapError(message: string): string {
    const m = message.toLowerCase()
    if (m.includes('rate') || m.includes('too many') || m.includes('429')) {
      return 'Too many attempts — try Google sign-in or wait a few minutes.'
    }
    if (m.includes('invalid') || m.includes('expired')) {
      return 'Code is invalid or expired — request a new one.'
    }
    return message
  }

  async function sendOtp(): Promise<boolean> {
    setError(null)
    const target = normalizedEmail()
    if (!target) {
      setError('Enter your email.')
      return false
    }
    const { error: err } = await supabase.auth.signInWithOtp({
      email: target,
      options: { shouldCreateUser: true },
    })
    if (err) {
      setError(mapError(err.message))
      return false
    }
    setResendIn(RESEND_SECONDS)
    return true
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    const ok = await sendOtp()
    setSending(false)
    if (ok) {
      setStep('verify')
      setCode('')
      setTimeout(() => codeInputRef.current?.focus(), 50)
    }
  }

  async function verifyCode(token: string) {
    setVerifying(true)
    setError(null)
    const { error: err } = await supabase.auth.verifyOtp({
      email: normalizedEmail(),
      token,
      type: 'email',
    })
    if (err) {
      setError(mapError(err.message))
      setCode('')
      setVerifying(false)
      codeInputRef.current?.focus()
      return
    }
    router.replace('/')
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6 && !verifying) {
      void verifyCode(digits)
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6 || verifying) return
    await verifyCode(code)
  }

  async function handleResend() {
    if (resendIn > 0 || sending) return
    setSending(true)
    await sendOtp()
    setSending(false)
  }

  function handleBack() {
    setStep('email')
    setCode('')
    setError(null)
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setError(err.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div style={layoutStyle}>
      <Suspense>
        <ErrorFromParams onError={setError} />
      </Suspense>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <span className="font-display" style={wordmarkStyle}>
            GYM COACH
          </span>
          <div style={subWordmarkStyle}>
            {step === 'email' ? 'SIGN IN' : 'VERIFY'}
          </div>
        </div>

        {step === 'email' ? (
          <>
            <form
              onSubmit={handleContinue}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                inputMode="email"
                style={inputStyle}
              />

              {error && <div style={errorStyle}>{error}</div>}

              <button type="submit" disabled={sending} style={primaryButtonStyle}>
                {sending ? 'SENDING…' : 'CONTINUE'}
              </button>
            </form>

            <div style={dividerStyle}>
              <div style={dividerLineStyle} />
              <span style={dividerLabelStyle}>OR</span>
              <div style={dividerLineStyle} />
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              style={secondaryButtonStyle}
            >
              <GoogleIcon />
              {googleLoading ? 'REDIRECTING…' : 'CONTINUE WITH GOOGLE'}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '6px' }}>
                Check your email
              </div>
              <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                We sent a 6-digit code to{' '}
                <span style={{ color: 'var(--text-primary)' }}>{normalizedEmail()}</span>
              </div>
            </div>

            <form
              onSubmit={handleVerifySubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                required
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontSize: '1.2rem',
                }}
              />

              {error && <div style={errorStyle}>{error}</div>}

              <button
                type="submit"
                disabled={code.length !== 6 || verifying}
                style={{
                  ...primaryButtonStyle,
                  opacity: code.length !== 6 || verifying ? 0.5 : 1,
                  cursor: code.length !== 6 || verifying ? 'default' : 'pointer',
                }}
              >
                {verifying ? 'VERIFYING…' : 'VERIFY'}
              </button>
            </form>

            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button onClick={handleBack} style={textButtonStyle}>
                ← BACK
              </button>
              <button
                onClick={handleResend}
                disabled={resendIn > 0 || sending}
                style={{
                  ...textButtonStyle,
                  opacity: resendIn > 0 || sending ? 0.4 : 1,
                  cursor: resendIn > 0 || sending ? 'default' : 'pointer',
                }}
              >
                {resendIn > 0 ? `RESEND IN ${resendIn}s` : 'RESEND CODE'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

const layoutStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--bg)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 20px',
}

const wordmarkStyle: React.CSSProperties = {
  fontSize: '2rem',
  color: 'var(--text-primary)',
  letterSpacing: '0.08em',
}

const subWordmarkStyle: React.CSSProperties = {
  marginTop: '6px',
  fontSize: '0.7rem',
  color: 'var(--text-secondary)',
  letterSpacing: '0.15em',
  fontFamily: "'Space Mono', monospace",
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: '2px',
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  fontFamily: "'Barlow Condensed', sans-serif",
  letterSpacing: '0.03em',
  outline: 'none',
  width: '100%',
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: '2px',
  padding: '13px',
  color: '#0C0B09',
  fontSize: '0.95rem',
  fontFamily: "'Bebas Neue', sans-serif",
  letterSpacing: '0.12em',
  cursor: 'pointer',
  width: '100%',
  marginTop: '4px',
}

const secondaryButtonStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: '2px',
  padding: '12px',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  fontFamily: "'Bebas Neue', sans-serif",
  letterSpacing: '0.1em',
  cursor: 'pointer',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
}

const textButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-mid)',
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  fontFamily: "'Bebas Neue', sans-serif",
  cursor: 'pointer',
  padding: 0,
}

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '20px 0',
}

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: 'var(--border)',
}

const dividerLabelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
}

const errorStyle: React.CSSProperties = {
  color: 'var(--rust)',
  fontSize: '0.8rem',
  letterSpacing: '0.03em',
}
