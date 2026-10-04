import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { addDays, daysBetween, formatDate, today } from '../../domain/format'
import type { MaintenanceRecord, MaintenanceVisit } from '../../domain/types'
import {
  PageHeader, Section, Table, EmptyState, Badge, StatTile, StatusBadge, Modal, Field, Checkbox,
} from '../../components/ui'
import { RepeaterList } from '../../components/RepeaterList'

type Row = { visit: MaintenanceVisit; record: MaintenanceRecord }

/** Every maintenance visit across all contracts, scheduled and done. */
export function AmcVisits() {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.manageAmc(roleKey)
  const [scheduling, setScheduling] = useState(false)
  const [completing, setCompleting] = useState<Row | null>(null)

  const rows: Row[] = db.maintenance.flatMap((record) => record.visits.map((visit) => ({ visit, record })))
  const upcoming = rows.filter((r) => !r.visit.done).sort((a, b) => a.visit.date.localeCompare(b.visit.date))
  const done = rows.filter((r) => r.visit.done).sort((a, b) => b.visit.date.localeCompare(a.visit.date))
  const overdue = upcoming.filter((r) => r.visit.date < today())
  const thisWeek = upcoming.filter((r) => r.visit.date >= today() && r.visit.date <= addDays(today(), 7))

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'
  const workerNames = (ids: string[]) =>
    ids.map((id) => db.workers.find((w) => w.id === id)?.name).filter(Boolean).join(', ') || '—'

  return (
    <div>
      <PageHeader
        title="AMC Visit Schedule"
        subtitle="Upcoming and completed maintenance visits across every contract."
        actions={editable && db.maintenance.length > 0 && (
          <button onClick={() => setScheduling(true)} className="btn-primary">Schedule visit</button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Next 7 Days" value={thisWeek.length} tone="amber" />
        <StatTile label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} />
        <StatTile label="All Upcoming" value={upcoming.length} />
        <StatTile label="Completed" value={done.length} tone="green" />
      </div>

      <Section title="Upcoming Visits" className="mb-6">
        {upcoming.length === 0 ? (
          <EmptyState title="No visits scheduled." hint={editable ? 'Use Schedule visit to add one.' : undefined} />
        ) : (
          <Table head={['Date', 'Site', 'Contract', 'Team', 'Status', '']}>
            {upcoming.map((row) => {
              const lateBy = daysBetween(row.visit.date, today())
              return (
                <tr key={row.visit.id} className="row-hover">
                  <td className="td tabular-nums font-medium text-stone-900">{formatDate(row.visit.date)}</td>
                  <td className="td">
                    <Link to={`/projects/${row.record.projectId}`} className="hover:text-brand-700">
                      {projectName(row.record.projectId)}
                    </Link>
                  </td>
                  <td className="td"><Badge tone={row.record.type === 'AMC' ? 'clay' : 'green'}>{row.record.type}</Badge></td>
                  <td className="td">{workerNames(row.visit.teamIds)}</td>
                  <td className="td">
                    {lateBy > 0 ? <Badge tone="red">Overdue {lateBy}d</Badge> : <StatusBadge status="Scheduled" />}
                  </td>
                  <td className="td text-right">
                    {editable && (
                      <button onClick={() => setCompleting(row)} className="btn-secondary py-1 text-xs">
                        Mark done
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      <Section title="Completed Visits">
        {done.length === 0 ? (
          <EmptyState title="No visits completed yet." />
        ) : (
          <Table head={['Date', 'Site', 'Contract', 'Team', 'Notes', 'Issues']}>
            {done.map((row) => (
              <tr key={row.visit.id} className="row-hover">
                <td className="td tabular-nums font-medium text-stone-900">{formatDate(row.visit.date)}</td>
                <td className="td">{projectName(row.record.projectId)}</td>
                <td className="td"><Badge tone={row.record.type === 'AMC' ? 'clay' : 'green'}>{row.record.type}</Badge></td>
                <td className="td">{workerNames(row.visit.teamIds)}</td>
                <td className="td max-w-sm">{row.visit.notes || '—'}</td>
                <td className="td">
                  {row.visit.issues.length ? <span className="text-clay-800">{row.visit.issues.join('; ')}</span> : '—'}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {scheduling && <ScheduleVisitModal onClose={() => setScheduling(false)} />}
      {completing && <CompleteVisitModal row={completing} onClose={() => setCompleting(null)} />}
    </div>
  )
}

function ScheduleVisitModal({ onClose }: { onClose: () => void }) {
  const db = useDb()
  // Only contracts still running can take a new visit; fall back to all if none are.
  const running = db.maintenance.filter((m) => m.endDate >= today())
  const contracts = running.length ? running : db.maintenance
  const first = contracts[0]
  const [recordId, setRecordId] = useState(first?.id ?? '')
  const [date, setDate] = useState(addDays(today(), 1))
  const [teamIds, setTeamIds] = useState<string[]>(first?.teamIds ?? [])
  const [error, setError] = useState<string | null>(null)

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'

  const save = () => {
    if (!recordId) return setError('Select a contract.')
    if (!date) return setError('Pick a date.')
    if (teamIds.length === 0) return setError('Assign at least one person.')
    api.amc.scheduleVisit(recordId, date, teamIds)
    onClose()
  }

  return (
    <Modal
      title="Schedule maintenance visit"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Schedule</button>
      </>}
    >
      <div className="space-y-4">
        <Field label="Contract" required>
          <select
            className="input" value={recordId}
            onChange={(e) => {
              setRecordId(e.target.value)
              setTeamIds(db.maintenance.find((m) => m.id === e.target.value)?.teamIds ?? [])
            }}
          >
            {contracts.map((m) => (
              <option key={m.id} value={m.id}>{projectName(m.projectId)} — {m.type}</option>
            ))}
          </select>
        </Field>
        <Field label="Visit date" required>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <p className="label">Team<span className="ml-0.5 text-red-500">*</span></p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {db.workers.filter((w) => w.active).map((worker) => (
              <Checkbox
                key={worker.id}
                checked={teamIds.includes(worker.id)}
                onChange={(on) => setTeamIds(on ? [...teamIds, worker.id] : teamIds.filter((id) => id !== worker.id))}
                label={<>{worker.name} <span className="text-xs text-stone-400">{worker.skill}</span></>}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

function CompleteVisitModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const db = useDb()
  const [notes, setNotes] = useState(row.visit.notes)
  const [issues, setIssues] = useState<string[]>(row.visit.issues.length ? row.visit.issues : [''])

  const save = () => {
    api.amc.completeVisit(row.record.id, row.visit.id, notes.trim(), issues)
    onClose()
  }

  return (
    <Modal
      title={`Visit on ${formatDate(row.visit.date)}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Mark done</button>
      </>}
    >
      <div className="space-y-4">
        <p className="text-sm text-stone-500">
          {db.projects.find((p) => p.id === row.record.projectId)?.name} · {row.record.type}
        </p>
        <Field label="Work done">
          <textarea
            rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Lawn mowing, pruning, irrigation check…"
          />
        </Field>
        <Field label="Issues found">
          <RepeaterList values={issues} onChange={setIssues} addLabel="Add issue" placeholder="Leave blank if none" />
        </Field>
      </div>
    </Modal>
  )
}
