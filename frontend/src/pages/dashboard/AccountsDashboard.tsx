import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate, pad2 } from '../../domain/format'
import { inRange, periodPhrase } from '../../domain/period'
import { paymentSchedule, withCollection } from '../../domain/workflow'
import { PeriodSwitch, useDashboardPeriod } from '../../components/PeriodSwitch'
import {
  Badge, PageHeader, Section, StatTile, StatusBadge, Table, EmptyState, ProgressBar,
} from '../../components/ui'

/** Arshad and Anaswara's view. Materials and procurement are out of scope. */
export function AccountsDashboard() {
  const db = useDb()
  const { user } = useSession()

  const contracted = db.projects.reduce((sum, p) => sum + p.value, 0)
  const received = db.payments.reduce((sum, p) => sum + p.amount, 0)
  const { period, range } = useDashboardPeriod()
  const when = periodPhrase(period)
  const paymentsIn = db.payments.filter((p) => inRange(p.date, range))
  const requestsRaised = db.paymentRequests.filter((r) => inRange(r.date, range))
  const pending = db.paymentRequests.filter((r) => r.status === 'Pending')
  const approved = db.paymentRequests.filter((r) => r.status === 'Approved')
  const openQuotes = db.quotations.filter((q) => ['Draft', 'Sent'].includes(q.status))
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  // Every slab a project has reached that its payments do not yet cover — what to call the client about.
  const toCollect = db.projects.flatMap((project) => {
    const paid = db.payments.filter((p) => p.projectId === project.id).reduce((sum, p) => sum + p.amount, 0)
    return withCollection(paymentSchedule(project, db.settings), paid)
      .filter((row) => row.reached && !row.collected)
      .map((row) => ({ project, row }))
  })
  const toCollectTotal = toCollect.reduce((sum, { row }) => sum + (row.outstanding ?? 0), 0)

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="Accounts — quotations, payment requests and client payments."
        actions={<PeriodSwitch />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Collected" value={formatCurrency(paymentsIn.reduce((s, p) => s + p.amount, 0), true)} sub={`${paymentsIn.length} payment${paymentsIn.length === 1 ? '' : 's'} ${when}`} tone="green" icon="rupee" />
        <StatTile label="Requests Raised" value={pad2(requestsRaised.length)} sub={`${formatCurrency(requestsRaised.reduce((s, r) => s + r.amount, 0), true)} ${when}`} icon="doc" />
        <StatTile label="Outstanding" value={formatCurrency(contracted - received, true)} tone="amber" />
        <StatTile
          label="Requests Pending" value={pad2(pending.length)}
          tone={pending.length ? 'amber' : 'green'} to="/accounts/payment-requests"
        />
      </div>

      <Section
        title="Payments to Collect"
        description="Payment slabs projects have reached that the client has not paid yet. You are told on your bell as each one falls due."
        className="mt-6"
        actions={toCollect.length > 0 && (
          <span className="text-sm font-semibold tabular-nums text-amber-700">
            {toCollect.length} slab{toCollect.length === 1 ? '' : 's'} due{toCollectTotal > 0 && ` · ${formatCurrency(toCollectTotal)}`}
          </span>
        )}
      >
        {toCollect.length === 0 ? (
          <EmptyState title="Nothing to collect right now." />
        ) : (
          <Table head={['Project', 'Slab', 'Due since', 'Amount']}>
            {toCollect.map(({ project, row }) => (
              <tr key={`${project.id}-${row.key}`} className="row-hover">
                <td className="td">
                  <Link to={`/projects/${project.id}?tab=accounts`} className="font-medium text-stone-900 hover:text-brand-700">{project.name}</Link>
                  <span className="block text-xs text-stone-400">{project.code} · {clientName(project.clientId)}</span>
                </td>
                <td className="td">
                  <Badge tone={row.stage === 'Design' ? 'green' : 'blue'}>{row.stage}</Badge>
                  <span className="ml-2 font-medium text-stone-800">{row.label}</span>
                  <span className="ml-1 text-xs tabular-nums text-stone-400">{row.percent}%</span>
                </td>
                <td className="td text-stone-600">{row.dueWhen}</td>
                <td className="td tabular-nums">
                  {row.outstanding === undefined ? (
                    <span className="text-stone-400">Value not set</span>
                  ) : (
                    <>
                      {formatCurrency(row.outstanding)}
                      {row.outstanding < (row.amount ?? 0) && <span className="block text-xs text-stone-400">of {formatCurrency(row.amount ?? 0)}</span>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Collection Progress" className="mt-6">
        <div className="px-5 py-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-stone-600">
              {formatCurrency(received)} of {formatCurrency(contracted)} collected
            </span>
            <span className="text-lg font-bold tabular-nums text-brand-700">
              {Math.round((received / contracted) * 100)}%
            </span>
          </div>
          <ProgressBar value={(received / contracted) * 100} />
        </div>
      </Section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section
          title="Payment Requests"
          actions={<Link to="/accounts/payment-requests" className="text-sm font-semibold text-brand-700">View all</Link>}
        >
          {pending.length + approved.length === 0 ? (
            <EmptyState title="No open requests." />
          ) : (
            <Table head={['Project', 'Amount', 'Date', 'Status']}>
              {[...pending, ...approved].map((request) => {
                const project = db.projects.find((p) => p.id === request.projectId)
                return (
                  <tr key={request.id} className="row-hover">
                    <td className="td font-medium text-stone-900">{project?.name}</td>
                    <td className="td tabular-nums">{formatCurrency(request.amount)}</td>
                    <td className="td tabular-nums">{formatDate(request.date)}</td>
                    <td className="td"><StatusBadge status={request.status} /></td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Section>

        <Section
          title="Open BOQs & Quotations"
          actions={<Link to="/accounts/quotations" className="text-sm font-semibold text-brand-700">View all</Link>}
        >
          {openQuotes.length === 0 ? (
            <EmptyState title="No open BOQs or quotations." />
          ) : (
            <Table head={['Number', 'Client', 'Value', 'Status']}>
              {openQuotes.map((quote) => (
                <tr key={quote.id} className="row-hover">
                  <td className="td font-medium text-stone-900">{quote.number}</td>
                  <td className="td">{clientName(quote.clientId)}</td>
                  <td className="td tabular-nums">
                    {formatCurrency(quote.items.reduce((s, i) => s + i.quantity * i.rate, 0))}
                  </td>
                  <td className="td"><StatusBadge status={quote.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </div>
  )
}
