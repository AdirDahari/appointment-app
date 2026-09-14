const CACHE_NAME = 'appointment-app-v5'
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
  if (['/customers', '/appointments', '/auth', '/push', '/webhook', '/health'].some((p) => url.pathname.startsWith(p))) return

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

// ---------- Web Push: the owner's phone learns that a customer replied ----------
self.addEventListener('push', (event) => {
  let data = { title: 'ניהול תורים', body: '', url: '/' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(target)
    }),
  )
})
