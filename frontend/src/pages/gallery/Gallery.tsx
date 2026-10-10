import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { addDays, formatDateLong, formatTime, today } from '../../domain/format'
import { PHOTO_SESSIONS, type DailyWorkReport, type ID, type PhotoSession, type ReportPhoto } from '../../domain/types'
import { PageHeader, Section, EmptyState, StatTile, SiteName, Badge } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { Lightbox } from '../../components/Lightbox'
import { SearchSelect } from '../../components/SearchSelect'
import { projectOptions } from '../../components/pickerOptions'

type DateMode = 'day' | 'week' | 'month' | 'range' | 'all'

const MODES: { key: DateMode; label: string }[] = [
  { key: 'day', label: 'Single day' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'range', label: 'Date range' },
  { key: 'all', label: 'All dates' },
]

interface Item {
  photo: ReportPhoto
  report: DailyWorkReport
}

const SESSION_STYLE: Record<PhotoSession, { icon: string; tone: string }> = {
  Morning: { icon: 'sun', tone: 'text-amber-600 bg-amber-50' },
  Evening: { icon: 'moon', tone: 'text-violet-600 bg-violet-50' },
}

/**
 * Every project's daily site photos in one window. Pick a project (or all),
 * a day or a range, and morning, evening or both. Each day shows a site's
 * morning and evening shots side by side so progress is easy to compare.
 * Pass `projectId` to embed the gallery for one project.
 */
