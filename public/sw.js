const CACHE_NAME = 'gym-coach-v3'
const SHELL_ASSETS = [
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
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

  // Never intercept navigation requests — let the server (middleware/auth) handle them
  if (event.request.mode === 'navigate') {
    return
  }

  // Never cache anything that isn't a same-origin GET. This includes:
  //   - cross-origin requests (Supabase REST/Auth, third-party APIs)
  //   - POST / PATCH / PUT / DELETE / OPTIONS
  // The previous logic only excluded /api/ and /auth/ paths, which let the
  // Supabase REST URL (https://*.supabase.co/rest/v1/...) be cache-first and
  // silently return stale rows after a successful write.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    return
  }

  // Don't cache same-origin API or auth routes either.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // Cache-first for static same-origin assets only.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
