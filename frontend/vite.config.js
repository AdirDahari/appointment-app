import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND_URL = 'http://127.0.0.1:8000'

// The real service worker lives in public/ and is only registered in production
// builds. If one was ever installed on this origin (e.g. from `vite preview`),
// it would keep intercepting Vite's dev module requests and break the page — so
// in dev we serve a worker whose only job is to uninstall itself and reload.
function devServiceWorkerKillSwitch() {
  return {
    name: 'dev-service-worker-kill-switch',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/serviceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Cache-Control', 'no-store')
        res.end(
          [
            "self.addEventListener('install', () => self.skipWaiting());",
            "self.addEventListener('activate', (event) => {",
            '  event.waitUntil((async () => {',
            '    const keys = await caches.keys();',
            '    await Promise.all(keys.map((key) => caches.delete(key)));',
            '    await self.registration.unregister();',
            "    const clients = await self.clients.matchAll({ type: 'window' });",
            '    clients.forEach((client) => client.navigate(client.url));',
            '  })());',
            '});',
          ].join('\n'),
        )
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devServiceWorkerKillSwitch()],
  server: {
    // Lets a Cloudflare quick tunnel reach the dev server (used to expose the
    // privacy-policy page publicly for Meta's app review).
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/customers': BACKEND_URL,
      '/appointments': BACKEND_URL,
      '/auth': BACKEND_URL,
      '/push': BACKEND_URL,
    },
  },
})
