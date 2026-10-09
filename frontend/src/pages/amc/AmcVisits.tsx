import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { addDays, formatDate, today } from '../../domain/format'
import { allOccurrences, describeSchedule, type AmcOccurrence } from '../../domain/amc'
import {
  PageHeader, Section, Table, EmptyState, Badge, StatTile, Modal, Field, Checkbox, Pills,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { OccurrenceBadge } from './AmcContractCard'
import { MoveVisitModal, VisitDoneModal } from './AmcVisitModals'

type Horizon = 14 | 30 | 60 | 365

/**
 * Every maintenance visit across all contracts — the ones each contract's
 * repeat schedule puts on the calendar, extra visits booked by hand, and the
 * visits already done.
 */
export function AmcVisits() {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.manageAmc(roleKey)
  const [scheduling, setScheduling] = useState(false)
  const [doing, setDoing] = useState<AmcOccurrence | null>(null)
  const [moving, setMoving] = useState<AmcOccurrence | null>(null)
  const [horizon, setHorizon] = useState<Horizon>(30)

  const all = allOccurrences(db.maintenance, today())
  const overdue = all.filter((o) => o.status === 'Overdue')
  const upcoming = all.filter((o) => (o.status === 'Planned' || o.status === 'Scheduled') && o.date <= addDays(today(), horizon))
  const done = all.filter((o) => o.status === 'Done').reverse()
  const thisWeek = all.filter((o) => o.status !== 'Done' && o.date >= today() && o.date <= addDays(today(), 7))

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'
  const workerNames = (ids: string[]) =>
    ids.map((id) => db.workers.find((w) => w.id === id)?.name).filter(Boolean).join(', ') || '—'

  const row = (o: AmcOccurrence, actions: boolean) => (
    <tr key={o.visit?.id ?? `${o.record.id}-${o.date}`} className="row-hover">
      <td className="td whitespace-nowrap font-medium tabular-nums text-stone-900">
        {o.date === today() ? 'Today' : formatDate(o.date)}
        {o.plannedFor && o.plannedFor !== o.date && <span className="block text-xs font-normal text-stone-400">moved from {formatDate(o.plannedFor)}</span>}
      </td>
      <td className="td">
        <Link to={`/projects/${o.record.projectId}`} className="hover:text-brand-700">{projectName(o.record.projectId)}</Link>
        <span className="block text-xs text-stone-400">{o.record.schedule ? describeSchedule(o.record.schedule) : 'No repeat schedule'}</span>
      </td>
      <td className="td"><Badge tone={o.record.type === 'AMC' ? 'clay' : 'green'}>{o.record.type}</Badge></td>
      <td className="td">{workerNames(o.visit?.teamIds ?? o.record.teamIds)}</td>
      <td className="td">
        {o.status === 'Done'
          ? <span className="text-sm text-stone-600">{o.visit?.notes || '—'}{o.visit?.issues.length ? <span className="block text-xs text-clay-800">{o.visit.issues.join('; ')}</span> : null}</span>
          : <OccurrenceBadge occurrence={o} />}
      </td>
      <td className="td text-right">
        {actions && editable && (
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setMoving(o)} className="btn-ghost px-2 py-1 text-xs">Move</button>
            <button onClick={() => setDoing(o)} className="btn-secondary py-1 text-xs">Mark done</button>
          </div>
        )}
      </td>
    </tr>
  )

  return (
    <div>
      <PageHeader
        title="AMC Visit Schedule"
        subtitle="Visits from every contract's repeat schedule, extra visits booked by hand, and the visits already done."
        actions={<>
          <Link to="/amc/calendar" className="btn-secondary"><Icon name="calendar" className="h-4 w-4" /> Calendar view</Link>
          {editable && db.maintenance.length > 0 && (
            <button onClick={() => setScheduling(true)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Extra visit</button>
          )}
        </>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Next 7 Days" value={thisWeek.length} tone="amber" icon="calendar" />
        <StatTile label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} icon="alert" />
        <StatTile label={`Next ${horizon} Days`} value={upcoming.length} tone="blue" icon="repeat" />
        <StatTile label="Completed" value={done.length} tone="green" icon="check" />
      </div>

      {overdue.length > 0 && (
        <Section title="Overdue" description="Planned visits whose date has passed without a visit recorded." className="mb-6">
          <Table head={['Date', 'Site', 'Contract', 'Team', 'Status', '']}>{overdue.map((o) => row(o, true))}</Table>
        </Section>
      )}

      <Section
        title="Upcoming Visits"
        className="mb-6"
        actions={
          <Pills<`${Horizon}`>
            active={`${horizon}`}
            onChange={(k) => setHorizon(Number(k) as Horizon)}
            options={[{ key: '14', label: '2 weeks' }, { key: '30', label: '30 days' }, { key: '60', label: '60 days' }, { key: '365', label: 'Year' }]}
          />
        }
      >
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing planned in this period." hint="Visits come from each contract's repeat schedule." icon="leaf" />
        ) : (
          <Table head={['Date', 'Site', 'Contract', 'Team', 'Status', '']}>{upcoming.map((o) => row(o, true))}</Table>
        )}
      </Section>

      <Section title="Completed Visits">
        {done.length === 0 ? (
          <EmptyState title="No visits completed yet." icon="check" />
        ) : (
          <Table head={['Date', 'Site', 'Contract', 'Team', 'Work done', '']}>{done.map((o) => row(o, false))}</Table>
        )}
      </Section>

      {scheduling && <ScheduleVisitModal onClose={() => setScheduling(false)} />}
      {doing && <VisitDoneModal occurrence={doing} onClose={() => setDoing(null)} />}
      {moving && <MoveVisitModal occurrence={moving} onClose={() => setMoving(null)} />}
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
      title="Book an extra visit"
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

