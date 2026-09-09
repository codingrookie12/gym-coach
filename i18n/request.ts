import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, defaultLocale, resolveLocale } from '@/lib/i18n/config'

// GYM-29: resolves the request locale from (1) the persisted cookie, then
// (2) a silent Accept-Language-based auto-detect, then (3) the default.
// Never a route param — this app has no /en/ or /es/ URL prefix.
// Messages are statically imported (build-time bundle), never fetched at
// runtime, so an offline user mid-session never needs a network call to
// render a label (protects lib/sessionStorage.ts's offline-first outbox).
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, (await headers()).get('accept-language'))

  return {
    locale,
    // Fixed, not derived from the request: this app has a single real user
    // (Bogotá) today and no per-user timezone preference stored anywhere.
    // Silences next-intl's ENVIRONMENT_FALLBACK warning (it otherwise falls
    // back to the server process's own TZ, which can differ from the
    // client's and would drift silently if a server ever moved regions).
    // Actual on-screen date/time formatting in components uses the
    // browser's local timezone directly (Date/Intl.DateTimeFormat with no
    // explicit timeZone) — this only affects next-intl's own internal
    // formatting, e.g. ICU date/time placeholders in translated messages.
    timeZone: 'America/Bogota',
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})

export { defaultLocale }
