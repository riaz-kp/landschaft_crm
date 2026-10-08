import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatDate, formatDateLong, formatTime, today } from '../../domain/format'
import { partyName } from '../../domain/consultations'
import { PageHeader, Section, EmptyState } from '../../components/ui'
import { Icon } from '../../components/Icon'

/** Everything that lands on the calendar, drawn from its own records. */
const TYPES = ['Site Visit', 'Task Due', 'Deadline', 'Meeting', 'AMC Visit', 'Consultation', 'Project Due'] as const
type EventType = (typeof TYPES)[number]

const STYLE: Record<EventType, { dot: string; chip: string; label: string }> = {
  'Site Visit': { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 border-sky-200', label: 'Site visits' },
  'Task Due': { dot: 'bg-stone-500', chip: 'bg-stone-100 text-stone-700 border-stone-200', label: 'Task due dates' },
  Deadline: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Deadlines' },
  Meeting: { dot: 'bg-clay-500', chip: 'bg-clay-50 text-clay-800 border-clay-200', label: 'Meetings' },
  'AMC Visit': { dot: 'bg-brand-500', chip: 'bg-brand-50 text-brand-800 border-brand-200', label: 'AMC visits' },
  Consultation: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-800 border-violet-200', label: 'CEO consultations' },
  'Project Due': { dot: 'bg-red-500', chip: 'bg-red-50 text-red-800 border-red-200', label: 'Project completions' },
}

interface CalEvent {
  id: string
  title: string
  date: string
  time?: string
  type: EventType
  /** People this event belongs to, for the "only mine" filter. */
  people: string[]
  to?: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarPage() {
  const db = useDb()
  const { user } = useSession()
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [shown, setShown] = useState<Set<EventType>>(() => new Set(TYPES))
  const [onlyMine, setOnlyMine] = useState(false)
  const [selected, setSelected] = useState(today())

  const [year, monthIndex] = month.split('-').map(Number)
  const firstDay = new Date(year, monthIndex - 1, 1)
  const daysInMonth = new Date(year, monthIndex, 0).getDate()
  // Shift so the grid starts on Monday.
  const leadingBlanks = (firstDay.getDay() + 6) % 7

  const projectName = (id?: string) => db.projects.find((p) => p.id === id)?.name ?? ''
  const subject = (leadId?: string, clientId?: string) =>
    leadId ? db.leads.find((l) => l.id === leadId)?.name : db.clients.find((c) => c.id === clientId)?.name

  const all: CalEvent[] = [
    ...db.siteVisits.filter((v) => v.status !== 'Cancelled').map((v): CalEvent => ({
      id: v.id, title: `Site visit — ${subject(v.leadId, v.clientId) ?? v.location}`, date: v.date, type: 'Site Visit',
      people: [v.assignedTo], to: '/crm/site-visits',
    })),
    ...db.tasks.filter((t) => t.status !== 'Done').map((t): CalEvent => ({
      id: t.id, title: t.title, date: t.dueDate, type: 'Task Due', people: [t.assigneeId], to: `/tasks/all?open=${t.id}`,
    })),
    ...db.calendarEvents.filter((e) => e.type === 'Deadline' || e.type === 'Meeting').map((e): CalEvent => ({
      id: e.id, title: e.title, date: e.date, type: e.type as EventType, people: e.assigneeId ? [e.assigneeId] : [],
      to: e.projectId ? `/projects/${e.projectId}` : undefined,
    })),
    ...db.maintenance.flatMap((m) => m.visits.map((v): CalEvent => ({
      id: v.id, title: `AMC visit — ${projectName(m.projectId)}`, date: v.date, type: 'AMC Visit', people: [], to: '/amc/visits',
    }))),
    ...db.consultations.filter((c) => c.status === 'Scheduled').map((c): CalEvent => ({
      id: c.id, title: `CEO · ${c.purpose} — ${partyName(c, db.clients, db.leads)}`, date: c.date, time: c.start,
      type: 'Consultation', people: [c.bookedBy, db.employees.find((e) => e.role === 'ceo')?.id ?? ''], to: '/consultations',
    })),
    ...db.projects.filter((p) => p.status !== 'Completed').map((p): CalEvent => ({
      id: `due-${p.id}`, title: `${p.name} due`, date: p.expectedCompletion, type: 'Project Due',
      people: [p.projectManagerId], to: `/projects/${p.id}`,
    })),
  ]

  const visible = all
    .filter((e) => shown.has(e.type) && (!onlyMine || e.people.includes(user.id)))
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  const on = (iso: string) => visible.filter((e) => e.date === iso)
  const inMonth = (type: EventType) => all.filter((e) => e.type === type && e.date.startsWith(month) && (!onlyMine || e.people.includes(user.id))).length

  const toggle = (type: EventType) => {
    const next = new Set(shown)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setShown(next)
  }

  const shiftMonth = (delta: number) => {
    const date = new Date(year, monthIndex - 1 + delta, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const dayEvents = on(selected)
  const upcoming = visible.filter((e) => e.date > selected).slice(0, 8)

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Site visits, task due dates, deadlines, meetings, AMC visits, CEO consultations and project completions — tick what to show."
      />

      {/* Filters — tick what to show */}
      <div className="card mb-5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            <Icon name="filter" className="h-3.5 w-3.5" /> Show
          </span>
          {TYPES.map((type) => (
            <label
              key={type}
              className={`flex cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition ${
                shown.has(type) ? 'border-stone-300 bg-white text-stone-800' : 'border-dashed border-stone-200 bg-stone-50 text-stone-400'
              }`}
            >
              <input
                type="checkbox" checked={shown.has(type)} onChange={() => toggle(type)}
                className="h-4 w-4 rounded border-stone-300 accent-brand-600"
              />
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STYLE[type].dot} ${shown.has(type) ? '' : 'opacity-40'}`} />
              {STYLE[type].label}
              <span className="rounded-full bg-stone-100 px-1.5 text-[11px] tabular-nums text-stone-500">{inMonth(type)}</span>
            </label>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" />
          <label className={`flex cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium ${onlyMine ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-300 text-stone-700'}`}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="h-4 w-4 rounded border-stone-300 accent-brand-600" />
            Only items for me
          </label>
          <div className="ml-auto flex gap-3 px-1 text-xs font-semibold">
            <button onClick={() => setShown(new Set(TYPES))} className="text-brand-700 hover:text-brand-800">Select all</button>
            <button onClick={() => setShown(new Set())} className="text-stone-500 hover:text-stone-800">Clear</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">

        {/* Month grid */}
        <Section className="min-w-0">
          <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
            <div className="flex items-center gap-1">
              <button onClick={() => shiftMonth(-1)} className="btn-icon" aria-label="Previous month"><Icon name="chevron" className="h-4 w-4 rotate-180" /></button>
              <h2 className="w-40 text-center font-semibold text-stone-900">
                {firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => shiftMonth(1)} className="btn-icon" aria-label="Next month"><Icon name="chevron" className="h-4 w-4" /></button>
            </div>
            <button onClick={() => { setMonth(today().slice(0, 7)); setSelected(today()) }} className="btn-secondary py-1.5 text-xs">Today</button>
          </header>
          <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/80">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-16 border-b border-r border-stone-100 bg-stone-50/50 sm:min-h-28" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const iso = `${month}-${String(day).padStart(2, '0')}`
              const events = on(iso)
              const isToday = iso === today()
              const isSelected = iso === selected
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(iso)}
                  className={`flex min-h-16 flex-col items-stretch justify-start border-b border-r border-stone-100 p-1 text-left transition sm:min-h-28 sm:p-1.5 ${isSelected ? 'bg-brand-50/70 ring-2 ring-inset ring-brand-400' : 'hover:bg-stone-50'}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                    isToday ? 'bg-brand-600 text-white' : 'text-stone-500'
                  }`}>
                    {day}
                  </span>
                  {/* Dots on a phone, labelled chips on wider screens. */}
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {events.slice(0, 6).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${STYLE[e.type].dot}`} />)}
                  </div>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {events.slice(0, 3).map((e) => (
                      <p key={e.id} className={`truncate rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${STYLE[e.type].chip}`} title={e.title}>
                        {e.time && <span className="tabular-nums">{e.time} </span>}{e.title}
                      </p>
                    ))}
                    {events.length > 3 && <p className="px-1 text-[10.5px] font-semibold text-stone-500">+{events.length - 3} more</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* Selected day + what follows */}
        <div className="space-y-6">
          <Section title={selected === today() ? 'Today' : formatDateLong(selected)} description={`${dayEvents.length} item${dayEvents.length === 1 ? '' : 's'}`}>
            {dayEvents.length === 0 ? (
              <EmptyState title="Nothing on this day." icon="calendar" />
            ) : (
              <ul className="divide-y divide-stone-100">
                {dayEvents.map((e) => <EventRow key={e.id} event={e} />)}
              </ul>
            )}
          </Section>
          <Section title="Coming up">
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing after this day." icon="calendar" />
            ) : (
              <ul className="divide-y divide-stone-100">
                {upcoming.map((e) => <EventRow key={e.id} event={e} showDate />)}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function EventRow({ event: e, showDate }: { event: CalEvent; showDate?: boolean }) {
  const body = (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STYLE[e.type].dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-stone-800">{e.title}</span>
        <span className="block text-xs text-stone-400">
          {e.type}
          {showDate && ` · ${formatDate(e.date)}`}
          {e.time && ` · ${formatTime(e.time)}`}
        </span>
      </span>
    </div>
  )
  return <li>{e.to ? <Link to={e.to} className="block hover:bg-stone-50">{body}</Link> : body}</li>
}
