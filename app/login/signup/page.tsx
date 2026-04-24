'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Insert public profile row (display_name = email prefix before @)
    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        display_name: email.split('@')[0],
      })
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
            We sent a confirmation link to <span style={{ color: 'var(--text-primary)' }}>{email}</span>.
            Click it to activate your account.
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
            CREATE ACCOUNT
          </div>
        </div>

        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={inputStyle}
          />

          {error && (
            <div style={{ color: 'var(--rust)', fontSize: '0.8rem', letterSpacing: '0.03em' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={primaryButtonStyle}>
            {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <Link href="/login" style={linkStyle}>
            ALREADY HAVE AN ACCOUNT
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
