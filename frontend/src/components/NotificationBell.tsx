import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useDb } from '../state/useDb'
import { useSession } from '../state/session'
import { addDays, formatDate, formatTime, today } from '../domain/format'
import { occurrencesBetween, visibleTo } from '../domain/reminders'
import { Icon } from './Icon'
import { ReminderModal } from './ReminderModal'

/**
 * The header bell: today's reminders, plus any from the past fortnight that
 * were never ticked off. Tick them here, or add a new one.
 */
export function NotificationBell() {
  const db = useDb()
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const due = occurrencesBetween(visibleTo(db.reminders, user.id), addDays(today(), -14), today())
    .filter((o) => !o.done)
    .reverse()
  const coming = occurrencesBetween(visibleTo(db.reminders, user.id), addDays(today(), 1), addDays(today(), 7)).slice(0, 4)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-icon relative h-10 w-10 rounded-xl"
        aria-label={`Reminders${due.length ? `, ${due.length} due` : ''}`}
      >
        <Icon name="bell" className="h-5 w-5" />
        {due.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {due.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-in overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <p className="text-sm font-semibold text-stone-900">Reminders</p>
              <button onClick={() => { setAdding(true); setOpen(false) }} className="text-xs font-semibold text-brand-700">+ Add reminder</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {due.length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-400">Nothing due today.</p>}
              {due.map((o) => (
                <div key={`${o.reminder.id}-${o.date}`} className="flex items-start gap-3 border-b border-stone-50 px-4 py-2.5">
                  <button
                    onClick={() => api.reminders.setDone(o.reminder.id, o.date, true)}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-stone-300 text-transparent hover:border-brand-500 hover:text-brand-600"
                    aria-label={`Mark "${o.reminder.title}" done`}
                  >
                    <Icon name="check" className="h-3 w-3" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800">{o.reminder.title}</p>
                    <p className={`text-xs ${o.date < today() ? 'font-semibold text-red-600' : 'text-stone-400'}`}>
                      {o.date < today() ? `Missed · ${formatDate(o.date)}` : 'Today'}{o.reminder.time && ` · ${formatTime(o.reminder.time)}`}
                    </p>
                  </div>
                </div>
              ))}
              {coming.length > 0 && (
                <>
                  <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Next 7 days</p>
                  {coming.map((o) => (
                    <p key={`${o.reminder.id}-${o.date}`} className="truncate px-4 py-1.5 text-xs text-stone-600">
                      <span className="tabular-nums text-stone-400">{formatDate(o.date).slice(0, 5)}</span> · {o.reminder.title}
                    </p>
                  ))}
                </>
              )}
            </div>
            <Link to="/calendar" onClick={() => setOpen(false)} className="block border-t border-stone-100 px-4 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-stone-50">
              Open calendar
            </Link>
          </div>
        </>
      )}

      {adding && <ReminderModal onClose={() => setAdding(false)} />}
    </div>
  )
}
