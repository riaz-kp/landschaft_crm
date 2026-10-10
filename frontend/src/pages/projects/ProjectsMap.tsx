import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useDb } from '../../state/useDb'
import { computeProgress, projectType } from '../../domain/progress'
import { formatCurrency, formatDate } from '../../domain/format'
import type { Project, ProjectStatus } from '../../domain/types'
import { PageHeader, Section, StatusBadge, Badge, ProgressBar, SearchInput, EmptyState, SiteName } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { mapsUrl } from '../../components/MapPicker'
import { SearchSelect } from '../../components/SearchSelect'
import { clientOptions, employeeOptions } from '../../components/pickerOptions'

type Service = 'design' | 'execution' | 'amc'
type ColourBy = 'status' | 'service'

const STATUSES: ProjectStatus[] = ['Planning', 'In Progress', 'On Hold', 'Completed']

const STATUS_COLOUR: Record<ProjectStatus, string> = {
  Planning: '#0284c7', 'In Progress': '#d97706', 'On Hold': '#78716c', Completed: '#2d6b46',
}
const SERVICE_COLOUR: Record<string, string> = {
  design: '#0284c7', execution: '#2d6b46', amc: '#b1774f', mixed: '#7c3aed',
}

/** The colour a project's pin takes: by status, or by the service it carries (violet when it carries several). */
function colourOf(p: Project, by: ColourBy): string {
  if (by === 'status') return p.delayed && p.status !== 'Completed' ? '#dc2626' : STATUS_COLOUR[p.status]
  const services = (['design', 'execution', 'amc'] as const).filter((s) => p.services[s])
  return services.length === 1 ? SERVICE_COLOUR[services[0]] : SERVICE_COLOUR.mixed
}

