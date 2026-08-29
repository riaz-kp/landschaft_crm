import { useState } from 'react'
import { useDb } from '../../state/useDb'
import { formatCurrency, formatDate } from '../../domain/format'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, StatTile,
} from '../../components/ui'
import { Icon } from '../../components/Icon'

export function Quotations() {
  const db = useDb()
  const [expanded, setExpanded] = useState<string | null>(null)

  const total = (id: string) => {
    const quote = db.quotations.find((q) => q.id === id)
    return quote?.items.reduce((sum, item) => sum + item.quantity * item.rate, 0) ?? 0
  }
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="Quotations" subtitle="Priced proposals issued to clients." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total" value={db.quotations.length} />
        <StatTile label="Accepted" value={db.quotations.filter((q) => q.status === 'Accepted').length} tone="green" />
        <StatTile label="Sent" value={db.quotations.filter((q) => q.status === 'Sent').length} tone="amber" />
        <StatTile
          label="Accepted Value"
          value={formatCurrency(
            db.quotations.filter((q) => q.status === 'Accepted').reduce((s, q) => s + total(q.id), 0), true,
          )}
          tone="green"
        />
      </div>

      <Section>
        {db.quotations.length === 0 ? (
          <EmptyState title="No quotations." />
        ) : (
          <Table head={['Number', 'Project', 'Client', 'Date', 'Value', 'Status', '']}>
            {db.quotations.map((quote) => (
              <>
                <tr key={quote.id} className="row-hover">
                  <td className="td font-medium text-stone-900">{quote.number}</td>
                  <td className="td">{projectName(quote.projectId)}</td>
                  <td className="td">{clientName(quote.clientId)}</td>
                  <td className="td tabular-nums">{formatDate(quote.date)}</td>
                  <td className="td font-semibold tabular-nums">{formatCurrency(total(quote.id))}</td>
                  <td className="td"><StatusBadge status={quote.status} /></td>
                  <td className="td">
                    <button
                      onClick={() => setExpanded(expanded === quote.id ? null : quote.id)}
                      className="flex items-center gap-1 text-sm font-semibold text-brand-700"
                    >
                      {expanded === quote.id ? 'Hide' : 'Items'}
                      <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${expanded === quote.id ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                </tr>
                {expanded === quote.id && (
                  <tr key={quote.id + '-items'}>
                    <td colSpan={7} className="bg-stone-50 px-4 py-3">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="th">Description</th>
                            <th className="th text-right">Qty</th>
                            <th className="th">Unit</th>
                            <th className="th text-right">Rate</th>
                            <th className="th text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quote.items.map((item, i) => (
                            <tr key={i}>
                              <td className="td">{item.description}</td>
                              <td className="td text-right tabular-nums">{item.quantity}</td>
                              <td className="td">{item.unit}</td>
                              <td className="td text-right tabular-nums">{formatCurrency(item.rate)}</td>
                              <td className="td text-right font-medium tabular-nums">
                                {formatCurrency(item.quantity * item.rate)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
