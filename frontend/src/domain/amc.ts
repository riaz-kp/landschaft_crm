import { addDays, daysBetween } from './format'
import type { MaintenanceRecord, MaintenanceVisit, RecurrenceUnit, VisitSchedule } from './types'

/** Adds whole months, holding the day of month where the target month allows it. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  const dd = String(target.getDate()).padStart(2, '0')
  return `${target.getFullYear()}-${mm}-${dd}`
}

function step(iso: string, every: number, unit: RecurrenceUnit, times: number): string {
  if (unit === 'month') return addMonths(iso, every * times)
  return addDays(iso, (unit === 'week' ? 7 : 1) * every * times)
}

const UNIT_LABEL: Record<RecurrenceUnit, [string, string]> = {
  day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'],
}

/** "Every week", "Every 2 weeks", "Every 3 months". */
export function describeSchedule(s: Pick<VisitSchedule, 'every' | 'unit'>): string {
  const [one, many] = UNIT_LABEL[s.unit]
  return s.every === 1 ? `Every ${one}` : `Every ${s.every} ${many}`
}

/** Common choices offered when setting a schedule; "Custom" lets the user type any N. */
export const SCHEDULE_PRESETS: { label: string; every: number; unit: RecurrenceUnit }[] = [
  { label: 'Weekly', every: 1, unit: 'week' },
  { label: 'Fortnightly', every: 2, unit: 'week' },
  { label: 'Monthly', every: 1, unit: 'month' },
  { label: 'Every 2 months', every: 2, unit: 'month' },
  { label: 'Quarterly', every: 3, unit: 'month' },
  { label: 'Half-yearly', every: 6, unit: 'month' },
]

/** Every planned visit date on a contract, from the first visit to the contract's end. */
export function plannedDates(record: MaintenanceRecord): string[] {
  const s = record.schedule
  if (!s || s.every < 1) return []
  const out: string[] = []
  for (let i = 0; i < 500; i += 1) {
    const date = step(s.firstVisit, s.every, s.unit, i)
    if (date > record.endDate) break
    if (date >= record.startDate) out.push(date)
  }
  return out
}

export type OccurrenceStatus = 'Done' | 'Scheduled' | 'Planned' | 'Overdue'

/** One visit on the AMC calendar — a recorded visit, or a date the repeat schedule says is due. */
export interface AmcOccurrence {
  record: MaintenanceRecord
  date: string
  /** The schedule date this occurrence belongs to, if any. */
  plannedFor?: string
  visit?: MaintenanceVisit
  status: OccurrenceStatus
}

/**
 * Merges a contract's recorded visits with its repeat schedule. A recorded
 * visit on (or moved from) a planned date replaces it, so nothing is counted
 * twice; planned dates nobody has visited yet show as Planned, or Overdue
 * once they pass.
 */
export function occurrencesFor(record: MaintenanceRecord, today: string): AmcOccurrence[] {
  const planned = plannedDates(record)
  const covered = new Set<string>()
  const out: AmcOccurrence[] = []

  for (const visit of record.visits) {
    const plannedFor = visit.plannedFor ?? (planned.includes(visit.date) ? visit.date : undefined)
    if (plannedFor) covered.add(plannedFor)
    out.push({
      record, visit, date: visit.date, plannedFor,
      status: visit.done ? 'Done' : visit.date < today ? 'Overdue' : 'Scheduled',
    })
  }
  for (const date of planned) {
    if (covered.has(date)) continue
    out.push({ record, date, plannedFor: date, status: date < today ? 'Overdue' : 'Planned' })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function allOccurrences(records: MaintenanceRecord[], today: string): AmcOccurrence[] {
  return records.flatMap((r) => occurrencesFor(r, today)).sort((a, b) => a.date.localeCompare(b.date))
}

export interface AmcReminder {
  occurrence: AmcOccurrence
  /** Days until the visit; negative when overdue. */
  daysLeft: number
}

/**
 * Visits inside their reminder window (or already overdue). A contract that
 * reminds 2 days ahead puts each visit on this list 2 days before it falls due.
 * Overdue visits older than `overdueWindow` days are left out — those need a
 * decision on the contract, not a daily nudge.
 */
export function visitReminders(records: MaintenanceRecord[], today: string, overdueWindow = 30): AmcReminder[] {
  return allOccurrences(records, today)
    .filter((o) => o.status !== 'Done')
    .map((o) => ({ occurrence: o, daysLeft: daysBetween(today, o.date) }))
    .filter(({ occurrence, daysLeft }) =>
      daysLeft < 0 ? -daysLeft <= overdueWindow : daysLeft <= (occurrence.record.schedule?.reminderDaysBefore ?? 1))
}

/** AMC contracts whose renewal date is inside their renewal reminder window. */
export function renewalReminders(records: MaintenanceRecord[], today: string): { record: MaintenanceRecord; daysLeft: number }[] {
  return records
    .filter((r) => r.type === 'AMC' && r.renewalDate)
    .map((r) => ({ record: r, daysLeft: daysBetween(today, r.renewalDate!) }))
    .filter(({ record, daysLeft }) => daysLeft <= (record.renewalReminderDays ?? 60))
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

/** Share of a contract's planned visits already done, for the AMC progress bar. */
export function amcProgress(record: MaintenanceRecord, today: string): { done: number; total: number; percent: number } {
  const all = occurrencesFor(record, today)
  const done = all.filter((o) => o.status === 'Done').length
  const total = all.length
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}
