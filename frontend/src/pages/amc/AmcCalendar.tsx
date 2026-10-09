import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { formatDateLong, today } from '../../domain/format'
import { allOccurrences, describeSchedule, type AmcOccurrence } from '../../domain/amc'
import { PageHeader, Section, EmptyState } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { OccurrenceBadge, inReminderWindow } from './AmcContractCard'
import { AmcReminders } from './AmcReminders'
import { AmcContractModal } from './AmcContractForm'
import { MoveVisitModal, VisitDoneModal } from './AmcVisitModals'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** One colour per contract so a busy month stays readable. */
const PALETTE = [
  { dot: 'bg-clay-500', chip: 'border-clay-300 bg-clay-50 text-clay-900' },
  { dot: 'bg-sky-500', chip: 'border-sky-300 bg-sky-50 text-sky-900' },
  { dot: 'bg-violet-500', chip: 'border-violet-300 bg-violet-50 text-violet-900' },
  { dot: 'bg-brand-500', chip: 'border-brand-300 bg-brand-50 text-brand-900' },
  { dot: 'bg-amber-500', chip: 'border-amber-300 bg-amber-50 text-amber-900' },
  { dot: 'bg-rose-500', chip: 'border-rose-300 bg-rose-50 text-rose-900' },
]

const STATUS_MARK: Record<AmcOccurrence['status'], string> = { Done: '✓', Scheduled: '•', Planned: '', Overdue: '!' }

/**
 * The AMC calendar: every contract's repeat visits laid out by month, with
 * reminders for what is coming up. Tick contracts to show or hide them; pick
 * a day to mark visits done or move them.
 */
