import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate, today } from '../../domain/format'
import type { ID, Payment, Project } from '../../domain/types'
import { canTickStep, holders, nextStep, paymentSchedule, withCollection, workflowFor, type CollectionRow } from '../../domain/workflow'
import { Badge, ConfirmDialog, EmptyState, Field, Modal, ProgressBar, Section, Table } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { MoneyFields, moneyFields, moneyOf, moneyProblem } from './ProjectIntake'

/**
 * The project's hand-offs, from the scope proposal to work starting on site.
 * Ticking one tells whoever acts next, on their bell.
 */
export function WorkflowTab({ project }: { project: Project }) {
  const db = useDb()
  const { user, roleKey } = useSession()
  const steps = workflowFor(project)
  const next = nextStep(project)
  const done = steps.filter((s) => project.workflow?.[s.key]?.done).length
  const names = (ids: string[]) => ids.join(', ')

  if (steps.length === 0) {
    return <EmptyState title="No workflow on an AMC-only project." hint="The workflow covers design and execution." icon="list" />
  }

  return (
    <Section
      title="Workflow"
      description="Tick each hand-off as it happens. The people who act next get a reminder on their bell, and it is written to the project's History."
      actions={<Badge tone={done === steps.length ? 'green' : 'amber'}>{done} / {steps.length}</Badge>}
    >
      <div className="px-5 pt-4"><ProgressBar value={(done / steps.length) * 100} tone={done === steps.length ? 'green' : 'amber'} /></div>
      <ol className="px-2 py-3">
        {steps.map((step, i) => {
          const tick = project.workflow?.[step.key]
          const isNext = step.key === next?.key
          const allowed = canTickStep(step, roleKey)
          const owners = holders(db.employees, step.owners).map((e) => e.name)
          const told = holders(db.employees, step.notify).map((e) => e.name)
          return (
            <li
              key={step.key}
              className={`flex gap-3 rounded-xl px-3 py-3 ${isNext ? 'bg-amber-50/70 ring-1 ring-amber-200' : ''}`}
            >
              <button
                type="button"
                disabled={!allowed}
                onClick={() => api.projects.setWorkflowStep(project.id, step.key, !tick?.done, user.id)}
                aria-pressed={Boolean(tick?.done)}
                aria-label={`${tick?.done ? 'Reopen' : 'Mark done'}: ${step.label}`}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition disabled:cursor-not-allowed ${
                  tick?.done ? 'border-brand-600 bg-brand-600 text-white' : isNext ? 'border-amber-500 bg-white text-amber-700' : 'border-stone-300 bg-white text-stone-400'
                } ${allowed && !tick?.done ? 'hover:border-brand-500 hover:text-brand-600' : ''}`}
              >
                {tick?.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${tick?.done ? 'text-stone-500' : 'text-stone-900'}`}>{step.label}</span>
                  <Badge tone={step.stage === 'Design' ? 'green' : 'blue'}>{step.stage}</Badge>
                  {isNext && <Badge tone="amber">Next</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {owners.length > 0 && <>By {names(owners)}</>}
                  {told.length > 0 && <> · tells {names(told)}</>}
                </p>
                {tick?.done && tick.on && (
                  <p className="mt-0.5 text-xs text-brand-700">
                    Done {formatDate(tick.on)} · {db.employees.find((e) => e.id === tick.by)?.name ?? '—'}
                  </p>
                )}
                {isNext && step.key === 'clientApproved' && (
                  <Link to="/consultations/site-visits" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                    <Icon name="pin" className="h-3 w-3" /> Plan the site visit
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

/**
 * The design and execution payment slabs for this project, from Settings, with
 * the values Accounts set, and the payments the client has made. Recording a
 * payment sets it against the slabs in order and tells the people concerned.
 */
export function PaymentSchedule({ project, received, canEdit, canRecord, canRemove }: {
  project: Project; received: number; canEdit: boolean; canRecord: boolean; canRemove: boolean
}) {
  const db = useDb()
  const { user } = useSession()
  const [editing, setEditing] = useState(false)
  // A slab being paid for, or 'any' for a payment not tied to one.
  const [recording, setRecording] = useState<CollectionRow | 'any' | null>(null)
  const [removing, setRemoving] = useState<Payment | null>(null)
  const rows = withCollection(paymentSchedule(project, db.settings), received)
  const dueSoFar = rows.filter((r) => r.reached).reduce((s, r) => s + (r.amount ?? 0), 0)
  const payments = db.payments.filter((p) => p.projectId === project.id).sort((a, b) => b.date.localeCompare(a.date))
  const staffName = (id?: ID) => (id ? db.employees.find((e) => e.id === id)?.name : undefined) ?? '—'

  return (
    <Section
      title="Payment Schedule"
      description="Slabs from Settings, applied to the design and execution values Accounts fixed for this project. What the client has paid is set against them in order."
      className="lg:col-span-3"
      actions={(canEdit || canRecord) && (
        <div className="flex gap-2">
          {canEdit && <button onClick={() => setEditing(true)} className="btn-secondary py-1.5"><Icon name="edit" className="h-4 w-4" /> Edit values</button>}
          {canRecord && <button onClick={() => setRecording('any')} className="btn-primary py-1.5"><Icon name="plus" className="h-4 w-4" /> Record payment</button>}
        </div>
      )}
    >
      <dl className="grid gap-4 border-b border-stone-100 px-5 py-4 sm:grid-cols-4">
        {[
          ['Client Budget', project.budget ? formatCurrency(project.budget) : '—'],
          ['Design Value', project.services.design ? (project.designValue ? formatCurrency(project.designValue) : 'Not set') : '—'],
          ['Execution Value', project.services.execution ? (project.executionValue ? formatCurrency(project.executionValue) : 'Not set') : '—'],
          ['Due so far / Received', `${formatCurrency(dueSoFar)} / ${formatCurrency(received)}`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="label">{label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">{value}</dd>
          </div>
        ))}
      </dl>
      {rows.length === 0 ? (
        <EmptyState title="No payment slabs — this project has no design or execution." />
      ) : (
        <Table head={['Stage', 'Slab', 'Collected at', '%', 'Amount', '']}>
          {rows.map((row, i) => (
            <tr key={i} className="row-hover">
              <td className="td"><Badge tone={row.stage === 'Design' ? 'green' : 'blue'}>{row.stage}</Badge></td>
              <td className="td font-medium text-stone-900">{row.label}</td>
              <td className="td text-stone-600">{row.dueWhen}</td>
              <td className="td tabular-nums">{row.percent}%</td>
              <td className="td tabular-nums">{row.amount !== undefined ? formatCurrency(row.amount) : <span className="text-stone-400">Value not set</span>}</td>
              <td className="td">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {row.collected ? <Badge tone="green">Collected</Badge>
                    : row.reached ? <Badge tone="amber">{row.outstanding !== undefined && row.outstanding < (row.amount ?? 0) ? `Due · ${formatCurrency(row.outstanding)} left` : 'Due'}</Badge>
                      : <Badge tone="stone">{row.amount !== undefined && row.outstanding !== undefined && row.outstanding < row.amount ? `Upcoming · ${formatCurrency(row.amount - row.outstanding)} paid` : 'Upcoming'}</Badge>}
                  {canRecord && row.reached && !row.collected && (
                    <button onClick={() => setRecording(row)} className="btn-secondary px-2.5 py-1 text-xs">Record payment</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <div className="border-t border-stone-100">
        <p className="px-5 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-stone-400">Payments received</p>
        {payments.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-stone-500">Nothing recorded yet.</p>
        ) : (
          <Table head={['Date', 'Amount', 'Method', 'Reference', 'Recorded by', '']}>
            {payments.map((payment) => (
              <tr key={payment.id} className="row-hover">
                <td className="td tabular-nums">{formatDate(payment.date)}</td>
                <td className="td font-semibold tabular-nums text-stone-900">{formatCurrency(payment.amount)}</td>
                <td className="td">{payment.method}</td>
                <td className="td max-w-xs truncate" title={payment.note}>{[payment.reference, payment.note].filter(Boolean).join(' · ') || '—'}</td>
                <td className="td">{staffName(payment.byId)}</td>
                <td className="td text-right">
                  {canRemove && (
                    <button onClick={() => setRemoving(payment)} className="text-stone-400 hover:text-red-600" aria-label={`Remove the payment of ${formatCurrency(payment.amount)}`}>
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {editing && <ValuesModal project={project} onClose={() => setEditing(false)} />}
      {recording && <RecordPaymentModal project={project} row={recording === 'any' ? undefined : recording} onClose={() => setRecording(null)} />}
      {removing && (
        <ConfirmDialog
          title="Remove this payment?"
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onConfirm={() => api.payments.remove(removing.id, user.id)}
          message={`${formatCurrency(removing.amount)} received ${formatDate(removing.date)} by ${removing.method} is taken off the project, and the slabs it paid for show as due again. The project's history notes the removal.`}
        />
      )}
    </Section>
  )
}

const METHODS: Payment['method'][] = ['Bank Transfer', 'UPI', 'Cheque', 'Cash']

/**
 * Accounts records money the client paid. Opened from a slab, the amount starts
 * at what is still owed on it; the payment is still set against the slabs in
 * order, so paying more than one slab at once is one entry.
 */
function RecordPaymentModal({ project, row, onClose }: { project: Project; row?: CollectionRow; onClose: () => void }) {
  const { user } = useSession()
  const owed = row?.outstanding ?? row?.amount
  const [form, setForm] = useState({
    amount: owed ? String(Math.round(owed)) : '',
    date: today(),
    method: 'Bank Transfer' as Payment['method'],
    reference: '',
    note: '',
  })
  const [error, setError] = useState<string | null>(null)
  const save = () => {
    const amount = Number(form.amount)
    if (!(amount > 0)) return setError('Enter the amount received.')
    if (!form.date) return setError('Enter the date it was received.')
    if (form.date > today()) return setError('The date cannot be in the future.')
    api.payments.record({
      projectId: project.id, amount, date: form.date, method: form.method,
      reference: form.reference.trim(), note: form.note.trim() || undefined,
    }, user.id)
    onClose()
  }
  return (
    <Modal
      title={row ? `Record payment — ${row.stage.toLowerCase()} ${row.label}` : 'Record payment'}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Record payment</button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received (₹)" required hint={owed ? `${formatCurrency(owed)} is owed on this slab.` : undefined}>
            <input
              type="number" min={0} inputMode="decimal" className="input" value={form.amount} autoFocus
              onChange={(e) => { setForm({ ...form, amount: e.target.value }); setError(null) }}
            />
          </Field>
          <Field label="Received on" required>
            <input type="date" className="input" max={today()} value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setError(null) }} />
          </Field>
          <Field label="Method">
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as Payment['method'] })}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label={form.method === 'Cheque' ? 'Cheque number' : 'Reference'}>
            <input className="input" value={form.reference} placeholder={form.method === 'Cash' ? 'Receipt number' : 'UTR / transaction ID'} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
        </div>
        <Field label="Note">
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        <p className="text-xs text-stone-500">
          The CEO, the rest of Accounts, the project manager and the head of the stage it pays for are told. Anyone without access to Accounts hears only that an amount was collected, not how much.
        </p>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

/** Accounts fixes, and later revises, the design and execution values. */
function ValuesModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { user } = useSession()
  const [money, setMoney] = useState(() => moneyOf(project))
  const [error, setError] = useState<string | null>(null)
  const save = () => {
    const problem = moneyProblem(money)
    if (problem) return setError(problem)
    api.projects.update(project.id, moneyFields(money, project.value), user.id)
    onClose()
  }
  return (
    <Modal
      title="Budget & project value"
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Save</button>
      </>}
    >
      <MoneyFields value={money} onChange={(v) => { setMoney(v); setError(null) }} services={project.services} fallbackValue={project.value} />
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}
