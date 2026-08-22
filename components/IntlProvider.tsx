'use client'

import { IntlProvider as UseIntlProvider } from 'use-intl/react'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'

interface IntlProviderProps {
  locale: Locale
  messages: Record<string, unknown>
  children: ReactNode
}

/**
 * GYM-29 / Phase 1 checker fix (2026-08-22): a plain 'use client' wrapper
 * around use-intl/react's own IntlProvider, used INSTEAD of next-intl's own
 * <NextIntlClientProvider> in app/layout.tsx.
 *
 * Root cause (found via superpowers:systematic-debugging): next-intl's
 * `NextIntlClientProvider`, when imported from 'next-intl' inside an async
 * Server Component (app/layout.tsx), resolves via package.json's
 * "react-server" conditional export to `NextIntlClientProviderServer` — an
 * async Server Component that itself renders the real 'use client' provider
 * as a nested lazy reference. In this project, Next 14.2.35's dev-mode
 * webpack bundler fails to register that nested client reference in the
 * browser's module map, crashing every route on first hydration
 * ("Cannot read properties of undefined (reading 'call')" at
 * mountLazyComponent). Reproduced identically across next-intl 4.10.0 and
 * 4.13.7 (not a version regression) and with a maximally minimal layout
 * (not an interaction with ThemeProvider/LocaleSync) — isolated to
 * next-intl's own Server→Client trampoline. `next build` was never
 * affected — only dev's incremental on-demand compilation hits this.
 *
 * Marking next-intl/use-intl as `serverComponentsExternalPackages` (tried
 * first) does fix that specific crash, but trades it for two worse ones:
 * (a) this app's own `next-intl/server` imports resolve to the wrong
 * (client-guard-stub) conditional-export branch when the package is
 * externalized, and (b) use-intl's own hooks (`useContext`) end up reading
 * a different React module instance than the one Next's RSC runtime uses,
 * an "invalid hook call"-class bug — externalizing a package that itself
 * uses React hooks is a known-risky move. Reverted.
 *
 * This wrapper is the actual fix: since IT is a plain component in our own
 * app code (not inside node_modules, not behind any conditional export),
 * Next's dev-mode 'use client' boundary detection handles it the same
 * reliable way it handles every other client component in this app — no
 * nested trampoline, no conditional-exports ambiguity. use-intl/react's
 * `IntlProvider` is the exact same underlying provider next-intl's own
 * client wrapper calls (confirmed by reading next-intl's source) and
 * `next-intl`'s hooks (useTranslations, etc., used throughout
 * components/ui/* and the rebuilt screens) read from the same shared
 * use-intl context regardless of which component mounted the provider.
 */
export default function IntlProvider({ locale, messages, children }: IntlProviderProps) {
  return (
    <UseIntlProvider locale={locale} messages={messages}>
      {children}
    </UseIntlProvider>
  )
}
