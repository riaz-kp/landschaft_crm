import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api/client'
import { useDb } from '../../../state/useDb'
import { useSession } from '../../../state/session'
import { receivable } from '../../../domain/finance'
import { addDays, formatCurrency, formatDate, today } from '../../../domain/format'
import { PHASE_LABELS, type Client, type PaymentFollowUp } from '../../../domain/types'
import {
  Section, Table, EmptyState, Badge, StatusBadge, StatTile, ProgressBar, Modal, Field,
} from '../../../components/ui'
import { Icon } from '../../../components/Icon'

const MODES: PaymentFollowUp['mode'][] = ['Call', 'WhatsApp', 'Email', 'Visit']

/** What the client owes, what they have paid, and the chase to collect the rest. */
export function Receivables({ client }: { client: Client }) {
  const db = useDb()
  const [logging, setLogging] = useState(false)

  const projects = db.projects.filter((p) => p.clientId === client.id)
  const projectIds = new Set(projects.map((p) => p.id))
  const total = receivable(db, client.id)
  const requests = db.paymentRequests
    .filter((r) => projectIds.has(r.projectId))
    .sort((a, b) => b.date.localeCompare(a.date))
  const payments = db.payments
    .filter((p) => p.clientId === client.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const followUps = db.followUps
    .filter((f) => f.clientId === client.id)
    .sort((a, b) => b.date.localeCompare(a.date))

  const nextDue = followUps.find((f) => f.nextFollowUp)?.nextFollowUp
  const followUpOverdue = nextDue !== undefined && nextDue <= today() && total.outstanding > 0

  const projectName = (id?: string) => (id ? projects.find((p) => p.id === id)?.name ?? '—' : 'All projects')
  const staffName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Contract Value" value={formatCurrency(total.contracted, true)} />
        <StatTile label="Received" value={formatCurrency(total.received, true)} tone="green" />
        <StatTile
          label="Outstanding" value={formatCurrency(total.outstanding, true)}
          tone={total.outstanding ? 'amber' : 'green'} sub="Contract value not yet received"
        />
        <StatTile
          label="Due Now" value={formatCurrency(total.dueNow, true)}
          tone={total.dueNow ? 'red' : 'green'} sub="Requests raised, unpaid"
        />
      </div>

      {followUpOverdue && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">Payment follow-up due {formatDate(nextDue)}</p>
            <p className="mt-0.5 text-sm text-amber-800">
              {formatCurrency(total.outstanding)} is outstanding. Log the next follow-up once you have spoken to the client.
            </p>
          </div>
          <button onClick={() => setLogging(true)} className="btn-secondary shrink-0">Log follow-up</button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <Section title="Receivables by Project" className="xl:col-span-3">
          {projects.length === 0 ? (
            <EmptyState title="No projects yet." />
          ) : (
            <Table head={['Project', 'Contract', 'Received', 'Outstanding', 'Collected']}>
              {projects.map((project) => {
                const r = receivable(db, client.id, project.id)
                const percent = r.contracted ? (r.received / r.contracted) * 100 : 0
                return (
                  <tr key={project.id} className="row-hover">
                    <td className="td">
                      <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">{project.name}</Link>
                      {r.dueNow > 0 && <span className="mt-1 block"><Badge tone="red">{formatCurrency(r.dueNow)} due now</Badge></span>}
                    </td>
                    <td className="td tabular-nums">{formatCurrency(r.contracted)}</td>
                    <td className="td tabular-nums">{formatCurrency(r.received)}</td>
                    <td className="td font-semibold tabular-nums">{formatCurrency(r.outstanding)}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="w-20"><ProgressBar value={percent} size="sm" tone={percent >= 100 ? 'green' : 'amber'} /></div>
                        <span className="text-xs tabular-nums text-stone-500">{Math.round(percent)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Section>

        <Section title="Payment Requests" className="xl:col-span-2">
          {requests.length === 0 ? (
            <EmptyState title="No payment requests raised." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {requests.map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">
                      {projectName(request.projectId)}{request.phase && ` · ${PHASE_LABELS[request.phase]}`}
                    </p>
                    <p className="text-xs text-stone-400">{formatDate(request.date)}{request.note && ` · ${request.note}`}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-stone-900">{formatCurrency(request.amount)}</p>
                    <StatusBadge status={request.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Payment Follow-ups"
        description="Calls, messages and visits to collect what is owed."
        actions={<button onClick={() => setLogging(true)} className="btn-primary">Log follow-up</button>}
      >
        {followUps.length === 0 ? (
          <EmptyState title="No follow-ups logged." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {followUps.map((f, index) => (
              <li key={f.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-stone-900">{formatDate(f.date)}</span>
                  <Badge tone={f.mode === 'WhatsApp' ? 'green' : 'stone'}>{f.mode}</Badge>
                  <span className="text-sm text-stone-500">{staffName(f.byId)} · {projectName(f.projectId)}</span>
                </div>
                <p className="mt-1.5 text-sm text-stone-700">{f.note}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.promisedAmount ? <Badge tone="blue">Promised {formatCurrency(f.promisedAmount)}</Badge> : null}
                  {f.nextFollowUp && (
                    <Badge tone={index === 0 && f.nextFollowUp <= today() ? 'red' : 'stone'}>
                      Next follow-up {formatDate(f.nextFollowUp)}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Transactions" description="Payments received from this client.">
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded." />
        ) : (
          <Table head={['Date', 'Project', 'Method', 'Reference', 'Amount']}>
            {payments.map((payment) => (
              <tr key={payment.id} className="row-hover">
                <td className="td tabular-nums font-medium text-stone-900">{formatDate(payment.date)}</td>
                <td className="td">{projectName(payment.projectId)}</td>
                <td className="td"><Badge tone="stone">{payment.method}</Badge></td>
                <td className="td font-mono text-xs">{payment.reference}</td>
                <td className="td font-semibold tabular-nums">{formatCurrency(payment.amount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-stone-200 bg-stone-50">
              <td className="td font-semibold text-stone-900" colSpan={4}>Total received</td>
              <td className="td font-bold tabular-nums text-stone-900">{formatCurrency(total.received)}</td>
            </tr>
          </Table>
        )}
      </Section>

      {logging && <FollowUpModal client={client} onClose={() => setLogging(false)} />}
    </div>
  )
}

function FollowUpModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const projects = db.projects.filter((p) => p.clientId === client.id)
  const [form, setForm] = useState({
    projectId: '',
    date: today(),
    mode: 'Call' as PaymentFollowUp['mode'],
    note: '',
    promisedAmount: '',
    nextFollowUp: addDays(today(), 7),
  })
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!form.note.trim()) return setError('Note what was discussed.')
    api.followUps.create({
      clientId: client.id,
      projectId: form.projectId || undefined,
      date: form.date,
      mode: form.mode,
      note: form.note.trim(),
      byId: user.id,
      promisedAmount: Number(form.promisedAmount) || undefined,
      nextFollowUp: form.nextFollowUp || undefined,
    })
    onClose()
  }

  return (
    <Modal
      title="Log payment follow-up"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Save follow-up</button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="How">
            <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as PaymentFollowUp['mode'] })}>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Project">
          <select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="What was discussed" required>
          <textarea rows={3} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount promised (₹)">
            <input
              type="number" min={0} className="input" value={form.promisedAmount}
              onChange={(e) => setForm({ ...form, promisedAmount: e.target.value })}
            />
          </Field>
          <Field label="Next follow-up">
            <input type="date" className="input" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} />
          </Field>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
