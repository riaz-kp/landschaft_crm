import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { formatTime, today } from '../../domain/format'
import type { Employee, StaffAttendanceStatus } from '../../domain/types'
import { Section, StatTile } from '../../components/ui'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Clicking a day steps through these, then back to unrecorded. */
const CYCLE: (StaffAttendanceStatus | null)[] = ['Present', 'Half Day', 'Leave', 'Absent', null]

const CELL: Record<StaffAttendanceStatus, string> = {
  Present: 'bg-brand-100 text-brand-800 ring-brand-600/20',
  'Half Day': 'bg-amber-100 text-amber-800 ring-amber-600/20',
  Leave: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  Absent: 'bg-red-100 text-red-800 ring-red-600/20',
}

export function EmployeeAttendance({ employee, canEdit }: { employee: Employee; canEdit: boolean }) {
  const db = useDb()
  const [month, setMonth] = useState(() => today().slice(0, 7))

  const [year, monthIndex] = month.split('-').map(Number)
  const firstDay = new Date(year, monthIndex - 1, 1)
  const daysInMonth = new Date(year, monthIndex, 0).getDate()
  const leadingBlanks = (firstDay.getDay() + 6) % 7

  const entries = db.staffAttendance.filter((a) => a.employeeId === employee.id && a.date.startsWith(month))
  const entryOn = (iso: string) => entries.find((a) => a.date === iso)
  const count = (status: StaffAttendanceStatus) => entries.filter((a) => a.status === status).length
  const worked = count('Present') + count('Half Day') / 2
  const recorded = entries.length
  const rate = recorded ? Math.round((worked / recorded) * 100) : 0

  const shiftMonth = (delta: number) => {
    const date = new Date(year, monthIndex - 1 + delta, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const cycle = (iso: string) => {
    const current = entryOn(iso)?.status ?? null
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
    api.employees.setAttendance(employee.id, iso, next)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Present" value={count('Present')} tone="green" />
        <StatTile label="Half Day" value={count('Half Day')} tone="amber" />
        <StatTile label="Leave" value={count('Leave')} tone="blue" />
        <StatTile label="Absent" value={count('Absent')} tone={count('Absent') ? 'red' : 'stone'} />
        <StatTile label="Attendance" value={`${rate}%`} sub={`${worked} of ${recorded} recorded days`} />
      </div>

      <Section
        title={firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        description={canEdit ? 'Click a day to change its status. Sundays are the weekly off.' : 'Sundays are the weekly off.'}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="btn-secondary px-3" aria-label="Previous month">‹</button>
            <button onClick={() => shiftMonth(1)} className="btn-secondary px-3" aria-label="Next month">›</button>
          </div>
        }
      >
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-stone-400">{d}</div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const iso = `${month}-${String(day).padStart(2, '0')}`
              const entry = entryOn(iso)
              const sunday = new Date(year, monthIndex - 1, day).getDay() === 0
              const future = iso > today()
              const clickable = canEdit && !future
              const tone = entry ? CELL[entry.status] : sunday ? 'bg-stone-50 text-stone-300 ring-stone-200' : 'bg-white text-stone-500 ring-stone-200'
              const title = entry
                ? `${entry.status}${entry.checkIn ? ` · in ${formatTime(entry.checkIn)}` : ''}${entry.checkOut ? ` · out ${formatTime(entry.checkOut)}` : ''}`
                : sunday ? 'Weekly off' : future ? '' : 'Not recorded'
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!clickable}
                  onClick={() => cycle(iso)}
                  title={title}
                  className={`flex min-h-14 flex-col items-start rounded-lg p-1.5 text-left ring-1 ring-inset transition ${tone} ${
                    clickable ? 'hover:brightness-95' : 'cursor-default'
                  } ${iso === today() ? 'outline outline-2 outline-offset-1 outline-brand-500' : ''} ${future ? 'opacity-40' : ''}`}
                >
                  <span className="text-xs font-semibold tabular-nums">{day}</span>
                  <span className="mt-auto hidden text-[10px] font-medium leading-tight sm:block">
                    {entry ? entry.status : sunday ? 'Off' : ''}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-stone-500">
            {(Object.keys(CELL) as StaffAttendanceStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ring-1 ring-inset ${CELL[s]}`} /> {s}
              </span>
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}
