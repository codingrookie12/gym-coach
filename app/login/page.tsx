'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase'

// Isolated component so useSearchParams gets its own Suspense boundary
function ErrorFromParams({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('error') === 'auth_callback_failed') {
      onError('Authentication failed. Please try again.')
    }
  }, [searchParams, onError])
  return null
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.replace('/')
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      <Suspense>
        <ErrorFromParams onError={setError} />
      </Suspense>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        {/* Wordmark */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <span
            className="font-display"
            style={{
              fontSize: '2rem',
              color: 'var(--text-primary)',
              letterSpacing: '0.08em',
            }}
          >
            GYM COACH
          </span>
          <div
            style={{
              marginTop: '6px',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.15em',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            SIGN IN
          </div>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />

          {error && (
            <div style={{ color: 'var(--rust)', fontSize: '0.8rem', letterSpacing: '0.03em' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={primaryButtonStyle}>
            {loading ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '20px 0',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          style={secondaryButtonStyle}
        >
          <GoogleIcon />
          {googleLoading ? 'REDIRECTING…' : 'CONTINUE WITH GOOGLE'}
        </button>

        {/* Footer links */}
        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Link href="/login/signup" style={linkStyle}>
            CREATE ACCOUNT
          </Link>
          <Link href="/login/reset" style={{ ...linkStyle, color: 'var(--text-secondary)' }}>
            FORGOT PASSWORD
          </Link>
        </div>
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

const linkStyle: React.CSSProperties = {
  color: 'var(--text-mid)',
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  fontFamily: "'Bebas Neue', sans-serif",
  textDecoration: 'none',
}
