import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import './globals.css'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import ThemeProvider from '@/components/ThemeProvider'
import LocaleSync from '@/components/LocaleSync'
import IntlProvider from '@/components/IntlProvider'
import { THEME_COOKIE, resolveServerTheme } from '@/lib/theme'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/config'
import enMessages from '@/messages/en.json'
import esMessages from '@/messages/es.json'

const MESSAGES = { en: enMessages, es: esMessages } as const

export const metadata: Metadata = {
  title: 'Ritmo',
  description: 'Personal gym coaching app',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ritmo',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Deliberately NOT async — no `await` anywhere in this component. Found
// via superpowers:systematic-debugging (2026-08-22, Phase 1 checker
// re-review round 2): an async RootLayout that awaits before rendering a
// client-component boundary hits an intermittent (not 100% reproducible,
// but recurring and NOT self-healing on reload once triggered) Next
// 14.2.35 dev-mode bug where the RSC flight response references a lazy
// client-reference module ID the browser's webpack runtime hasn't
// registered yet — "Cannot read properties of undefined (reading
// 'call')" at mountLazyComponent. Confirmed NOT specific to next-intl:
// it reproduced identically pointing at components/IntlProvider.tsx (a
// trivial hand-rolled client wrapper) after the async-await pattern was
// otherwise fixed. `cookies()`/`headers()` are synchronous in Next 14.2
// despite next-intl's own docs/examples awaiting them (that project
// supports newer Next versions too, where they are async) — dropping
// the `await` and switching the message catalog from a dynamic
// `import()` to a static import + lookup removes every microtask tick
// between RootLayout starting and its client children rendering, which
// closes the race window. `next build` was never affected by any of
// this — production's single-pass compile doesn't have the on-demand
// chunk race dev mode does.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const theme = resolveServerTheme(cookieStore.get(THEME_COOKIE)?.value)
  // Resolved directly via lib/i18n/config.ts's resolveLocale() (cookie,
  // then Accept-Language) rather than next-intl/server's getLocale() —
  // single source of truth shared with i18n/request.ts, and keeps this
  // file's server-side logic independent of next-intl's own request-config
  // caching layer.
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headers().get('accept-language'))
  const messages = MESSAGES[locale]

  return (
    <html lang={locale} data-theme={theme}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Ritmo" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
        {/* components/IntlProvider.tsx, not next-intl's own
            <NextIntlClientProvider> — see that file's doc comment for the
            dev-mode RSC crash this works around and why. */}
        <IntlProvider locale={locale} messages={messages}>
          <ThemeProvider initialTheme={theme}>
            <ServiceWorkerRegistrar />
            <LocaleSync />
            {children}
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  )
}
