import type { AttendanceEntry, DailyWorkReport, ID, PersonKind, StaffAttendanceStatus } from './types'
import { minutesBetween } from './format'

/** Sundays are the weekly off; holidays are added in the register. */
export function isOffDay(date: string, holidays: string[]): boolean {
  return new Date(date + 'T00:00:00').getDay() === 0 || holidays.includes(date)
}

export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

/** One person's resolved day: what was marked in the register, or what a daily report shows. */
export interface ResolvedDay {
  status: StaffAttendanceStatus
  checkIn?: string
  checkOut?: string
  otHours?: number
  /** "report" when the day comes from a foreman's daily report rather than the register. */
  source: 'register' | 'report'
  /** Projects the worker was reported at that day. */
  projectIds: ID[]
}

/** worker id → date → the reports that list them as present. */
export type WorkerReportIndex = Map<ID, Map<string, DailyWorkReport[]>>

export function indexWorkerReports(reports: DailyWorkReport[]): WorkerReportIndex {
  const index: WorkerReportIndex = new Map()
  for (const report of reports) {
    // A draft is still being filled in on site; it only counts once submitted.
    if (report.status === 'Draft') continue
    for (const entry of report.attendance) {
      if (!entry.present) continue
      let days = index.get(entry.workerId)
      if (!days) index.set(entry.workerId, (days = new Map()))
      days.set(report.date, [...(days.get(report.date) ?? []), report])
    }
  }
  return index
}

/** register key → entry, for quick lookups while drawing the month grid. */
export function indexRegister(entries: AttendanceEntry[]): Map<string, AttendanceEntry> {
  return new Map(entries.map((e) => [registerKey(e.kind, e.personId, e.date), e]))
}

export const registerKey = (kind: PersonKind, personId: ID, date: string) => `${kind}:${personId}:${date}`

export function resolveDay(
  kind: PersonKind, personId: ID, date: string,
  register: Map<string, AttendanceEntry>, workerReports: WorkerReportIndex,
): ResolvedDay | undefined {
  const reports = kind === 'worker' ? workerReports.get(personId)?.get(date) ?? [] : []
  const projectIds = reports.map((r) => r.projectId)
  const marked = register.get(registerKey(kind, personId, date))
  if (marked) {
    return { status: marked.status, checkIn: marked.checkIn, checkOut: marked.checkOut, otHours: marked.otHours, source: 'register', projectIds }
  }
  if (reports.length === 0) return undefined
  const first = reports[0]
  const entry = first.attendance.find((a) => a.workerId === personId)
  return {
    status: 'Present',
    checkIn: entry?.checkIn || first.startTime,
    checkOut: entry?.checkOut || first.endTime,
    otHours: Math.max(...reports.map((r) => r.otHours)) || undefined,
    source: 'report',
    projectIds,
  }
}

export interface AttendanceTotals {
  present: number
  half: number
  leave: number
  absent: number
  ot: number
  /** Present days plus half days counted as halves. */
  days: number
  /** Days worked on a Sunday or holiday. */
  offDayWork: number
  minutes: number
}

export function totalsFor(days: { date: string; day?: ResolvedDay }[], holidays: string[]): AttendanceTotals {
  const t: AttendanceTotals = { present: 0, half: 0, leave: 0, absent: 0, ot: 0, days: 0, offDayWork: 0, minutes: 0 }
  for (const { date, day } of days) {
    if (!day) continue
    if (day.status === 'Present') t.present += 1
    if (day.status === 'Half Day') t.half += 1
    if (day.status === 'Leave') t.leave += 1
    if (day.status === 'Absent') t.absent += 1
    t.ot += day.otHours ?? 0
    if ((day.status === 'Present' || day.status === 'Half Day') && isOffDay(date, holidays)) t.offDayWork += 1
    if (day.checkIn && day.checkOut) t.minutes += minutesBetween(day.checkIn, day.checkOut)
  }
  t.days = t.present + t.half / 2
  return t
}

/** The register's single-letter codes, as on a paper muster roll. */
export const STATUS_CODE: Record<StaffAttendanceStatus, string> = {
  Present: 'P', 'Half Day': 'H', Leave: 'L', Absent: 'A',
}

export const STATUS_CELL: Record<StaffAttendanceStatus, string> = {
  Present: 'bg-brand-100 text-brand-800 ring-brand-600/25',
  'Half Day': 'bg-amber-100 text-amber-800 ring-amber-600/25',
  Leave: 'bg-violet-100 text-violet-800 ring-violet-600/25',
  Absent: 'bg-red-100 text-red-700 ring-red-600/25',
}
