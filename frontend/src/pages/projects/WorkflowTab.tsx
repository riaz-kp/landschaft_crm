import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate } from '../../domain/format'
import type { Project } from '../../domain/types'
import { canTickStep, holders, nextStep, paymentSchedule, workflowFor } from '../../domain/workflow'
import { Badge, EmptyState, Modal, ProgressBar, Section, Table } from '../../components/ui'
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

/** The design and execution payment slabs for this project, from Settings, with the values Accounts set. */
export function PaymentSchedule({ project, received, canEdit }: { project: Project; received: number; canEdit: boolean }) {
  const db = useDb()
  const [editing, setEditing] = useState(false)
  const rows = paymentSchedule(project, db.settings)
  const dueSoFar = rows.filter((r) => r.reached).reduce((s, r) => s + (r.amount ?? 0), 0)

  return (
    <Section
      title="Payment Schedule"
      description="Slabs from Settings, applied to the design and execution values Accounts fixed for this project."
      className="lg:col-span-3"
      actions={canEdit && (
        <button onClick={() => setEditing(true)} className="btn-secondary py-1.5"><Icon name="edit" className="h-4 w-4" /> Edit values</button>
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
                {row.reached === true ? <Badge tone="amber">Due</Badge> : row.reached === false ? <Badge tone="stone">Upcoming</Badge> : null}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <ValuesModal project={project} onClose={() => setEditing(false)} />}
    </Section>
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
