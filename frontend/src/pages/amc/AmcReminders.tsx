import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { formatDate, formatDateLong, today } from '../../domain/format'
import { describeSchedule, renewalReminders, visitReminders, type AmcOccurrence } from '../../domain/amc'
import { Section } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { OccurrenceBadge } from './AmcContractCard'
import { MoveVisitModal, VisitDoneModal } from './AmcVisitModals'

/**
 * What the AMC team needs to act on now: visits inside their reminder window,
 * visits that slipped past their date, and contracts nearing renewal. Each
 * contract sets its own reminder lead times.
 */
export function AmcReminders({ className = '' }: { className?: string }) {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.manageAmc(roleKey)
  const [doing, setDoing] = useState<AmcOccurrence | null>(null)
  const [moving, setMoving] = useState<AmcOccurrence | null>(null)

  const visits = visitReminders(db.maintenance, today())
  const renewals = renewalReminders(db.maintenance, today())
  const project = (id: string) => db.projects.find((p) => p.id === id)

  if (visits.length === 0 && renewals.length === 0) {
    return (
      <div className={`flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-3.5 text-sm text-brand-900 ${className}`}>
        <Icon name="bell" className="h-5 w-5 text-brand-600" />
        No AMC reminders right now — every visit inside its reminder window is done, and no renewal is due.
      </div>
    )
  }

  return (
    <Section
      title={<span className="flex items-center gap-2"><Icon name="bell" className="h-4 w-4 text-amber-600" /> Reminders</span>}
      description="Visits coming up inside each contract's reminder window, visits overdue, and renewals due."
      className={className}
    >
      <ul className="divide-y divide-stone-100">
        {visits.map(({ occurrence: o, daysLeft }) => (
          <li key={o.visit?.id ?? `${o.record.id}-${o.date}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${daysLeft < 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
              <Icon name={daysLeft < 0 ? 'alert' : 'leaf'} className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Link to={`/projects/${o.record.projectId}`} className="block truncate text-sm font-medium text-stone-900 hover:text-brand-700">
                {o.record.type === 'AMC' ? 'AMC' : 'Maintenance'} visit — {project(o.record.projectId)?.name}
              </Link>
              <p className="text-xs text-stone-500">
                {formatDateLong(o.date)}
                {o.record.schedule && ` · ${describeSchedule(o.record.schedule)}, reminded ${o.record.schedule.reminderDaysBefore}d ahead`}
              </p>
            </div>
            <OccurrenceBadge occurrence={o} />
            {editable && (
              <div className="flex gap-1.5">
                <button onClick={() => setMoving(o)} className="btn-ghost px-2 py-1 text-xs">Move</button>
                <button onClick={() => setDoing(o)} className="btn-secondary py-1 text-xs">Mark done</button>
              </div>
            )}
          </li>
        ))}
        {renewals.map(({ record, daysLeft }) => (
          <li key={`renew-${record.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-50 text-clay-600">
              <Icon name="repeat" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Link to="/amc/renewals" className="block truncate text-sm font-medium text-stone-900 hover:text-brand-700">
                Renewal — {project(record.projectId)?.name}
              </Link>
              <p className="text-xs text-stone-500">Contract ends {formatDate(record.renewalDate!)} · reminded {record.renewalReminderDays ?? 60}d ahead</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${daysLeft < 0 ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-clay-50 text-clay-800 ring-clay-600/25'}`}>
              {daysLeft < 0 ? `Lapsed ${-daysLeft}d ago` : `${daysLeft} days left`}
            </span>
          </li>
        ))}
      </ul>

      {doing && <VisitDoneModal occurrence={doing} onClose={() => setDoing(null)} />}
      {moving && <MoveVisitModal occurrence={moving} onClose={() => setMoving(null)} />}
    </Section>
  )
}
