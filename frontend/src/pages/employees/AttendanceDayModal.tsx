import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { currentTime, formatDateLong, formatDuration, minutesBetween, today } from '../../domain/format'
import { STATUS_CELL, STATUS_CODE, isOffDay, type ResolvedDay } from '../../domain/attendance'
import { ATTENDANCE_STATUSES, type ID, type PersonKind, type StaffAttendanceStatus } from '../../domain/types'
import { Avatar, FormError, Modal } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ClockToggle, TimeInput } from '../../components/TimeInput'

/**
 * Everything about one person's day in one place: status, time in and out,
 * and overtime. Opened from the day register, the month grid and a person's
 * own attendance calendar. Read-only for anyone who cannot edit attendance.
 */
export function AttendanceDayModal({
  kind, personId, name, photo, date, day, canEdit, onClose,
}: {
  kind: PersonKind
  personId: ID
  name: string
  photo?: string
  date: string
  day?: ResolvedDay
  canEdit: boolean
  onClose: () => void
}) {
  const db = useDb()
  const [status, setStatus] = useState<StaffAttendanceStatus | null>(day?.status ?? null)
  const [checkIn, setCheckIn] = useState(day?.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(day?.checkOut ?? '')
  const [ot, setOt] = useState(day?.otHours ?? 0)
  const [error, setError] = useState<string | null>(null)

  const working = status === 'Present' || status === 'Half Day'
  const isToday = date === today()
  const worked = working && checkIn && checkOut ? minutesBetween(checkIn, checkOut) : 0
  const sites = day?.projectIds.map((id) => db.projects.find((p) => p.id === id)?.siteLocation).filter(Boolean) ?? []
  const offDay = isOffDay(date, db.settings.holidays)

  const pickStatus = (s: StaffAttendanceStatus) => {
    setStatus(s)
    setError(null)
    // Someone newly marked in gets a time in straight away; it can be changed below.
    if ((s === 'Present' || s === 'Half Day') && !checkIn) setCheckIn(isToday ? currentTime() : '09:00')
  }

  const save = () => {
    if (!status) {
      api.attendance.set(kind, personId, date, null)
      return onClose()
    }
    if (working && !checkIn) return setError('Set the time in.')
    if (working && checkOut && checkOut <= checkIn) return setError('Time out must be after time in.')
    api.attendance.set(kind, personId, date, working
      ? { status, checkIn, checkOut, otHours: ot || undefined }
      : { status })
    onClose()
  }

  const stepOt = (delta: number) => setOt((h) => Math.max(0, Math.min(12, Math.round((h + delta) * 2) / 2)))

  return (
    <Modal
      title={
        <span className="flex items-center gap-3">
          <Avatar name={name} size="sm" src={photo} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate">{name}</span>
            <span className="block text-xs font-normal text-stone-500">{formatDateLong(date)}{isToday && ' · Today'}</span>
          </span>
        </span>
      }
      onClose={onClose}
      footer={canEdit ? <>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary"><Icon name="check" className="h-4 w-4" /> Save</button>
      </> : <button onClick={onClose} className="btn-secondary">Close</button>}
    >
      <div className="space-y-5">
        {offDay && (
          <p className="rounded-xl bg-stone-100 px-3 py-2 text-xs text-stone-600">
            {new Date(date + 'T00:00:00').getDay() === 0 ? 'Sunday' : 'Holiday'} — an off day. Marking someone in here counts as work on an off day.
          </p>
        )}
        {day?.source === 'report' && (
          <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-900">
            <Icon name="doc" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Filled in from the daily report{sites.length ? ` at ${sites.join(', ')}` : ''}. Saving here corrects it in the register.
          </p>
        )}

        <div>
          <p className="label mb-2">Status</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ATTENDANCE_STATUSES.map((s) => {
              const on = status === s
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => pickStatus(s)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ring-inset transition ${
                    on ? `${STATUS_CELL[s]} ring-2` : 'bg-white text-stone-600 ring-stone-200 hover:ring-stone-300'
                  } disabled:cursor-default`}
                  aria-pressed={on}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs ${on ? 'bg-white/70' : 'bg-stone-100'}`}>{STATUS_CODE[s]}</span>
                  {s}
                </button>
              )
            })}
          </div>
          {canEdit && status && (
            <button type="button" onClick={() => setStatus(null)} className="mt-2 text-xs font-semibold text-stone-500 hover:text-red-600">
              Clear — leave the day unmarked
            </button>
          )}
        </div>

        {working && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-stone-800">Hours</p>
              <ClockToggle />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeRow label="Time in" value={checkIn} onChange={setCheckIn} disabled={!canEdit} showNow={isToday} />
              <TimeRow label="Time out" value={checkOut} onChange={setCheckOut} disabled={!canEdit} showNow={isToday} clearable />
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="label">Overtime</span>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <button type="button" disabled={!canEdit || ot <= 0} onClick={() => stepOt(-0.5)} className="btn-secondary h-10 w-10 p-0 text-lg" aria-label="Less overtime">−</button>
                  <input
                    type="number" min={0} max={12} step={0.5} value={ot} disabled={!canEdit}
                    onChange={(e) => setOt(Math.max(0, Number(e.target.value) || 0))}
                    className="input w-20 text-center text-base font-semibold tabular-nums" aria-label="Overtime hours"
                  />
                  <button type="button" disabled={!canEdit} onClick={() => stepOt(0.5)} className="btn-secondary h-10 w-10 p-0 text-lg" aria-label="More overtime">+</button>
                  <span className="text-sm text-stone-500">hours</span>
                </div>
              </div>
              {worked > 0 && (
                <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-stone-200">
                  <span className="text-stone-500">Worked </span>
                  <span className="font-semibold tabular-nums text-stone-900">{formatDuration(worked)}</span>
                  {ot > 0 && <span className="text-stone-500"> + {ot}h OT</span>}
                </p>
              )}
            </div>
          </div>
        )}

        <FormError message={error} />
      </div>
    </Modal>
  )
}

function TimeRow({
  label, value, onChange, disabled, showNow, clearable,
}: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; showNow: boolean; clearable?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {!disabled && (
          <span className="flex gap-2 text-xs font-semibold">
            {showNow && <button type="button" onClick={() => onChange(currentTime())} className="text-brand-700 hover:text-brand-800">Now</button>}
            {clearable && value && <button type="button" onClick={() => onChange('')} className="text-stone-400 hover:text-red-600">Clear</button>}
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <TimeInput value={value} onChange={onChange} disabled={disabled} ariaLabel={label} />
      </div>
    </div>
  )
}
