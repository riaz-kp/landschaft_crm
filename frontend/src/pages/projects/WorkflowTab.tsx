import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate, today } from '../../domain/format'
import type { ID, Payment, Project } from '../../domain/types'
import { canTickStep, describeSplit, holders, nextStep, paymentSchedule, withCollection, workflowFor, type CollectionRow, type WorkflowStep } from '../../domain/workflow'
import { Badge, ConfirmDialog, EmptyState, Field, Modal, ProgressBar, Section, Table } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { MoneyFields, forServices, moneyFields, moneyOf, moneyProblem } from './ProjectIntake'

/**
 * The project's hand-offs, from the scope proposal to work starting on site.
 * The step to do now sits on top with one clear button; below, every step in
 * order, grouped by stage, each with its own Mark done button. Marking a step
 * done tells whoever acts next, on their bell, and writes it to History.
 */
export function WorkflowTab({ project }: { project: Project }) {
  const db = useDb()
  const { user, roleKey } = useSession()
  const steps = workflowFor(project)
  const next = nextStep(project)
  const done = steps.filter((s) => project.workflow?.[s.key]?.done).length
  const [undoing, setUndoing] = useState<WorkflowStep | null>(null)
  const [flash, setFlash] = useState<{ key: string; text: string } | null>(null)

  if (steps.length === 0) {
    return <EmptyState title="No workflow on an AMC-only project." hint="The workflow covers design and execution." icon="list" />
  }

  const namesOf = (roles: WorkflowStep['owners']) => holders(db.employees, roles).map((e) => e.name)
  const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)
  const person = (id?: ID) => (id ? db.employees.find((e) => e.id === id)?.name : undefined) ?? '—'

  const markDone = (step: WorkflowStep) => {
    api.projects.setWorkflowStep(project.id, step.key, true, user.id)
    const told = namesOf(step.notify).filter((n) => n !== user.name)
    setFlash({ key: step.key, text: told.length ? `Done — ${list(told)} ${told.length === 1 ? 'has' : 'have'} been told.` : 'Done.' })
    window.setTimeout(() => setFlash((f) => (f?.key === step.key ? null : f)), 4000)
  }

  const allDone = done === steps.length
  const stages = (['Design', 'Execution'] as const)
    .map((stage) => ({ stage, steps: steps.filter((s) => s.stage === stage) }))
    .filter((g) => g.steps.length)

  return (
    <div className="space-y-5">
      {/* Where the project stands, and the one thing to do now. */}
      <section className={`overflow-hidden rounded-2xl border shadow-card ${allDone ? 'border-brand-200 bg-brand-50/60' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3">
          <p className="text-sm font-semibold text-stone-700">Workflow · {done} of {steps.length} steps done</p>
          <div className="w-28 sm:w-40"><ProgressBar value={(done / steps.length) * 100} tone={allDone ? 'green' : 'amber'} size="sm" /></div>
        </div>
        {allDone || !next ? (
          <div className="flex items-center gap-3 px-5 py-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Icon name="check" className="h-5 w-5" /></span>
            <div>
              <p className="font-semibold text-stone-900">Every hand-off is done</p>
              <p className="text-sm text-stone-500">Nothing is waiting on the workflow. Any step below can still be undone.</p>
            </div>
          </div>
        ) : (
          <NextStepCard
            step={next}
            number={steps.indexOf(next) + 1}
            owners={namesOf(next.owners)}
            told={namesOf(next.notify)}
            allowed={canTickStep(next, roleKey)}
            flash={flash?.key === next.key ? flash.text : undefined}
            onDone={() => markDone(next)}
            list={list}
          />
        )}
        {flash && flash.key !== next?.key && (
          <p className="flex items-center gap-2 border-t border-black/5 bg-brand-50 px-5 py-2.5 text-sm font-medium text-brand-800">
            <Icon name="checks" className="h-4 w-4" /> {flash.text}
          </p>
        )}
      </section>

      {/* Every step, in order. */}
      {stages.map(({ stage, steps: group }) => {
        const groupDone = group.filter((s) => project.workflow?.[s.key]?.done).length
        return (
          <Section
            key={stage}
            title={<span className="flex items-center gap-2">{stage} <span className="text-sm font-normal text-stone-400">{groupDone} of {group.length} done</span></span>}
          >
            <ol className="relative px-3 py-3 sm:px-4">
              {group.map((step, i) => {
                const n = steps.indexOf(step) + 1
                const tick = project.workflow?.[step.key]
                const isNext = step.key === next?.key
                const allowed = canTickStep(step, roleKey)
                const owners = namesOf(step.owners)
                const told = namesOf(step.notify)
                const last = i === group.length - 1
                return (
                  <li key={step.key} className="relative flex gap-3 pb-1">
                    {/* The line joining the steps. */}
                    {!last && <span aria-hidden className={`absolute left-[19px] top-10 bottom-0 w-0.5 sm:left-[23px] ${tick?.done ? 'bg-brand-300' : 'bg-stone-200'}`} />}
                    <span className={`relative z-[1] mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white sm:ml-1 ${
                      tick?.done ? 'bg-brand-600 text-white' : isNext ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {tick?.done ? <Icon name="check" className="h-4 w-4" /> : n}
                    </span>
                    <div className={`mb-2 flex min-w-0 flex-1 flex-col gap-3 rounded-xl px-3 py-2.5 sm:flex-row sm:items-center ${isNext ? 'bg-amber-50 ring-1 ring-amber-200' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-semibold ${tick?.done ? 'text-stone-500' : 'text-stone-900'}`}>{step.label}</span>
                          {isNext && <Badge tone="amber">Next</Badge>}
                        </p>
                        {tick?.done ? (
                          <p className="mt-0.5 text-xs text-brand-700">
                            Done{tick.on ? ` ${formatDate(tick.on)}` : ''}{tick.by ? ` by ${person(tick.by)}` : ''}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-stone-500">
                            {owners.length > 0 ? <>Assigned to {list(owners)}</> : 'Assigned to the CEO'}
                            {told.length > 0 && <> · tells {list(told)}</>}
                          </p>
                        )}
                        {flash?.key === step.key && !isNext && <p className="mt-1 text-xs font-medium text-brand-700">{flash.text}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {tick?.done ? (
                          allowed && (
                            <button type="button" onClick={() => setUndoing(step)} className="btn-secondary px-2.5 py-1 text-xs text-stone-500">
                              <Icon name="repeat" className="h-3.5 w-3.5" /> Undo
                            </button>
                          )
                        ) : allowed ? (
                          <button
                            type="button"
                            onClick={() => markDone(step)}
                            className={`${isNext ? 'btn-primary' : 'btn-secondary'} w-full px-3 py-1.5 text-sm sm:w-auto`}
                          >
                            <Icon name="check" className="h-4 w-4" /> Mark done
                          </button>
                        ) : (
                          <span className="text-xs text-stone-400" title={`Only ${list(owners)} can mark this done`}>
                            <Icon name="shield" className="mr-1 inline h-3.5 w-3.5" />{owners.length ? `For ${list(owners)}` : 'Not your step'}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Section>
        )
      })}

      <p className="px-1 text-xs text-stone-500">
        Marking a step done reminds the people who act next on their bell and writes it to the project's History.
      </p>

      {undoing && (
        <ConfirmDialog
          title="Undo this step?"
          confirmLabel="Undo step"
          onClose={() => setUndoing(null)}
          onConfirm={() => api.projects.setWorkflowStep(project.id, undoing.key, false, user.id)}
          message={`“${undoing.label}” goes back to not done. Nobody is told; the project's History notes that it was reopened.`}
        />
      )}
    </div>
  )
}

