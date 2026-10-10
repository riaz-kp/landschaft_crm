import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { addDays, formatDateLong, formatTime, today, whatsappUrl } from '../../domain/format'
import { crewOf } from '../../domain/workers'
import { Avatar, SiteName, StatusBadge } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { FieldCard } from '../../shells/FieldShell'

function monthName(month: string) {
  return new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** "Today", "Yesterday" or the date. */
function when(date: string) {
  if (date === today()) return 'Today'
  if (date === addDays(today(), -1)) return 'Yesterday'
  return formatDateLong(date)
}

/** Everyone who has worked under this foreman, most recent first. Shown on the Works tab. */
export function FieldCrewList() {
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const crew = useMemo(() => crewOf(db.reports, user.id, today()), [db.reports, user.id])
  const month = today().slice(0, 7)
  const worker = (id: string) => db.workers.find((w) => w.id === id)
  const q = query.trim().toLowerCase()
  const shown = crew.filter((c) => {
    const w = worker(c.workerId)
    return !q || `${w?.name ?? ''} ${w?.skill ?? ''}`.toLowerCase().includes(q)
  })
  const workerDays = crew.reduce((s, c) => s + c.days, 0)
  const thisMonth = crew.filter((c) => c.lastDate.startsWith(month)).length

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Workers', crew.length],
          ['This month', thisMonth],
          ['Worker-days', workerDays],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-card">
            <p className="font-display text-2xl font-bold tabular-nums text-stone-900">{value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
          </div>
        ))}
      </div>

      <label className="relative mt-4 block">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or skill" className="input pl-9" aria-label="Search workers" />
      </label>

      <div className="mt-4 space-y-2">
        {shown.map((c) => {
          const w = worker(c.workerId)
          return (
            <FieldCard key={c.workerId} onClick={() => navigate(`/field/workers/${c.workerId}`)}>
              <div className="flex items-center gap-3">
                <Avatar name={w?.name ?? '?'} src={w?.photo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{w?.name ?? 'Removed worker'}</p>
                  <p className="truncate text-xs text-stone-500">{w?.skill} · last on site {when(c.lastDate).replace(/^(Today|Yesterday)$/, (d) => d.toLowerCase())}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold leading-tight tabular-nums text-brand-700">{c.days}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">day{c.days === 1 ? '' : 's'}</p>
                </div>
                <Icon name="chevron" className="h-4 w-4 shrink-0 text-stone-300" />
              </div>
            </FieldCard>
          )
        })}
        {crew.length === 0 && (
          <FieldCard><p className="py-6 text-center text-sm text-stone-400">Workers appear here once you file a report with them on it.</p></FieldCard>
        )}
        {crew.length > 0 && shown.length === 0 && (
          <FieldCard><p className="py-6 text-center text-sm text-stone-400">No worker matches “{query.trim()}”.</p></FieldCard>
        )}
      </div>
    </div>
  )
}

/** One worker, as their foreman sees them: contact, and every report they were on under this foreman. */
export function FieldWorkerView() {
  const { workerId = '' } = useParams()
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()

  const worker = db.workers.find((w) => w.id === workerId)
  const record = useMemo(() => crewOf(db.reports, user.id, today()).find((c) => c.workerId === workerId), [db.reports, user.id, workerId])

  if (!worker || !record) {
    return (
      <div className="space-y-4">
        <Link to="/field/works?view=workers" className="flex items-center gap-1.5 text-sm font-medium text-stone-500"><Icon name="back" className="h-4 w-4" /> My workers</Link>
        <FieldCard><p className="py-6 text-center text-sm text-stone-400">This worker has not been on any of your reports.</p></FieldCard>
      </div>
    )
  }

  const month = today().slice(0, 7)
  const monthDays = new Set(record.reports.filter((r) => r.date.startsWith(month)).map((r) => r.date)).size
  const otHours = record.reports.reduce((s, r) => s + (r.otHours || 0), 0)
  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? ''
  const months = [...new Set(record.reports.map((r) => r.date.slice(0, 7)))]
  const phone = worker.phone.replace(/\s/g, '')

  return (
    <div className="space-y-4">
      <Link to="/field/works?view=workers" className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> My workers
      </Link>

      <FieldCard>
        <div className="flex items-center gap-4">
          <Avatar name={worker.name} size="lg" src={worker.photo} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-stone-900">{worker.name}</h1>
            <p className="text-sm text-stone-500">{worker.skill}{!worker.active && ' · inactive'}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${phone}`} className="btn-secondary py-2.5"><Icon name="phone" className="h-4 w-4" /> Call</a>
          <a href={whatsappUrl(worker.whatsapp || worker.phone)} target="_blank" rel="noreferrer" className="btn-secondary py-2.5">
            <Icon name="chat" className="h-4 w-4 text-brand-600" /> WhatsApp
          </a>
        </div>
      </FieldCard>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Days with you', record.days],
          ['This month', monthDays],
          ['Sites', record.projectIds.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-card">
            <p className="font-display text-2xl font-bold tabular-nums text-stone-900">{value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
          </div>
        ))}
      </div>
      {otHours > 0 && (
        <p className="text-center text-xs text-stone-500">{otHours}h overtime recorded on these days</p>
      )}

      {months.map((m) => (
        <div key={m}>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-stone-400">{monthName(m)}</p>
          <div className="space-y-2">
            {record.reports.filter((r) => r.date.startsWith(m)).map((r) => {
              const entry = r.attendance.find((a) => a.workerId === worker.id)
              return (
                <FieldCard key={r.id} onClick={() => navigate(`/field/works/${r.id}`)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900">{when(r.date)}</p>
                      <p className="truncate text-sm text-stone-500"><SiteName name={r.siteLocation} /> · {projectName(r.projectId)}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-stone-500">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Icon name="clock" className="h-3.5 w-3.5" />
                      {formatTime(entry?.checkIn || r.startTime)} – {formatTime(entry?.checkOut || r.endTime)}
                    </span>
                    {r.otHours > 0 && <span className="text-sky-700">+{r.otHours}h OT</span>}
                  </p>
                  {r.workDone.some(Boolean) && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-stone-700">{r.workDone.filter(Boolean).join('; ')}</p>
                  )}
                </FieldCard>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
