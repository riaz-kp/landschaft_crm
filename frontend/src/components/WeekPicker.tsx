import { addDays, formatDateLong, today } from '../domain/format'
import { rangeOf, type DateRange } from '../domain/period'
import { Icon } from './Icon'

/** The Monday-to-Sunday week containing `date`. */
export function weekOf(date: string): DateRange {
  return rangeOf('week', undefined, date)!
}

/** "12 Oct – 18 Oct 2026" */
export function weekLabel(week: DateRange): string {
  const from = new Date(week.from + 'T00:00:00')
  const to = new Date(week.to + 'T00:00:00')
  const sameYear = from.getFullYear() === to.getFullYear()
  const start = from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  return `${start} – ${formatDateLong(week.to)}`
}

/** Steps through weeks, Monday to Sunday, with shortcuts for this week and last week. */
export function WeekPicker({ week, onChange }: { week: DateRange; onChange: (week: DateRange) => void }) {
  const thisWeek = weekOf(today())
  const lastWeek = weekOf(addDays(thisWeek.from, -7))
  const shortcut = (label: string, target: DateRange) => (
    <button
      type="button"
      onClick={() => onChange(target)}
      className={`chip px-3 py-1 text-[13px] ${week.from === target.from ? 'chip-on' : ''}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
        <button type="button" onClick={() => onChange(weekOf(addDays(week.from, -7)))} className="btn-icon h-8 w-8" aria-label="Previous week">
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <span className="min-w-[170px] px-1 text-center text-sm font-semibold tabular-nums text-stone-900">{weekLabel(week)}</span>
        <button type="button" onClick={() => onChange(weekOf(addDays(week.from, 7)))} className="btn-icon h-8 w-8" aria-label="Next week">
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </div>
      {shortcut('This week', thisWeek)}
      {shortcut('Last week', lastWeek)}
      <input
        type="date"
        className="input w-auto py-1.5"
        value={week.from}
        onChange={(e) => e.target.value && onChange(weekOf(e.target.value))}
        aria-label="Jump to the week of"
        title="Jump to the week of a date"
      />
    </div>
  )
}
