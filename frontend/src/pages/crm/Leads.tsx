import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { formatDate } from '../../domain/format'
import type { LeadStatus } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, Badge,
} from '../../components/ui'

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Site Visit', 'Quoted', 'Won', 'Lost']

/** Leads → Clients → Site Visits is the first of the five connected systems. */
export function Leads() {
  const db = useDb()
  const [filter, setFilter] = useState<LeadStatus | 'All'>('All')

  const leads = filter === 'All' ? db.leads : db.leads.filter((l) => l.status === filter)
  const ownerName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Enquiries from first contact through to a won or lost decision."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['All', ...STATUSES] as const).map((status) => {
          const count = status === 'All'
            ? db.leads.length
            : db.leads.filter((l) => l.status === status).length
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-brand-600 text-white'
                  : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {status} <span className="tabular-nums opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      <Section>
        {leads.length === 0 ? (
          <EmptyState title="No leads in this stage." />
        ) : (
          <Table head={['Lead', 'Location', 'Source', 'Requirement', 'Owner', 'Status', '']}>
            {leads.map((lead) => (
              <tr key={lead.id} className="row-hover">
                <td className="td">
                  <span className="font-medium text-stone-900">{lead.name}</span>
                  <span className="block text-xs text-stone-400">
                    {lead.phone} · {formatDate(lead.createdAt)}
                  </span>
                </td>
                <td className="td">{lead.location}</td>
                <td className="td"><Badge tone="stone">{lead.source}</Badge></td>
                <td className="td max-w-xs truncate" title={lead.requirement}>{lead.requirement}</td>
                <td className="td">{ownerName(lead.ownerId)}</td>
                <td className="td">
                  <select
                    value={lead.status}
                    onChange={(e) => api.leads.setStatus(lead.id, e.target.value as LeadStatus)}
                    className="input py-1 text-xs"
                    aria-label={`Status for ${lead.name}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="td">
                  {lead.status === 'Won' && !lead.clientId ? (
                    <button onClick={() => api.leads.convert(lead.id)} className="btn-secondary py-1 text-xs">
                      Create client
                    </button>
                  ) : lead.clientId ? (
                    <StatusBadge status="Won" />
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
