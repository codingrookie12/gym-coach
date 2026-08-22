'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE, type Locale, isLocale } from '@/lib/i18n/config'

/**
 * GYM-29: sets the persisted locale cookie server-side. Called from the
 * MeScreen locale switcher (client component) via a form action / onClick
 * handler. The client then calls router.refresh() so the RSC tree
 * re-renders with next-intl's new message bundle.
 */
export async function setLocaleCookie(locale: Locale) {
  if (!isLocale(locale)) return
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
