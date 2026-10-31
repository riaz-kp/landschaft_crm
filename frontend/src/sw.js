/**
 * The service worker: makes the CRM installable and lets it open without a
 * connection. The build (serviceWorker() in vite.config.ts) fills in VERSION
 * and PRECACHE and writes this file to /sw.js; it is not used in development.
 *
 * Every screen is served from the cached copy of this build, so the app opens
 * at once and offline. A new build installs alongside and waits until the user
 * chooses to reload (UpdatePrompt), so an open form is never swapped mid-entry.
 * Data still comes from Supabase; nothing here touches it.
 */

const VERSION = 'dev'
const PRECACHE = []

const SHELL = `landschaft-shell-${VERSION}`
const FONTS = 'landschaft-fonts'

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('landschaft-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    // Screens are routes of the one page; a path with a file extension is a real file.
    if (request.mode === 'navigate' && !/\.[a-z0-9]+$/i.test(url.pathname)) {
      event.respondWith(fromShell('/index.html', request))
    } else if (PRECACHE.includes(url.pathname)) {
      event.respondWith(fromShell(url.pathname, request))
    }
  } else if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request))
  } else if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request))
  }
  // Everything else (Supabase, map tiles, uploads) goes to the network untouched.
})

/**
 * Fetches this build's files. Hashed files under /assets/ never change, so one
 * already held from the last build is copied over instead of downloaded again.
 */
async function precache() {
  const cache = await caches.open(SHELL)
  await Promise.all(PRECACHE.map(async (path) => {
    const held = path.startsWith('/assets/') ? await caches.match(path) : undefined
    if (held) await cache.put(path, held)
    else await cache.add(new Request(path, { cache: 'reload' }))
  }))
}

async function fromShell(path, request) {
  const cached = await caches.match(path, { cacheName: SHELL })
  return cached ?? fetch(request)
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: FONTS })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await (await caches.open(FONTS)).put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(FONTS)
  const cached = await cache.match(request)
  const fresh = fetch(request).then((response) => {
    if (response.ok) void cache.put(request, response.clone())
    return response
  })
  if (cached) {
    fresh.catch(() => {})
    return cached
  }
  return fresh
}
