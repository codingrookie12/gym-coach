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

/**
 * Single source of truth for locale resolution (cookie, then
 * Accept-Language auto-detect, then default) — used directly by both
 * i18n/request.ts (next-intl's request config) and app/layout.tsx.
 *
 * Deliberately NOT implemented via next-intl/server's own `getLocale()`
 * export: with `next-intl`/`use-intl` marked as `serverComponentsExternalPackages`
 * in next.config.mjs (required to fix a dev-mode-only RSC lazy-loading
 * crash — see next.config.mjs's comment), imports that go through
 * `next-intl/server`'s package.json "exports" conditions from OUTSIDE the
 * next-intl package (i.e. from our own app code) can resolve to the
 * wrong (client-guard-stub) branch instead of the real react-server
 * implementation, throwing "`getLocale` is not supported in Client
 * Components" even though the caller (app/layout.tsx) is a real Server
 * Component. next-intl's own internals never hit this because they use
 * plain relative imports internally, not the public conditional exports
 * — so this helper avoids the public `next-intl/server` entry point for
 * the same reason, reading the cookie/header directly instead.
 */
export function resolveLocale(cookieLocale: string | undefined, acceptLanguage: string | null): Locale {
  return isLocale(cookieLocale) ? cookieLocale : detectLocaleFromAcceptLanguage(acceptLanguage)
}