export function PhotoGallery({ projectId: fixedProject }: { projectId?: ID }) {
  const db = useDb()
  const [projectId, setProjectId] = useState<ID>(fixedProject ?? '')
  const [mode, setMode] = useState<DateMode>(fixedProject ? 'all' : 'day')
  const [date, setDate] = useState(today())
  const [from, setFrom] = useState(addDays(today(), -6))
  const [to, setTo] = useState(today())
  const [session, setSession] = useState<PhotoSession | ''>('')
  const [viewing, setViewing] = useState<number | null>(null)

  const range: [string, string] | null = mode === 'day' ? [date, date]
    : mode === 'week' ? [addDays(today(), -6), today()]
    : mode === 'month' ? [`${today().slice(0, 7)}-01`, today()]
    : mode === 'range' ? [from <= to ? from : to, from <= to ? to : from]
    : null

  const project = (id: ID) => db.projects.find((p) => p.id === id)
  const foreman = (id: ID) => db.employees.find((e) => e.id === id)?.name ?? '—'

  const [rFrom, rTo] = range ?? ['', '']
  const items = useMemo<Item[]>(() => db.reports
    .filter((r) => (!projectId || r.projectId === projectId) && (!rFrom || (r.date >= rFrom && r.date <= rTo)))
    .flatMap((report) => report.photos
      .filter((p) => !session || p.session === session)
      .map((photo) => ({ photo, report })))
    .sort((a, b) => b.report.date.localeCompare(a.report.date)
      || a.report.projectId.localeCompare(b.report.projectId)
      || (a.photo.takenAt ?? '').localeCompare(b.photo.takenAt ?? '')),
  [db.reports, projectId, rFrom, rTo, session])

  // date → report id → photos, keeping the sorted order.
  const byDate = new Map<string, Map<ID, Item[]>>()
  for (const item of items) {
    let reports = byDate.get(item.report.date)
    if (!reports) byDate.set(item.report.date, (reports = new Map()))
    reports.set(item.report.id, [...(reports.get(item.report.id) ?? []), item])
  }

  // Reports in range that are missing a session's photo — worth chasing.
  const inRange = db.reports.filter((r) => (!projectId || r.projectId === projectId) && (!range || (r.date >= range[0] && r.date <= range[1])))
  const missing = inRange.filter((r) => PHOTO_SESSIONS.some((s) => !r.photos.some((p) => p.session === s)))
  const sites = new Set(items.map((i) => i.report.projectId))
  const executionProjects = db.projects.filter((p) => p.services.execution)

  const lightboxPhotos = items.map(({ photo, report }) => ({
    src: photo.src,
    title: `${project(report.projectId)?.name ?? ''} — ${photo.caption || `${photo.session} photo`}`,
    sub: `${formatDateLong(report.date)} · ${photo.session}${photo.takenAt ? ` · ${formatTime(photo.takenAt)}` : ''} · ${foreman(report.foremanId)}`,
  }))

  return (
    <div>
      {/* Filters */}
      <div className="card mb-5 space-y-3 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 sm:flex">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-lg px-2 py-1.5 text-[13px] font-medium transition sm:shrink-0 sm:px-3 sm:text-sm ${mode === m.key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
            {([['', 'Both'], ['Morning', 'Morning'], ['Evening', 'Evening']] as const).map(([key, label]) => (
              <button
                key={label}
                onClick={() => setSession(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${session === key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
              >
                {key && <Icon name={SESSION_STYLE[key].icon} className="h-3.5 w-3.5" />} {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!fixedProject && (
            <div className="w-full sm:w-72">
              <SearchSelect
                size="sm"
                value={projectId}
                onChange={setProjectId}
                options={projectOptions(db, executionProjects)}
                emptyOption="All projects"
                searchPlaceholder="Search projects"
                ariaLabel="Project"
              />
            </div>
          )}
          {mode === 'day' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setDate(addDays(date, -1))} className="btn-icon" aria-label="Previous day"><Icon name="chevron" className="h-4 w-4 rotate-180" /></button>
              <input type="date" className="input w-auto py-1.5" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
              <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} className="btn-icon disabled:opacity-30" aria-label="Next day"><Icon name="chevron" className="h-4 w-4" /></button>
              {date !== today() && <button onClick={() => setDate(today())} className="text-xs font-semibold text-brand-700">Today</button>}
            </div>
          )}
          {mode === 'range' && (
            <div className="flex items-center gap-2">
              <input type="date" className="input w-auto py-1.5" value={from} max={today()} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
              <span className="text-sm text-stone-400">to</span>
              <input type="date" className="input w-auto py-1.5" value={to} max={today()} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            </div>
          )}
          <span className="ml-auto text-xs text-stone-500">
            {range ? (range[0] === range[1] ? formatDateLong(range[0]) : `${formatDateLong(range[0])} – ${formatDateLong(range[1])}`) : 'All dates'}
          </span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Photos" value={items.length} icon="image" tone="green" />
        <StatTile label="Sites" value={sites.size} icon="pin" />
        <StatTile label="Days" value={byDate.size} icon="calendar" tone="blue" />
        <StatTile
          label="Reports Missing a Photo" value={missing.length} icon="alert"
          tone={missing.length ? 'amber' : 'green'}
          sub={missing.length ? 'morning or evening not taken' : 'every report has both'}
        />
      </div>

      {byDate.size === 0 ? (
        <Section>
          <EmptyState
            title="No site photos for these filters."
            hint={mode === 'day' ? 'Try another day, or switch to Last 7 days.' : 'Foremen add morning and evening photos on their daily report.'}
            icon="image"
          />
        </Section>
      ) : (
        <div className="space-y-8">
          {[...byDate.entries()].map(([day, reports]) => (
            <section key={day}>
              <h2 className="mb-3 flex items-baseline gap-3 px-1">
                <span className="text-lg font-bold text-stone-900">{day === today() ? 'Today' : day === addDays(today(), -1) ? 'Yesterday' : formatDateLong(day)}</span>
                <span className="text-sm text-stone-400">
                  {new Date(day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })} · {[...reports.values()].flat().length} photos
                </span>
              </h2>
              <div className="grid gap-4 xl:grid-cols-2">
                {[...reports.entries()].map(([reportId, group]) => {
                  const report = group[0].report
                  const p = project(report.projectId)
                  const sessions = session ? [session] : PHOTO_SESSIONS
                  return (
                    <article key={reportId} className="card overflow-hidden">
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
                        <div className="min-w-0">
                          <Link to={`/projects/${report.projectId}`} className="block truncate font-semibold text-stone-900 hover:text-brand-700">{p?.name}</Link>
                          <p className="truncate text-xs text-stone-500"><SiteName name={report.siteLocation} /> · {foreman(report.foremanId)}</p>
                        </div>
                        <Link to={`/execution/reports/${report.id}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">Daily report</Link>
                      </header>
                      <div className={`grid gap-px bg-stone-100 ${sessions.length === 2 ? 'sm:grid-cols-2' : ''}`}>
                        {sessions.map((s) => {
                          const shots = group.filter((g) => g.photo.session === s)
                          return (
                            <div key={s} className="bg-white p-3">
                              <p className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SESSION_STYLE[s].tone}`}>
                                <Icon name={SESSION_STYLE[s].icon} className="h-3 w-3" /> {s}
                              </p>
                              {shots.length === 0 ? (
                                <div className="flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-stone-200 text-xs text-stone-400">
                                  No {s.toLowerCase()} photo
                                </div>
                              ) : (
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                                  {shots.map((item) => (
                                    <button
                                      key={item.photo.id}
                                      onClick={() => setViewing(items.indexOf(item))}
                                      className="group relative overflow-hidden rounded-xl"
                                    >
                                      <img src={item.photo.src} alt={item.photo.caption ?? `${s} photo`} className="h-28 w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left">
                                        <span className="block truncate text-[11px] font-medium text-white">{item.photo.caption || s}</span>
                                        {item.photo.takenAt && <span className="block text-[10px] text-white/70">{formatTime(item.photo.takenAt)}</span>}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <Section title="Reports missing a photo" className="mt-8" description="The foreman still needs to add the morning or evening photo.">
          <ul className="divide-y divide-stone-100">
            {missing.slice(0, 10).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="text-sm text-stone-700">
                  <strong className="font-medium text-stone-900">{project(r.projectId)?.name}</strong> · {formatDateLong(r.date)} · {foreman(r.foremanId)}
                </span>
                <span className="flex gap-1.5">
                  {PHOTO_SESSIONS.filter((s) => !r.photos.some((p) => p.session === s)).map((s) => (
                    <Badge key={s} tone="amber">No {s.toLowerCase()} photo</Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {viewing !== null && (
        <Lightbox photos={lightboxPhotos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

export function Gallery() {
  return (
    <div>
      <PageHeader
        title="Site Gallery"
        subtitle="Every project's daily site photos in one place — taken by the foremen each morning and evening. Filter by project, date and session."
      />
      <PhotoGallery />
    </div>
  )
}
