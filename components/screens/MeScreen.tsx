'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { User } from '@supabase/supabase-js'
import { useTheme } from '@/components/ThemeProvider'
import { setLocaleCookie } from '@/app/actions/locale'
import { syncUserLocale } from '@/lib/i18n/syncUserLocale'
import type { Locale } from '@/lib/i18n/config'

interface MeScreenProps {
  user: User | null
  onLogout: () => void
}

const ROW_MIN_HEIGHT = '44px'

/** Shared two-option segmented control (theme + language) — 44px min tap
 *  targets, token-driven, no hardcoded pixel widths on the label text
 *  (flex + padding only, per CLAUDE.md's localized-text rule). */
function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: '2px', overflow: 'hidden' }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="font-mono"
            style={{
              flex: 1,
              minHeight: ROW_MIN_HEIGHT,
              padding: '10px 12px',
              background: active ? 'var(--accent)' : 'none',
              color: active ? 'var(--on-accent)' : 'var(--text-mid)',
              border: 'none',
              fontSize: '0.7rem',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function MeScreen({ user, onLogout }: MeScreenProps) {
  const t = useTranslations('me')
  const common = useTranslations('common')
  const { theme, setTheme } = useTheme()
  const locale = useLocale() as Locale
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [switchingLocale, setSwitchingLocale] = useState(false)

  const meta = user?.user_metadata ?? {}
  const fullName: string | null = meta.full_name ?? meta.name ?? null

  async function handleLocaleChange(next: string) {
    if (next === locale || switchingLocale) return
    setSwitchingLocale(true)
    await setLocaleCookie(next as Locale)
    if (user) syncUserLocale(user.id, next as Locale)
    startTransition(() => {
      router.refresh()
      setSwitchingLocale(false)
    })
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div
        className="safe-top flex items-center px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
          {t('header')}
        </span>
      </div>

      {/* Content */}
      <div className="scroll-area" style={{ flex: 1, padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* Account section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <span className="font-mono section-label" style={{ marginBottom: '12px' }}>
            {t('account')}
          </span>

          {fullName && (
            <div style={{ minHeight: ROW_MIN_HEIGHT, display: 'flex', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
              <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                {fullName}
              </span>
            </div>
          )}

          <div style={{ minHeight: ROW_MIN_HEIGHT, display: 'flex', alignItems: 'center', paddingTop: fullName ? '10px' : '0', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-mid)', letterSpacing: '0.05em' }}>
              {user?.email ?? '—'}
            </span>
          </div>

          <div style={{ paddingTop: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={onLogout}
              className="font-mono"
              style={{
                minHeight: ROW_MIN_HEIGHT,
                width: '100%',
                fontSize: '0.75rem',
                color: 'var(--rust)',
                letterSpacing: '0.08em',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase',
                padding: 0,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {t('signOut')}
            </button>
          </div>

          <div style={{ paddingTop: '10px' }}>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono"
              style={{
                minHeight: ROW_MIN_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.08em',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}
            >
              {t('privacyPolicy')}
            </a>
          </div>
        </div>

        {/* Appearance — GYM-19 theme toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span className="font-mono section-label">{t('appearance')}</span>
          <SegmentedToggle
            options={[
              { value: 'dark', label: t('themeDark').toUpperCase() },
              { value: 'light', label: t('themeLight').toUpperCase() },
            ]}
            value={theme}
            onChange={(v) => setTheme(v as 'dark' | 'light')}
          />
        </div>

        {/* Language — GYM-29 locale switcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span className="font-mono section-label">{t('language')}</span>
          <SegmentedToggle
            options={[
              { value: 'en', label: t('languageEnglish').toUpperCase() },
              { value: 'es', label: t('languageSpanish').toUpperCase() },
            ]}
            value={locale}
            onChange={handleLocaleChange}
          />
          {switchingLocale && (
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
              {common('loading')}
            </span>
          )}
        </div>

      </div>
    </div>
  )
}