function pin(colour: string, selected: boolean): L.DivIcon {
  const size = selected ? 40 : 30
  return L.divIcon({
    className: '',
    html: `<svg width="${size}" height="${size * 1.3}" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))">
      <path d="M17 43s15-14.2 15-26A15 15 0 0 0 2 17c0 11.8 15 26 15 26z" fill="${colour}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="17" cy="17" r="6" fill="#fff"/></svg>`,
    iconSize: [size, size * 1.3],
    iconAnchor: [size / 2, size * 1.3 - 1],
  })
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/**
 * Every project's site on one map. Filter by service, status, project
 * manager or client; pins are coloured by status or by service, and clicking
 * one shows the project beside the map.
 */
export function ProjectsMap() {
  const db = useDb()
  const [services, setServices] = useState<Set<Service>>(new Set())
  const [statuses, setStatuses] = useState<Set<ProjectStatus>>(new Set(['Planning', 'In Progress', 'On Hold']))
  const [managerId, setManagerId] = useState('')
  const [clientId, setClientId] = useState('')
  const [delayedOnly, setDelayedOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [colourBy, setColourBy] = useState<ColourBy>('status')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => db.projects.filter((p) =>
    (services.size === 0 || [...services].some((s) => p.services[s]))
    && (statuses.size === 0 || statuses.has(p.status))
    && (!managerId || p.projectManagerId === managerId)
    && (!clientId || p.clientId === clientId)
    && (!delayedOnly || (p.delayed && p.status !== 'Completed'))
    && (!q || [p.name, p.code, p.siteLocation, db.clients.find((c) => c.id === p.clientId)?.name ?? ''].some((v) => v.toLowerCase().includes(q)))),
  [db.projects, db.clients, services, statuses, managerId, clientId, delayedOnly, q])

  const pinned = useMemo(() => filtered.filter((p) => p.siteCoords), [filtered])
  const unpinned = filtered.filter((p) => !p.siteCoords)
  const selected = db.projects.find((p) => p.id === selectedId)
  const managers = db.employees.filter((e) => db.projects.some((p) => p.projectManagerId === e.id))
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  // Build the map once.
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

  // Redraw the pins whenever the filters, colouring or selection change.
  useEffect(() => {
    const m = map.current
    const group = layer.current
    if (!m || !group) return
    group.clearLayers()
    for (const p of pinned) {
      const marker = L.marker([p.siteCoords!.lat, p.siteCoords!.lng], {
        icon: pin(colourOf(p, colourBy), p.id === selectedId),
        zIndexOffset: p.id === selectedId ? 1000 : 0,
        title: p.name,
      })
      marker.bindTooltip(`<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(p.siteLocation)}`, { direction: 'top', offset: [0, -30] })
      marker.on('click', () => setSelectedId(p.id))
      group.addLayer(marker)
    }
  }, [pinned, colourBy, selectedId])

  // Frame the filtered pins — but not on every selection, which would jump the view.
  const frameKey = pinned.map((p) => p.id).join(',')
  useEffect(() => {
    const m = map.current
    if (!m || pinned.length === 0) return
    if (pinned.length === 1) m.setView([pinned[0].siteCoords!.lat, pinned[0].siteCoords!.lng], 13)
    else m.fitBounds(L.latLngBounds(pinned.map((p) => [p.siteCoords!.lat, p.siteCoords!.lng])), { padding: [40, 40], maxZoom: 13 })
  }, [frameKey])

  const focus = (p: Project) => {
    setSelectedId(p.id)
    if (p.siteCoords) map.current?.setView([p.siteCoords.lat, p.siteCoords.lng], Math.max(map.current.getZoom(), 12), { animate: true })
  }

  const toggle = <T,>(set: Set<T>, value: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    apply(next)
  }

  const legend = colourBy === 'status'
    ? [...STATUSES.map((s) => ({ label: s, colour: STATUS_COLOUR[s] })), { label: 'Delayed', colour: '#dc2626' }]
    : [{ label: 'Design', colour: SERVICE_COLOUR.design }, { label: 'Execution', colour: SERVICE_COLOUR.execution }, { label: 'AMC', colour: SERVICE_COLOUR.amc }, { label: 'Several services', colour: SERVICE_COLOUR.mixed }]

  return (
    <div>
      <PageHeader
        title="Projects Map"
        subtitle="Every project site on one map. Filter by service, status, manager or client; click a pin to see the project."
      />

      {/* Filters */}
      <div className="card mb-5 space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Service</span>
            {(['design', 'execution', 'amc'] as const).map((s) => (
              <button key={s} onClick={() => toggle(services, s, setServices)} className={`chip px-3 py-1.5 text-sm ${services.has(s) ? 'chip-on' : ''}`}>
                {s === 'amc' ? 'AMC' : s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <span className="hidden h-6 w-px bg-stone-200 lg:block" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Status</span>
            {STATUSES.map((s) => (
              <label key={s} className={`flex cursor-pointer select-none items-center gap-1.5 rounded-xl border px-2.5 py-1 text-sm ${statuses.has(s) ? 'border-stone-300 bg-white' : 'border-dashed border-stone-200 text-stone-400'}`}>
                <input type="checkbox" checked={statuses.has(s)} onChange={() => toggle(statuses, s, setStatuses)} className="h-3.5 w-3.5 accent-brand-600" />
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOUR[s] }} />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="sm:w-48">
            <SearchSelect
              size="sm"
              value={managerId}
              onChange={setManagerId}
              options={employeeOptions(managers)}
              emptyOption="All managers"
              searchPlaceholder="Search managers"
              ariaLabel="Project manager"
            />
          </div>
          <div className="sm:w-56">
            <SearchSelect
              size="sm"
              value={clientId}
              onChange={setClientId}
              options={clientOptions(db.clients)}
              emptyOption="All clients"
              searchPlaceholder="Search clients"
              ariaLabel="Client"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-300 px-3 py-1.5 text-sm text-stone-700">
            <input type="checkbox" checked={delayedOnly} onChange={(e) => setDelayedOnly(e.target.checked)} className="h-4 w-4 accent-red-600" /> Delayed only
          </label>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, code, place…" className="sm:ml-auto sm:w-64" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Section className="relative">
          <div ref={el} className="h-[520px] w-full sm:h-[620px]" />
          {/* Colour key and switch */}
          <div className="absolute bottom-3 left-3 z-[400] max-w-[calc(100%-1.5rem)] rounded-xl border border-stone-200 bg-white/95 p-2.5 shadow-lg backdrop-blur">
            <div className="mb-1.5 flex gap-1 rounded-lg bg-stone-100 p-0.5 text-xs">
              {(['status', 'service'] as const).map((by) => (
                <button key={by} onClick={() => setColourBy(by)} className={`rounded-md px-2 py-1 font-semibold ${colourBy === by ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500'}`}>
                  Colour by {by}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {legend.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-stone-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.colour }} /> {l.label}
                </span>
              ))}
            </div>
          </div>
          <span className="absolute right-3 top-3 z-[400] rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-stone-700 shadow">
            {pinned.length} on the map
          </span>
        </Section>

        <div className="space-y-6">
          {selected && (
            <Section
              title={<Link to={`/projects/${selected.id}`} className="hover:text-brand-700">{selected.name}</Link>}
              description={`${selected.code} · ${clientName(selected.clientId)}`}
              actions={<button onClick={() => setSelectedId(null)} className="btn-icon" aria-label="Close"><Icon name="x" className="h-4 w-4" /></button>}
            >
              <div className="space-y-3 px-5 py-4 text-sm">
                <p className="flex items-center gap-1.5 text-stone-600"><Icon name="pin" className="h-4 w-4 text-stone-400" /> <SiteName name={selected.siteLocation} /></p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="stone">{projectType(selected)}</Badge>
                  <StatusBadge status={selected.status} />
                  {selected.delayed && selected.status !== 'Completed' && <Badge tone="red">Delayed</Badge>}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-stone-500"><span>Progress</span><span className="font-semibold">{computeProgress(selected).overall}%</span></div>
                  <ProgressBar value={computeProgress(selected).overall} size="sm" />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-stone-400">Manager</dt><dd className="font-medium text-stone-800">{db.employees.find((e) => e.id === selected.projectManagerId)?.name ?? '—'}</dd></div>
                  <div><dt className="text-stone-400">Value</dt><dd className="font-medium text-stone-800">{formatCurrency(selected.value, true)}</dd></div>
                  <div><dt className="text-stone-400">Started</dt><dd className="font-medium text-stone-800">{formatDate(selected.startDate)}</dd></div>
                  <div><dt className="text-stone-400">Due</dt><dd className="font-medium text-stone-800">{formatDate(selected.expectedCompletion)}</dd></div>
                </dl>
                <div className="flex gap-2 pt-1">
                  <Link to={`/projects/${selected.id}`} className="btn-primary flex-1 py-1.5">Open project</Link>
                  {selected.siteCoords && (
                    <a href={mapsUrl(selected.siteCoords)} target="_blank" rel="noreferrer" className="btn-secondary py-1.5"><Icon name="map" className="h-4 w-4" /> Directions</a>
                  )}
                </div>
              </div>
            </Section>
          )}

          <Section title="Projects" description={`${filtered.length} match${filtered.length === 1 ? 'es' : ''}`}>
            {filtered.length === 0 ? (
              <EmptyState title="No projects match these filters." icon="map" />
            ) : (
              <ul className="max-h-[440px] divide-y divide-stone-100 overflow-y-auto">
                {[...pinned, ...unpinned].map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => focus(p)}
                      className={`flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-stone-50 ${p.id === selectedId ? 'bg-brand-50' : ''}`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: p.siteCoords ? colourOf(p, colourBy) : '#d6d3d1' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-stone-800">{p.name}</span>
                        <span className="block truncate text-xs text-stone-400"><SiteName name={p.siteLocation} /> · {clientName(p.clientId)}</span>
                      </span>
                      {!p.siteCoords && <Badge tone="stone">No pin</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {unpinned.length > 0 && (
              <p className="border-t border-stone-100 px-5 py-2.5 text-xs text-stone-400">
                {unpinned.length} project{unpinned.length === 1 ? ' has' : 's have'} no pin yet — open the project and use “Pin the site”.
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
