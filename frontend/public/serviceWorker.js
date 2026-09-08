const CACHE_NAME = 'appointment-app-v4'
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
  '/favicon-32.png',
  '/favicon-64.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === 'basic'
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Live data always goes to the network — never serve stale customers/appointments
  if (url.pathname.startsWith('/customers') || url.pathname.startsWith('/appointments')) return

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)

      if (cached) {
        // Stale-while-revalidate: answer from cache, refresh it in the background.
        event.waitUntil(
          fetch(request)
            .then(async (response) => {
              if (isCacheable(response)) {
                const cache = await caches.open(CACHE_NAME)
                await cache.put(request, response)
              }
            })
            .catch(() => {}),
        )
        return cached
      }

      try {
        const response = await fetch(request)
        if (isCacheable(response)) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(request, response.clone()).catch(() => {})
        }
        return response
      } catch {
        // Never resolve respondWith() with undefined — that surfaces as
        // "ServiceWorker intercepted the request and encountered an unexpected error".
        if (request.mode === 'navigate') {
          const shell = await caches.match('/')
          if (shell) return shell
        }
        return new Response('', { status: 504, statusText: 'Offline' })
      }
    })(),
  )
})
