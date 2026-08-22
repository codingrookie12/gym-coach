// GYM-29: i18n architecture — Section 5 of the revamp plan.
// Cookie/DB-persisted locale, NO URL prefix (this app has no locale-scoped
// routing — a single-route Screen-state-machine, see app/page.tsx).

export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** Cookie name used to persist the resolved locale across requests. */
export const LOCALE_COOKIE = 'ritmo-locale'

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

/**
 * Silent device-locale auto-detect (first load, no cookie yet) — parses the
 * `Accept-Language` header and returns the first supported locale, or the
 * default. Never blocks onboarding, never shown as a UI step.
 */
export function detectLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale
  const preferred = acceptLanguage
    .split(',')
    .map(part => part.split(';')[0].trim().toLowerCase())
  for (const tag of preferred) {
    const base = tag.split('-')[0]
    if (isLocale(base)) return base
  }
  return defaultLocale
}