export function AmcCalendar() {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.manageAmc(roleKey)
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [selected, setSelected] = useState(today())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [doing, setDoing] = useState<AmcOccurrence | null>(null)
  const [moving, setMoving] = useState<AmcOccurrence | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [year, monthIndex] = month.split('-').map(Number)
  const firstDay = new Date(year, monthIndex - 1, 1)
  const daysInMonth = new Date(year, monthIndex, 0).getDate()
  const leadingBlanks = (firstDay.getDay() + 6) % 7

  const contracts = db.maintenance
  const colour = (id: string) => PALETTE[Math.max(0, contracts.findIndex((m) => m.id === id)) % PALETTE.length]
  const project = (id: string) => db.projects.find((p) => p.id === id)
  const occurrences = allOccurrences(contracts.filter((m) => !hidden.has(m.id)), today())
  const on = (iso: string) => occurrences.filter((o) => o.date === iso)
  const dayItems = on(selected)

  const shiftMonth = (delta: number) => {
    const d = new Date(year, monthIndex - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden(next)
  }
  const editing = contracts.find((m) => m.id === editingId)

  return (
    <div>
      <PageHeader
        title="AMC Calendar"
        subtitle="Repeat maintenance visits for every contract, with reminders ahead of each one. Change how often a site is visited from its Schedule button."
      />

      <AmcReminders className="mb-6" />

      {/* Contracts on the calendar */}
      <div className="card mb-5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            <Icon name="filter" className="h-3.5 w-3.5" /> Contracts
          </span>
          {contracts.map((m) => {
            const shown = !hidden.has(m.id)
            return (
              <span key={m.id} className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${shown ? 'border-stone-300 bg-white' : 'border-dashed border-stone-200 bg-stone-50 text-stone-400'}`}>
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <input type="checkbox" checked={shown} onChange={() => toggle(m.id)} className="h-4 w-4 rounded border-stone-300 accent-brand-600" />
                  <span className={`h-2.5 w-2.5 rounded-full ${colour(m.id).dot} ${shown ? '' : 'opacity-40'}`} />
                  <span className="font-medium">{project(m.projectId)?.name}</span>
                  <span className="text-xs text-stone-400">{m.type === 'AMC' ? 'AMC' : 'Free'} · {m.schedule ? describeSchedule(m.schedule) : 'no schedule'}</span>
                </label>
                {editable && (
                  <button onClick={() => setEditingId(m.id)} className="text-stone-400 hover:text-brand-700" title="Change schedule" aria-label="Change schedule">
                    <Icon name="repeat" className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Section className="min-w-0">
          <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
            <div className="flex items-center gap-1">
              <button onClick={() => shiftMonth(-1)} className="btn-icon" aria-label="Previous month"><Icon name="chevron" className="h-4 w-4 rotate-180" /></button>
              <h2 className="w-40 text-center font-semibold text-stone-900">{firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => shiftMonth(1)} className="btn-icon" aria-label="Next month"><Icon name="chevron" className="h-4 w-4" /></button>
            </div>
            <div className="hidden items-center gap-3 text-[11px] text-stone-500 md:flex">
              <span>✓ done</span><span>• booked</span><span className="text-red-600">! overdue</span>
              <span className="flex items-center gap-1"><Icon name="bell" className="h-3 w-3 text-amber-600" /> reminder</span>
            </div>
            <button onClick={() => { setMonth(today().slice(0, 7)); setSelected(today()) }} className="btn-secondary py-1.5 text-xs">Today</button>
          </header>
          <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/80">
            {WEEKDAYS.map((d) => <div key={d} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} className="min-h-16 border-b border-r border-stone-100 bg-stone-50/50 sm:min-h-28" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const iso = `${month}-${String(day).padStart(2, '0')}`
              const items = on(iso)
              const isToday = iso === today()
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  className={`flex min-h-16 flex-col items-stretch justify-start border-b border-r border-stone-100 p-1 text-left transition sm:min-h-28 sm:p-1.5 ${iso === selected ? 'bg-brand-50/70 ring-2 ring-inset ring-brand-400' : 'hover:bg-stone-50'}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${isToday ? 'bg-brand-600 text-white' : 'text-stone-500'}`}>{day}</span>
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {items.map((o) => <span key={o.visit?.id ?? o.record.id + o.date} className={`h-1.5 w-1.5 rounded-full ${o.status === 'Overdue' ? 'bg-red-500' : colour(o.record.id).dot}`} />)}
                  </div>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {items.slice(0, 3).map((o) => (
                      <p
                        key={o.visit?.id ?? o.record.id + o.date}
                        className={`flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${
                          o.status === 'Overdue' ? 'border-red-300 bg-red-50 text-red-800' : colour(o.record.id).chip
                        } ${o.status === 'Done' ? 'opacity-60' : ''}`}
                        title={`${project(o.record.projectId)?.name} — ${o.status}`}
                      >
                        {inReminderWindow(o) && <Icon name="bell" className="h-2.5 w-2.5 shrink-0 text-amber-600" />}
                        {STATUS_MARK[o.status] && <span className="font-bold">{STATUS_MARK[o.status]}</span>}
                        <span className="truncate">{project(o.record.projectId)?.name}</span>
                      </p>
                    ))}
                    {items.length > 3 && <p className="px-1 text-[10.5px] font-semibold text-stone-500">+{items.length - 3} more</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title={selected === today() ? 'Today' : formatDateLong(selected)} description={`${dayItems.length} visit${dayItems.length === 1 ? '' : 's'}`} className="h-fit">
          {dayItems.length === 0 ? (
            <EmptyState title="No maintenance visits on this day." icon="leaf" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {dayItems.map((o) => (
                <li key={o.visit?.id ?? o.record.id + o.date} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/projects/${o.record.projectId}`} className="flex items-center gap-2 text-sm font-medium text-stone-900 hover:text-brand-700">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colour(o.record.id).dot}`} />
                        <span className="truncate">{project(o.record.projectId)?.name}</span>
                      </Link>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {o.record.type}{o.record.schedule && ` · ${describeSchedule(o.record.schedule)}`}
                      </p>
                      {o.visit?.notes && <p className="mt-1 text-xs text-stone-600">{o.visit.notes}</p>}
                    </div>
                    <OccurrenceBadge occurrence={o} />
                  </div>
                  {editable && o.status !== 'Done' && (
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={() => setMoving(o)} className="btn-ghost px-2 py-1 text-xs">Move</button>
                      <button onClick={() => setDoing(o)} className="btn-secondary py-1 text-xs">Mark done</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {doing && <VisitDoneModal occurrence={doing} onClose={() => setDoing(null)} />}
      {moving && <MoveVisitModal occurrence={moving} onClose={() => setMoving(null)} />}
      {editing && <AmcContractModal record={editing} onClose={() => setEditingId(null)} />}
    </div>
  )
}
