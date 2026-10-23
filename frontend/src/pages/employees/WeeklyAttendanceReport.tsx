import { useMemo, useState } from 'react'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import type { DbShape } from '../../data/store'
import { addDays, formatCurrency, formatTime, minutesBetween, today } from '../../domain/format'
import type { DateRange } from '../../domain/period'
import { titleOf } from '../../domain/roles'
import {
  STATUS_CODE, daysOfMonth, indexRegister, indexWorkerReports, isOffDay, resolveDay, totalsFor,
  type AttendanceTotals, type ResolvedDay,
} from '../../domain/attendance'
import type { ID, PayRecord, PayType, PersonKind } from '../../domain/types'
import { Checkbox, Modal, Pills, StatTile } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { WeekPicker, weekLabel, weekOf } from '../../components/WeekPicker'
import { RUPEES, excelDate, exportWorkbook, sheet } from '../../components/excel'

type Who = 'all' | PersonKind

export interface WeekPerson {
  kind: PersonKind
  id: ID
  name: string
  /** Role for employees, trade for workers. */
  role: string
  group: string
  monthlySalary?: number
  dailyWage?: number
  days: { date: string; day?: ResolvedDay }[]
  totals: AttendanceTotals
  /** Sites a worker was reported at during the week. */
  sites: string[]
  /** What the days worked are worth: the day rate, or the month's salary spread over its working days. */
  earned: number
  /** Everything paid out in the week, by type. */
  paid: Record<PayType, number>
  /** Salary or wages paid in the week for the month(s) the week falls in — set against what the week earned. */
  wagesForWeek: number
  /** Salary or wages paid in the week for an earlier month, such as last month's salary. Listed, not set against the week. */
  paidForEarlier: number
  /** Earned, less this period's salary or wages paid, advances and deductions — the same rule as the monthly pay summary. */
  net: number
  payments: PayRecord[]
}

const PAY_TYPES: PayType[] = ['Salary', 'Wages', 'Advance', 'TA', 'Bonus', 'Deduction']
const DAY_SHARE: Record<string, number> = { Present: 1, 'Half Day': 0.5 }
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekDates(week: DateRange): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week.from, i))
}

/** Everyone's week on the register, with what it earned and what was paid out in it. */
export function weeklyAttendanceData(db: DbShape, week: DateRange, who: Who): WeekPerson[] {
  const register = indexRegister(db.attendance)
  const workerReports = indexWorkerReports(db.reports)
  const holidays = db.settings.holidays
  const dates = weekDates(week)
  const workingDaysIn = new Map<string, number>()
  const workingDays = (month: string) => {
    if (!workingDaysIn.has(month)) workingDaysIn.set(month, daysOfMonth(month).filter((d) => !isOffDay(d, holidays)).length)
    return workingDaysIn.get(month)!
  }
  const siteName = (id: ID) => db.projects.find((p) => p.id === id)?.siteLocation ?? ''
  const weekMonths = new Set([week.from.slice(0, 7), week.to.slice(0, 7)])

  type Base = Pick<WeekPerson, 'kind' | 'id' | 'name' | 'role' | 'group' | 'monthlySalary' | 'dailyWage'>
  const people: Base[] = [
    ...(who === 'worker' ? [] : db.employees.filter((e) => e.role !== 'super_admin').map((e) => ({
      kind: 'employee' as const, id: e.id, name: e.name, role: titleOf(e), group: e.department, monthlySalary: e.monthlySalary,
    }))),
    ...(who === 'employee' ? [] : db.workers.filter((w) => w.active).map((w) => ({
      kind: 'worker' as const, id: w.id, name: w.name, role: w.skill, group: 'Execution Workers', dailyWage: w.dailyWage,
    }))),
  ]

  return people.map((person) => {
    const days = dates.map((date) => ({
      date, day: date <= today() ? resolveDay(person.kind, person.id, date, register, workerReports) : undefined,
    }))
    const earned = Math.round(days.reduce((sum, { date, day }) => {
      const share = DAY_SHARE[day?.status ?? ''] ?? 0
      if (!share) return sum
      if (person.dailyWage) return sum + share * person.dailyWage
      if (person.monthlySalary) return sum + share * (person.monthlySalary / (workingDays(date.slice(0, 7)) || 1))
      return sum
    }, 0))
    const payments = db.payRecords
      .filter((r) => r.kind === person.kind && r.personId === person.id && r.date >= week.from && r.date <= week.to)
      .sort((a, b) => a.date.localeCompare(b.date))
    const paid = Object.fromEntries(PAY_TYPES.map((t) => [t, payments.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0)])) as Record<PayType, number>
    // September's salary paid on 5 October settles September, not the days worked this week.
    const paidForEarlier = payments
      .filter((r) => (r.type === 'Salary' || r.type === 'Wages') && r.period && !weekMonths.has(r.period))
      .reduce((s, r) => s + r.amount, 0)
    const wagesForWeek = paid.Salary + paid.Wages - paidForEarlier
    return {
      ...person,
      days,
      totals: totalsFor(days, holidays),
      sites: [...new Set(days.flatMap(({ day }) => day?.projectIds ?? []).map(siteName))].filter(Boolean),
      earned,
      paid,
      wagesForWeek,
      paidForEarlier,
      net: earned - wagesForWeek - paid.Advance - paid.Deduction,
      payments,
    }
  })
}

