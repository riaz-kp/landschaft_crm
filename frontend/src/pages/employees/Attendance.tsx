import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { titleOf } from '../../domain/roles'
import { currentTime, formatDate, formatDateLong, formatDuration, formatTime, minutesBetween, today } from '../../domain/format'
import {
  STATUS_CELL, STATUS_CODE, daysOfMonth, indexRegister, indexWorkerReports, isOffDay,
  resolveDay, totalsFor, type ResolvedDay,
} from '../../domain/attendance'
import {
  ATTENDANCE_STATUSES, DEPARTMENTS, type ID, type PersonKind, type StaffAttendanceStatus,
} from '../../domain/types'
import { PageHeader, Section, StatTile, Avatar, Pills, SearchInput, Badge, EmptyState } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ClockToggle } from '../../components/TimeInput'
import { AttendanceDayModal } from './AttendanceDayModal'

interface Person {
  kind: PersonKind
  id: ID
  name: string
  sub: string
  photo?: string
  /** Department for employees, skill for workers — what the group filter matches on. */
  group: string
  to: string
}

type KindFilter = 'all' | PersonKind

const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * A day taken from a daily report has no register entry yet. When it is
 * corrected, carry its times across so they are not replaced by defaults.
 */
function fromReport(day?: ResolvedDay) {
  return day?.source === 'report'
    ? { status: day.status, checkIn: day.checkIn, checkOut: day.checkOut, otHours: day.otHours }
    : {}
}

/**
 * The attendance register for the whole company — office staff and site
 * workers on one page. Mark the day at the top; the month grid below shows
 * everyone's month with totals. Workers' days fill in from the foremen's
 * daily reports, and can be corrected here. Any day opens in an editor.
 */
