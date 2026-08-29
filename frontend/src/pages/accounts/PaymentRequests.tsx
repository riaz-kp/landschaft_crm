import { useDb } from '../../state/useDb'
import { formatCurrency, formatDate } from '../../domain/format'
import { PHASE_LABELS, type PhaseKey } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, StatTile, Badge,
} from '../../components/ui'

export function PaymentRequests() {
  const db = useDb()
  const requests = [...db.paymentRequests].sort((a, b) => b.date.localeCompare(a.date))

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'
  const staffName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'
  const pending = requests.filter((r) => r.status === 'Pending')

  return (
    <div>
      <PageHeader
        title="Payment Requests"
        subtitle="Raised against a phase milestone, approved, then paid."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Pending" value={pending.length} tone={pending.length ? 'amber' : 'green'} />
        <StatTile label="Approved" value={requests.filter((r) => r.status === 'Approved').length} tone="blue" />
        <StatTile label="Paid" value={requests.filter((r) => r.status === 'Paid').length} tone="green" />
        <StatTile
          label="Pending Value"
          value={formatCurrency(pending.reduce((s, r) => s + r.amount, 0), true)}
          tone="amber"
        />
      </div>

      <Section>
        {requests.length === 0 ? (
          <EmptyState title="No payment requests." />
        ) : (
          <Table head={['Project', 'Phase', 'Amount', 'Requested By', 'Date', 'Note', 'Status']}>
            {requests.map((request) => (
              <tr key={request.id} className="row-hover">
                <td className="td font-medium text-stone-900">{projectName(request.projectId)}</td>
                <td className="td">
                  {request.phase
                    ? <Badge tone="stone">{PHASE_LABELS[request.phase as PhaseKey]}</Badge>
                    : '—'}
                </td>
                <td className="td font-semibold tabular-nums">{formatCurrency(request.amount)}</td>
                <td className="td">{staffName(request.requestedBy)}</td>
                <td className="td tabular-nums">{formatDate(request.date)}</td>
                <td className="td max-w-xs truncate">{request.note ?? '—'}</td>
                <td className="td"><StatusBadge status={request.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
