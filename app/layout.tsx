import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import ThemeProvider from '@/components/ThemeProvider'
import LocaleSync from '@/components/LocaleSync'
import { THEME_COOKIE, resolveServerTheme } from '@/lib/theme'

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const theme = resolveServerTheme(cookieStore.get(THEME_COOKIE)?.value)
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} data-theme={theme}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Ritmo" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider initialTheme={theme}>
            <ServiceWorkerRegistrar />
            <LocaleSync />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
