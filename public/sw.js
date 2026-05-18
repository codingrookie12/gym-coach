const CACHE_NAME = 'gym-coach-v3'
const SHELL_ASSETS = [
  '/manifest.json',
]
// The app shell HTML to serve for navigation requests when offline.
// Next.js serves the same HTML for all routes (it's a SPA shell), so
// caching '/' is enough to give the user the app skeleton offline.
const SHELL_URL = '/'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([...SHELL_ASSETS, SHELL_URL]))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Don't cache API calls or auth routes — let them fail fast so the
  // outbox path in app/page.tsx triggers correctly.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // Navigation requests: try network first, fall back to cached shell.
  // This ensures the app loads even on a cold offline launch.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(SHELL_URL).then(cached => cached ?? Response.error())
      )
    )
    return
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
