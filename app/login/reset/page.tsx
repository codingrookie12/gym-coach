'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div style={centeredLayout}>
        <div style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
          <div
            className="font-display"
            style={{ fontSize: '2rem', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: '16px' }}
          >
            CHECK YOUR EMAIL
          </div>
          <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '28px' }}>
            If an account exists for <span style={{ color: 'var(--text-primary)' }}>{email}</span>,
            you&apos;ll receive a password reset link shortly.
          </p>
          <Link href="/login" style={linkStyle}>
            BACK TO SIGN IN
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={centeredLayout}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <span
            className="font-display"
            style={{ fontSize: '2rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}
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
            RESET PASSWORD
          </div>
        </div>

        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />

          {error && (
            <div style={{ color: 'var(--rust)', fontSize: '0.8rem', letterSpacing: '0.03em' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={primaryButtonStyle}>
            {loading ? 'SENDING…' : 'SEND RESET LINK'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <Link href="/login" style={linkStyle}>
            BACK TO SIGN IN
          </Link>
        </div>
      </div>
    </div>
  )
}

const centeredLayout: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--bg)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 20px',
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

const linkStyle: React.CSSProperties = {
  color: 'var(--text-mid)',
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  fontFamily: "'Bebas Neue', sans-serif",
  textDecoration: 'none',
}
