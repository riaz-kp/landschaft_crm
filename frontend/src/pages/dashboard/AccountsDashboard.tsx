import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate, pad2 } from '../../domain/format'
import {
  PageHeader, Section, StatTile, StatusBadge, Table, EmptyState, ProgressBar,
} from '../../components/ui'

/** Arshad and Anaswara's view. Materials and procurement are out of scope. */
export function AccountsDashboard() {
  const db = useDb()
  const { user } = useSession()

  const contracted = db.projects.reduce((sum, p) => sum + p.value, 0)
  const received = db.payments.reduce((sum, p) => sum + p.amount, 0)
  const pending = db.paymentRequests.filter((r) => r.status === 'Pending')
  const approved = db.paymentRequests.filter((r) => r.status === 'Approved')
  const openQuotes = db.quotations.filter((q) => ['Draft', 'Sent'].includes(q.status))
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="Accounts — quotations, payment requests and client payments."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Contracted" value={formatCurrency(contracted, true)} />
        <StatTile label="Received" value={formatCurrency(received, true)} tone="green" />
        <StatTile label="Outstanding" value={formatCurrency(contracted - received, true)} tone="amber" />
        <StatTile
          label="Requests Pending" value={pad2(pending.length)}
          tone={pending.length ? 'amber' : 'green'} to="/accounts/payment-requests"
        />
      </div>

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
          title="Open Quotations"
          actions={<Link to="/accounts/quotations" className="text-sm font-semibold text-brand-700">View all</Link>}
        >
          {openQuotes.length === 0 ? (
            <EmptyState title="No open quotations." />
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
