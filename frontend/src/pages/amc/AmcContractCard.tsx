import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { daysBetween, formatCurrency, formatDate, today } from '../../domain/format'
import { amcProgress, describeSchedule, occurrencesFor, type AmcOccurrence } from '../../domain/amc'
import type { MaintenanceRecord } from '../../domain/types'
import { Badge, ProgressBar, Section, Table, type Tone } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { AmcContractModal } from './AmcContractForm'
import { MoveVisitModal, VisitDoneModal } from './AmcVisitModals'

export const OCCURRENCE_TONE: Record<AmcOccurrence['status'], Tone> = {
  Done: 'green', Scheduled: 'blue', Planned: 'stone', Overdue: 'red',
}

/** True when a visit is inside its contract's reminder window. */
export function inReminderWindow(o: AmcOccurrence): boolean {
  if (o.status === 'Done') return false
  const left = daysBetween(today(), o.date)
  return left >= 0 && left <= (o.record.schedule?.reminderDaysBefore ?? 1)
}

export function OccurrenceBadge({ occurrence: o }: { occurrence: AmcOccurrence }) {
  if (o.status === 'Overdue') return <Badge tone="red">Overdue {daysBetween(o.date, today())}d</Badge>
  if (inReminderWindow(o)) {
    const left = daysBetween(today(), o.date)
    return <Badge tone="amber"><Icon name="bell" className="h-3 w-3" /> {left === 0 ? 'Today' : `In ${left}d`}</Badge>
  }
  return <Badge tone={OCCURRENCE_TONE[o.status]}>{o.status}</Badge>
}

/**
 * One maintenance contract: its repeat schedule and reminders, how far
 * through the planned visits it is, and the visits themselves — with the next
 * few coming up and the last few done.
 */
