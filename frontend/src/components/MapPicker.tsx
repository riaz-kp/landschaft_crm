import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '../domain/types'
import { Icon } from './Icon'

/** Centre of Kerala — where a new map opens before a pin is dropped. */
const KERALA: LatLng = { lat: 10.1632, lng: 76.6413 }

const PIN = L.divIcon({
  className: '',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 43s15-14.2 15-26A15 15 0 0 0 2 17c0 11.8 15 26 15 26z" fill="#2d6b46" stroke="#fff" stroke-width="2.5"/>
    <circle cx="17" cy="17" r="6" fill="#fff"/></svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
})

interface Place {
  display_name: string
  lat: string
  lon: string
}

/** OpenStreetMap's public geocoder. Called only when someone searches, never per keystroke. */
async function geocode(query: string): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

async function reverseGeocode(at: LatLng): Promise<string | undefined> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&lat=${at.lat}&lon=${at.lng}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return undefined
  const data = await res.json() as { address?: Record<string, string> }
  const a = data.address ?? {}
  // A short "locality, town" rather than the full postal address.
  const parts = [a.suburb ?? a.neighbourhood ?? a.village ?? a.hamlet, a.city ?? a.town ?? a.county ?? a.state_district]
  return parts.filter(Boolean).join(', ') || undefined
}

/**
 * The project site on a map. Click or drag the pin to place it, search for a
 * place, or use the device's location. Read-only when `onChange` is omitted.
 */
export function MapPicker({
  value, onChange, onPlaceName, initialQuery, height = 320,
}: {
  value?: LatLng
  onChange?: (at: LatLng) => void
  /** Called with a short place name after the pin moves, to fill the site location. */
  onPlaceName?: (name: string) => void
  initialQuery?: string
  height?: number
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const editable = Boolean(onChange)
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Callbacks change every render; the map handlers read the latest through refs.
  const change = useRef(onChange)
  const named = useRef(onPlaceName)
  change.current = onChange
  named.current = onPlaceName

  const place = (at: LatLng, zoom?: number, fromUser = true) => {
    const m = map.current
    if (!m) return
    if (!marker.current) {
      marker.current = L.marker(at, { icon: PIN, draggable: editable }).addTo(m)
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng()
        change.current?.({ lat: p.lat, lng: p.lng })
        reverseGeocode({ lat: p.lat, lng: p.lng }).then((n) => n && named.current?.(n)).catch(() => {})
      })
    } else {
      marker.current.setLatLng(at)
    }
    m.setView(at, zoom ?? Math.max(m.getZoom(), 14))
    if (fromUser) {
      change.current?.(at)
      reverseGeocode(at).then((n) => n && named.current?.(n)).catch(() => {})
    }
  }

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { scrollWheelZoom: editable, zoomControl: true, attributionControl: true })
      .setView(value ?? KERALA, value ? 15 : 7)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m)
    map.current = m
    if (value) place(value, 15, false)
    if (editable) m.on('click', (e: L.LeafletMouseEvent) => place({ lat: e.latlng.lat, lng: e.latlng.lng }))
    // The map is often drawn inside a card that is still settling its size.
    setTimeout(() => m.invalidateSize(), 150)
    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  // Keep an external change (e.g. a reset) in step with the pin.
  useEffect(() => {
    if (value && marker.current) {
      const p = marker.current.getLatLng()
      if (Math.abs(p.lat - value.lat) > 1e-7 || Math.abs(p.lng - value.lng) > 1e-7) place(value, undefined, false)
    }
  }, [value?.lat, value?.lng])

  const search = async () => {
    if (!query.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const found = await geocode(query.trim())
      setResults(found)
      if (found.length === 0) setMessage('No places found. Try a nearby town, or click the map.')
    } catch {
      setMessage('Search is unavailable right now — click the map to drop the pin instead.')
    } finally {
      setBusy(false)
    }
  }

  const locate = () => {
    if (!navigator.geolocation) return setMessage('This device cannot share its location.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); place({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 17) },
      () => { setBusy(false); setMessage('Location permission was refused — search or click the map instead.') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="space-y-2">
      {editable && (
        <div className="relative">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                className="input pl-9"
                value={query}
                placeholder="Search a place, e.g. Kowdiar, Thiruvananthapuram"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={search} disabled={busy} className="btn-secondary flex-1 sm:flex-none">
                {busy ? 'Searching…' : 'Search'}
              </button>
              <button type="button" onClick={locate} disabled={busy} className="btn-secondary flex-1 sm:flex-none" title="Use this device's location">
                <Icon name="pin" className="h-4 w-4" /> My location
              </button>
            </div>
          </div>
          {results.length > 0 && (
            <ul className="absolute z-[500] mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    onClick={() => { place({ lat: Number(r.lat), lng: Number(r.lon) }, 16); setResults([]) }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-brand-50"
                  >
                    <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span className="line-clamp-2">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100" />
      {message && <p className="text-xs font-medium text-amber-700">{message}</p>}
      {editable && (
        <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <span>Click the map or drag the pin to the exact site.</span>
          {value && <span className="tabular-nums">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>}
        </p>
      )}
    </div>
  )
}

export function mapsUrl(at: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${at.lat},${at.lng}`
}
