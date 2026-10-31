import { useState } from 'react'
import { applyUpdate, useUpdateReady } from '../lib/pwa'
import { Icon } from './Icon'

/**
 * Offers a new version once it has downloaded. Never reloads by itself, so
 * nobody loses a half-filled form; "Later" leaves it until the next visit.
 */
export function UpdatePrompt() {
  const ready = useUpdateReady()
  const [dismissed, setDismissed] = useState(false)
  if (!ready || dismissed) return null

  return (
    // Above the foreman's tab bar on phones; bottom of the screen elsewhere.
    <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 sm:bottom-6">
      <div role="status" className="flex w-full max-w-md animate-fade-in items-center gap-3 rounded-2xl bg-brand-950 py-2.5 pl-4 pr-2.5 text-white shadow-lift ring-1 ring-white/10">
        <Icon name="repeat" className="h-4 w-4 shrink-0 text-[#C8B8A2]" />
        <p className="min-w-0 flex-1 text-sm">A new version of the CRM is ready.</p>
        <button onClick={() => setDismissed(true)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-200 hover:bg-white/10">
          Later
        </button>
        <button onClick={applyUpdate} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-brand-50">
          Reload
        </button>
      </div>
    </div>
  )
}
