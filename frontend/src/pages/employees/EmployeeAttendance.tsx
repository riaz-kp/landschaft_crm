import { useMemo, useState } from 'react'
import { useDb } from '../../state/useDb'
import { formatDateLong, formatDuration, formatTime, today } from '../../domain/format'
import {
  STATUS_CELL, daysOfMonth, indexRegister, indexWorkerReports, isOffDay, resolveDay, totalsFor,
} from '../../domain/attendance'
import { ATTENDANCE_STATUSES, type Employee, type ID, type PersonKind } from '../../domain/types'
import { Badge, Section, StatTile } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { DayHours, DayStatusButtons } from './AttendanceDayEditor'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * One person's month — employee or site worker — with their totals. Tapping
 * a day opens it just under the calendar, where it can be changed in place.
 */
export function PersonAttendance({ kind, personId, canEdit }: { kind: PersonKind; personId: ID; canEdit: boolean }) {
  const db = useDb()
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const register = useMemo(() => indexRegister(db.attendance), [db.attendance])
  const workerReports = useMemo(() => indexWorkerReports(db.reports), [db.reports])
  const holidays = db.settings.holidays

  const [year, monthIndex] = month.split('-').map(Number)
  const firstDay = new Date(year, monthIndex - 1, 1)
  const leadingBlanks = (firstDay.getDay() + 6) % 7
  const days = daysOfMonth(month).map((date) => ({ date, day: resolveDay(kind, personId, date, register, workerReports) }))
  const t = totalsFor(days, holidays)
  const working = days.filter((d) => !isOffDay(d.date, holidays) && d.date <= today()).length
  const rate = working ? Math.round((t.days / working) * 100) : 0

  const shiftMonth = (delta: number) => {
    const date = new Date(year, monthIndex - 1 + delta, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const [selected, setSelected] = useState(today)
  const person = kind === 'employee'
    ? db.employees.find((e) => e.id === personId)
    : db.workers.find((w) => w.id === personId)
  const picked = selected.startsWith(month) ? days.find((d) => d.date === selected) : undefined

  const site = (id: ID) => db.projects.find((p) => p.id === id)?.siteLocation ?? ''

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Present" value={t.present} tone="green" />
        <StatTile label="Half Day" value={t.half} tone="amber" />
        <StatTile label="Leave" value={t.leave} tone="violet" />
        <StatTile label="Absent" value={t.absent} tone={t.absent ? 'red' : 'stone'} />
        <StatTile label="Overtime" value={`${t.ot}h`} tone="blue" sub={t.minutes ? `${formatDuration(t.minutes)} worked` : undefined} />
        <StatTile label="Attendance" value={`${rate}%`} sub={`${t.days} of ${working} working days so far`} />
      </div>

      <Section
        title={firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        description={canEdit ? 'Tap a day to change it below the calendar. Sundays and holidays are off days.' : 'Tap a day for its times. Sundays and holidays are off days.'}
        actions={
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="btn-icon" aria-label="Previous month"><Icon name="chevron" className="h-4 w-4 rotate-180" /></button>
            <button onClick={() => setMonth(today().slice(0, 7))} className="btn-secondary py-1.5 text-xs">This month</button>
            <button onClick={() => shiftMonth(1)} className="btn-icon" aria-label="Next month"><Icon name="chevron" className="h-4 w-4" /></button>
          </div>
        }
      >
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400">{d}</div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
            {days.map(({ date, day }) => {
              const off = isOffDay(date, holidays)
              const future = date > today()
              const clickable = !future
              const tone = day ? STATUS_CELL[day.status] : off ? 'bg-stone-50 text-stone-300 ring-stone-200' : 'bg-white text-stone-500 ring-stone-200'
              const title = day
                ? `${day.status}${day.checkIn ? ` · in ${formatTime(day.checkIn)}` : ''}${day.checkOut ? ` · out ${formatTime(day.checkOut)}` : ''}${day.otHours ? ` · OT ${day.otHours}h` : ''}`
                : off ? 'Off day' : future ? '' : 'Not recorded'
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!clickable}
                  onClick={() => setSelected(date)}
                  title={title}
                  aria-pressed={date === picked?.date}
                  className={`relative flex min-h-16 flex-col items-start rounded-xl p-1.5 text-left ring-1 ring-inset transition ${tone} ${
                    clickable ? 'hover:brightness-95' : 'cursor-default'
                  } ${date === picked?.date ? 'outline outline-2 outline-offset-1 outline-brand-600' : date === today() ? 'outline outline-1 outline-offset-1 outline-brand-300' : ''} ${future ? 'opacity-40' : ''}`}
                >
                  <span className="text-xs font-semibold tabular-nums">{Number(date.slice(8))}</span>
                  {day?.otHours ? <span className="absolute right-1.5 top-1.5 rounded bg-sky-500 px-1 text-[9px] font-bold text-white">+{day.otHours}h</span> : null}
                  <span className="mt-auto hidden w-full truncate text-[10px] font-medium leading-tight sm:block">
                    {day ? (day.projectIds.length ? site(day.projectIds[0]) : day.status) : off ? 'Off' : ''}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-stone-500">
            {ATTENDANCE_STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ring-1 ring-inset ${STATUS_CELL[s]}`} /> {s}
              </span>
            ))}
          </div>
        </div>

        {picked && (
          <div className="border-t border-stone-100 bg-stone-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="font-semibold text-stone-900">{formatDateLong(picked.date)}{picked.date === today() && ' · Today'}</p>
              {isOffDay(picked.date, holidays) && <Badge tone="stone">Off day</Badge>}
              {picked.day?.source === 'report' && <Badge tone="stone">from daily report</Badge>}
              {picked.day && picked.day.projectIds.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Icon name="pin" className="h-3 w-3" /> {picked.day.projectIds.map(site).join(', ')}
                </span>
              )}
            </div>
            <div className="max-w-xl space-y-3">
              {canEdit && (
                <DayStatusButtons labels kind={kind} personId={personId} date={picked.date} day={picked.day} name={person?.name ?? ''} canEdit />
              )}
              <DayHours kind={kind} personId={personId} date={picked.date} day={picked.day} name={person?.name ?? ''} canEdit={canEdit} />
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

export function EmployeeAttendance({ employee, canEdit }: { employee: Employee; canEdit: boolean }) {
  return <PersonAttendance kind="employee" personId={employee.id} canEdit={canEdit} />
}