export function AmcContractCard({ record, canManage, showProject = true }: { record: MaintenanceRecord; canManage: boolean; showProject?: boolean }) {
  const db = useDb()
  const [editing, setEditing] = useState(false)
  const [doing, setDoing] = useState<AmcOccurrence | null>(null)
  const [moving, setMoving] = useState<AmcOccurrence | null>(null)
  const [showAll, setShowAll] = useState(false)

  const project = db.projects.find((p) => p.id === record.projectId)
  const client = db.clients.find((c) => c.id === project?.clientId)
  const all = occurrencesFor(record, today())
  const progress = amcProgress(record, today())
  const pending = all.filter((o) => o.status !== 'Done')
  const next = pending.find((o) => o.date >= today())
  const done = all.filter((o) => o.status === 'Done').reverse()
  const rows = showAll ? all : [...pending.slice(0, 4), ...done.slice(0, 3)].sort((a, b) => a.date.localeCompare(b.date))
  const workerNames = (ids: string[]) => ids.map((id) => db.workers.find((w) => w.id === id)?.name).filter(Boolean).join(', ') || '—'
  const renewalLeft = record.renewalDate ? daysBetween(today(), record.renewalDate) : null

  return (
    <Section
      title={
        <span className="flex flex-wrap items-center gap-2">
          {showProject ? (
            <Link to={`/projects/${record.projectId}`} className="hover:text-brand-700">{project?.name ?? '—'}</Link>
          ) : record.type}
          {showProject && <Badge tone={record.type === 'AMC' ? 'clay' : 'green'}>{record.type}</Badge>}
        </span>
      }
      description={`${showProject ? `${client?.name ?? '—'} · ` : ''}${formatDate(record.startDate)} – ${formatDate(record.endDate)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {record.value ? <span className="text-sm font-semibold tabular-nums">{formatCurrency(record.value)}</span> : null}
          {renewalLeft !== null && (
            <Badge tone={renewalLeft < 0 ? 'red' : renewalLeft <= (record.renewalReminderDays ?? 60) ? 'amber' : 'stone'}>
              {renewalLeft < 0 ? 'Lapsed' : `Renews ${formatDate(record.renewalDate!)}`}
            </Badge>
          )}
          {canManage && (
            <button onClick={() => setEditing(true)} className="btn-secondary py-1.5 text-xs">
              <Icon name="repeat" className="h-3.5 w-3.5" /> Schedule
            </button>
          )}
        </div>
      }
    >
      {/* Schedule at a glance */}
      <div className="grid gap-px border-b border-stone-100 bg-stone-100 sm:grid-cols-4">
        <div className="bg-white px-5 py-3">
          <p className="label">Repeats</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-stone-900">
            <Icon name="repeat" className="h-4 w-4 text-clay-600" />
            {record.schedule ? describeSchedule(record.schedule) : 'Not set'}
          </p>
        </div>
        <div className="bg-white px-5 py-3">
          <p className="label">Reminder</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-800">
            <Icon name="bell" className="h-4 w-4 text-amber-600" />
            {record.schedule ? `${record.schedule.reminderDaysBefore} day${record.schedule.reminderDaysBefore === 1 ? '' : 's'} before` : '—'}
          </p>
        </div>
        <div className="bg-white px-5 py-3">
          <p className="label">Next visit</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-stone-800">
            {next ? <>{formatDate(next.date)} <OccurrenceBadge occurrence={next} /></> : 'None left in term'}
          </p>
        </div>
        <div className="bg-white px-5 py-3">
          <p className="label">Visits done</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1"><ProgressBar value={progress.percent} size="sm" /></div>
            <span className="text-xs font-semibold tabular-nums text-stone-600">{progress.done}/{progress.total}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="label">Scope of Work</p>
          <p className="mt-1 text-sm text-stone-700">{record.scopeOfWork || '—'}</p>
        </div>
        <div>
          <p className="label">Team</p>
          <p className="mt-1 text-sm text-stone-700">{workerNames(record.teamIds)}</p>
          {record.visitSchedule && <p className="mt-1 text-xs text-stone-400">{record.visitSchedule}</p>}
        </div>
      </div>

      <Table head={['Visit', 'Status', 'Team', 'Notes', '']}>
        {rows.map((o) => (
          <tr key={o.visit?.id ?? `p-${o.date}`} className="row-hover">
            <td className="td whitespace-nowrap font-medium tabular-nums text-stone-900">
              {formatDate(o.date)}
              {o.plannedFor && o.plannedFor !== o.date && (
                <span className="block text-xs font-normal text-stone-400">moved from {formatDate(o.plannedFor)}</span>
              )}
            </td>
            <td className="td"><OccurrenceBadge occurrence={o} /></td>
            <td className="td">{workerNames(o.visit?.teamIds ?? record.teamIds)}</td>
            <td className="td max-w-sm">
              {o.visit?.notes || <span className="text-stone-400">{o.status === 'Planned' ? 'From the repeat schedule' : '—'}</span>}
              {o.visit?.issues.length ? <span className="block text-xs text-clay-800">{o.visit.issues.join('; ')}</span> : null}
            </td>
            <td className="td">
              {canManage && o.status !== 'Done' && (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => setMoving(o)} className="btn-ghost px-2 py-1 text-xs">Move</button>
                  {o.date <= today() || inReminderWindow(o) ? (
                    <button onClick={() => setDoing(o)} className="btn-secondary py-1 text-xs">Mark done</button>
                  ) : null}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {all.length > rows.length || showAll ? (
        <button onClick={() => setShowAll(!showAll)} className="w-full border-t border-stone-100 py-2.5 text-xs font-semibold text-brand-700 hover:bg-stone-50">
          {showAll ? 'Show fewer' : `Show all ${all.length} visits in the term`}
        </button>
      ) : null}

      {editing && <AmcContractModal record={record} onClose={() => setEditing(false)} />}
      {doing && <VisitDoneModal occurrence={doing} onClose={() => setDoing(null)} />}
      {moving && <MoveVisitModal occurrence={moving} onClose={() => setMoving(null)} />}
    </Section>
  )
}
