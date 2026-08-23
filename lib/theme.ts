// GYM-19: theme toggle. Dark-first, light as a companion mode — explicit
// user toggle only, no system prefers-color-scheme auto-detection (unlike
// locale, which does auto-detect). Cookie-persisted so SSR can set
// data-theme on <html> before first paint (no flash of wrong theme).

export type Theme = 'dark' | 'light'

export const THEME_COOKIE = 'ritmo-theme'

export function isTheme(value: string | undefined | null): value is Theme {
  return value === 'dark' || value === 'light'
}

export function resolveServerTheme(cookieValue: string | undefined): Theme {
  return isTheme(cookieValue) ? cookieValue : 'dark'
}