/** The step to do now: what it is, whose it is, who hears, and the button that does it. */
function NextStepCard({ step, number, owners, told, allowed, flash, onDone, list }: {
  step: WorkflowStep; number: number; owners: string[]; told: string[]; allowed: boolean
  flash?: string; onDone: () => void; list: (names: string[]) => string
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-white shadow-sm">{number}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Next step · {step.stage}</p>
        <p className="mt-0.5 text-base font-semibold text-stone-900 sm:text-lg">{step.label}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
          <span className="inline-flex items-center gap-1"><Icon name="user" className="h-3.5 w-3.5 text-stone-400" />{owners.length ? list(owners) : 'The CEO'}</span>
          {told.length > 0 && <span className="inline-flex items-center gap-1"><Icon name="bell" className="h-3.5 w-3.5 text-stone-400" />Tells {list(told)}</span>}
        </p>
        {step.key === 'clientApproved' && (
          <Link to="/consultations/site-visits" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
            <Icon name="pin" className="h-3.5 w-3.5" /> Plan the site visit
          </Link>
        )}
        {flash && <p className="mt-2 text-sm font-medium text-brand-700">{flash}</p>}
      </div>
      {allowed ? (
        <button type="button" onClick={onDone} className="btn-primary w-full px-5 py-2.5 sm:w-auto">
          <Icon name="check" className="h-4 w-4" /> Mark as done
        </button>
      ) : (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-sm text-stone-500 ring-1 ring-stone-200 sm:max-w-[14rem]">
          Waiting for {owners.length ? list(owners) : 'the CEO'} to mark this done.
        </p>
      )}
    </div>
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
      {project.services.execution && describeSplit(project.executionSplit) && (
        <p className="border-b border-stone-100 px-5 py-2.5 text-sm text-stone-600">
          <span className="label mr-2">Execution split</span>
          <span className="tabular-nums">{describeSplit(project.executionSplit)}</span>
        </p>
      )}
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
    api.projects.update(project.id, moneyFields(forServices(money, project.services), project.value), user.id)
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
