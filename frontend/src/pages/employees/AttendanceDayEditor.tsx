import { api, type AttendancePatch } from '../../api/client'
import { formatDuration, formatTime, minutesBetween } from '../../domain/format'
import { STATUS_CELL, STATUS_CODE, fromReport, type ResolvedDay } from '../../domain/attendance'
import { ATTENDANCE_STATUSES, type ID, type PersonKind } from '../../domain/types'
import { TimeInput } from '../../components/TimeInput'

/** One person's day, as the inline editors below need it. */
export interface DayRef {
  kind: PersonKind
  personId: ID
  date: string
  day?: ResolvedDay
  name: string
  canEdit: boolean
}

/** Every change saves at once. A day still coming from a daily report keeps its times when corrected. */
function save(ref: DayRef, patch: AttendancePatch | null) {
  api.attendance.set(ref.kind, ref.personId, ref.date, patch && { ...fromReport(ref.day), ...patch })
}

/**
 * The status letters — tap one to mark the day, tap it again to clear it.
 * Marking someone present fills in the working hours from Settings.
 */
export function DayStatusButtons({ labels, ...ref }: DayRef & { labels?: boolean }) {
  return (
    <div className={labels ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'flex shrink-0 gap-1'}>
      {ATTENDANCE_STATUSES.map((s) => {
        const on = ref.day?.status === s
        return (
          <button
            key={s}
            type="button"
            disabled={!ref.canEdit}
            onClick={() => save(ref, on ? null : { status: s })}
            title={s}
            aria-label={`${s} — ${ref.name}`}
            aria-pressed={on}
            className={`text-xs font-bold ring-1 ring-inset transition disabled:cursor-default ${
              labels ? 'flex items-center gap-2 rounded-xl px-3 py-2 text-sm' : 'h-8 w-8 rounded-lg'
            } ${on ? STATUS_CELL[s] : 'bg-white text-stone-400 ring-stone-200 hover:text-stone-700 hover:ring-stone-300'}`}
          >
            {labels ? <><span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs ${on ? 'bg-white/70' : 'bg-stone-100'}`}>{STATUS_CODE[s]}</span>{s}</> : STATUS_CODE[s]}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Time in, time out and overtime, typed straight into the register. Read-only
 * for anyone without permission to edit attendance.
 */
export function DayHours(ref: DayRef) {
  const { day, canEdit, name } = ref
  const working = day?.status === 'Present' || day?.status === 'Half Day'

  if (!day || !working) {
    return (
      <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-500 ring-1 ring-inset ring-stone-200/70">
        {day ? `${day.status} — no hours to record` : canEdit ? 'Not marked yet — tap P to mark present with the usual hours.' : 'Not marked.'}
      </p>
    )
  }

  const ot = day.otHours ?? 0
  const worked = day.checkIn && day.checkOut ? minutesBetween(day.checkIn, day.checkOut) : 0
  const stepOt = (delta: number) => save(ref, { otHours: Math.max(0, Math.min(12, ot + delta)) })

  if (!canEdit) {
    return (
      <p className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-stone-50 px-3 py-2 text-xs ring-1 ring-inset ring-stone-200/70">
        <span><span className="text-stone-400">In </span><strong className="tabular-nums text-stone-800">{formatTime(day.checkIn ?? '')}</strong></span>
        <span><span className="text-stone-400">Out </span><strong className="tabular-nums text-stone-800">{formatTime(day.checkOut ?? '')}</strong></span>
        {ot > 0 && <span><span className="text-stone-400">OT </span><strong className="tabular-nums text-stone-800">{ot}h</strong></span>}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">In</span>
          <TimeInput size="sm" value={day.checkIn ?? ''} onChange={(checkIn) => save(ref, { checkIn })} ariaLabel={`Time in for ${name}`} />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Out</span>
          <TimeInput size="sm" value={day.checkOut ?? ''} onChange={(checkOut) => save(ref, { checkOut })} ariaLabel={`Time out for ${name}`} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">OT</span>
          <button type="button" onClick={() => stepOt(-0.5)} disabled={ot <= 0} className="btn-secondary h-7 w-7 p-0 text-base" aria-label={`Less overtime for ${name}`}>−</button>
          <span className="w-9 text-center text-sm font-semibold tabular-nums text-stone-800">{ot}h</span>
          <button type="button" onClick={() => stepOt(0.5)} className="btn-secondary h-7 w-7 p-0 text-base" aria-label={`More overtime for ${name}`}>+</button>
        </span>
        {worked > 0 && <span className="text-[11px] tabular-nums text-stone-500">{formatDuration(worked)} worked</span>}
      </div>
    </div>
  )
}