const rateBasis = (p: WeekPerson) =>
  p.dailyWage ? `${formatCurrency(p.dailyWage)} a day` : p.monthlySalary ? `${formatCurrency(p.monthlySalary)} a month` : 'No rate set'
const hours = (t: AttendanceTotals) => Math.round(t.minutes / 6) / 10
/** −₹3,300 rather than ₹-3,300: a negative balance means more was paid than the week earned. */
const signed = (n: number, compact = false) => (n < 0 ? `−${formatCurrency(-n, compact)}` : formatCurrency(n, compact))

async function exportWeeklyAttendance(db: DbShape, people: WeekPerson[], week: DateRange, whoLabel: string, withPay: boolean) {
  const holidays = db.settings.holidays
  const dates = weekDates(week)
  const kindLabel = (p: WeekPerson) => (p.kind === 'worker' ? 'Worker' : 'Employee')
  const sum = (f: (p: WeekPerson) => number) => people.reduce((s, p) => s + f(p), 0)
  const dayCode = (date: string, day?: ResolvedDay) =>
    day ? STATUS_CODE[day.status] : date > today() ? '' : isOffDay(date, holidays) ? 'Off' : '·'
  const personName = (id: ID) => db.employees.find((e) => e.id === id)?.name ?? ''
  const dayRows = people.flatMap((p) => p.days.filter((d) => d.day).map((d) => ({ person: p, date: d.date, day: d.day! })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.person.name.localeCompare(b.person.name))

  // Counts and rupee amounts sit in separate columns so half days keep their decimals.
  type SummaryRow = { label: string; value?: string | number | Date; amount?: number }
  const summary: SummaryRow[] = [
    { label: 'Report', value: `Landschaft CRM — weekly attendance${withPay ? ' and payout' : ''}` },
    { label: 'Week', value: weekLabel(week) }, { label: 'People', value: `${people.length} · ${whoLabel}` },
    { label: 'Generated', value: excelDate(today()) },
    { label: 'Working days in the week', value: dates.filter((d) => !isOffDay(d, holidays)).length },
    { label: 'Days worked (half days as ½)', value: sum((p) => p.totals.days) },
    { label: 'Present', value: sum((p) => p.totals.present) }, { label: 'Half days', value: sum((p) => p.totals.half) },
    { label: 'Leave', value: sum((p) => p.totals.leave) }, { label: 'Absent', value: sum((p) => p.totals.absent) },
    { label: 'Overtime hours', value: sum((p) => p.totals.ot) },
    ...(withPay ? [
      { label: 'Earned this week', amount: sum((p) => p.earned) },
      { label: 'Salary and wages paid for this period', amount: sum((p) => p.wagesForWeek) },
      { label: 'Advances', amount: sum((p) => p.paid.Advance) }, { label: 'Deductions', amount: sum((p) => p.paid.Deduction) },
      { label: 'TA paid', amount: sum((p) => p.paid.TA) }, { label: 'Bonus paid', amount: sum((p) => p.paid.Bonus) },
      { label: 'Net payable', amount: sum((p) => p.net) },
      { label: 'Salary and wages paid for earlier months (not set against this week)', amount: sum((p) => p.paidForEarlier) },
    ] : []),
  ]

  await exportWorkbook(`Weekly attendance${withPay ? ' and payout' : ''} ${week.from} to ${week.to}`, [
    sheet({
      name: 'Summary',
      rows: summary,
      columns: [
        { header: 'Measure', value: (r) => r.label, width: 30 },
        { header: 'Value', value: (r) => r.value, width: 44 },
        ...(withPay ? [{ header: 'Amount (₹)', value: (r: SummaryRow) => r.amount, width: 16, format: RUPEES }] : []),
      ],
    }),
    sheet({
      name: 'Attendance',
      rows: people,
      columns: [
        { header: 'Name', value: (p) => p.name, width: 18 },
        { header: 'Type', value: kindLabel, width: 10 },
        { header: 'Department / Trade', value: (p) => (p.kind === 'worker' ? p.role : p.group), width: 20 },
        ...dates.map((date, i) => ({
          header: `${WEEKDAY[new Date(date + 'T00:00:00').getDay()]} ${date.slice(8)}/${date.slice(5, 7)}`,
          value: (p: WeekPerson) => dayCode(date, p.days[i].day),
          width: 9,
        })),
        { header: 'Present', value: (p) => p.totals.present, width: 9 },
        { header: 'Half days', value: (p) => p.totals.half, width: 10 },
        { header: 'Leave', value: (p) => p.totals.leave, width: 8 },
        { header: 'Absent', value: (p) => p.totals.absent, width: 8 },
        { header: 'Days worked', value: (p) => p.totals.days, width: 12 },
        { header: 'Hours', value: (p) => hours(p.totals), width: 8 },
        { header: 'OT hours', value: (p) => p.totals.ot, width: 9 },
        { header: 'Sites', value: (p) => p.sites.join(', '), width: 34 },
      ],
    }),
    sheet({
      name: 'Daily Detail',
      rows: dayRows,
      columns: [
        { header: 'Date', value: (r) => excelDate(r.date), width: 12 },
        { header: 'Day', value: (r) => WEEKDAY[new Date(r.date + 'T00:00:00').getDay()], width: 6 },
        { header: 'Name', value: (r) => r.person.name, width: 18 },
        { header: 'Type', value: (r) => kindLabel(r.person), width: 10 },
        { header: 'Status', value: (r) => r.day.status, width: 10 },
        { header: 'In', value: (r) => (r.day.checkIn ? formatTime(r.day.checkIn) : ''), width: 10 },
        { header: 'Out', value: (r) => (r.day.checkOut ? formatTime(r.day.checkOut) : ''), width: 10 },
        { header: 'Hours', value: (r) => (r.day.checkIn && r.day.checkOut ? Math.round(minutesBetween(r.day.checkIn, r.day.checkOut) / 6) / 10 : undefined), width: 8 },
        { header: 'OT hours', value: (r) => r.day.otHours, width: 9 },
        { header: 'Off day', value: (r) => isOffDay(r.date, holidays), width: 9 },
        { header: 'From', value: (r) => (r.day.source === 'report' ? 'Daily report' : 'Register'), width: 13 },
        { header: 'Site', value: (r) => r.day.projectIds.map((id) => db.projects.find((p) => p.id === id)?.siteLocation).filter(Boolean).join(', '), width: 30 },
      ],
    }),
    ...(withPay ? [
      sheet({
        name: 'Payout',
        rows: people,
        columns: [
          { header: 'Name', value: (p) => p.name, width: 18 },
          { header: 'Type', value: kindLabel, width: 10 },
          { header: 'Role / Trade', value: (p) => p.role, width: 24 },
          { header: 'Rate', value: rateBasis, width: 18 },
          { header: 'Days worked', value: (p) => p.totals.days, width: 12 },
          { header: 'OT hours', value: (p) => p.totals.ot, width: 9 },
          { header: 'Earned (₹)', value: (p) => p.earned, width: 12, format: RUPEES },
          { header: 'Salary / wages paid (₹)', value: (p) => p.wagesForWeek, width: 20, format: RUPEES },
          { header: 'Advances (₹)', value: (p) => p.paid.Advance, width: 13, format: RUPEES },
          { header: 'Deductions (₹)', value: (p) => p.paid.Deduction, width: 14, format: RUPEES },
          { header: 'Net payable (₹)', value: (p) => p.net, width: 15, format: RUPEES },
          { header: 'Paid for earlier months (₹)', value: (p) => p.paidForEarlier, width: 24, format: RUPEES },
          { header: 'TA paid (₹)', value: (p) => p.paid.TA, width: 12, format: RUPEES },
          { header: 'Bonus paid (₹)', value: (p) => p.paid.Bonus, width: 13, format: RUPEES },
          { header: 'Total paid out (₹)', value: (p) => PAY_TYPES.filter((t) => t !== 'Deduction').reduce((s, t) => s + p.paid[t], 0), width: 17, format: RUPEES },
        ],
      }),
      sheet({
        name: 'Payments',
        rows: people.flatMap((p) => p.payments.map((r) => ({ person: p, record: r }))).sort((a, b) => a.record.date.localeCompare(b.record.date)),
        columns: [
          { header: 'Date', value: (r) => excelDate(r.record.date), width: 12 },
          { header: 'Name', value: (r) => r.person.name, width: 18 },
          { header: 'Type', value: (r) => kindLabel(r.person), width: 10 },
          { header: 'Payment', value: (r) => r.record.type, width: 11 },
          { header: 'Amount (₹)', value: (r) => r.record.amount, width: 12, format: RUPEES },
          { header: 'Method', value: (r) => r.record.method, width: 14 },
          { header: 'For month', value: (r) => r.record.period ?? '', width: 10 },
          { header: 'Note', value: (r) => r.record.note ?? '', width: 34 },
          { header: 'Paid by', value: (r) => personName(r.record.paidBy), width: 14 },
        ],
      }),
    ] : []),
  ])
}

/** Picks a week and who to include, previews the totals, and downloads the attendance (and payout) workbook. */
export function WeeklyAttendanceReportModal({ onClose, initialWho = 'all' }: { onClose: () => void; initialWho?: Who }) {
  const db = useDb()
  const { can } = usePermissions()
  const canSeePay = can('Accounts', 'view') || can('Employees', 'edit')
  const [week, setWeek] = useState(() => weekOf(today()))
  const [who, setWho] = useState<Who>(initialWho)
  const [withPay, setWithPay] = useState(canSeePay)
  const [exporting, setExporting] = useState(false)
  const people = useMemo(() => weeklyAttendanceData(db, week, who), [db, week, who])
  const pay = withPay && canSeePay
  const whoLabel = { all: 'employees and execution workers', employee: 'employees', worker: 'execution workers' }[who]
  const sum = (f: (p: WeekPerson) => number) => people.reduce((s, p) => s + f(p), 0)

  const download = async () => {
    setExporting(true)
    try {
      await exportWeeklyAttendance(db, people, week, whoLabel, pay)
      onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal
      title={canSeePay ? 'Weekly attendance & payout' : 'Weekly attendance'}
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={download} disabled={exporting} className="btn-primary">
          <Icon name="upload" className="h-4 w-4 rotate-180" /> {exporting ? 'Preparing…' : 'Download Excel'}
        </button>
      </>}
    >
      <div className="space-y-4">
        <WeekPicker week={week} onChange={setWeek} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Pills<Who>
            active={who}
            onChange={setWho}
            options={[
              { key: 'all', label: 'Everyone' },
              { key: 'employee', label: 'Employees' },
              { key: 'worker', label: 'Execution Workers' },
            ]}
          />
          {canSeePay && <Checkbox checked={withPay} onChange={setWithPay} label="Include payout" />}
        </div>

        <div className={`grid grid-cols-2 gap-3 ${pay ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <StatTile label="Days Worked" value={sum((p) => p.totals.days)} sub={`${people.length} people`} icon="calendar" />
          <StatTile label="Overtime" value={`${sum((p) => p.totals.ot)}h`} tone="blue" icon="clock" />
          {pay ? <>
            <StatTile label="Earned" value={formatCurrency(sum((p) => p.earned), true)} tone="green" icon="rupee" />
            <StatTile label="Net Payable" value={signed(sum((p) => p.net), true)} tone="amber" icon="wallet" sub="after pay and advances" />
          </> : (
            <StatTile label="Absent" value={sum((p) => p.totals.absent)} tone="red" icon="alert" />
          )}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-stone-50 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-2 py-2 text-right">Days</th>
                <th className="px-2 py-2 text-right">OT</th>
                {pay && <><th className="px-2 py-2 text-right">Earned</th><th className="px-3 py-2 text-right">Net payable</th></>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {people.map((p) => (
                <tr key={`${p.kind}-${p.id}`}>
                  <td className="px-3 py-1.5">
                    <span className="font-medium text-stone-800">{p.name}</span>
                    <span className="ml-1.5 text-xs text-stone-400">{p.kind === 'worker' ? p.role : p.group}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.totals.days}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-stone-500">{p.totals.ot ? `${p.totals.ot}h` : '—'}</td>
                  {pay && <>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.earned ? formatCurrency(p.earned) : '—'}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${p.net < 0 ? 'text-red-700' : 'text-stone-900'}`}>{signed(p.net)}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-stone-500">
          Sheets: Summary, Attendance (P / H / L / A for each day of the week), Daily Detail (times, overtime, site)
          {pay && ', Payout and Payments'}. Workers' days come from the register, or from the foremen's daily reports where the register is blank.
          {pay && ' Earned is the day rate per day worked, or the monthly salary spread over the month’s working days. Net payable is earned less the salary or wages, advances and deductions paid in the week; pay for an earlier month, such as last month’s salary, is listed separately and not set against the week.'}
        </p>
      </div>
    </Modal>
  )
}
