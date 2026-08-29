import { useState } from 'react'
import { useDb } from '../../state/useDb'
import { formatDate, formatDateLong, today } from '../../domain/format'
import type { CalendarEvent } from '../../domain/types'
import { PageHeader, Section, EmptyState, Badge } from '../../components/ui'

const TONES: Record<CalendarEvent['type'], 'green' | 'amber' | 'blue' | 'clay'> = {
  'Site Visit': 'blue',
  Deadline: 'amber',
  Maintenance: 'green',
  Meeting: 'clay',
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarPage() {
  const db = useDb()
  const [month, setMonth] = useState(() => today().slice(0, 7))

  const [year, monthIndex] = month.split('-').map(Number)
  const firstDay = new Date(year, monthIndex - 1, 1)
  const daysInMonth = new Date(year, monthIndex, 0).getDate()
  // Shift so the grid starts on Monday.
  const leadingBlanks = (firstDay.getDay() + 6) % 7

  const eventsOn = (day: number) => {
    const iso = `${month}-${String(day).padStart(2, '0')}`
    return db.calendarEvents.filter((e) => e.date === iso)
  }

  const upcoming = [...db.calendarEvents]
    .filter((e) => e.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date))

  const shiftMonth = (delta: number) => {
    const date = new Date(year, monthIndex - 1 + delta, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Site visits, deadlines, maintenance visits and meetings."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="btn-secondary px-3">‹</button>
            <span className="w-36 text-center text-sm font-semibold text-stone-700">
              {firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => shiftMonth(1)} className="btn-secondary px-3">›</button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Section className="xl:col-span-2">
          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-24 border-b border-r border-stone-100 bg-stone-50/50" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const iso = `${month}-${String(day).padStart(2, '0')}`
              const events = eventsOn(day)
              const isToday = iso === today()
              return (
                <div key={day} className="min-h-24 border-b border-r border-stone-100 p-1.5">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                    isToday ? 'bg-brand-600 text-white' : 'text-stone-500'
                  }`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {events.map((event) => (
                      <p
                        key={event.id}
                        className="truncate rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-800"
                        title={event.title}
                      >
                        {event.title}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Upcoming">
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {upcoming.slice(0, 10).map((event) => (
                <li key={event.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-800">{event.title}</p>
                      <p className="mt-0.5 text-xs text-stone-400">
                        {formatDateLong(event.date)}
                        {event.assigneeId && ` · ${db.employees.find((e) => e.id === event.assigneeId)?.name}`}
                      </p>
                    </div>
                    <Badge tone={TONES[event.type]}>{event.type}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}

export { formatDate }
