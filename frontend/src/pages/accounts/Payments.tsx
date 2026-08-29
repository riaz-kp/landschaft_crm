import { useDb } from '../../state/useDb'
import { formatCurrency, formatDate } from '../../domain/format'
import {
  PageHeader, Section, Table, EmptyState, StatTile, Badge, ProgressBar,
} from '../../components/ui'

export function Payments() {
  const db = useDb()
  const payments = [...db.payments].sort((a, b) => b.date.localeCompare(a.date))

  const contracted = db.projects.reduce((sum, p) => sum + p.value, 0)
  const received = payments.reduce((sum, p) => sum + p.amount, 0)
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="Payments" subtitle="Money received from clients, by project." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Contracted" value={formatCurrency(contracted, true)} />
        <StatTile label="Received" value={formatCurrency(received, true)} tone="green" />
        <StatTile label="Outstanding" value={formatCurrency(contracted - received, true)} tone="amber" />
        <StatTile label="Payments" value={payments.length} />
      </div>

      <Section title="Project Financial Summary" className="mb-6">
        <div className="grid gap-x-8 gap-y-5 px-5 py-5 md:grid-cols-2">
          {db.projects.map((project) => {
            const paid = payments
              .filter((p) => p.projectId === project.id)
              .reduce((s, p) => s + p.amount, 0)
            const percent = project.value ? (paid / project.value) * 100 : 0
            return (
              <div key={project.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-stone-800">{project.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-stone-500">
                    {formatCurrency(paid, true)} / {formatCurrency(project.value, true)}
                  </span>
                </div>
                <ProgressBar value={percent} tone={percent >= 100 ? 'green' : 'amber'} size="sm" />
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Received Payments">
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded." />
        ) : (
          <Table head={['Date', 'Client', 'Project', 'Method', 'Reference', 'Amount']}>
            {payments.map((payment) => (
              <tr key={payment.id} className="row-hover">
                <td className="td tabular-nums font-medium text-stone-900">{formatDate(payment.date)}</td>
                <td className="td">{clientName(payment.clientId)}</td>
                <td className="td">{projectName(payment.projectId)}</td>
                <td className="td"><Badge tone="stone">{payment.method}</Badge></td>
                <td className="td font-mono text-xs">{payment.reference}</td>
                <td className="td font-semibold tabular-nums">{formatCurrency(payment.amount)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
