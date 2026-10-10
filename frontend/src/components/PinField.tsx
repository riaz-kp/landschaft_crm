import { useState } from 'react'
import type { LatLng } from '../domain/types'
import { MapPicker } from './MapPicker'
import { Icon } from './Icon'

/**
 * An optional map pin inside a form. Folded away until wanted, so a quick
 * booking stays quick; opened, it is the usual map with search and
 * "my location".
 */
export function PinField({
  value, onChange, query, fallback,
}: {
  value?: LatLng
  onChange: (next?: LatLng) => void
  /** Searched for when the map opens, e.g. the typed location. */
  query?: string
  /** Shown when nothing is pinned but the map can still place it, e.g. at the client's project site. */
  fallback?: string
}) {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <div className="space-y-2">
        <MapPicker value={value} onChange={onChange} initialQuery={query} height={240} />
        <div className="flex justify-end">
          <button type="button" onClick={() => setOpen(false)} className="btn-primary py-1.5 text-xs">
            <Icon name="check" className="h-3.5 w-3.5" /> Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${value ? 'border-brand-200 bg-brand-50/50' : 'border-dashed border-stone-300'}`}>
      <Icon name="pin" className={`h-4 w-4 shrink-0 ${value ? 'text-brand-600' : 'text-stone-400'}`} />
      <span className="min-w-0 flex-1 text-stone-600">
        {value ? 'Pinned on the map' : fallback ?? 'Not pinned — pin it to show it on the map'}
      </span>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary py-1 text-xs">
        {value ? 'Move pin' : 'Pin on map'}
      </button>
      {value && (
        <button type="button" onClick={() => onChange(undefined)} className="text-xs font-semibold text-stone-400 hover:text-red-600">
          Remove
        </button>
      )}
    </div>
  )
}
