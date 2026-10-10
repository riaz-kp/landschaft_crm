import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { addDays, formatDateLong, formatTime, today } from '../../domain/format'
import {
  STATUS_CELL, STATUS_CODE, daysOfMonth, indexRegister, indexWorkerReports, isOffDay, resolveDay, totalsFor,
} from '../../domain/attendance'
import { crewOf } from '../../domain/workers'
import { Avatar, SiteName } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { FieldCard } from '../../shells/FieldShell'

/**
 * The workers under this foreman — everyone who has been on their reports —
 * and how each one's day went: on site or not, the hours, and where. Read
 * only; the foreman records attendance through the daily report.
 */
export function FieldCrewAttendance() {
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()
  const [date, setDate] = useState(today())

  const register = useMemo(() => indexRegister(db.attendance), [db.attendance])
  const workerReports = useMemo(() => indexWorkerReports(db.reports), [db.reports])
  const crew = useMemo(() => crewOf(db.reports, user.id, today()), [db.reports, user.id])
  const holidays = db.settings.holidays
  const month = date.slice(0, 7)
  const monthSoFar = daysOfMonth(month).filter((d) => d <= today())

  const rows = crew
    .map((c) => {
      const worker = db.workers.find((w) => w.id === c.workerId)
      const day = resolveDay('worker', c.workerId, date, register, workerReports)
      const monthDays = totalsFor(
        monthSoFar.map((d) => ({ date: d, day: resolveDay('worker', c.workerId, d, register, workerReports) })),
        holidays,
      ).days
      return { workerId: c.workerId, worker, day, monthDays }
    })
    // On site first, then everyone else, each A–Z.
    .sort((a, b) => Number(Boolean(b.day)) - Number(Boolean(a.day)) || (a.worker?.name ?? '').localeCompare(b.worker?.name ?? ''))

  const working = rows.filter((r) => r.day?.status === 'Present' || r.day?.status === 'Half Day').length
  const away = rows.filter((r) => r.day?.status === 'Leave' || r.day?.status === 'Absent').length
  const site = (id: string) => db.projects.find((p) => p.id === id)?.siteLocation ?? ''
  const off = isOffDay(date, holidays)

  return (
    <div>
      <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-1.5 shadow-card">
        <button onClick={() => setDate(addDays(date, -1))} className="btn-icon h-10 w-10" aria-label="Previous day">
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <label className="relative flex flex-col items-center px-2 text-center">
          <span className="font-semibold text-stone-900">{date === today() ? 'Today' : date === addDays(today(), -1) ? 'Yesterday' : formatDateLong(date)}</span>
          <span className="text-[11px] text-stone-400">{date === today() || date === addDays(today(), -1) ? formatDateLong(date) : 'Tap to pick a date'}</span>
          <input
            type="date" value={date} max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pick a date"
          />
        </label>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} className="btn-icon h-10 w-10 disabled:opacity-30" aria-label="Next day">
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ['On site', working, 'text-brand-700'],
          ['Leave / absent', away, away ? 'text-red-700' : 'text-stone-900'],
          ['Crew', rows.length, 'text-stone-900'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-card">
            <p className={`font-display text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
          </div>
        ))}
      </div>
      {off && <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-center text-xs text-stone-600">{new Date(date + 'T00:00:00').getDay() === 0 ? 'Sunday' : 'Holiday'} — an off day.</p>}

      <div className="mt-4 space-y-2">
        {rows.map(({ workerId, worker, day, monthDays }) => (
          <FieldCard key={workerId} onClick={() => navigate(`/field/workers/${workerId}`)} className="py-3">
            <div className="flex items-center gap-3">
              <Avatar name={worker?.name ?? '?'} src={worker?.photo} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">{worker?.name ?? 'Removed worker'}</p>
                <p className="truncate text-xs text-stone-500">{worker?.skill}</p>
              </div>
              {day ? (
                <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_CELL[day.status]}`}>
                  <span className="font-bold">{STATUS_CODE[day.status]}</span> {day.status}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">Not on site</span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-stone-100 pt-2.5 text-xs text-stone-500">
              {day?.checkIn && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Icon name="clock" className="h-3.5 w-3.5" /> {formatTime(day.checkIn)} – {day.checkOut ? formatTime(day.checkOut) : '…'}
                </span>
              )}
              {day?.otHours ? <span className="font-semibold text-sky-700">+{day.otHours}h OT</span> : null}
              {day && day.projectIds.length > 0 && (
                <span className="flex min-w-0 items-center gap-1">
                  <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{day.projectIds.map((id, i) => <span key={id}>{i > 0 && ', '}<SiteName name={site(id)} /></span>)}</span>
                </span>
              )}
              <span className="ml-auto tabular-nums">
                <strong className="text-stone-800">{monthDays}</strong> day{monthDays === 1 ? '' : 's'} in {new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
              </span>
            </div>
          </FieldCard>
        ))}
        {rows.length === 0 && (
          <FieldCard><p className="py-6 text-center text-sm text-stone-400">Workers appear here once you file a report with them on it.</p></FieldCard>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-stone-400">
        Taken from the daily reports and the office register. Tell your Execution PM if a day looks wrong.
      </p>
    </div>
  )
}
