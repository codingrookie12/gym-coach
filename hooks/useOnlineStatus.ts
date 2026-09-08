'use client'

import { useState, useEffect } from 'react'

export function useOnlineStatus(): boolean {
  // `typeof navigator !== 'undefined'` is NOT a safe SSR guard: Node.js 21+
  // ships a minimal global `navigator` (user-agent identification only, no
  // `onLine`), so on the server this branch was taken and `navigator.onLine`
  // resolved to `undefined` instead of the intended `true` fallback —
  // `undefined` is falsy, which flipped `OfflineIndicator`'s visibility on
  // the server relative to a real (online) browser client, causing a
  // hydration mismatch. `window` has no server-side equivalent at all, so
  // it's the reliable SSR check.
  const [online, setOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    function handleOnline() { setOnline(true) }
    function handleOffline() { setOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
