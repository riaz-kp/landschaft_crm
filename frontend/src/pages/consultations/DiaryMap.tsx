import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatDateLong, formatTime, today } from '../../domain/format'
import type { MapPlace } from '../../domain/places'
import { Pills, EmptyState } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { directionsUrl } from '../../components/mapLinks'
import { DIARY_COLOUR, escapeHtml, pinIcon } from '../../components/mapPins'

/** A consultation or site visit as the diary map shows it. */
export interface DiaryItem {
  id: string
  kind: 'consultation' | 'visit'
  date: string
  time?: string
  title: string
  sub: string
  done: boolean
  place?: MapPlace
  /** Why it has no pin, when it has none. */
  missing?: string
}

type Range = 'upcoming' | 'week' | 'all'

/**
 * Where the consultations and site visits are, on one map. Pins are green for
 * consultations and blue for site visits; pick one to see it beside the map,
 * get directions or open it. Anything that cannot be placed is listed with
 * the reason.
 */
export function DiaryMap({
  items, week, onOpen,
}: { items: DiaryItem[]; week: [string, string]; onOpen: (item: DiaryItem) => void }) {
  const [range, setRange] = useState<Range>('upcoming')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  const inRange = (i: DiaryItem) =>
    range === 'all' || (range === 'week' ? i.date >= week[0] && i.date <= week[1] : i.date >= today() && !i.done)
  const shown = items
    .filter(inRange)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  const pinned = shown.filter((i) => i.place)
  const unpinned = shown.filter((i) => !i.place)
  const selected = pinned.find((i) => i.id === selectedId)

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true }).setView([10.2, 76.4], 7)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m)
    map.current = m
    layer.current = L.layerGroup().addTo(m)
    const resize = setTimeout(() => m.invalidateSize(), 150)
    return () => { clearTimeout(resize); m.remove(); map.current = null; layer.current = null }
  }, [])

  useEffect(() => {
    const group = layer.current
    if (!group) return
    group.clearLayers()
    for (const i of pinned) {
      const marker = L.marker([i.place!.coords.lat, i.place!.coords.lng], {
        icon: pinIcon(DIARY_COLOUR[i.kind], i.id === selectedId),
        zIndexOffset: i.id === selectedId ? 1000 : 0,
        title: i.title,
        opacity: i.done ? 0.6 : 1,
      })
      marker.bindTooltip(
        `<strong>${escapeHtml(i.title)}</strong><br/>${escapeHtml(formatDateLong(i.date))}${i.time ? ` · ${formatTime(i.time)}` : ''}<br/>${escapeHtml(i.place!.label)}`,
        { direction: 'top', offset: [0, -30] },
      )
      marker.on('click', () => setSelectedId(i.id))
      group.addLayer(marker)
    }
  }, [pinned, selectedId])

  // Frame the pins whenever the set changes, not on every selection.
  const frameKey = pinned.map((i) => i.id).join(',')
  useEffect(() => {
    const m = map.current
    if (!m || pinned.length === 0) return
    if (pinned.length === 1) m.setView([pinned[0].place!.coords.lat, pinned[0].place!.coords.lng], 12)
    else m.fitBounds(L.latLngBounds(pinned.map((i) => [i.place!.coords.lat, i.place!.coords.lng])), { padding: [40, 40], maxZoom: 13 })
  }, [frameKey])

  const pick = (i: DiaryItem) => {
    setSelectedId(i.id)
    if (i.place) map.current?.setView([i.place.coords.lat, i.place.coords.lng], Math.max(map.current.getZoom(), 12))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3">
        <Pills<Range>
          active={range}
          onChange={setRange}
          options={[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'week', label: 'This week' },
            { key: 'all', label: 'All' },
          ]}
        />
        <span className="text-xs text-stone-500">{pinned.length} on the map{unpinned.length ? ` · ${unpinned.length} without a place` : ''}</span>
      </div>

      <div className="relative">
        <div ref={el} className="h-[420px] w-full bg-stone-100" />
        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-stone-200 bg-white p-3 shadow-xl sm:left-auto sm:w-80">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: DIARY_COLOUR[selected.kind] }}>
                  <Icon name={selected.kind === 'visit' ? 'pin' : 'clock'} className="h-3.5 w-3.5" />
                  {selected.date === today() ? 'Today' : formatDateLong(selected.date)}{selected.time && ` · ${formatTime(selected.time)}`}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-stone-900">{selected.title}</p>
                <p className="text-xs text-stone-500">{selected.sub}</p>
                <p className="mt-1 text-xs text-stone-400">
                  {selected.place!.label}{selected.place!.fromProject && ' · the client’s project site'}
                </p>
              </div>
              <button onClick={() => setSelectedId(null)} className="btn-icon -mr-1 -mt-1 h-7 w-7" aria-label="Close"><Icon name="x" className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => onOpen(selected)} className="btn-secondary py-1.5 text-xs">Open</button>
              <a href={directionsUrl(selected.place!.coords)} target="_blank" rel="noreferrer" className="btn-primary py-1.5 text-xs">
                <Icon name="map" className="h-3.5 w-3.5" /> Directions
              </a>
            </div>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing in this range." icon="map" />
      ) : (
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {shown.map((i) => (
            <li key={i.id} className={`flex items-center gap-3 px-5 py-2.5 ${i.id === selectedId ? 'bg-brand-50/60' : ''}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DIARY_COLOUR[i.kind], opacity: i.place ? 1 : 0.35 }} />
              <button onClick={() => (i.place ? pick(i) : onOpen(i))} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-stone-800">
                  {i.done && '✓ '}{i.title}
                </span>
                <span className="block truncate text-xs text-stone-500">
                  {formatDateLong(i.date)}{i.time && ` · ${formatTime(i.time)}`} · {i.place ? i.place.label : <span className="text-amber-700">{i.missing}</span>}
                </span>
              </button>
              {i.place
                ? <Icon name="pin" className="h-4 w-4 shrink-0 text-stone-300" />
                : <button onClick={() => onOpen(i)} className="shrink-0 text-xs font-semibold text-brand-700">Open</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
