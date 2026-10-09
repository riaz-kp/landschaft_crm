import { addDays, formatDate, today } from './format'

export interface DateRange {
  from: string
  to: string
}

/** Preset windows offered by the dashboards and reports. */
export type PeriodKey = 'today' | 'week' | 'month' | 'lastMonth' | 'quarter' | 'year' | 'all' | 'custom'

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  lastMonth: 'Last month',
  quarter: 'This quarter',
  year: 'This year',
  all: 'All time',
  custom: 'Custom range',
}

/** The dashboard's four windows. */
export const DASHBOARD_PERIODS: PeriodKey[] = ['today', 'week', 'month', 'year']

const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/**
 * The dates a period covers, inclusive. Weeks run Monday to Sunday, the
 * quarter is the calendar quarter, and the year is the calendar year.
 * "All time" and an unset custom range return null — no date limit.
 */
export function rangeOf(period: PeriodKey, custom?: Partial<DateRange>, on = today()): DateRange | null {
  const [y, m] = on.split('-').map(Number)
  switch (period) {
    case 'today': return { from: on, to: on }
    case 'week': {
      const start = addDays(on, -((new Date(on + 'T00:00:00').getDay() + 6) % 7))
      return { from: start, to: addDays(start, 6) }
    }
    case 'month': return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) }
    case 'lastMonth': {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      return { from: iso(py, pm, 1), to: iso(py, pm, lastDay(py, pm)) }
    }
    case 'quarter': {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1
      return { from: iso(y, qStart, 1), to: iso(y, qStart + 2, lastDay(y, qStart + 2)) }
    }
    case 'year': return { from: iso(y, 1, 1), to: iso(y, 12, 31) }
    case 'custom':
      if (!custom?.from || !custom?.to) return null
      return custom.from <= custom.to ? { from: custom.from, to: custom.to } : { from: custom.to, to: custom.from }
    default: return null
  }
}

export function inRange(date: string | undefined, range: DateRange | null): boolean {
  if (!range) return true
  if (!date) return false
  const d = date.slice(0, 10)
  return d >= range.from && d <= range.to
}

export function describeRange(range: DateRange | null): string {
  if (!range) return 'All dates'
  return range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`
}

/** "today", "this week" — for labels like "Reports this week". */
export function periodPhrase(period: PeriodKey): string {
  return period === 'today' ? 'today' : PERIOD_LABELS[period].toLowerCase()
}