export function Attendance() {
  const db = useDb()
  const { can } = usePermissions()
  const canEdit = can('Attendance', 'edit')

  const [kind, setKind] = useState<KindFilter>('all')
  const [group, setGroup] = useState('')
  const [query, setQuery] = useState('')
  const [date, setDate] = useState(today())
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [editing, setEditing] = useState<{ person: Person; date: string } | null>(null)

  const register = useMemo(() => indexRegister(db.attendance), [db.attendance])
  const workerReports = useMemo(() => indexWorkerReports(db.reports), [db.reports])
  const holidays = db.settings.holidays

  const people = useMemo<Person[]>(() => [
    ...db.employees.filter((e) => e.role !== 'super_admin').map((e): Person => ({
      kind: 'employee', id: e.id, name: e.name, sub: titleOf(e), photo: e.photo, group: e.department, to: `/employees/${e.id}`,
    })),
    ...db.workers.filter((w) => w.active).map((w): Person => ({
      kind: 'worker', id: w.id, name: w.name, sub: w.skill, photo: w.photo, group: 'Execution Workers', to: `/employees/workers/${w.id}`,
    })),
  ], [db.employees, db.workers])

  const groups = kind === 'worker' ? [] : DEPARTMENTS.filter((d) => people.some((p) => p.group === d))
  const q = query.trim().toLowerCase()
  const shown = people.filter((p) =>
    (kind === 'all' || p.kind === kind)
    && (!group || p.group === group)
    && (!q || p.name.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q)))

  const dayOf = (p: Person, d: string) => resolveDay(p.kind, p.id, d, register, workerReports)
  const todays = shown.map((p) => ({ person: p, day: dayOf(p, date) }))
  const count = (s: StaffAttendanceStatus) => todays.filter((t) => t.day?.status === s).length
  const unmarked = todays.filter((t) => !t.day)

  const projectName = (id: ID) => db.projects.find((p) => p.id === id)?.siteLocation ?? ''
  const open = (person: Person, d: string) => setEditing({ person, date: d })

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Daily register for employees and execution workers — status, time in and out, and overtime. Workers fill in automatically from the foremen's daily reports. Tap anyone's day to edit it."
        actions={<ClockToggle />}
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Pills<KindFilter>
          active={kind}
          onChange={(k) => { setKind(k); setGroup('') }}
          options={[
            { key: 'all', label: 'Everyone', count: people.length },
            { key: 'employee', label: 'Employees', count: people.filter((p) => p.kind === 'employee').length },
            { key: 'worker', label: 'Execution Workers', count: people.filter((p) => p.kind === 'worker').length },
          ]}
        />
        <div className="flex flex-1 flex-col gap-3 sm:flex-row lg:justify-end">
          {groups.length > 0 && (
            <select className="input sm:w-48" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {groups.map((g) => <option key={g}>{g}</option>)}
            </select>
          )}
          <SearchInput value={query} onChange={setQuery} placeholder="Search people…" className="sm:w-64" />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Present" value={count('Present')} tone="green" icon="check" />
        <StatTile label="Half Day" value={count('Half Day')} tone="amber" icon="clock" />
        <StatTile label="On Leave" value={count('Leave')} tone="violet" icon="calendar" />
        <StatTile label="Absent" value={count('Absent')} tone={count('Absent') ? 'red' : 'stone'} icon="alert" />
        <StatTile label="Not Marked" value={unmarked.length} tone={unmarked.length ? 'amber' : 'green'} icon="users" />
      </div>

      {!canEdit && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm text-stone-600">
          <Icon name="eye" className="h-4 w-4 shrink-0" /> You can view attendance. Editing is granted from Settings → Roles &amp; Permissions → Attendance.
        </p>
      )}

      {/* Day register */}
      <Section
        className="mb-6"
        title={date === today() ? 'Today' : formatDateLong(date)}
        description={
          isOffDay(date, holidays)
            ? `${new Date(date + 'T00:00:00').getDay() === 0 ? 'Sunday' : 'Holiday'} — off day. Anyone marked here counts as work on an off day.`
            : unmarked.length ? `${unmarked.length} not marked yet` : 'Everyone is marked'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date" value={date} max={today()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="input w-auto py-1.5" aria-label="Register date"
            />
            {date !== today() && (
              <button onClick={() => setDate(today())} className="btn-secondary py-1.5">Today</button>
            )}
            {canEdit && unmarked.length > 0 && (
              <button
                onClick={() => unmarked.forEach(({ person }) => api.attendance.set(person.kind, person.id, date, { status: 'Present' }))}
                className="btn-secondary py-1.5"
              >
                Mark the rest present
              </button>
            )}
          </div>
        }
      >
        {shown.length === 0 ? (
          <EmptyState title="No one matches these filters." icon="users" />
        ) : (
          <div className="grid gap-3 bg-stone-50/60 p-3 sm:p-4 md:grid-cols-2 2xl:grid-cols-3">
            {todays.map(({ person, day }) => (
              <RegisterCard
                key={`${person.kind}-${person.id}`}
                person={person} date={date} day={day} canEdit={canEdit}
                sites={day?.projectIds.map(projectName) ?? []}
                onOpen={() => open(person, date)}
              />
            ))}
          </div>
        )}
        <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-400">
          Tap a letter to set the status quickly — tap it again to clear. Tap the hours to edit time in, time out and
          overtime. Marking someone present notes the current time as their time in.
        </p>
      </Section>

      <MonthRegister
        people={shown} month={month} setMonth={setMonth} canEdit={canEdit}
        dayOf={dayOf} holidays={holidays} onOpen={open}
      />

      {editing && (
        <AttendanceDayModal
          key={`${editing.person.kind}-${editing.person.id}-${editing.date}`}
          kind={editing.person.kind}
          personId={editing.person.id}
          name={editing.person.name}
          photo={editing.person.photo}
          date={editing.date}
          day={dayOf(editing.person, editing.date)}
          canEdit={canEdit && editing.date <= today()}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- one person, one day

function RegisterCard({
  person, date, day, canEdit, sites, onOpen,
}: { person: Person; date: string; day?: ResolvedDay; canEdit: boolean; sites: string[]; onOpen: () => void }) {
  const working = day?.status === 'Present' || day?.status === 'Half Day'
  const set = (patch: Parameters<typeof api.attendance.set>[3]) => api.attendance.set(person.kind, person.id, date, patch)
  const hours = working && day?.checkIn && day.checkOut ? formatDuration(minutesBetween(day.checkIn, day.checkOut)) : null
  const canClockOut = canEdit && working && date === today() && !day?.checkOut

  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm transition ${day ? 'border-stone-200 bg-white' : 'border-dashed border-amber-300 bg-amber-50/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <Link to={person.to} className="flex min-w-0 items-center gap-2.5">
          <Avatar name={person.name} size="sm" src={person.photo} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-stone-900 hover:text-brand-700">{person.name}</span>
            <span className="block truncate text-xs text-stone-500">{person.sub}</span>
          </span>
        </Link>
        <div className="flex shrink-0 gap-1">
          {ATTENDANCE_STATUSES.map((s) => {
            const on = day?.status === s
            return (
              <button
                key={s}
                type="button"
                disabled={!canEdit}
                onClick={() => set(on ? null : { ...fromReport(day), status: s })}
                title={s}
                aria-label={`${s} — ${person.name}`}
                aria-pressed={on}
                className={`h-8 w-8 rounded-lg text-xs font-bold ring-1 ring-inset transition ${
                  on ? STATUS_CELL[s] : 'bg-white text-stone-400 ring-stone-200 hover:text-stone-700 hover:ring-stone-300'
                } disabled:cursor-default`}
              >
                {STATUS_CODE[s]}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 flex w-full items-center gap-3 rounded-xl bg-stone-50 px-3 py-2 text-left ring-1 ring-inset ring-stone-200/70 transition hover:bg-brand-50/60 hover:ring-brand-200"
        aria-label={`${canEdit ? 'Edit' : 'View'} ${person.name}'s day`}
      >
        {working ? (
          <span className="grid flex-1 grid-cols-3 gap-2 text-xs">
            <TimeCell label="In" value={day?.checkIn ? formatTime(day.checkIn) : '—'} />
            <TimeCell label="Out" value={day?.checkOut ? formatTime(day.checkOut) : '—'} muted={!day?.checkOut} />
            <TimeCell label="OT" value={day?.otHours ? `${day.otHours}h` : '—'} muted={!day?.otHours} />
          </span>
        ) : (
          <span className="flex-1 text-xs text-stone-500">
            {day ? `${day.status} — no hours to record` : 'Not marked yet'}
          </span>
        )}
        {canEdit && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700">
            <Icon name="edit" className="h-3.5 w-3.5" /> Edit
          </span>
        )}
      </button>

      {(canClockOut || day?.source === 'report' || sites.length > 0 || hours) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
          {hours && <span className="tabular-nums">{hours} worked</span>}
          {sites.length > 0 && <span className="flex items-center gap-1"><Icon name="pin" className="h-3 w-3" /> {sites.join(', ')}</span>}
          {day?.source === 'report' && <Badge tone="stone">from daily report</Badge>}
          {canClockOut && (
            <button
              type="button"
              onClick={() => set({ ...fromReport(day), checkOut: currentTime() })}
              className="ml-auto rounded-lg bg-brand-50 px-2 py-1 font-semibold text-brand-700 hover:bg-brand-100"
            >
              Time out now
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TimeCell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <span className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</span>
      <span className={`block truncate font-semibold tabular-nums ${muted ? 'text-stone-400' : 'text-stone-800'}`}>{value}</span>
    </span>
  )
}

// ---------------------------------------------------------------- the month

function MonthRegister({
  people, month, setMonth, canEdit, dayOf, holidays, onOpen,
}: {
  people: Person[]; month: string; setMonth: (m: string) => void; canEdit: boolean
  dayOf: (p: Person, date: string) => ResolvedDay | undefined; holidays: string[]
  onOpen: (p: Person, date: string) => void
}) {
  const days = daysOfMonth(month)
  const working = days.filter((d) => !isOffDay(d, holidays))
  const sofar = working.filter((d) => d <= today()).length
  const offThisMonth = days.filter((d) => isOffDay(d, holidays))
  const sundays = offThisMonth.filter((d) => new Date(d + 'T00:00:00').getDay() === 0).length
  const holidayList = offThisMonth.filter((d) => new Date(d + 'T00:00:00').getDay() !== 0)

  const label = new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <Section>
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="btn-icon" aria-label="Previous month">
            <Icon name="chevron" className="h-4 w-4 rotate-180" />
          </button>
          <h2 className="w-40 text-center font-semibold text-stone-900">{label}</h2>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="btn-icon" aria-label="Next month">
            <Icon name="chevron" className="h-4 w-4" />
          </button>
        </div>
        <span className="rounded-xl bg-stone-100 px-3 py-1.5 text-xs text-stone-600">
          Working days <strong className="ml-1 text-base text-stone-900">{working.length}</strong>
          <span className="ml-1.5 text-stone-400">{sofar} so far</span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-stone-500">
          {ATTENDANCE_STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-inset ${STATUS_CELL[s]}`}>{STATUS_CODE[s]}</span>
              {s}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-5 w-5 rounded-md bg-stone-100 ring-1 ring-inset ring-stone-200" /> Off day</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-brand-100 text-[10px] font-bold text-brand-800 ring-1 ring-inset ring-brand-600/25">
              P<span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
            </span>
            Overtime
          </span>
        </div>
      </header>

      {people.length === 0 ? (
        <EmptyState title="No one matches these filters." icon="users" />
      ) : (
        <div className="scroll-x">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[170px] border-b border-stone-200 bg-white px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Person</th>
                {days.map((d) => {
                  const dow = new Date(d + 'T00:00:00').getDay()
                  const off = isOffDay(d, holidays)
                  const isHoliday = holidays.includes(d)
                  const clickable = canEdit && dow !== 0
                  return (
                    <th key={d} className={`border-b border-stone-200 px-0.5 py-1.5 text-center font-semibold ${off ? 'bg-stone-50' : ''} ${d === today() ? 'bg-brand-50' : ''}`}>
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => api.attendance.setHoliday(d, !isHoliday)}
                        title={clickable ? (isHoliday ? 'Holiday — click to make it a working day' : 'Click to make this an off day for everyone') : dow === 0 ? 'Sunday' : ''}
                        className={`w-7 rounded-md py-0.5 leading-tight ${clickable ? 'hover:bg-stone-200/70' : 'cursor-default'}`}
                      >
                        <span className={`block text-[10px] ${off ? 'text-red-500' : 'text-stone-400'}`}>{WEEKDAY_LETTER[dow]}</span>
                        <span className={`block tabular-nums ${d === today() ? 'text-brand-700' : 'text-stone-700'}`}>{Number(d.slice(8))}</span>
                      </button>
                    </th>
                  )
                })}
                {['P', 'H', 'L', 'A', 'OT', 'Days'].map((h) => (
                  <th key={h} className="border-b border-l border-stone-200 bg-stone-50 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-stone-500 first-of-type:border-l-2">
                    {h}
                    {h === 'Days' && <span className="block font-normal normal-case tracking-normal text-stone-400">of {working.length}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const rows = days.map((d) => ({ date: d, day: dayOf(p, d) }))
                const t = totalsFor(rows, holidays)
                return (
                  <tr key={`${p.kind}-${p.id}`} className="group">
                    <td className="sticky left-0 z-10 border-b border-stone-100 bg-white px-4 py-1.5 group-hover:bg-stone-50">
                      <Link to={p.to} className="flex items-center gap-2">
                        <Avatar name={p.name} size="sm" src={p.photo} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-stone-800 hover:text-brand-700">{p.name}</span>
                          <span className="block truncate text-[10px] text-stone-400">{p.kind === 'worker' ? 'Worker' : p.group}</span>
                        </span>
                      </Link>
                    </td>
                    {rows.map(({ date: d, day }) => {
                      const off = isOffDay(d, holidays)
                      const future = d > today()
                      return (
                        <td key={d} className={`border-b border-stone-100 px-0.5 py-1 text-center ${off ? 'bg-stone-50' : ''} ${d === today() ? 'bg-brand-50/60' : ''}`}>
                          <button
                            type="button"
                            disabled={future}
                            onClick={() => onOpen(p, d)}
                            title={day ? `${formatDate(d)} · ${day.status}${day.checkIn ? ` · in ${formatTime(day.checkIn)}` : ''}${day.checkOut ? ` · out ${formatTime(day.checkOut)}` : ''}${day.otHours ? ` · OT ${day.otHours}h` : ''}${day.source === 'report' ? ' · from daily report' : ''}` : formatDate(d)}
                            className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold transition ${
                              day ? `ring-1 ring-inset ${STATUS_CELL[day.status]}` : off ? 'text-stone-300' : 'text-stone-300 hover:bg-stone-100'
                            } ${future ? 'cursor-default' : 'hover:brightness-95'} ${day?.source === 'report' ? 'outline-dashed outline-1 outline-offset-[-3px] outline-brand-600/30' : ''}`}
                          >
                            {day ? STATUS_CODE[day.status] : off || future ? '' : '·'}
                            {day?.otHours ? <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" /> : null}
                          </button>
                        </td>
                      )
                    })}
                    <td className="border-b border-l-2 border-stone-200 px-2 text-center font-semibold tabular-nums text-brand-700">{t.present}</td>
                    <td className="border-b border-l border-stone-100 px-2 text-center tabular-nums text-amber-700">{t.half}</td>
                    <td className="border-b border-l border-stone-100 px-2 text-center tabular-nums text-violet-700">{t.leave}</td>
                    <td className="border-b border-l border-stone-100 px-2 text-center tabular-nums text-red-700">{t.absent}</td>
                    <td className="border-b border-l border-stone-100 px-2 text-center tabular-nums text-stone-600">{t.ot ? `${t.ot}h` : '—'}</td>
                    <td className="border-b border-l border-stone-100 px-2 text-center font-bold tabular-nums text-stone-900">
                      {t.days}{t.offDayWork ? '*' : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1 border-t border-stone-100 px-5 py-3 text-xs text-stone-400">
        <p>
          Off this month: {sundays} Sundays{holidayList.length > 0 && ` · ${holidayList.map((d) => formatDateLong(d)).join(', ')}`}.
          Days marked * include work on an off day. Dashed cells come from a foreman's daily report.
        </p>
        <p>
          {canEdit
            ? 'Click any day to set its status, times and overtime. Click a date at the top to make it an off day for everyone, such as a holiday.'
            : 'Click any day to see its times and overtime.'}
        </p>
      </div>
    </Section>
  )
}
