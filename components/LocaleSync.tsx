'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'
import { setLocaleCookie } from '@/app/actions/locale'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/config'
import { syncUserLocale } from '@/lib/i18n/syncUserLocale'
import { createSupabaseBrowserClient } from '@/lib/supabase'

function hasLocaleCookie(): boolean {
  return document.cookie.split('; ').some(c => c.startsWith(`${LOCALE_COOKIE}=`))
}

/**
 * GYM-29: makes the silent first-load Accept-Language auto-detect
 * sticky — on mount, if no locale cookie exists yet, persists the
 * server-resolved locale (passed down implicitly via next-intl's
 * useLocale()) as a real cookie, and best-effort syncs it to
 * `public.users.locale` for a signed-in user. Runs once near the app
 * root (see app/layout.tsx); renders nothing.
 */
export default function LocaleSync() {
  const locale = useLocale() as Locale
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (hasLocaleCookie()) return

    setLocaleCookie(locale)

    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) syncUserLocale(data.user.id, locale)
      })
      .catch(() => {})
  }, [locale])

  return null
}
