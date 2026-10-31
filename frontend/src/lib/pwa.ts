import { useSyncExternalStore } from 'react'

/** A newer build, installed and waiting for the user to reload into it. */
let waiting: ServiceWorker | null = null
const listeners = new Set<() => void>()
let updateRequested = false

function offer(worker: ServiceWorker) {
  waiting = worker
  listeners.forEach((fn) => fn())
}

/**
 * Installs the service worker (src/sw.js), which makes the app installable
 * and lets it open offline. Built app only: in development it would serve
 * stale files over Vite's live reload. Client links (/portal/…) are one-off
 * visits, so they don't download the whole CRM for offline use.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  if (window.location.pathname.startsWith('/portal/')) return

  // Only when the user chose to reload: the first install also takes control, and must not reload the page.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) window.location.reload()
  })

  // After the page has loaded, so caching the app doesn't compete with opening it.
  const register = () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker)
        })
      })
      // The office keeps the CRM open all day; look for a new build every hour.
      setInterval(() => void registration.update().catch(() => {}), 60 * 60 * 1000)
    }).catch((error: unknown) => console.warn('Service worker not registered', error))
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => waiting !== null,
  )
}

/** Switches to the waiting build; the page reloads once it has taken over. */
export function applyUpdate() {
  if (!waiting) return
  updateRequested = true
  waiting.postMessage('skip-waiting')
}
